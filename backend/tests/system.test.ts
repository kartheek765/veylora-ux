process.env.NODE_ENV = 'test';
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../src/db/index.js';
import { ModelUsageService } from '../src/services/modelUsageService.js';
import { ChatHistoryService } from '../src/services/chatHistoryService.js';
import { PlaywrightRunnerService } from '../src/services/playwrightRunnerService.js';
import { KnowledgeBaseService } from '../src/services/knowledgeBaseService.js';
import { AIService } from '../src/services/aiService.js';
import { config } from '../src/config.js';

describe('Veylora UX — Comprehensive Backend & Architecture Tests', () => {
  before(() => {
    initDatabase();
  });

  describe('1. SQLite Persistence & Schema Integrity', () => {
    test('Database initializes with foreign keys enabled and WAL mode', () => {
      const fk = db.pragma('foreign_keys', { simple: true });
      assert.equal(fk, 1, 'Foreign keys pragma must be active');

      const jm = db.pragma('journal_mode', { simple: true });
      assert.equal(String(jm).toLowerCase(), 'wal', 'Journal mode must be WAL');
    });

    test('Initial seed projects and personas exist in database', () => {
      const projects = db.prepare('SELECT * FROM projects').all() as any[];
      assert.ok(projects.length >= 2, 'Default seed projects must exist');

      const personas = db.prepare('SELECT * FROM personas').all() as any[];
      assert.ok(personas.length >= 5, 'Default seed personas must exist');
    });

    test('Enforces foreign key cascade deletion safely', () => {
      const testProjId = `test-fk-proj-${Date.now()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO projects (id, name, source_type, source_url, allowed_domains, viewport, created_at, updated_at)
        VALUES (?, 'Test FK Project', 'website', 'https://staging.test.dev', '[]', 'desktop-1440', ?, ?)
      `).run(testProjId, now, now);

      const testScenId = `test-fk-scen-${Date.now()}`;
      db.prepare(`
        INSERT INTO scenarios (id, project_id, title, natural_goal, starting_url, success_condition, stop_conditions, steps, test_data_fixtures, negative_paths, created_at, updated_at)
        VALUES (?, ?, 'Test Scenario', 'Goal', 'https://staging.test.dev', 'Success', '[]', '[]', '{}', '[]', ?, ?)
      `).run(testScenId, testProjId, now, now);

      // Verify scenario was inserted
      const scenBefore = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(testScenId);
      assert.ok(scenBefore, 'Scenario should exist before project deletion');

      // Delete project
      db.prepare('DELETE FROM projects WHERE id = ?').run(testProjId);

      // Verify cascading deletion removed child scenario
      const scenAfter = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(testScenId);
      assert.equal(scenAfter, undefined, 'Scenario must be cascade deleted when project is removed');
    });
  });

  describe('2. Server-side Model Usage & Rolling 24-Hour Cascade', () => {
    test('Progresses through Stage 1 -> Stage 2 -> Stage 3 -> Exhausted', () => {
      ModelUsageService.resetService('ux_analysis');

      // 1. Initial stage must be 1
      const initial = ModelUsageService.getActiveStage('ux_analysis');
      assert.equal(initial.stage, 1, 'Initial stage must be 1');
      assert.equal(initial.usageInStage, 0);

      // 2. Record 10 successful requests for stage 1
      for (let i = 0; i < 10; i++) {
        ModelUsageService.recordSuccessfulRequest('ux_analysis', 1);
      }

      // Stage 1 is now full (10 credits used), should move to Stage 2
      const stage2 = ModelUsageService.getActiveStage('ux_analysis');
      assert.equal(stage2.stage, 2, 'Must transition to Stage 2 after 10 successful requests');

      // 3. Record 10 successful requests for stage 2
      for (let i = 0; i < 10; i++) {
        ModelUsageService.recordSuccessfulRequest('ux_analysis', 2);
      }

      // Should move to Stage 3
      const stage3 = ModelUsageService.getActiveStage('ux_analysis');
      assert.equal(stage3.stage, 3, 'Must transition to Stage 3 after next 10 successful requests');

      // 4. Record 10 successful requests for stage 3
      for (let i = 0; i < 10; i++) {
        ModelUsageService.recordSuccessfulRequest('ux_analysis', 3);
      }

      // Should now be exhausted
      const exhausted = ModelUsageService.getActiveStage('ux_analysis');
      assert.equal(exhausted.stage, 'exhausted', 'Must enter exhausted stage after Stage 3 limit reached');
    });

    test('Rolling 24-hour window reset recovers primary Stage 1', () => {
      // Advance clock by 25 hours
      const futureTime = new Date(Date.now() + 25 * 60 * 60 * 1000);

      // Active stage should now reset to Stage 1
      const resetStage = ModelUsageService.getActiveStage('ux_analysis', futureTime);
      assert.equal(resetStage.stage, 1, 'Expired 24h rolling window must reset routing back to Stage 1');
      assert.equal(resetStage.usageInStage, 0, 'Reset window must reset successful request counter to 0');
    });
  });

  describe('3. Ask Veylora Chat Persistence & 7-Day TTL Cleanup', () => {
    test('Persists conversations and messages in SQLite with TTL', () => {
      const conv = ChatHistoryService.createConversation('Audit Assistance');
      assert.ok(conv.id.startsWith('conv-'));

      const msg = ChatHistoryService.addMessage(conv.id, 'user', 'Where do I find critical findings?', '/findings');
      assert.ok(msg.id.startsWith('msg-'));

      const fetched = ChatHistoryService.getConversation(conv.id);
      assert.ok(fetched);
      assert.equal(fetched.conversation.title, 'Audit Assistance');
      assert.equal(fetched.messages.length, 1);
      assert.equal(fetched.messages[0].content, 'Where do I find critical findings?');
    });

    test('Automatically purges expired conversations and messages older than 7 days', () => {
      // Insert an artificially expired conversation (8 days ago)
      const expiredConvId = `expired-conv-${Date.now()}`;
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const expiredTimestamp = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // expired yesterday

      db.prepare(`
        INSERT INTO ask_veylora_conversations (id, title, created_at, updated_at, expires_at)
        VALUES (?, 'Expired Chat', ?, ?, ?)
      `).run(expiredConvId, eightDaysAgo, eightDaysAgo, expiredTimestamp);

      db.prepare(`
        INSERT INTO ask_veylora_messages (id, conversation_id, role, content, created_at, expires_at)
        VALUES (?, ?, 'user', 'Old question', ?, ?)
      `).run(`msg-${expiredConvId}`, expiredConvId, eightDaysAgo, expiredTimestamp);

      // Run cleanup sweep
      const cleanup = ChatHistoryService.cleanExpiredConversations();
      assert.ok(cleanup.deletedConversations >= 1, 'Must sweep expired conversations');
      assert.ok(cleanup.deletedMessages >= 1, 'Must sweep expired messages');

      // Verify conversation can no longer be retrieved
      const check = ChatHistoryService.getConversation(expiredConvId);
      assert.equal(check, null, 'Expired conversation must not be retrievable via API');
    });
  });

  describe('4. Playwright Domain Safety & Validation', () => {
    test('Validates domain allowlist with exact and wildcard matching', () => {
      const allowedDomains = ['staging.apexflow.dev', '*.lumina-craft.com'];

      // Exact match
      assert.equal(PlaywrightRunnerService.isDomainAllowed('https://staging.apexflow.dev/login', allowedDomains), true);

      // Wildcard subdomains
      assert.equal(PlaywrightRunnerService.isDomainAllowed('https://shop.lumina-craft.com/cart', allowedDomains), true);
      assert.equal(PlaywrightRunnerService.isDomainAllowed('https://auth.staging.lumina-craft.com', allowedDomains), true);

      // Localhost is always allowed
      assert.equal(PlaywrightRunnerService.isDomainAllowed('http://localhost:3000', allowedDomains), true);
      assert.equal(PlaywrightRunnerService.isDomainAllowed('http://127.0.0.1:8080/app', allowedDomains), true);

      // Unauthorized external domains must be blocked
      assert.equal(PlaywrightRunnerService.isDomainAllowed('https://malicious-external-site.com', allowedDomains), false);
      assert.equal(PlaywrightRunnerService.isDomainAllowed('https://evil-apexflow.dev', allowedDomains), false);
    });
  });

  describe('5. Knowledge Base & Grounded Product Guidance', () => {
    test('Provides accurate knowledge for all primary application routes', () => {
      const routes = ['/', '/projects', '/personas', '/scenarios', '/runs', '/findings', '/comparisons', '/reports', '/settings'];
      for (const r of routes) {
        const info = KnowledgeBaseService.getScreenKnowledge(r);
        assert.ok(info.name, `Route ${r} must have a name`);
        assert.ok(info.keyControls.length > 0, `Route ${r} must define key controls`);
        assert.ok(info.commonWorkflows.length > 0, `Route ${r} must define workflows`);
      }
    });

    test('Generates helpful, grounded local fallback response when AI is offline', () => {
      const response = KnowledgeBaseService.getLocalHelpResponse('What does this button do?', '/findings');
      assert.ok(response.includes('UX Findings'), 'Response must explain findings screen');
      assert.ok(response.includes('Severity Filter') || response.includes('Controls'), 'Must reference actual controls');

      const createProjResponse = KnowledgeBaseService.getLocalHelpResponse('How do I create a project?', '/projects');
      assert.ok(createProjResponse.includes('Allowed Domains'), 'Must mention domain allowlist requirements');
    });

    test('Ask Veylora executes with graceful local fallback if API key is not configured', async () => {
      const origKey = config.geminiApiKey;
      try {
        (config as any).geminiApiKey = '';
        const result = await AIService.askVeylora('How do I test a website?', '/runs', 'Active tab: All Runs');
        assert.ok(result.answer.length > 0, 'Answer must not be empty');
        assert.equal(result.isFallback, true, 'Must return fallback response when no API key configured');
      } finally {
        (config as any).geminiApiKey = origKey;
      }
    });

    test('Natural-language test plan generator returns structured steps', async () => {
      const origKey = config.geminiApiKey;
      try {
        (config as any).geminiApiKey = '';
        const plan = await AIService.generateTestPlan({
          naturalGoal: 'Test user onboarding form',
          startingUrl: 'https://staging.test.dev/signup',
          allowedDomains: ['staging.test.dev']
        });

        assert.ok(plan.steps.length > 0, 'Must produce test plan steps');
        assert.ok(plan.steps[0].actionType, 'Step must have actionType');
        assert.equal(plan.steps[0].stepNumber, 1, 'First step must be number 1');
      } finally {
        (config as any).geminiApiKey = origKey;
      }
    });
  });
});
