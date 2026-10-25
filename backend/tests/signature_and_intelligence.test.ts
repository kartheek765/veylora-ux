process.env.NODE_ENV = 'test';
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import { db, initDatabase } from '../src/db/index.js';
import { IntentClassifierService } from '../src/services/intentClassifierService.js';
import { LanguageService } from '../src/services/languageService.js';
import { KnowledgeBaseService } from '../src/services/knowledgeBaseService.js';
import { IntentDetectiveService } from '../src/services/intentDetectiveService.js';
import { EvidenceGuardService } from '../src/services/evidenceGuardService.js';
import { apiRoutes } from '../src/routes/api.js';

describe('Veylora UX — Signature Feature & Ask Veylora Intelligence Tests', () => {
  before(() => {
    initDatabase();
  });

  // 1. Database Migrations
  describe('DATABASE — Additive Migration v3 Integrity', () => {
    it('applies Migration 3 without resetting or dropping existing tables', () => {
      const migrations = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version ASC').all() as any[];
      const versions = migrations.map(m => m.version);
      
      assert.ok(versions.includes(1) || versions.length >= 2, 'Migration 1 or 2 must exist');
      assert.ok(versions.includes(3), 'Migration 3 must be applied');

      // Verify detective_investigations table exists
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='detective_investigations'").get() as any;
      assert.strictEqual(tableInfo.name, 'detective_investigations');

      // Verify findings table has investigation_id column
      const cols = db.pragma('table_info(findings)') as Array<{ name: string }>;
      assert.ok(cols.some(c => c.name === 'investigation_id'), 'findings.investigation_id column must exist');
    });
  });

  // 2. Intent Classification
  describe('INTENT CLASSIFICATION — Screen Context Separation', () => {
    it('classifies "What is Playwright?" as GENERAL_KNOWLEDGE and suppresses screen context', () => {
      const result = IntentClassifierService.classify('What is Playwright?');
      assert.strictEqual(result.intent, 'GENERAL_KNOWLEDGE');
      assert.strictEqual(result.isScreenContextRelevant, false, 'Screen context must NOT be relevant for general concepts');
    });

    it('classifies "Explain this screen" as CURRENT_SCREEN and activates screen context', () => {
      const result = IntentClassifierService.classify('Explain this screen and its controls');
      assert.strictEqual(result.intent, 'CURRENT_SCREEN');
      assert.strictEqual(result.isScreenContextRelevant, true, 'Screen context MUST be relevant when explicitly asked');
    });

    it('classifies "How do I create a project?" as HOW_TO_NAVIGATE and provides workflow regardless of current screen', () => {
      const result = IntentClassifierService.classify('How do I create a project?');
      assert.strictEqual(result.intent, 'HOW_TO_NAVIGATE');
      assert.strictEqual(result.isScreenContextRelevant, false, 'Screen context must NOT override global navigation guides');
    });

    it('classifies "Why did this run fail?" as RUN_FINDING_ANALYSIS', () => {
      const result = IntentClassifierService.classify('Why did this run fail?');
      assert.strictEqual(result.intent, 'RUN_FINDING_ANALYSIS');
    });

    it('classifies "What is the weather?" as GENERAL_KNOWLEDGE without hallucinating screen controls', () => {
      const result = IntentClassifierService.classify('What is the weather in Hyderabad?');
      assert.strictEqual(result.intent, 'GENERAL_KNOWLEDGE');
      assert.strictEqual(result.isScreenContextRelevant, false);
    });
  });

  // 3. Multilingual Detection & Directives (Telugu, Tanglish, English)
  describe('MULTILINGUAL — Telugu Script, Tanglish, and English Support', () => {
    it('detects Telugu script when user types Telugu Unicode characters', () => {
      const res = LanguageService.detectLanguage('ప్రాజెక్ట్ ఎలా క్రియేట్ చేయాలి?');
      assert.strictEqual(res.language, 'te-Telu');
    });

    it('detects conversational Tanglish when user writes Telugu in Latin characters', () => {
      const res1 = LanguageService.detectLanguage('Bro, project ela create cheyyali?');
      const res2 = LanguageService.detectLanguage('Naaku ee run results cheppu bro');
      const res3 = LanguageService.detectLanguage('Ekkada click cheyyali?');
      
      assert.strictEqual(res1.language, 'te-Latn');
      assert.strictEqual(res2.language, 'te-Latn');
      assert.strictEqual(res3.language, 'te-Latn');
    });

    it('detects English when user writes plain English', () => {
      const res = LanguageService.detectLanguage('How do I configure allowed domains?');
      assert.strictEqual(res.language, 'en');
    });

    it('honors explicit language override requests', () => {
      assert.strictEqual(LanguageService.detectLanguage('Explain this in Telugu: తెలుగులో చెప్పు').language, 'te-Telu');
      assert.strictEqual(LanguageService.detectLanguage('Tanglish lo cheppu bro').language, 'te-Latn');
      assert.strictEqual(LanguageService.detectLanguage('Answer in English please').language, 'en');
    });

    it('provides localized Tanglish fallback for how-to questions', () => {
      const fallback = KnowledgeBaseService.generateFallbackAnswer(
        'project ela create cheyyali?',
        '/findings',
        undefined,
        'te-Latn'
      );
      assert.ok(fallback.includes('Project create cheyyadaniki'), 'Fallback must contain natural Tanglish phrasing');
      assert.ok(fallback.includes('New Project'), 'Must preserve exact UI label "New Project"');
    });

    it('provides localized Telugu script fallback for Telugu questions', () => {
      const fallback = KnowledgeBaseService.generateFallbackAnswer(
        'ప్రాజెక్ట్ ఎలా చేయాలి?',
        '/runs',
        undefined,
        'te-Telu'
      );
      assert.ok(/[\u0C00-\u0C7F]/.test(fallback), 'Fallback must contain authentic Telugu Unicode script');
      assert.ok(fallback.includes('New Project'), 'Must preserve exact UI label');
    });
  });

  // 4. Grounded Knowledge Source
  describe('KNOWLEDGE SOURCE — Accurate Routes and Steps', () => {
    it('returns exact step-by-step navigation for project creation regardless of current route', () => {
      const answerFromSettings = KnowledgeBaseService.generateFallbackAnswer(
        'How do I create a project?',
        '/settings'
      );
      assert.ok(answerFromSettings.includes('Projects'), 'Must mention Projects navigation');
      assert.ok(answerFromSettings.includes('New Project'), 'Must mention New Project button');
      assert.ok(answerFromSettings.includes('/projects'), 'Must reference route /projects');
      assert.ok(!answerFromSettings.startsWith('You are currently on the Settings screen'), 'Must not force current screen onto general navigation');
    });

    it('explains the current screen accurately when explicitly requested', () => {
      const screenAnswer = KnowledgeBaseService.generateFallbackAnswer(
        'Explain this screen',
        '/detective'
      );
      assert.ok(screenAnswer.includes('Intent-to-Failure Detective'), 'Must describe the Intent Detective screen');
      assert.ok(screenAnswer.includes('journey'), 'Must describe journey failure investigation');
    });
  });

  // 5. Intent-to-Failure Detective
  describe('FEATURE 1 — Intent-to-Failure Detective', () => {
    it('converts a natural language goal into a structured journey specification', () => {
      const spec = IntentDetectiveService.generateJourneySpec({
        projectId: 'proj-1',
        naturalGoal: 'A new customer should find a product and reach checkout'
      });

      assert.strictEqual(spec.goal, 'A new customer should find a product and reach checkout');
      assert.ok(spec.orderedSteps.length >= 3, 'Must have at least 3 ordered steps');
      assert.ok(spec.orderedSteps.some(s => s.actionType === 'click'), 'Must have click actions');
      assert.ok(spec.expectedOutcomes.length > 0, 'Must have expected outcomes');
      assert.ok(spec.failureConditions.length > 0, 'Must have failure conditions');
      assert.strictEqual(spec.hasConsequentialActions, true, 'Checkout must be flagged as consequential');
      assert.ok(spec.consequentialWarning?.includes('Consequential'), 'Must display consequential warning');
    });

    it('creates a draft investigation that requires user approval before execution', () => {
      const inv = IntentDetectiveService.createDraftInvestigation({
        projectId: 'proj-1',
        naturalGoal: 'A visitor should submit a contact form successfully'
      });

      assert.strictEqual(inv.status, 'draft');
      assert.strictEqual(inv.is_approved_by_user, 0, 'Must start as not approved');
      assert.ok(inv.id.startsWith('inv-'));

      // Approve investigation
      const approved = IntentDetectiveService.approveInvestigation(inv.id);
      assert.strictEqual(approved, true);

      const refreshed = IntentDetectiveService.getInvestigation(inv.id);
      assert.strictEqual(refreshed?.status, 'approved');
      assert.strictEqual(refreshed?.is_approved_by_user, 1);
    });

    it('creates a verified retest baseline link for before/after comparison', () => {
      const baseline = IntentDetectiveService.createDraftInvestigation({
        projectId: 'proj-1',
        naturalGoal: 'A user should be able to create an account'
      });

      const retest = IntentDetectiveService.createRetest(baseline.id);
      assert.strictEqual(retest.baseline_investigation_id, baseline.id);
      assert.ok(retest.natural_goal.includes('Retest:'));
      assert.strictEqual(retest.is_approved_by_user, 1, 'Retest is approved for execution');
    });
  });

  // 6. Evidence Guard & Privacy Safeguards
  describe('PRIVACY & GUARDRAILS — Evidence Confidence and Redaction', () => {
    it('prevents AI heuristics from self-promoting to VERIFIED status', () => {
      const sanitized = EvidenceGuardService.sanitizeAndClassifyFinding({
        title: 'Possible checkout latency bottleneck',
        category: 'performance',
        severity: 'moderate',
        confidence: 'high',
        observedFacts: 'AI simulated impression of page latency',
        pageUrl: 'https://staging.apexflow.dev/checkout',
        isHeuristic: true,
        proposedVerificationStatus: 'VERIFIED' // Attempted self-promotion
      });

      assert.notStrictEqual(sanitized.verificationStatus, 'VERIFIED', 'AI finding must NEVER self-promote to VERIFIED');
      assert.strictEqual(sanitized.verificationStatus, 'AI_HYPOTHESIS');
    });

    it('redacts passwords, tokens, and credit cards before storing evidence', () => {
      const sensitive = 'User submitted password="SecretPass123!" with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and card 4111 2222 3333 4444';
      const redacted = EvidenceGuardService.redactSensitiveText(sensitive);

      assert.ok(!redacted.includes('SecretPass123!'), 'Password must be redacted');
      assert.ok(!redacted.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'JWT must be redacted');
      assert.ok(!redacted.includes('4111 2222 3333 4444'), 'Card must be redacted');
      assert.ok(redacted.includes('[REDACTED_PASSWORD]'));
      assert.ok(redacted.includes('[REDACTED_CARD]'));
    });
  });

  // 7. Instant URL Auto-Audit (Zero AI Credits + Direct Execution)
  describe('INSTANT AUTO-AUDIT — Safe Provisioning & Headless Execution', () => {
    let app: any;

    before(async () => {
      app = Fastify();
      await app.register(apiRoutes, { prefix: '/api' });
    });

    it('rejects requests with missing or empty URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/assistant/quick-audit',
        payload: {}
      });
      assert.strictEqual(res.statusCode, 400);
      const data = res.json();
      assert.ok(data.error.includes('URL is required'));
    });

    it('rejects cloud metadata and prohibited destinations via SSRF guard', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/assistant/quick-audit',
        payload: { url: 'http://169.254.169.254/latest/meta-data' }
      });
      assert.strictEqual(res.statusCode, 400);
      const data = res.json();
      assert.ok(data.error.toLowerCase().includes('blocked') || data.error.toLowerCase().includes('cloud metadata'));
    });

    it('auto-provisions project, smoke scenario, and launches headless run for valid URL', async () => {
      const targetUrl = 'https://staging.acme-corp.dev/login';
      const res = await app.inject({
        method: 'POST',
        url: '/api/assistant/quick-audit',
        payload: { url: targetUrl }
      });

      assert.strictEqual(res.statusCode, 201);
      const data = res.json();

      assert.strictEqual(data.success, true);
      assert.ok(data.runId.startsWith('run-'));
      assert.ok(data.projectId.startsWith('proj-'));
      assert.strictEqual(data.targetUrl, targetUrl);
      assert.strictEqual(data.hostname, 'staging.acme-corp.dev');
      assert.ok(data.agentCount >= 1);

      // Verify Project record in SQLite
      const proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(data.projectId) as any;
      assert.ok(proj, 'Project must be created in SQLite');
      assert.strictEqual(proj.source_url, targetUrl);
      assert.ok(proj.allowed_domains.includes('staging.acme-corp.dev'));

      // Verify Scenario record in SQLite with deterministic steps (Zero AI Credits)
      const scen = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(data.scenarioId) as any;
      assert.ok(scen, 'Scenario must exist');
      const steps = JSON.parse(scen.steps);
      assert.strictEqual(steps.length, 5);
      assert.strictEqual(steps[0].actionType, 'goto');
      assert.strictEqual(steps[0].value, targetUrl);

      // Verify Run record in SQLite
      const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(data.runId) as any;
      assert.ok(run, 'Run must exist');
      assert.strictEqual(run.project_id, data.projectId);
      assert.strictEqual(run.action_budget, 15);
      assert.strictEqual(run.browser, 'chromium');
    });

    it('reuses existing project when auditing another URL on same hostname', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/assistant/quick-audit',
        payload: { url: 'https://staging.acme-corp.dev/dashboard' }
      });

      assert.strictEqual(res.statusCode, 201);
      const data = res.json();
      const existingProj = db.prepare("SELECT * FROM projects WHERE source_url LIKE '%staging.acme-corp.dev%'").get() as any;
      assert.strictEqual(data.projectId, existingProj.id, 'Should reuse existing project for same hostname');
    });
  });
});
