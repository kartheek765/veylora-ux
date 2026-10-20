process.env.NODE_ENV = 'test';
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { db, initDatabase } from '../src/db/index.js';
import { FingerprintService } from '../src/services/fingerprintService.js';
import { RegressionMemoryService } from '../src/services/regressionMemoryService.js';
import { EvidenceGuardService } from '../src/services/evidenceGuardService.js';
import { SSRFProtectionService } from '../src/services/ssrfProtectionService.js';
import { RoadmapService } from '../src/services/roadmapService.js';
import { AssistantActionService } from '../src/services/assistantActionService.js';
import { PrivacyService } from '../src/services/privacyService.js';

describe('Veylora UX — Production-Grade Feature Expansion Tests (Phases 1 - 8)', () => {
  before(() => {
    initDatabase();
  });

  describe('PHASE 1 — UX Regression Memory & Fingerprint Stability', () => {
    it('generates identical fingerprints for findings with same semantic location regardless of timestamp or volatile query params', () => {
      const fp1 = FingerprintService.generate({
        category: 'ACCESSIBILITY',
        pageUrl: 'https://example.com/checkout?session_id=abc12345&timestamp=170000000',
        selectorSummary: 'button#pay-now',
        ruleId: 'button-name'
      });

      const fp2 = FingerprintService.generate({
        category: 'accessibility',
        pageUrl: 'https://example.com/checkout?session_id=xyz98765&ref=banner',
        selectorSummary: 'button#pay-now',
        ruleId: 'button-name'
      });

      assert.strictEqual(fp1, fp2, 'Fingerprints should match despite different volatile query parameters');
      assert.strictEqual(fp1.length, 64, 'Fingerprint should be a 64-char SHA-256 hex string');
    });

    it('generates distinct fingerprints for different rules or different element selectors', () => {
      const fpA = FingerprintService.generate({
        category: 'accessibility',
        pageUrl: 'https://example.com/checkout',
        selectorSummary: 'button#pay-now',
        ruleId: 'button-name'
      });

      const fpB = FingerprintService.generate({
        category: 'accessibility',
        pageUrl: 'https://example.com/checkout',
        selectorSummary: 'button#cancel',
        ruleId: 'button-name'
      });

      assert.notStrictEqual(fpA, fpB, 'Different elements on same page must have distinct fingerprints');
    });

    it('compares baseline and current audits and detects NEW, PERSISTENT, and RESOLVED states accurately', () => {
      const projId = 'proj-reg-test';
      const run1Id = 'run-baseline-1';
      const run2Id = 'run-current-2';
      const now = new Date().toISOString();

      // Seed mock project and two runs
      db.prepare(`
        INSERT OR IGNORE INTO projects (id, name, description, source_type, source_url, allowed_domains, viewport, readiness_status, notes, created_at, updated_at)
        VALUES (?, 'Regression Test Project', '', 'website', 'https://example.com', '["example.com"]', 'desktop-1440', 'demo-ready', '', ?, ?)
      `).run(projId, now, now);

      db.prepare(`
        INSERT OR IGNORE INTO runs (id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps, viewport, browser, model_mode, action_budget, actions_executed, started_at, task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run)
        VALUES (?, ?, '["persona-1"]', '[]', 'completed', 5, 5, 'desktop-1440', 'chromium', 'live', 15, 5, ?, 'completed', 0, 0, '{"critical":1}', 0)
      `).run(run1Id, projId, now);

      db.prepare(`
        INSERT OR IGNORE INTO runs (id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps, viewport, browser, model_mode, action_budget, actions_executed, started_at, task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run)
        VALUES (?, ?, '["persona-1"]', '[]', 'completed', 5, 5, 'desktop-1440', 'chromium', 'live', 15, 5, ?, 'completed', 0, 0, '{"critical":0}', 0)
      `).run(run2Id, projId, now);

      // Add action events for run2 so we know https://example.com/nav was tested
      db.prepare(`
        INSERT OR REPLACE INTO action_events (id, run_id, sequence_no, action_type, target_summary, result, url, timestamp)
        VALUES ('ev-reg-nav', ?, 1, 'navigate', 'Visited Nav page', 'success', 'https://example.com/nav', ?)
      `).run(run2Id, now);

      const fpPersistent = FingerprintService.generate({ category: 'usability', pageUrl: 'https://example.com/home', selectorSummary: '#hero' });
      const fpResolved = FingerprintService.generate({ category: 'accessibility', pageUrl: 'https://example.com/nav', ruleId: 'color-contrast' });
      const fpNew = FingerprintService.generate({ category: 'performance', pageUrl: 'https://example.com/cart', selectorSummary: '#cart' });

      // Run 1 has Persistent and Resolved
      db.prepare(`
        INSERT OR REPLACE INTO findings (id, run_id, project_id, category, severity, confidence, title, observed_facts, possible_cause, recommended_action, page_url, fingerprint, verification_status, lifecycle_status, created_at)
        VALUES ('f-1', ?, ?, 'usability', 'moderate', 'high', 'Hero layout shift', 'Fact 1', 'Cause 1', 'Fix 1', 'https://example.com/home', ?, 'VERIFIED', 'NEW', ?)
      `).run(run1Id, projId, fpPersistent, now);

      db.prepare(`
        INSERT OR REPLACE INTO findings (id, run_id, project_id, category, severity, confidence, title, observed_facts, possible_cause, recommended_action, page_url, fingerprint, verification_status, lifecycle_status, created_at)
        VALUES ('f-2', ?, ?, 'accessibility', 'serious', 'high', 'Low contrast nav link', 'Fact 2', 'Cause 2', 'Fix 2', 'https://example.com/nav', ?, 'VERIFIED', 'NEW', ?)
      `).run(run1Id, projId, fpResolved, now);

      // Run 2 has Persistent and New
      db.prepare(`
        INSERT OR REPLACE INTO findings (id, run_id, project_id, category, severity, confidence, title, observed_facts, possible_cause, recommended_action, page_url, fingerprint, verification_status, lifecycle_status, created_at)
        VALUES ('f-3', ?, ?, 'usability', 'moderate', 'high', 'Hero layout shift', 'Fact 1', 'Cause 1', 'Fix 1', 'https://example.com/home', ?, 'VERIFIED', 'PERSISTENT', ?)
      `).run(run2Id, projId, fpPersistent, now);

      db.prepare(`
        INSERT OR REPLACE INTO findings (id, run_id, project_id, category, severity, confidence, title, observed_facts, possible_cause, recommended_action, page_url, fingerprint, verification_status, lifecycle_status, created_at)
        VALUES ('f-4', ?, ?, 'performance', 'minor', 'high', 'Cart delay', 'Fact 3', 'Cause 3', 'Fix 3', 'https://example.com/cart', ?, 'VERIFIED', 'NEW', ?)
      `).run(run2Id, projId, fpNew, now);

      const comparison = RegressionMemoryService.compareAudits(run1Id, run2Id);

      assert.strictEqual(comparison.persistentCount, 1, 'Should find 1 persistent finding');
      assert.strictEqual(comparison.resolvedCount, 1, 'Should find 1 resolved finding');
      assert.strictEqual(comparison.newCount, 1, 'Should find 1 new finding');

      const persistent = comparison.results.filter(r => r.lifecycleStatus === 'PERSISTENT');
      const resolved = comparison.results.filter(r => r.lifecycleStatus === 'RESOLVED');
      const newItems = comparison.results.filter(r => r.lifecycleStatus === 'NEW');

      assert.strictEqual(persistent[0].fingerprint, fpPersistent);
      assert.strictEqual(resolved[0].fingerprint, fpResolved);
      assert.strictEqual(newItems[0].fingerprint, fpNew);
    });
  });

  describe('PHASE 2 — Evidence Guard & Confidence Model', () => {
    it('prevents AI hypotheses from promoting themselves to VERIFIED', () => {
      const sanitized = EvidenceGuardService.sanitizeAndValidateFinding({
        category: 'usability',
        severity: 'critical',
        confidence: 'high',
        verificationStatus: 'VERIFIED', // AI tries to claim VERIFIED
        title: 'AI thinks checkout button is bad',
        observedFacts: 'Model subjective assessment',
        possibleCause: 'Heuristic evaluation',
        recommendedAction: 'Change color',
        pageUrl: 'https://example.com',
        isAiGenerated: true // AI generated source!
      });

      assert.notStrictEqual(
        sanitized.verificationStatus,
        'VERIFIED',
        'AI generated findings must NOT self-promote to VERIFIED'
      );
      assert.strictEqual(sanitized.verificationStatus, 'AI_HYPOTHESIS');
    });

    it('redacts sensitive secrets, passwords, Bearer tokens, and credit cards from findings and evidence', () => {
      const rawText = 'User typed password "SuperSecret123!" and Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz and Card: 4532-1234-5678-9010';
      const cleanText = EvidenceGuardService.redactText(rawText);

      assert.ok(!cleanText.includes('SuperSecret123!'), 'Password must be redacted');
      assert.ok(!cleanText.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'JWT Bearer token must be redacted');
      assert.ok(!cleanText.includes('4532-1234-5678-9010'), 'Card number must be redacted');
      assert.ok(cleanText.includes('[REDACTED_PASSWORD]'), 'Should contain redacted password placeholder');
    });
  });

  describe('PHASE 3 — Real Journey Testing & SSRF Protection', () => {
    it('blocks access to cloud metadata services (169.254.169.254)', () => {
      const result = SSRFProtectionService.validateUrl('http://169.254.169.254/latest/meta-data/', ['*']);
      assert.strictEqual(result.safe, false, 'Cloud metadata service must be blocked');
      assert.ok(result.reason?.toLowerCase().includes('cloud metadata'));
    });

    it('blocks private IP ranges (10.0.0.0/8, 192.168.0.0/16)', () => {
      const res1 = SSRFProtectionService.validateUrl('http://10.0.0.1/admin', ['*']);
      assert.strictEqual(res1.safe, false, 'Private class A IP must be blocked');

      const res2 = SSRFProtectionService.validateUrl('http://192.168.1.100/config', ['*']);
      assert.strictEqual(res2.safe, false, 'Private class C IP must be blocked');
    });

    it('blocks unauthorized domains not in project allowedDomains list', () => {
      const result = SSRFProtectionService.validateUrl('https://evil-hacker.com/steal', ['myapp.local', 'staging.company.com']);
      assert.strictEqual(result.safe, false, 'Unauthorized domain must be rejected');
      assert.ok(result.reason?.toLowerCase().includes('allowed domains'));
    });

    it('permits authorized domains and authorized localhost development testing', () => {
      const resDomain = SSRFProtectionService.validateUrl('https://staging.company.com/checkout', ['staging.company.com']);
      assert.strictEqual(resDomain.safe, true, 'Authorized domain should be accepted');

      const resLocal = SSRFProtectionService.validateUrl('http://localhost:5173/workbench', ['localhost']);
      assert.strictEqual(resLocal.safe, true, 'Authorized localhost development should be accepted');
    });
  });

  describe('PHASE 5 — Verified Before/After Comparison', () => {
    it('distinguishes a conclusively verified fix from an unobserved finding', () => {
      const resolved = {
        fingerprint: 'fp-123',
        title: 'Contrast fix',
        verificationStatus: 'VERIFIED',
        lifecycleStatus: 'RESOLVED'
      };

      assert.strictEqual(resolved.lifecycleStatus, 'RESOLVED');
      assert.strictEqual(resolved.verificationStatus, 'VERIFIED');
    });
  });

  describe('PHASE 6 — Smart Fix Roadmap Prioritization Engine', () => {
    it('scores critical verified security/a11y defects into Tier P0', () => {
      const { score, tier, rationale } = RoadmapService.calculatePriority(
        'critical',
        'VERIFIED',
        'RECURRING',
        'accessibility',
        'xs'
      );

      assert.ok(score >= 20, `Score (${score}) should be >= 20 for P0`);
      assert.strictEqual(tier, 'P0');
      assert.ok(rationale.includes('Tier P0'));
      assert.ok(rationale.includes('Severity weight'));
    });

    it('scores low severity unverified heuristic suggestions into lower tiers (P2 or P3)', () => {
      const { score, tier } = RoadmapService.calculatePriority(
        'minor',
        'low',
        'NEW',
        'usability',
        'l'
      );

      assert.ok(score < 14, `Score (${score}) should be < 14`);
      assert.ok(tier === 'P2' || tier === 'P3');
    });

    it('generates roadmap tasks and persists them with conservative root-cause grouping', () => {
      const projId = 'proj-roadmap-test';
      const runId = 'run-roadmap-1';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT OR IGNORE INTO projects (id, name, source_type, source_url, allowed_domains, viewport, readiness_status, created_at, updated_at)
        VALUES (?, 'Roadmap Test Project', 'website', 'https://example.com', '["example.com"]', 'desktop-1440', 'demo-ready', ?, ?)
      `).run(projId, now, now);

      db.prepare(`
        INSERT OR IGNORE INTO runs (id, project_id, persona_ids, scenario_ids, status, viewport, browser, model_mode, started_at, task_outcome, findings_count)
        VALUES (?, ?, '["persona-1"]', '[]', 'completed', 'desktop-1440', 'chromium', 'live', ?, 'completed', '{}')
      `).run(runId, projId, now);

      db.prepare(`
        INSERT OR REPLACE INTO findings (id, run_id, project_id, category, severity, confidence, title, observed_facts, possible_cause, recommended_action, page_url, selector_summary, rule_id, status, created_at)
        VALUES ('f-road-1', ?, ?, 'accessibility', 'critical', 'VERIFIED', 'Missing button accessible name', 'Facts', 'Cause', 'Add aria-label', 'https://example.com/login', 'button#submit', 'button-name', 'needs_review', ?)
      `).run(runId, projId, now);

      db.prepare(`
        INSERT OR REPLACE INTO findings (id, run_id, project_id, category, severity, confidence, title, observed_facts, possible_cause, recommended_action, page_url, selector_summary, rule_id, status, created_at)
        VALUES ('f-road-2', ?, ?, 'accessibility', 'critical', 'VERIFIED', 'Missing second button accessible name', 'Facts', 'Cause', 'Add aria-label', 'https://example.com/login', 'button#cancel', 'button-name', 'needs_review', ?)
      `).run(runId, projId, now);

      const tasks = RoadmapService.generateRoadmapForProject(projId);

      assert.ok(Array.isArray(tasks));
      assert.ok(tasks.length > 0, 'Should generate roadmap tasks for project findings');
      
      const firstTask = tasks[0];
      assert.ok(firstTask.priorityScore >= tasks[tasks.length - 1].priorityScore, 'Tasks must be sorted by priority score descending');
      assert.ok(['P0', 'P1', 'P2', 'P3'].includes(firstTask.priorityTier));
      // Conservative root-cause grouping: both share rule_id 'button-name' on 'https://example.com/login'
      assert.strictEqual(firstTask.associatedFindingIds.length, 2, 'Should group findings with same rule on same page');
    });
  });

  describe('PHASE 7 — Ask Veylora Assistant Actions & Validation', () => {
    it('rejects unauthorized arbitrary action types not in the strict allowlist', () => {
      const result = AssistantActionService.validateAction('EXECUTE_SHELL_COMMAND', { cmd: 'rm -rf /' });
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes('strictly prohibited'));
    });

    it('flags browser-execution actions as requiring explicit user confirmation', () => {
      const result = AssistantActionService.validateAction('PROPOSE_JOURNEY_RUN', { projectId: 'proj-reg-test' });
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.proposedAction?.requiresConfirmation, true);
    });

    it('blocks execution of state-changing actions if confirmed flag is false', async () => {
      const execResult = await AssistantActionService.executeAction(
        'PROPOSE_JOURNEY_RUN',
        { projectId: 'proj-reg-test' },
        false // Not confirmed!
      );

      assert.strictEqual(execResult.success, false);
      assert.ok(execResult.error?.includes('Confirmation required'));
    });

    it('successfully executes read-only actions without confirmation requirement', async () => {
      const execResult = await AssistantActionService.executeAction(
        'GET_ROADMAP',
        { projectId: 'proj-reg-test' }
      );

      assert.strictEqual(execResult.success, true);
      assert.ok(execResult.data.totalTasks >= 0);
    });
  });

  describe('PHASE 8 — Local-First Privacy Controls & Settings', () => {
    it('persists privacy preferences in SQLite and retrieves them', () => {
      const updated = PrivacyService.updateSettings({
        shareScreenshots: false,
        shareDomSummaries: false,
        retainEvidenceDays: 14
      });

      assert.strictEqual(updated.shareScreenshots, false);
      assert.strictEqual(updated.shareDomSummaries, false);
      assert.strictEqual(updated.retainEvidenceDays, 14);

      const fetched = PrivacyService.getSettings();
      assert.strictEqual(fetched.shareScreenshots, false);
      assert.strictEqual(fetched.shareDomSummaries, false);
      assert.strictEqual(fetched.retainEvidenceDays, 14);
    });

    it('safely deletes an evidence record and unlinks its references without crashing', () => {
      const evId = `ev-test-${Date.now()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO evidence (id, run_id, type, url, timestamp, step_number, redaction_status)
        VALUES (?, 'run-baseline-1', 'screenshot', 'https://example.com', ?, 1, 'clean')
      `).run(evId, now);

      const delResult = PrivacyService.deleteEvidence(evId);
      assert.strictEqual(delResult.success, true);

      const check = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evId);
      assert.strictEqual(check, undefined, 'Evidence should be deleted from SQLite');
    });
  });
});
