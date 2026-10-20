import { db } from '../db/index.js';
import { FingerprintService } from './fingerprintService.js';
import { LifecycleStatus, VerificationStatus } from '../types/canonical.js';

export interface FindingComparisonResult {
  fingerprint: string;
  title: string;
  category: string;
  severity: string;
  baselineFindingId?: string;
  currentFindingId?: string;
  lifecycleStatus: LifecycleStatus;
  verificationStatus: VerificationStatus;
  pageUrl: string;
  explanation: string;
}

export interface AuditComparisonSummary {
  comparisonId: string;
  projectId: string;
  baselineRunId: string;
  currentRunId: string;
  baselineStartedAt: string;
  currentStartedAt: string;
  newCount: number;
  persistentCount: number;
  resolvedCount: number;
  recurringCount: number;
  inconclusiveCount: number;
  verifiedFixCount: number;
  results: FindingComparisonResult[];
}

export class RegressionMemoryService {
  /**
   * Processes findings of a completed run to assign stable fingerprints
   * and determine lifecycle status (NEW, PERSISTENT, RECURRING, MATERIALLY_CHANGED)
   * relative to project history.
   */
  static processRunFindings(runId: string): void {
    const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
    if (!run) return;

    const findings = db.prepare('SELECT * FROM findings WHERE run_id = ?').all(runId) as any[];
    if (findings.length === 0) return;

    const now = new Date().toISOString();

    const updateTx = db.transaction(() => {
      for (const finding of findings) {
        const fingerprint = FingerprintService.generateFingerprint(
          finding.category,
          finding.page_url,
          finding.selector_summary || finding.title,
          finding.rule_id
        );

        // Find historical records of this fingerprint in previous runs of this project
        const prior = db.prepare(`
          SELECT * FROM findings 
          WHERE project_id = ? AND fingerprint = ? AND run_id != ?
          ORDER BY created_at DESC LIMIT 1
        `).get(run.project_id, fingerprint, runId) as any;

        let lifecycleStatus: LifecycleStatus = 'NEW';
        let firstSeenAt = now;

        if (prior) {
          firstSeenAt = prior.first_seen_at || prior.created_at;

          if (prior.lifecycle_status === 'RESOLVED' || prior.resolved_at) {
            lifecycleStatus = 'RECURRING';
          } else if (prior.severity !== finding.severity) {
            lifecycleStatus = 'MATERIALLY_CHANGED';
          } else {
            lifecycleStatus = 'PERSISTENT';
          }
        }

        // Default verification status based on whether it came from heuristic or deterministic source
        const verificationStatus: VerificationStatus = finding.is_heuristic === 1 ? 'AI_HYPOTHESIS' : 'NEEDS_REVIEW';

        db.prepare(`
          UPDATE findings 
          SET fingerprint = ?, 
              lifecycle_status = ?, 
              verification_status = ?, 
              first_seen_at = ?, 
              last_seen_at = ?
          WHERE id = ?
        `).run(fingerprint, lifecycleStatus, verificationStatus, firstSeenAt, now, finding.id);
      }
    });

    updateTx();
  }

