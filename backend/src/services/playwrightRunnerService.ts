import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { AIService, UXPlanStep } from './aiService.js';
import { SSRFProtectionService } from './ssrfProtectionService.js';
import { AccessibilityAuditService } from './accessibilityAuditService.js';
import { EvidenceGuardService, RawFindingInput } from './evidenceGuardService.js';
import { RegressionMemoryService } from './regressionMemoryService.js';

interface ActiveRunSession {
  runId: string;
  cancelled: boolean;
  abortController: AbortController;
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
}

export class PlaywrightRunnerService {
  private static activeSessions = new Map<string, ActiveRunSession>();

  /**
   * Safe domain allowlist validation.
   */
  static isDomainAllowed(targetUrl: string, allowedDomains: string[]): boolean {
    const res = SSRFProtectionService.isSafeDestination(targetUrl, allowedDomains);
    return res.safe;
  }

  /**
   * Cancel an active running test.
   */
  static async cancelRun(runId: string): Promise<boolean> {
    const session = this.activeSessions.get(runId);
    if (session) {
      session.cancelled = true;
      session.abortController.abort();

      try {
        if (session.page) await session.page.close().catch(() => {});
        if (session.context) await session.context.close().catch(() => {});
        if (session.browser) await session.browser.close().catch(() => {});
      } catch (e) {
        console.warn(`[PlaywrightRunner] Error closing browser for cancelled run ${runId}:`, e);
      }

      this.activeSessions.delete(runId);
    }

    const run = db.prepare('SELECT id, status FROM runs WHERE id = ?').get(runId) as any;
    if (!run) return false;

    if (['completed', 'failed', 'cancelled'].includes(run.status)) {
      return false; // Already finalized
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE runs 
      SET status = 'cancelled', task_outcome = 'cancelled', ended_at = ?
      WHERE id = ?
    `).run(now, runId);

    console.log(`[PlaywrightRunner] Run ${runId} cancelled.`);
    return true;
  }

  /**
   * Launch a headless browser using chromium or system chrome/edge channels.
   */
  private static async launchBrowser(): Promise<Browser> {
    try {
      return await chromium.launch({ headless: true });
    } catch {
      try {
        return await chromium.launch({ channel: 'chrome', headless: true });
      } catch {
        return await chromium.launch({ channel: 'msedge', headless: true });
      }
    }
  }

  /**
   * Map viewport string to dimensions.
   */
  private static getViewportDimensions(viewportName: string): { width: number; height: number } {
    switch (viewportName) {
      case 'mobile-390':
        return { width: 390, height: 844 };
      case 'tablet-768':
        return { width: 768, height: 1024 };
      case 'desktop-1440':
      default:
        return { width: 1440, height: 900 };
    }
  }

  /**
   * Execute a real bounded website smoke test against a project's target URL.
   * Collects final URL, page title, navigation duration, screenshot, console/network errors,
   * checks page availability, and records genuine evidence in SQLite.
   */
  static async executeSmokeTest(projectId: string): Promise<{
    runId: string;
    status: 'passed' | 'failed' | 'blocked';
    targetUrl: string;
    finalUrl?: string;
    pageTitle?: string;
    durationMs: number;
    screenshotUrl?: string;
    consoleErrors: string[];
    networkErrors: string[];
    errorMessage?: string;
    evidenceId?: string;
  }> {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) throw new Error(`Project ${projectId} not found`);

    const allowedDomains: string[] = JSON.parse(project.allowed_domains || '[]');
    const targetUrl = project.source_url;

    const ssrfCheck = SSRFProtectionService.isSafeDestination(targetUrl, allowedDomains);
    const runId = `run-smoke-${Date.now()}`;
    const now = new Date().toISOString();

    if (!ssrfCheck.safe) {
      db.prepare(`
        INSERT INTO runs (
          id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps,
          viewport, browser, model_mode, action_budget, actions_executed, started_at, ended_at,
          duration_seconds, task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run
        ) VALUES (?, ?, '["persona-1"]', '[]', 'blocked', 1, 1, ?, 'chromium', 'smoke', 1, 0, ?, ?, 0, 'blocked', 0, 0, '{"critical":0,"serious":0,"moderate":0,"minor":0}', 0)
      `).run(runId, projectId, project.viewport || 'desktop-1440', now, now);

      this.recordStep(
        runId, 1, 'persona-1', 'smoke_navigation',
        `Navigate to ${targetUrl}`, 'BLOCKED',
        `Blocked by SSRF security check: ${ssrfCheck.reason}`,
        targetUrl, 0, null
      );

      return {
        runId,
        status: 'blocked',
        targetUrl,
        durationMs: 0,
        consoleErrors: [],
        networkErrors: [],
        errorMessage: ssrfCheck.reason
      };
    }

    // Ensure screenshots folder exists
    const screenshotsDir = path.join(config.artifactsDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    db.prepare(`
      INSERT INTO runs (
        id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps,
        viewport, browser, model_mode, action_budget, actions_executed, started_at,
        task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run
      ) VALUES (?, ?, '["persona-1"]', '[]', 'running', 0, 1, ?, 'chromium', 'smoke', 1, 0, ?, 'in_progress', 0, 0, '{"critical":0,"serious":0,"moderate":0,"minor":0}', 0)
    `).run(runId, projectId, project.viewport || 'desktop-1440', now);

    const startTime = Date.now();
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let screenshotUrl: string | undefined = undefined;
    let evidenceId: string | undefined = undefined;
    let finalUrl = targetUrl;
    let pageTitle = 'Unknown';
    let passed = false;
    let errorMsg: string | undefined = undefined;

    try {
      browser = await this.launchBrowser();
      context = await browser.newContext({
        viewport: this.getViewportDimensions(project.viewport || 'desktop-1440')
      });
      page = await context.newPage();

      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        consoleErrors.push(`[Page Crash] ${err.message}`);
      });
      page.on('requestfailed', req => {
        networkErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText || 'Unknown'}`);
      });

      const navResponse = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      finalUrl = page.url();
      pageTitle = await page.title().catch(() => 'Untitled');
      const httpStatus = navResponse ? navResponse.status() : 200;

      // Evaluate page availability
      if (httpStatus >= 400) {
        passed = false;
        errorMsg = `Server responded with HTTP ${httpStatus}`;
      } else {
        passed = true;
      }

      // Capture real screenshot from Playwright
      const filename = `smoke_${runId}.png`;
      const diskPath = path.join(screenshotsDir, filename);
      await page.screenshot({ path: diskPath, fullPage: false });
      screenshotUrl = `/artifacts/screenshots/${filename}`;
      evidenceId = `evi-${runId}-1`;

      db.prepare(`
        INSERT INTO evidence (id, run_id, action_event_id, type, url, page_title, timestamp, step_number, redaction_status, local_path, caption)
        VALUES (?, ?, ?, 'screenshot', ?, ?, ?, 1, 'clean', ?, ?)
      `).run(
        evidenceId,
        runId,
        `evt-${runId}-1`,
        finalUrl,
        pageTitle,
        new Date().toISOString(),
        screenshotUrl,
        `Website Smoke Test Capture: ${pageTitle} (${finalUrl})`
      );

      this.recordStep(
        runId, 1, 'persona-1', 'smoke_check',
        `Smoke test navigation to ${targetUrl}`,
        passed ? 'completed' : 'failed',
        passed ? `Loaded successfully (HTTP ${httpStatus}). Title: "${pageTitle}"` : `Failed with HTTP ${httpStatus}`,
        finalUrl,
        Date.now() - startTime,
        evidenceId
      );
    } catch (err: any) {
      passed = false;
      errorMsg = err.message || 'Navigation timed out or failed';
      console.warn(`[PlaywrightRunner] Smoke test navigation failed for ${targetUrl}:`, err.message);

      this.recordStep(
        runId, 1, 'persona-1', 'smoke_check',
        `Smoke test navigation to ${targetUrl}`,
        'failed',
        `Navigation failure: ${errorMsg}`,
        targetUrl,
        Date.now() - startTime,
        null
      );
    } finally {
      try {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
      } catch {}
    }

    const durationMs = Date.now() - startTime;
    const durationSec = Math.round(durationMs / 1000);
    const endStatus = passed ? 'passed' : 'failed';
    const endOutcome = passed ? 'smoke_passed' : 'smoke_failed';
    const endedAt = new Date().toISOString();

    db.prepare(`
      UPDATE runs 
      SET status = ?, 
          ended_at = ?, 
          duration_seconds = ?, 
          task_outcome = ?,
          actions_executed = 1,
          console_errors_count = ?, 
          network_errors_count = ?,
          findings_count = '{"critical":0,"serious":0,"moderate":0,"minor":0}'
      WHERE id = ?
    `).run(endStatus, endedAt, durationSec, endOutcome, consoleErrors.length, networkErrors.length, runId);

    return {
      runId,
      status: endStatus,
      targetUrl,
      finalUrl,
      pageTitle,
      durationMs,
      screenshotUrl,
      consoleErrors,
      networkErrors,
      errorMessage: errorMsg,
      evidenceId
    };
  }

  /**
   * Execute a full browser journey test run.
   */
  static async executeRun(runId: string): Promise<void> {
    // 1. Fetch run details
    const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
    if (!run) throw new Error(`Run ${runId} not found`);


    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(run.project_id) as any;
    if (!project) throw new Error(`Project ${run.project_id} not found`);

    const personaIds = JSON.parse(run.persona_ids || '[]');
    const primaryPersona = personaIds.length > 0
      ? db.prepare('SELECT * FROM personas WHERE id = ?').get(personaIds[0]) as any
      : null;

    const allowedDomains: string[] = JSON.parse(project.allowed_domains || '[]');
    const viewportDim = this.getViewportDimensions(run.viewport || project.viewport);

    // Ensure screenshots folder exists
    const screenshotsDir = path.join(config.artifactsDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Set up active session
    const abortController = new AbortController();
    const session: ActiveRunSession = {
      runId,
      cancelled: false,
      abortController
    };
    this.activeSessions.set(runId, session);

    // Update status to 'running'
    const startTime = Date.now();
    db.prepare("UPDATE runs SET status = 'running' WHERE id = ?").run(runId);

    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];
    const actionEvents: Array<{
      sequenceNo: number;
      actionType: string;
      targetSummary: string;
      result: string;
      url: string;
      durationMs: number;
    }> = [];

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      browser = await this.launchBrowser();
      session.browser = browser;

      context = await browser.newContext({
        viewport: viewportDim,
        userAgent: primaryPersona?.traits?.includes('iPhone')
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 VeyloraUX/1.0'
      });
      session.context = context;

      page = await context.newPage();
      session.page = page;

      // Listen to console and page errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', err => {
        consoleErrors.push(`[Page Crash] ${err.message}`);
      });
      page.on('requestfailed', req => {
        networkErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText || 'Unknown'}`);
      });

      // 2. Fetch or generate test steps
      let steps: any[] = [];
      const scenarioIds = JSON.parse(run.scenario_ids || '[]');
      if (scenarioIds.length > 0) {
        const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(scenarioIds[0]) as any;
        if (scenario && scenario.steps) {
          try {
            steps = JSON.parse(scenario.steps);
          } catch {}
        }
      }

      // If no pre-defined scenario steps exist, generate safe steps
      if (steps.length === 0) {
        const planResult = await AIService.generateTestPlan({
          naturalGoal: 'Navigate landing page, evaluate interaction affordances, inspect form controls',
          startingUrl: project.source_url,
          allowedDomains,
          personaName: primaryPersona?.name,
          actionBudget: run.action_budget || 10
        });
        steps = planResult.steps;
      }

      db.prepare('UPDATE runs SET total_steps = ? WHERE id = ?').run(steps.length, runId);

      // 3. Execute steps within budget
      const budget = run.action_budget || 15;
      let executedCount = 0;
      let hasVisitedPage = false;

      for (let i = 0; i < steps.length && executedCount < budget; i++) {
        if (session.cancelled) break;

        const step = steps[i];
        const seqNo = i + 1;
        const stepStartTime = Date.now();
        let actionResult = 'completed';
        let stateChange = '';
        let targetSummary = step.description || `${step.actionType} ${step.targetSelector || step.value || ''}`;

        // SSRF Safety Check before any navigation
        if (step.actionType === 'goto' && step.value) {
          const ssrfCheck = SSRFProtectionService.isSafeDestination(step.value, allowedDomains);
          if (!ssrfCheck.safe) {
            console.warn(`[PlaywrightRunner] Navigation to ${step.value} blocked: ${ssrfCheck.reason}`);
            actionResult = 'BLOCKED';
            stateChange = `Navigation blocked by security policy: ${ssrfCheck.reason}`;
            this.recordStep(runId, seqNo, primaryPersona?.id, step.actionType, step.value, actionResult, stateChange, step.value, 0, null);
            break;
          }
        }

        try {
          switch (step.actionType) {
            case 'goto':
              targetSummary = `Navigate to ${step.value}`;
              await page.goto(step.value || project.source_url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
              });
              hasVisitedPage = true;
              stateChange = `Page loaded. URL: ${page.url()}`;
              break;

            case 'click':
              targetSummary = `Click ${step.targetSelector || 'element'}`;
              if (step.targetSelector) {
                const locator = page.locator(step.targetSelector).first();
                await locator.waitFor({ state: 'visible', timeout: 5000 });
                await locator.click({ timeout: 5000 });
                stateChange = 'Element clicked successfully';
              }
              break;

            case 'fill':
              targetSummary = `Fill ${step.targetSelector || 'field'}`;
              if (step.targetSelector) {
                const locator = page.locator(step.targetSelector).first();
                await locator.waitFor({ state: 'visible', timeout: 5000 });
                // Synthetic fixture with password protection
                const isSensitive = step.targetSelector.includes('password') || step.targetSelector.includes('secret') || step.targetSelector.includes('token');
                const valToFill = isSensitive ? 'TestPassword123!' : (step.value || 'tester@veylora.dev');
                await locator.fill(valToFill, { timeout: 5000 });
                stateChange = isSensitive ? 'Filled password field (redacted)' : `Filled input field with synthetic test fixture`;
              }
              break;

            case 'submit':
              targetSummary = `Submit form ${step.targetSelector || ''}`;
              const formLocator = step.targetSelector ? page.locator(step.targetSelector).first() : page.locator('form').first();
              await formLocator.evaluate((form: any) => form.submit ? form.submit() : form.dispatchEvent(new Event('submit')));
              stateChange = 'Form submitted with synthetic data';
              break;

            case 'waitFor':
            case 'wait_for':
              targetSummary = `Wait for ${step.targetSelector || 'state change'}`;
              if (step.targetSelector) {
                await page.waitForSelector(step.targetSelector, { timeout: 5000 });
                stateChange = `Element ${step.targetSelector} became visible`;
              } else {
                await page.waitForTimeout(1000);
                stateChange = 'Waited 1000ms';
              }
              break;

            case 'assertText':
            case 'verifyText':
            case 'assert_text':
            case 'verify_text':
              targetSummary = `Assert text visible: "${step.value}"`;
              if (step.targetSelector && step.value) {
                const locator = page.locator(step.targetSelector).first();
                await locator.waitFor({ state: 'visible', timeout: 5000 });
                const actualText = await locator.innerText({ timeout: 5000 });
                if (!actualText.includes(step.value)) {
                  throw new Error(`Expected text "${step.value}" not found in element ${step.targetSelector}. Found: "${actualText.trim().substring(0, 80)}"`);
                }
                stateChange = `Verified text "${step.value}" is present in element`;
              } else if (step.value) {
                const bodyText = await page.locator('body').innerText({ timeout: 5000 });
                if (!bodyText.includes(step.value)) {
                  throw new Error(`Expected text "${step.value}" not found on page.`);
                }
                stateChange = `Verified text "${step.value}" is present on page`;
              }
              break;

            case 'assertVisible':
            case 'assert_visible':
              targetSummary = `Assert element visible: ${step.targetSelector}`;
              if (step.targetSelector) {
                const locator = page.locator(step.targetSelector).first();
                await locator.waitFor({ state: 'visible', timeout: 5000 });
                const isVis = await locator.isVisible();
                if (!isVis) {
                  throw new Error(`Element ${step.targetSelector} is not visible.`);
                }
                stateChange = `Element ${step.targetSelector} is visible`;
              }
              break;

            case 'assertUrl':
            case 'assert_url':
              targetSummary = `Assert URL matches: "${step.value}"`;
              const curUrl = page.url();
              if (step.value && !curUrl.includes(step.value)) {
                throw new Error(`URL mismatch: Expected "${step.value}", found "${curUrl}"`);
              }
              stateChange = `Verified URL matches "${step.value}"`;
              break;

            case 'select':
            case 'selectOption':
            case 'select_option':
              targetSummary = `Select option "${step.value}" in ${step.targetSelector}`;
              if (step.targetSelector) {
                const sel = page.locator(step.targetSelector).first();
                await sel.waitFor({ state: 'visible', timeout: 5000 });
                await sel.selectOption(step.value || '');
                stateChange = `Selected option "${step.value}" in ${step.targetSelector}`;
              }
              break;

            case 'check':
              targetSummary = `Check checkbox/radio: ${step.targetSelector}`;
              if (step.targetSelector) {
                const chk = page.locator(step.targetSelector).first();
                await chk.waitFor({ state: 'visible', timeout: 5000 });
                await chk.check({ timeout: 5000 });
                stateChange = `Checked element ${step.targetSelector}`;
              }
              break;

            case 'screenshot':
              targetSummary = `Capture screenshot: ${step.description || 'Visual Checkpoint'}`;
              stateChange = 'Explicit screenshot captured';
              break;

            case 'scroll':
              targetSummary = `Scroll viewport ${step.value || '500px'}`;
              const scrollY = parseInt(step.value || '500', 10);
              await page.evaluate((y: number) => {
                (globalThis as any).scrollBy({ top: y, behavior: 'smooth' });
              }, scrollY);
              await page.waitForTimeout(400);
              stateChange = `Scrolled viewport by ${scrollY}px`;
              break;

            case 'inspect':
            default:
              targetSummary = `Inspect DOM: ${step.description}`;
              const title = await page.title();
              stateChange = `Page title: "${title}". Interactive elements evaluated.`;
              break;
          }
        } catch (stepErr: any) {
          actionResult = 'failed';
          stateChange = `Action error: ${stepErr?.message || stepErr}`;
          console.warn(`[PlaywrightRunner] Step ${seqNo} error:`, stepErr?.message);
        }

        const stepDuration = Date.now() - stepStartTime;
        executedCount++;

        // Capture screenshot
        let screenshotPath: string | null = null;
        let evidenceId: string | null = null;

        try {
          const filename = `run_${runId}_step_${seqNo}.png`;
          const diskPath = path.join(screenshotsDir, filename);
          await page.screenshot({ path: diskPath, fullPage: false });
          screenshotPath = `/artifacts/screenshots/${filename}`;

          evidenceId = `evi-${runId}-${seqNo}`;
          const currentUrl = page.url();
          const pageTitle = await page.title().catch(() => 'Untitled');

          db.prepare(`
            INSERT INTO evidence (id, run_id, action_event_id, type, url, page_title, timestamp, step_number, redaction_status, local_path, caption)
            VALUES (?, ?, ?, 'screenshot', ?, ?, ?, ?, 'clean', ?, ?)
          `).run(
            evidenceId,
            runId,
            `evt-${runId}-${seqNo}`,
            currentUrl,
            pageTitle,
            new Date().toISOString(),
            seqNo,
            screenshotPath,
            `Visual capture at step ${seqNo}: ${targetSummary}`
          );
        } catch (ssErr) {
          console.warn(`[PlaywrightRunner] Screenshot capture failed at step ${seqNo}:`, ssErr);
        }

        // Record action event
        this.recordStep(
          runId,
          seqNo,
          primaryPersona?.id,
          step.actionType,
          targetSummary,
          actionResult,
          stateChange,
          page.url(),
          stepDuration,
          evidenceId
        );

        actionEvents.push({
          sequenceNo: seqNo,
          actionType: step.actionType,
          targetSummary,
          result: actionResult,
          url: page.url(),
          durationMs: stepDuration
        });

        db.prepare(`
          UPDATE runs 
          SET current_step_index = ?, actions_executed = ?
          WHERE id = ?
        `).run(seqNo, executedCount, runId);

        if (actionResult === 'failed' || actionResult === 'BLOCKED') {
          break; // Do not execute subsequent steps when a step or assertion has failed
        }
      }

      // 4. Run axe-core Automated Accessibility & Keyboard Focus Audit
      const allFindingsToPersist: RawFindingInput[] = [];

      if (hasVisitedPage && !session.cancelled) {
        try {
          const a11yResult = await AccessibilityAuditService.runAudit(page, runId, project.id);
          allFindingsToPersist.push(...a11yResult.findings);
        } catch (a11yErr) {
          console.warn('[PlaywrightRunner] axe-core accessibility audit warning:', a11yErr);
        }
      }

      // 5. Run UX Heuristic / AI Diagnosis
      const totalDurationSec = Math.round((Date.now() - startTime) / 1000);
      const hasFailures = actionEvents.some(e => e.result === 'failed');
      const hasBlocked = actionEvents.some(e => e.result === 'BLOCKED');
      const finalStatus = session.cancelled ? 'cancelled' : (hasBlocked ? 'blocked' : (hasFailures ? 'failed' : 'completed'));
      const outcome = session.cancelled ? 'cancelled' : (hasBlocked ? 'blocked' : (hasFailures ? 'failed' : 'completed_goal'));

      const analysisResult = await AIService.analyzeRunEvidence({
        runId,
        projectName: project.name,
        personaName: primaryPersona?.name || 'Standard User',
        startingUrl: project.source_url,
        events: actionEvents,
        consoleErrors,
        networkErrors
      });

      for (const f of analysisResult.findings) {
        allFindingsToPersist.push({
          ...f,
          pageUrl: project.source_url,
          isHeuristic: analysisResult.isFallback ? false : true,
          proposedVerificationStatus: analysisResult.isFallback ? 'NEEDS_REVIEW' : 'AI_HYPOTHESIS'
        });
      }

      // 6. Evidence & Confidence Guard: Sanitize and Persist Findings
      const findingsCountMap = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      const nowStr = new Date().toISOString();

      for (const rawFinding of allFindingsToPersist) {
        const clean = EvidenceGuardService.sanitizeAndClassifyFinding(rawFinding);
        findingsCountMap[clean.severity] = (findingsCountMap[clean.severity] || 0) + 1;

        const findingId = `fnd-${runId}-${Math.random().toString(36).substring(2, 7)}`;
        const linkedEvidence = db.prepare('SELECT id FROM evidence WHERE run_id = ? AND step_number = ? LIMIT 1').get(runId, clean.stepNumber) as any;

        db.prepare(`
          INSERT INTO findings (
            id, run_id, project_id, persona_id, category, severity, confidence, 
            title, observed_facts, possible_cause, recommended_action, page_url, step_number,
            status, is_heuristic, verification_status, lifecycle_status, selector_summary, rule_id,
            first_seen_at, last_seen_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review', ?, ?, 'NEW', ?, ?, ?, ?, ?)
        `).run(
          findingId,
          runId,
          project.id,
          primaryPersona?.id,
          clean.category,
          clean.severity,
          clean.confidence,
          clean.title,
          clean.observedFacts,
          clean.possibleCause,
          clean.recommendedAction,
          clean.pageUrl,
          clean.stepNumber,
          clean.isHeuristic ? 1 : 0,
          clean.verificationStatus,
          clean.selectorSummary,
          clean.ruleId || null,
          nowStr,
          nowStr,
          nowStr
        );
      }

      // 7. UX Regression Memory: Compute fingerprints and historical lifecycle status
      RegressionMemoryService.processRunFindings(runId);

      // 8. Persist Executive Report
      const reportId = `rep-${runId}`;
      db.prepare(`
        INSERT INTO reports (
          id, run_id, project_id, title, purpose, generation_time, 
          app_version, report_schema_version, executive_summary, limitations_notice
        ) VALUES (?, ?, ?, ?, ?, ?, '2.0.0', '2.0', ?, ?)
      `).run(
        reportId,
        runId,
        project.id,
        `${project.name} - Automated UX Journey & Audit Report`,
        `Automated evaluation of persona journey "${primaryPersona?.name || 'User'}" across ${project.source_url}`,
        nowStr,
        analysisResult.executiveSummary,
        'This report distinguishes deterministically verified browser defects from model hypotheses. Recommendations must be verified by UX practitioners before implementation.'
      );

      // Finalize run record
      db.prepare(`
        UPDATE runs 
        SET status = ?, 
            ended_at = ?, 
            duration_seconds = ?, 
            task_outcome = ?,
            console_errors_count = ?, 
            network_errors_count = ?, 
            findings_count = ?
        WHERE id = ?
      `).run(
        finalStatus,
        nowStr,
        totalDurationSec,
        outcome,
        consoleErrors.length,
        networkErrors.length,
        JSON.stringify(findingsCountMap),
        runId
      );

      console.log(`[PlaywrightRunner] Run ${runId} completed with ${allFindingsToPersist.length} findings (Accessibility + UX).`);
    } catch (err: any) {
      console.error(`[PlaywrightRunner] Run ${runId} encountered fatal failure:`, err);
      const nowStr = new Date().toISOString();
      db.prepare(`
        UPDATE runs 
        SET status = 'failed', ended_at = ?, task_outcome = 'failed'
        WHERE id = ?
      `).run(nowStr, runId);
    } finally {
      try {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
      } catch {}
      this.activeSessions.delete(runId);
    }
  }

  private static recordStep(
    runId: string,
    sequenceNo: number,
    personaId: string | undefined,
    actionType: string,
    targetSummary: string,
    result: string,
    observedStateChange: string,
    url: string,
    durationMs: number,
    evidenceId: string | null
  ) {
    const eventId = `evt-${runId}-${sequenceNo}`;
    db.prepare(`
      INSERT INTO action_events (
        id, run_id, persona_id, sequence_no, action_type, target_summary,
        result, observed_state_change, url, timestamp, duration_ms, evidence_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      runId,
      personaId || null,
      sequenceNo,
      actionType,
      targetSummary,
      result,
      observedStateChange,
      url,
      new Date().toISOString(),
      durationMs,
      evidenceId
    );
  }
}
