import axe from 'axe-core';
import { Page } from 'playwright';
import { db } from '../db/index.js';
import { FingerprintService } from './fingerprintService.js';
import { RawFindingInput, EvidenceGuardService } from './evidenceGuardService.js';

export interface AccessibilityAuditResult {
  runId: string;
  violationsCount: number;
  passesCount: number;
  keyboardCheckStatus: 'pass' | 'warning' | 'fail';
  manualReviewRequiredCount: number;
  violations: Array<{
    ruleId: string;
    description: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    helpUrl: string;
    targetSelector: string;
    htmlSnippet: string;
    failureSummary: string;
  }>;
  findings: RawFindingInput[];
}

export class AccessibilityAuditService {
  /**
   * Injects axe-core and runs automated accessibility + keyboard focus audits on an active page.
   */
  static async runAudit(page: Page, runId: string, projectId: string): Promise<AccessibilityAuditResult> {
    const currentUrl = page.url();
    const pageTitle = await page.title().catch(() => 'Page');

    // 1. Inject axe-core bundle
    await page.evaluate(axe.source);

    // 2. Execute axe.run()
    const axeResults = await page.evaluate(async () => {
      return await (window as any).axe.run({
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'best-practice']
        }
      });
    });

    // 3. Interactive Keyboard Navigation & Focus Ring Check
    const keyboardCheck = await page.evaluate(() => {
      const focusable = Array.from(
        document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')
      ) as HTMLElement[];

      let noFocusRingCount = 0;
      const unthemedElements: string[] = [];

      for (let i = 0; i < Math.min(focusable.length, 12); i++) {
        const el = focusable[i];
        el.focus();
        const style = window.getComputedStyle(el);
        const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
        const hasBoxShadow = style.boxShadow !== 'none' && style.boxShadow.length > 5;

        if (!hasOutline && !hasBoxShadow) {
          noFocusRingCount++;
          unthemedElements.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className ? '.' + el.className.split(' ')[0] : ''));
        }
      }

      return {
        focusableCount: focusable.length,
        noFocusRingCount,
        unthemedElements
      };
    });

    const violationsList: AccessibilityAuditResult['violations'] = [];
    const generatedFindings: RawFindingInput[] = [];

    const now = new Date().toISOString();

    const insertTx = db.transaction(() => {
      for (const v of axeResults.violations) {
        const impact = (v.impact as 'critical' | 'serious' | 'moderate' | 'minor') || 'moderate';

        for (const node of v.nodes) {
          const targetSelector = node.target.join(' > ');
          const htmlSnippet = node.html ? node.html.substring(0, 300) : '';
          const failureSummary = node.failureSummary || v.help;

          const accId = `acc-${runId}-${Math.random().toString(36).substring(2, 7)}`;

          db.prepare(`
            INSERT INTO accessibility_results (
              id, run_id, project_id, rule_id, description, impact,
              help_url, target_selector, html_snippet, failure_summary,
              verification_status, wcag_tags, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?)
          `).run(
            accId,
            runId,
            projectId,
            v.id,
            v.description,
            impact,
            v.helpUrl,
            targetSelector,
            htmlSnippet,
            failureSummary,
            JSON.stringify(v.tags || []),
            now
          );

          violationsList.push({
            ruleId: v.id,
            description: v.description,
            impact,
            helpUrl: v.helpUrl,
            targetSelector,
            htmlSnippet,
            failureSummary
          });

          // Generate an authoritative finding for this verified axe-core violation
          generatedFindings.push({
            title: `WCAG: ${v.help} (${v.id})`,
            category: 'accessibility_contrast',
            severity: impact,
            confidence: 'high',
            observedFacts: `Automated rule "${v.id}" failed on selector \`${targetSelector}\`. Detail: ${failureSummary}`,
            possibleCause: `Element markup or CSS styling violates WCAG accessibility criteria (${v.tags.join(', ')}).`,
            recommendedAction: `Inspect ${v.helpUrl} and update markup: ensure valid accessible names, labels, and color contrast.`,
            pageUrl: currentUrl,
            selectorSummary: targetSelector,
            ruleId: v.id,
            isHeuristic: false,
            proposedVerificationStatus: 'VERIFIED'
          });
        }
      }

      // If keyboard check found missing focus indicators
      if (keyboardCheck.noFocusRingCount > 0) {
        const targetStr = keyboardCheck.unthemedElements.slice(0, 3).join(', ');
        generatedFindings.push({
          title: `Keyboard Focus Indicator Missing on ${keyboardCheck.noFocusRingCount} Elements`,
          category: 'accessibility_contrast',
          severity: 'serious',
          confidence: 'high',
          observedFacts: `During interactive keyboard tab cycling, ${keyboardCheck.noFocusRingCount} interactive controls had outline:none with no fallback focus ring.`,
          possibleCause: 'Global CSS rule removing outline on :focus without providing an accessible :focus-visible replacement.',
          recommendedAction: 'Add visible :focus-visible styling with a minimum 2px solid contrast outline or distinct box-shadow ring.',
          pageUrl: currentUrl,
          selectorSummary: targetStr,
          ruleId: 'keyboard-focus-visible',
          isHeuristic: false,
          proposedVerificationStatus: 'VERIFIED'
        });
      }
    });

    insertTx();

    return {
      runId,
      violationsCount: violationsList.length,
      passesCount: axeResults.passes?.length || 0,
      keyboardCheckStatus: keyboardCheck.noFocusRingCount === 0 ? 'pass' : 'warning',
      manualReviewRequiredCount: axeResults.incomplete?.length || 0,
      violations: violationsList,
      findings: generatedFindings
    };
  }
}