  /**
   * Compares two audits (runs) of the same project.
   * Accurately distinguishes confirmed fixes from inconclusive observations.
   */
  static compareAudits(baselineRunId: string, currentRunId: string): AuditComparisonSummary {
    const baselineRun = db.prepare('SELECT * FROM runs WHERE id = ?').get(baselineRunId) as any;
    const currentRun = db.prepare('SELECT * FROM runs WHERE id = ?').get(currentRunId) as any;

    if (!baselineRun) throw new Error(`Baseline run ${baselineRunId} not found`);
    if (!currentRun) throw new Error(`Current run ${currentRunId} not found`);
    if (baselineRun.project_id !== currentRun.project_id) {
      throw new Error('Cannot compare audits across different projects');
    }

    const baselineFindings = db.prepare('SELECT * FROM findings WHERE run_id = ?').all(baselineRunId) as any[];
    const currentFindings = db.prepare('SELECT * FROM findings WHERE run_id = ?').all(currentRunId) as any[];

    const currentByFingerprint = new Map<string, any>();
    for (const cf of currentFindings) {
      const fp = cf.fingerprint || FingerprintService.generateFingerprint(cf.category, cf.page_url, cf.selector_summary || cf.title, cf.rule_id);
      currentByFingerprint.set(fp, cf);
    }

    const baselineByFingerprint = new Map<string, any>();
    for (const bf of baselineFindings) {
      const fp = bf.fingerprint || FingerprintService.generateFingerprint(bf.category, bf.page_url, bf.selector_summary || bf.title, bf.rule_id);
      baselineByFingerprint.set(fp, bf);
    }

    const results: FindingComparisonResult[] = [];
    let newCount = 0;
    let persistentCount = 0;
    let resolvedCount = 0;
    let recurringCount = 0;
    let inconclusiveCount = 0;
    let verifiedFixCount = 0;

    // 1. Process all baseline findings
    for (const [fp, bf] of baselineByFingerprint.entries()) {
      if (currentByFingerprint.has(fp)) {
        const cf = currentByFingerprint.get(fp);
        const materiallyChanged = cf.severity !== bf.severity;
        const status: LifecycleStatus = materiallyChanged ? 'MATERIALLY_CHANGED' : 'PERSISTENT';
        persistentCount++;

        results.push({
          fingerprint: fp,
          title: cf.title,
          category: cf.category,
          severity: cf.severity,
          baselineFindingId: bf.id,
          currentFindingId: cf.id,
          lifecycleStatus: status,
          verificationStatus: cf.verification_status || 'NEEDS_REVIEW',
          pageUrl: cf.page_url,
          explanation: materiallyChanged
            ? `Issue persists, but severity changed from ${bf.severity} to ${cf.severity}.`
            : `Issue remains active across both audits with matching fingerprint.`
        });
      } else {
        // Finding in baseline is NOT in current run.
        // Check if current run completed successfully and actually tested this page.
        const currentTestedPages = db.prepare('SELECT DISTINCT url FROM action_events WHERE run_id = ?').all(currentRunId) as Array<{ url: string }>;
        const normBaselinePath = FingerprintService.normalizePath(bf.page_url);
        const wasPageTested = currentTestedPages.some(p => FingerprintService.normalizePath(p.url) === normBaselinePath);

        const currentRunFailed = currentRun.status === 'failed' || currentRun.status === 'cancelled';

        if (currentRunFailed || !wasPageTested) {
          // Incomplete audit or page not visited: must NOT falsely claim resolved!
          inconclusiveCount++;
          results.push({
            fingerprint: fp,
            title: bf.title,
            category: bf.category,
            severity: bf.severity,
            baselineFindingId: bf.id,
            lifecycleStatus: 'NO_LONGER_OBSERVED',
            verificationStatus: 'NEEDS_REVIEW',
            pageUrl: bf.page_url,
            explanation: currentRunFailed
              ? 'Finding was not observed, but current audit ended prematurely (cancelled or failed).'
              : 'Finding was not observed because the current journey did not cover this page.'
          });
        } else {
          // Page was tested and current audit completed without finding this issue!
          resolvedCount++;
          verifiedFixCount++;
          results.push({
            fingerprint: fp,
            title: bf.title,
            category: bf.category,
            severity: bf.severity,
            baselineFindingId: bf.id,
            lifecycleStatus: 'RESOLVED',
            verificationStatus: 'VERIFIED',
            pageUrl: bf.page_url,
            explanation: 'Verified Resolved: The page was re-tested under equivalent test conditions and the defect is no longer detected.'
          });
        }
      }
    }

    // 2. Process findings present in current but not in baseline (NEW or RECURRING)
    for (const [fp, cf] of currentByFingerprint.entries()) {
      if (!baselineByFingerprint.has(fp)) {
        // Check if seen in older runs before baseline
        const older = db.prepare(`
          SELECT id FROM findings 
          WHERE project_id = ? AND fingerprint = ? AND run_id != ? AND run_id != ?
          LIMIT 1
        `).get(currentRun.project_id, fp, baselineRunId, currentRunId);

        const status: LifecycleStatus = older ? 'RECURRING' : 'NEW';
        if (status === 'RECURRING') recurringCount++;
        else newCount++;

        results.push({
          fingerprint: fp,
          title: cf.title,
          category: cf.category,
          severity: cf.severity,
          currentFindingId: cf.id,
          lifecycleStatus: status,
          verificationStatus: cf.verification_status || 'NEEDS_REVIEW',
          pageUrl: cf.page_url,
          explanation: status === 'RECURRING'
            ? 'Recurring Defect: Issue was not present in baseline audit, but was observed in an earlier historical audit.'
            : 'New Finding: Defect detected for the first time in this audit.'
        });
      }
    }

    const comparisonId = `comp-${baselineRunId}-${currentRunId}`;
    const now = new Date().toISOString();

    const summaryJson = JSON.stringify({
      newCount,
      persistentCount,
      resolvedCount,
      recurringCount,
      inconclusiveCount,
      verifiedFixCount,
      totalFindingsBaseline: baselineFindings.length,
      totalFindingsCurrent: currentFindings.length
    });

    // Upsert into audit_comparisons table
    db.prepare(`
      INSERT INTO audit_comparisons (
        id, project_id, baseline_run_id, current_run_id, status, summary_json,
        new_count, persistent_count, resolved_count, recurring_count, created_at
      ) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        summary_json = excluded.summary_json,
        new_count = excluded.new_count,
        persistent_count = excluded.persistent_count,
        resolved_count = excluded.resolved_count,
        recurring_count = excluded.recurring_count,
        created_at = excluded.created_at
    `).run(
      comparisonId,
      currentRun.project_id,
      baselineRunId,
      currentRunId,
      summaryJson,
      newCount,
      persistentCount,
      resolvedCount,
      recurringCount,
      now
    );

    return {
      comparisonId,
      projectId: currentRun.project_id,
      baselineRunId,
      currentRunId,
      baselineStartedAt: baselineRun.started_at,
      currentStartedAt: currentRun.started_at,
      newCount,
      persistentCount,
      resolvedCount,
      recurringCount,
      inconclusiveCount,
      verifiedFixCount,
      results
    };
  }
}
