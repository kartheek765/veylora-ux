import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { ChatHistoryService } from '../services/chatHistoryService.js';
import { AIService } from '../services/aiService.js';
import { PlaywrightRunnerService } from '../services/playwrightRunnerService.js';
import { RegressionMemoryService } from '../services/regressionMemoryService.js';
import { RoadmapService } from '../services/roadmapService.js';
import { AssistantActionService } from '../services/assistantActionService.js';
import { PrivacyService } from '../services/privacyService.js';
import { AccessibilityAuditService } from '../services/accessibilityAuditService.js';
import { IntentDetectiveService } from '../services/intentDetectiveService.js';
import { SSRFProtectionService } from '../services/ssrfProtectionService.js';

export async function apiRoutes(fastify: FastifyInstance) {
  // 1. Health check
  fastify.get('/health', async () => {
    const dbCheck = db.prepare('SELECT 1 as val').get() as { val: number };
    return {
      status: 'ok',
      version: '1.0.0',
      database: dbCheck?.val === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString()
    };
  });

  // 2. System Status
  fastify.get('/system/status', async () => {
    const projectCount = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c;
    const runCount = (db.prepare('SELECT COUNT(*) as c FROM runs').get() as any).c;
    const findingsCount = (db.prepare('SELECT COUNT(*) as c FROM findings').get() as any).c;

    return {
      appName: 'Veylora UX',
      version: '1.0.0',
      environment: config.nodeEnv,
      localOnly: true,
      databasePath: config.dbPath,
      artifactsPath: config.artifactsDir,
      projectCount,
      runCount,
      findingsCount,
      aiConfigured: Boolean(config.geminiApiKey && config.geminiApiKey.trim() !== ''),
      chatTtlDays: config.askVeyloraChatHistoryTtlDays
    };
  });

  // Explicit Demo Mode endpoints
  fastify.post('/demo/seed', async () => {
    const now = new Date().toISOString();
    // Check if demo project 1 exists
    const p1 = db.prepare('SELECT id FROM projects WHERE id = ?').get('proj-1');
    if (!p1) {
      db.prepare(`
        INSERT INTO projects (id, name, description, source_type, source_url, allowed_domains, viewport, readiness_status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'proj-1',
        'ApexFlow Cloud Onboarding (Demo)',
        'Self-serve developer team signup, workspace configuration, and initial API key generation journey.',
        'website',
        'https://staging.apexflow.dev/signup',
        JSON.stringify(['staging.apexflow.dev', 'auth.staging.apexflow.dev']),
        'desktop-1440',
        'demo-ready',
        'Explicitly seeded demo project for feature demonstration.',
        now,
        now
      );
    }

    const p2 = db.prepare('SELECT id FROM projects WHERE id = ?').get('proj-2');
    if (!p2) {
      db.prepare(`
        INSERT INTO projects (id, name, description, source_type, source_url, allowed_domains, viewport, readiness_status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'proj-2',
        'Lumina E-Commerce Checkout (Demo)',
        'Guest shopping bag to order confirmation journey, focusing on address autocomplete and payment method choice.',
        'website',
        'https://staging-shop.lumina-craft.com/cart',
        JSON.stringify(['staging-shop.lumina-craft.com']),
        'mobile-390',
        'demo-ready',
        'Explicitly seeded demo project for mobile checkout simulation.',
        now,
        now
      );
    }

    return { success: true, message: 'Demo projects seeded successfully' };
  });

  fastify.delete('/demo/seed', async () => {
    db.prepare("DELETE FROM projects WHERE id IN ('proj-1', 'proj-2')").run();
    return { success: true, message: 'Demo projects removed' };
  });

  // 3. Projects CRUD
  fastify.get('/projects', async () => {
    const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      sourceType: r.source_type,
      sourceUrl: r.source_url,
      allowedDomains: JSON.parse(r.allowed_domains || '[]'),
      viewport: r.viewport,
      readinessStatus: r.readiness_status,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  });

  fastify.post('/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body || {}) as any;
    if (!body.name || !body.sourceUrl) {
      return reply.status(400).send({ error: 'Name and sourceUrl are required' });
    }

    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return reply.status(400).send({ error: 'Project name must be a non-empty string' });
    }

    // Validate and normalize URL
    const norm = SSRFProtectionService.normalizeUrl(body.sourceUrl);
    if (!norm.valid || !norm.normalized) {
      return reply.status(400).send({ error: norm.error || 'Invalid target website URL' });
    }
    const normalizedUrl = norm.normalized;

    let defaultAllowed = ['localhost'];
    try {
      defaultAllowed = [new URL(normalizedUrl).hostname];
    } catch {}
    const allowedDomains = Array.isArray(body.allowedDomains) && body.allowedDomains.length > 0 ? body.allowedDomains : defaultAllowed;

    // Server-side network and SSRF security validation
    const safety = SSRFProtectionService.isSafeDestination(normalizedUrl, allowedDomains);
    if (!safety.safe) {
      return reply.status(400).send({ error: safety.reason || 'Target URL destination is prohibited by security policy.' });
    }

    const id = `proj-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO projects (id, name, description, source_type, source_url, allowed_domains, viewport, readiness_status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name.trim(),
      body.description || '',
      body.sourceType || 'website',
      normalizedUrl,
      JSON.stringify(allowedDomains),
      body.viewport || 'desktop-1440',
      body.readinessStatus || 'demo-ready',
      body.notes || '',
      now,
      now
    );

    return reply.status(201).send({
      id,
      name: body.name.trim(),
      sourceUrl: normalizedUrl,
      allowedDomains,
      success: true
    });
  });

  fastify.get('/projects/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(request.params.id) as any;
    if (!r) return reply.status(404).send({ error: 'Project not found' });
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      sourceType: r.source_type,
      sourceUrl: r.source_url,
      allowedDomains: JSON.parse(r.allowed_domains || '[]'),
      viewport: r.viewport,
      readinessStatus: r.readiness_status,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  });

  fastify.patch('/projects/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(request.params.id) as any;
    if (!proj) return reply.status(404).send({ error: 'Project not found' });
    const body = (request.body || {}) as any;
    const now = new Date().toISOString();

    let targetUrl = proj.source_url;
    if (body.sourceUrl && body.sourceUrl !== proj.source_url) {
      const norm = SSRFProtectionService.normalizeUrl(body.sourceUrl);
      if (!norm.valid || !norm.normalized) {
        return reply.status(400).send({ error: norm.error || 'Invalid target website URL' });
      }
      targetUrl = norm.normalized;
    }

    const name = body.name !== undefined ? body.name.trim() : proj.name;
    const desc = body.description !== undefined ? body.description : proj.description;
    const allowedDomains = body.allowedDomains ? JSON.stringify(body.allowedDomains) : proj.allowed_domains;
    const viewport = body.viewport || proj.viewport;
    const readinessStatus = body.readinessStatus || proj.readiness_status;
    const notes = body.notes !== undefined ? body.notes : proj.notes;

    db.prepare(`
      UPDATE projects 
      SET name = ?, description = ?, source_url = ?, allowed_domains = ?, viewport = ?, readiness_status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(name, desc, targetUrl, allowedDomains, viewport, readinessStatus, notes, now, request.params.id);

    return { id: request.params.id, success: true };
  });

  fastify.delete('/projects/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const proj = db.prepare('SELECT id FROM projects WHERE id = ?').get(request.params.id);
    if (!proj) return reply.status(404).send({ error: 'Project not found' });
    db.prepare('DELETE FROM projects WHERE id = ?').run(request.params.id);
    return { id: request.params.id, deleted: true, success: true };
  });

  fastify.post('/projects/:id/smoke-test', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const result = await PlaywrightRunnerService.executeSmokeTest(request.params.id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Smoke test failed' });
    }
  });

  // 4. Personas CRUD
  fastify.get('/personas', async () => {
    const rows = db.prepare('SELECT * FROM personas ORDER BY is_template DESC, name ASC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      shortProfile: r.short_profile,
      primaryGoal: r.primary_goal,
      secondaryGoal: r.secondary_goal,
      traits: JSON.parse(r.traits || '{}'),
      enabled: r.enabled === 1,
      version: r.version,
      avatarColor: r.avatar_color,
      isTemplate: r.is_template === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  });

  fastify.post('/personas', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.name || !body.primaryGoal) {
      return reply.status(400).send({ error: 'Name and primaryGoal are required' });
    }

    const id = `persona-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO personas (id, name, short_profile, primary_goal, secondary_goal, traits, enabled, version, avatar_color, is_template, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, 0, ?, ?)
    `).run(
      id,
      body.name.trim(),
      body.shortProfile || '',
      body.primaryGoal.trim(),
      body.secondaryGoal || '',
      JSON.stringify(body.traits || {}),
      body.avatarColor || '#6366F1',
      now,
      now
    );

    return reply.status(201).send({ id, name: body.name, success: true });
  });

  fastify.patch('/personas/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const p = db.prepare('SELECT * FROM personas WHERE id = ?').get(request.params.id) as any;
    if (!p) return reply.status(404).send({ error: 'Persona not found' });

    const body = (request.body || {}) as any;
    const updatedEnabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : p.enabled;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE personas
      SET enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(updatedEnabled, now, request.params.id);

    return { id: request.params.id, enabled: updatedEnabled === 1, success: true };
  });

  fastify.delete('/personas/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const p = db.prepare('SELECT id FROM personas WHERE id = ?').get(request.params.id);
    if (!p) return reply.status(404).send({ error: 'Persona not found' });
    db.prepare('DELETE FROM personas WHERE id = ?').run(request.params.id);
    return { id: request.params.id, deleted: true, success: true };
  });

  // 5. Scenarios & AI Plan Generation
  fastify.get('/scenarios', async (request: FastifyRequest<{ Querystring: { projectId?: string } }>) => {
    let rows: any[];
    if (request.query.projectId) {
      rows = db.prepare('SELECT * FROM scenarios WHERE project_id = ? ORDER BY created_at DESC').all(request.query.projectId);
    } else {
      rows = db.prepare('SELECT * FROM scenarios ORDER BY created_at DESC').all();
    }
    return rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      naturalGoal: r.natural_goal,
      startingUrl: r.starting_url,
      successCondition: r.success_condition,
      actionBudget: r.action_budget,
      timeBudgetSeconds: r.time_budget_seconds,
      stopConditions: JSON.parse(r.stop_conditions || '[]'),
      steps: JSON.parse(r.steps || '[]'),
      testDataFixtures: JSON.parse(r.test_data_fixtures || '{}'),
      negativePaths: JSON.parse(r.negative_paths || '[]'),
      version: r.version,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  });

  fastify.post('/scenarios/generate-plan', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.naturalGoal || !body.startingUrl) {
      return reply.status(400).send({ error: 'naturalGoal and startingUrl are required' });
    }

    let defaultAllowed = ['localhost'];
    try {
      defaultAllowed = [new URL(body.startingUrl).hostname];
    } catch {}

    const plan = await AIService.generateTestPlan({
      naturalGoal: body.naturalGoal,
      startingUrl: body.startingUrl,
      allowedDomains: body.allowedDomains || defaultAllowed,
      personaName: body.personaName,
      actionBudget: body.actionBudget || 10
    });

    return plan;
  });

  fastify.post('/scenarios', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.projectId || !body.title || !body.naturalGoal || !body.startingUrl) {
      return reply.status(400).send({ error: 'projectId, title, naturalGoal, and startingUrl are required' });
    }

    const id = `scen-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO scenarios (
        id, project_id, title, natural_goal, starting_url, success_condition, 
        action_budget, time_budget_seconds, stop_conditions, steps, test_data_fixtures, negative_paths, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      body.projectId,
      body.title,
      body.naturalGoal,
      body.startingUrl,
      body.successCondition || 'Goal reached',
      body.actionBudget || 15,
      body.timeBudgetSeconds || 45,
      JSON.stringify(body.stopConditions || ['404_error', 'unhandled_script_error']),
      JSON.stringify(body.steps || []),
      JSON.stringify(body.testDataFixtures || {}),
      JSON.stringify(body.negativePaths || []),
      now,
      now
    );

    return reply.status(201).send({ id, title: body.title, success: true });
  });

  fastify.get('/scenarios/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const r = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(request.params.id) as any;
    if (!r) return reply.status(404).send({ error: 'Scenario not found' });
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      naturalGoal: r.natural_goal,
      startingUrl: r.starting_url,
      successCondition: r.success_condition,
      actionBudget: r.action_budget,
      timeBudgetSeconds: r.time_budget_seconds,
      stopConditions: JSON.parse(r.stop_conditions || '[]'),
      steps: JSON.parse(r.steps || '[]'),
      testDataFixtures: JSON.parse(r.test_data_fixtures || '{}'),
      negativePaths: JSON.parse(r.negative_paths || '[]'),
      version: r.version,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  });

  fastify.patch('/scenarios/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const scen = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(request.params.id) as any;
    if (!scen) return reply.status(404).send({ error: 'Scenario not found' });
    const body = (request.body || {}) as any;
    const now = new Date().toISOString();

    const title = body.title !== undefined ? body.title : scen.title;
    const naturalGoal = body.naturalGoal !== undefined ? body.naturalGoal : scen.natural_goal;
    const startingUrl = body.startingUrl !== undefined ? body.startingUrl : scen.starting_url;
    const successCondition = body.successCondition !== undefined ? body.successCondition : scen.success_condition;
    const actionBudget = body.actionBudget !== undefined ? body.actionBudget : scen.action_budget;
    const steps = body.steps ? JSON.stringify(body.steps) : scen.steps;

    db.prepare(`
      UPDATE scenarios 
      SET title = ?, natural_goal = ?, starting_url = ?, success_condition = ?, action_budget = ?, steps = ?, updated_at = ?
      WHERE id = ?
    `).run(title, naturalGoal, startingUrl, successCondition, actionBudget, steps, now, request.params.id);

    return { id: request.params.id, success: true };
  });

  fastify.delete('/scenarios/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const scen = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(request.params.id);
    if (!scen) return reply.status(404).send({ error: 'Scenario not found' });
    db.prepare('DELETE FROM scenarios WHERE id = ?').run(request.params.id);
    return { id: request.params.id, deleted: true, success: true };
  });

  // 6. Runs Management & Real Playwright Execution
  fastify.get('/runs', async (request: FastifyRequest<{ Querystring: { projectId?: string } }>) => {
    let rows: any[];
    if (request.query.projectId) {
      rows = db.prepare('SELECT * FROM runs WHERE project_id = ? ORDER BY started_at DESC').all(request.query.projectId);
    } else {
      rows = db.prepare('SELECT * FROM runs ORDER BY started_at DESC').all();
    }
    return rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      personaIds: JSON.parse(r.persona_ids || '[]'),
      scenarioIds: JSON.parse(r.scenario_ids || '[]'),
      status: r.status,
      currentStepIndex: r.current_step_index,
      totalSteps: r.total_steps,
      viewport: r.viewport,
      browser: r.browser,
      modelMode: r.model_mode,
      actionBudget: r.action_budget,
      actionsExecuted: r.actions_executed,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      durationSeconds: r.duration_seconds,
      taskOutcome: r.task_outcome,
      consoleErrorsCount: r.console_errors_count,
      networkErrorsCount: r.network_errors_count,
      findingsCount: JSON.parse(r.findings_count || '{"critical":0,"serious":0,"moderate":0,"minor":0}'),
      isDemoRun: r.is_demo_run === 1
    }));
  });

  fastify.post('/runs', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.projectId) {
      return reply.status(400).send({ error: 'projectId is required' });
    }

    const runId = `run-${Date.now()}`;
    const now = new Date().toISOString();
    const personaIds = Array.isArray(body.personaIds) && body.personaIds.length > 0 ? body.personaIds : ['persona-1'];
    const scenarioIds = Array.isArray(body.scenarioIds) && body.scenarioIds.length > 0 ? body.scenarioIds : [];

    db.prepare(`
      INSERT INTO runs (
        id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps,
        viewport, browser, model_mode, action_budget, actions_executed, started_at,
        task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run
      ) VALUES (?, ?, ?, ?, 'queued', 0, 0, ?, ?, 'live', ?, 0, ?, 'in_progress', 0, 0, '{"critical":0,"serious":0,"moderate":0,"minor":0}', 0)
    `).run(
      runId,
      body.projectId,
      JSON.stringify(personaIds),
      JSON.stringify(scenarioIds),
      body.viewport || 'desktop-1440',
      body.browser || 'chromium',
      body.actionBudget || 15,
      now
    );

    // Launch Playwright asynchronously in background
    PlaywrightRunnerService.executeRun(runId).catch(err => {
      console.error(`[PlaywrightRunner] Error during background run ${runId}:`, err);
    });

    return reply.status(201).send({
      id: runId,
      status: 'queued',
      startedAt: now,
      success: true
    });
  });

  fastify.get('/runs/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const r = db.prepare('SELECT * FROM runs WHERE id = ?').get(request.params.id) as any;
    if (!r) return reply.status(404).send({ error: 'Run not found' });

    const events = db.prepare('SELECT * FROM action_events WHERE run_id = ? ORDER BY sequence_no ASC').all(request.params.id) as any[];
    const evidence = db.prepare('SELECT * FROM evidence WHERE run_id = ? ORDER BY step_number ASC').all(request.params.id) as any[];
    const findings = db.prepare('SELECT * FROM findings WHERE run_id = ? ORDER BY severity ASC').all(request.params.id) as any[];

    return {
      run: {
        id: r.id,
        projectId: r.project_id,
        personaIds: JSON.parse(r.persona_ids || '[]'),
        scenarioIds: JSON.parse(r.scenario_ids || '[]'),
        status: r.status,
        currentStepIndex: r.current_step_index,
        totalSteps: r.total_steps,
        viewport: r.viewport,
        browser: r.browser,
        actionBudget: r.action_budget,
        actionsExecuted: r.actions_executed,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        durationSeconds: r.duration_seconds,
        taskOutcome: r.task_outcome,
        consoleErrorsCount: r.console_errors_count,
        networkErrorsCount: r.network_errors_count,
        findingsCount: JSON.parse(r.findings_count || '{}')
      },
      events: events.map(e => ({
        id: e.id,
        sequenceNo: e.sequence_no,
        actionType: e.action_type,
        targetSummary: e.target_summary,
        result: e.result,
        observedStateChange: e.observed_state_change,
        url: e.url,
        timestamp: e.timestamp,
        durationMs: e.duration_ms,
        evidenceId: e.evidence_id
      })),
      evidence: evidence.map(ev => ({
        id: ev.id,
        type: ev.type,
        url: ev.url,
        pageTitle: ev.page_title,
        timestamp: ev.timestamp,
        stepNumber: ev.step_number,
        localPath: ev.local_path,
        caption: ev.caption
      })),
      findings: findings.map(f => ({
        id: f.id,
        category: f.category,
        severity: f.severity,
        confidence: f.confidence,
        title: f.title,
        observedFacts: f.observed_facts,
        possibleCause: f.possible_cause,
        recommendedAction: f.recommended_action,
        pageUrl: f.page_url,
        stepNumber: f.step_number,
        status: f.status,
        fingerprint: f.fingerprint,
        verificationStatus: f.verification_status || 'NEEDS_REVIEW',
        lifecycleStatus: f.lifecycle_status || 'NEW',
        selectorSummary: f.selector_summary,
        ruleId: f.rule_id,
        firstSeenAt: f.first_seen_at,
        lastSeenAt: f.last_seen_at,
        resolvedAt: f.resolved_at
      }))
    };
  });

  fastify.post('/runs/:id/cancel', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const cancelled = await PlaywrightRunnerService.cancelRun(request.params.id);
    return { id: request.params.id, cancelled, success: true };
  });

  fastify.delete('/runs/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const r = db.prepare('SELECT id FROM runs WHERE id = ?').get(request.params.id);
    if (!r) return reply.status(404).send({ error: 'Run not found' });
    db.prepare('DELETE FROM runs WHERE id = ?').run(request.params.id);
    return { id: request.params.id, deleted: true, success: true };
  });

  // 7. Findings CRUD
  fastify.get('/findings', async (request: FastifyRequest<{ Querystring: { runId?: string; projectId?: string; severity?: string; category?: string; status?: string; verificationStatus?: string; lifecycleStatus?: string } }>) => {
    let query = 'SELECT * FROM findings WHERE 1=1';
    const params: any[] = [];

    if (request.query.runId) {
      query += ' AND run_id = ?';
      params.push(request.query.runId);
    }
    if (request.query.projectId) {
      query += ' AND project_id = ?';
      params.push(request.query.projectId);
    }
    if (request.query.severity) {
      query += ' AND severity = ?';
      params.push(request.query.severity);
    }
    if (request.query.category) {
      query += ' AND category = ?';
      params.push(request.query.category);
    }
    if (request.query.status) {
      query += ' AND status = ?';
      params.push(request.query.status);
    }
    if (request.query.verificationStatus) {
      query += ' AND verification_status = ?';
      params.push(request.query.verificationStatus);
    }
    if (request.query.lifecycleStatus) {
      query += ' AND lifecycle_status = ?';
      params.push(request.query.lifecycleStatus);
    }
    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(f => ({
      id: f.id,
      runId: f.run_id,
      projectId: f.project_id,
      personaId: f.persona_id,
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      title: f.title,
      likelyImpact: f.likely_impact,
      observedFacts: f.observed_facts,
      possibleCause: f.possible_cause,
      recommendedAction: f.recommended_action,
      reproductionNotes: f.reproduction_notes,
      evidenceId: f.evidence_id,
      pageUrl: f.page_url,
      stepNumber: f.step_number,
      status: f.status,
      isHeuristic: f.is_heuristic === 1,
      fingerprint: f.fingerprint,
      verificationStatus: f.verification_status || 'NEEDS_REVIEW',
      lifecycleStatus: f.lifecycle_status || 'NEW',
      selectorSummary: f.selector_summary,
      ruleId: f.rule_id,
      firstSeenAt: f.first_seen_at,
      lastSeenAt: f.last_seen_at,
      resolvedAt: f.resolved_at,
      createdAt: f.created_at
    }));
  });

  fastify.get('/findings/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const f = db.prepare('SELECT * FROM findings WHERE id = ?').get(request.params.id) as any;
    if (!f) return reply.status(404).send({ error: 'Finding not found' });
    return {
      id: f.id,
      runId: f.run_id,
      projectId: f.project_id,
      personaId: f.persona_id,
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      title: f.title,
      likelyImpact: f.likely_impact,
      observedFacts: f.observed_facts,
      possibleCause: f.possible_cause,
      recommendedAction: f.recommended_action,
      reproductionNotes: f.reproduction_notes,
      evidenceId: f.evidence_id,
      pageUrl: f.page_url,
      stepNumber: f.step_number,
      status: f.status,
      isHeuristic: f.is_heuristic === 1,
      fingerprint: f.fingerprint,
      verificationStatus: f.verification_status || 'NEEDS_REVIEW',
      lifecycleStatus: f.lifecycle_status || 'NEW',
      selectorSummary: f.selector_summary,
      ruleId: f.rule_id,
      firstSeenAt: f.first_seen_at,
      lastSeenAt: f.last_seen_at,
      resolvedAt: f.resolved_at,
      createdAt: f.created_at
    };
  });

  fastify.get('/findings/:id/evidence', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const f = db.prepare('SELECT * FROM findings WHERE id = ?').get(request.params.id) as any;
    if (!f) return reply.status(404).send({ error: 'Finding not found' });

    let evidence: any = null;
    if (f.evidence_id) {
      evidence = db.prepare('SELECT * FROM evidence WHERE id = ?').get(f.evidence_id);
    }
    return { findingId: f.id, evidence };
  });

  fastify.patch('/findings/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = (request.body || {}) as any;
    const existing = db.prepare('SELECT * FROM findings WHERE id = ?').get(request.params.id) as any;
    if (!existing) return reply.status(404).send({ error: 'Finding not found' });

    const newStatus = body.status || existing.status;
    const newVerification = body.verificationStatus || existing.verification_status || 'NEEDS_REVIEW';
    const newLifecycle = body.lifecycleStatus || existing.lifecycle_status || 'NEW';
    const resolvedAt = (newStatus === 'resolved' || newLifecycle === 'RESOLVED') ? (existing.resolved_at || new Date().toISOString()) : null;

    db.prepare(`
      UPDATE findings 
      SET status = ?, verification_status = ?, lifecycle_status = ?, resolved_at = ?
      WHERE id = ?
    `).run(newStatus, newVerification, newLifecycle, resolvedAt, request.params.id);

    return {
      id: request.params.id,
      status: newStatus,
      verificationStatus: newVerification,
      lifecycleStatus: newLifecycle,
      resolvedAt,
      success: true
    };
  });

  // 8. Reports & Standalone Exports
  fastify.get('/reports', async (request: FastifyRequest<{ Querystring: { runId?: string; projectId?: string } }>) => {
    let query = 'SELECT * FROM reports WHERE 1=1';
    const params: any[] = [];
    if (request.query.runId) {
      query += ' AND run_id = ?';
      params.push(request.query.runId);
    }
    if (request.query.projectId) {
      query += ' AND project_id = ?';
      params.push(request.query.projectId);
    }
    query += ' ORDER BY generation_time DESC';

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      runId: r.run_id,
      projectId: r.project_id,
      title: r.title,
      purpose: r.purpose,
      generationTime: r.generation_time,
      appVersion: r.app_version,
      reportSchemaVersion: r.report_schema_version,
      executiveSummary: r.executive_summary,
      limitationsNotice: r.limitations_notice
    }));
  });

  fastify.get('/reports/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(request.params.id) as any;
    if (!r) return reply.status(404).send({ error: 'Report not found' });
    return {
      id: r.id,
      runId: r.run_id,
      projectId: r.project_id,
      title: r.title,
      purpose: r.purpose,
      generationTime: r.generation_time,
      appVersion: r.app_version,
      reportSchemaVersion: r.report_schema_version,
      executiveSummary: r.executive_summary,
      limitationsNotice: r.limitations_notice
    };
  });

  fastify.get('/reports/:id/export-html', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(request.params.id) as any;
    if (!report) return reply.status(404).send({ error: 'Report not found' });

    const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(report.run_id) as any;
    const findings = db.prepare('SELECT * FROM findings WHERE run_id = ? ORDER BY severity ASC').all(report.run_id) as any[];

    // Render standalone responsive HTML document with embedded CSS
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title} — Veylora UX Audit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B0F19; color: #F3F4F6; margin: 0; padding: 2.5rem; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; background: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 2.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #6366F1; margin-top: 0; font-size: 1.8rem; }
    .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; margin-right: 0.5rem; }
    .badge-critical { background: rgba(239, 68, 68, 0.2); color: #EF4444; border: 1px solid #EF4444; }
    .badge-serious { background: rgba(245, 158, 11, 0.2); color: #F59E0B; border: 1px solid #F59E0B; }
    .badge-moderate { background: rgba(59, 130, 246, 0.2); color: #3B82F6; border: 1px solid #3B82F6; }
    .badge-minor { background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid #10B981; }
    .summary-box { background: rgba(99, 102, 241, 0.08); border-left: 4px solid #6366F1; padding: 1.25rem; border-radius: 6px; margin: 1.5rem 0; }
    .finding-card { background: #1F2937; border: 1px solid #374151; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem; }
    .finding-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
    .meta-table th, .meta-table td { padding: 0.6rem 0.8rem; border-bottom: 1px solid #374151; text-align: left; font-size: 0.9rem; }
    .meta-table th { color: #9CA3AF; }
    .footer { margin-top: 2rem; font-size: 0.8rem; color: #6B7280; text-align: center; border-top: 1px solid #1F2937; padding-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${report.title}</h1>
    <p style="color: #9CA3AF;">Generated by <strong>Veylora UX</strong> on ${new Date(report.generation_time).toLocaleString()}</p>
    
    <div class="summary-box">
      <h3 style="margin-top:0; color: #818CF8;">Executive Summary</h3>
      <p>${report.executive_summary}</p>
    </div>

    <table class="meta-table">
      <tr><th>Run ID</th><td><code>${run?.id || report.run_id}</code></td></tr>
      <tr><th>Duration</th><td>${run?.duration_seconds || 0} seconds</td></tr>
      <tr><th>Task Outcome</th><td><strong>${run?.task_outcome || 'completed'}</strong></td></tr>
      <tr><th>Console Errors</th><td>${run?.console_errors_count || 0}</td></tr>
      <tr><th>Network Errors</th><td>${run?.network_errors_count || 0}</td></tr>
    </table>

    <h2>Evidence-Linked UX Findings (${findings.length})</h2>
    ${findings.map((f, i) => `
      <div class="finding-card">
        <div class="finding-title">
          <span class="badge badge-${f.severity}">${f.severity}</span>
          <span>#${i + 1} — ${f.title}</span>
        </div>
        <p><strong>Observed Facts:</strong> ${f.observed_facts}</p>
        <p><strong>Possible Cause:</strong> ${f.possible_cause}</p>
        <p><strong>Recommended Action:</strong> ${f.recommended_action}</p>
        <div style="font-size: 0.85rem; color: #9CA3AF;">Category: ${f.category} | Step #${f.step_number} | URL: ${f.page_url}</div>
      </div>
    `).join('')}

    <div class="footer">
      ${report.limitations_notice}
      <br>© ${new Date().getFullYear()} Veylora UX — See the friction. Prove the path.
    </div>
  </div>
</body>
</html>`;

    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="veylora-report-${report.id}.html"`);
    return reply.send(html);
  });

  // 9. Ask Veylora Endpoints
  fastify.get('/ask-veylora/conversations', async () => {
    return ChatHistoryService.listConversations();
  });

  fastify.post('/ask-veylora/conversations', async (request: FastifyRequest) => {
    const body = (request.body || {}) as any;
    return ChatHistoryService.createConversation(body.title);
  });

  fastify.get('/ask-veylora/conversations/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const data = ChatHistoryService.getConversation(request.params.id);
    if (!data) return reply.status(404).send({ error: 'Conversation not found or expired' });
    return data;
  });

  fastify.delete('/ask-veylora/conversations/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const deleted = ChatHistoryService.deleteConversation(request.params.id);
    return { id: request.params.id, deleted, success: true };
  });

  fastify.post('/ask-veylora/chat', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.prompt || String(body.prompt).trim() === '') {
      return reply.status(400).send({ error: 'Prompt is required' });
    }

    let conversationId = body.conversationId;
    if (!conversationId) {
      const newConv = ChatHistoryService.createConversation();
      conversationId = newConv.id;
    }

    // Save user message to SQLite with 7-day TTL
    ChatHistoryService.addMessage(conversationId, 'user', body.prompt.trim(), body.screenContextText);

    // Fetch recent message history
    const existing = ChatHistoryService.getConversation(conversationId);
    const history = (existing?.messages || []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Execute AI response (Gemma -> Gemini 3.5-flash-lite -> Gemini 3.1-flash-lite -> Local help)
    const aiResult = await AIService.askVeylora(
      body.prompt.trim(),
      body.currentRoute || '/',
      body.screenContextText,
      history,
      body.languagePreference
    );

    // Save assistant message to SQLite with 7-day TTL
    const assistantMsg = ChatHistoryService.addMessage(conversationId, 'assistant', aiResult.answer);

    // Return response WITHOUT exposing internal model IDs, credit counters, or stages
    return {
      conversationId,
      messageId: assistantMsg.id,
      answer: aiResult.answer,
      intent: aiResult.intent,
      language: aiResult.language,
      createdAt: assistantMsg.createdAt
    };
  });

  fastify.post('/ask-veylora/cleanup', async () => {
    const result = ChatHistoryService.cleanExpiredConversations();
    return { ...result, success: true };
  });

  // 10. Audit Comparisons (Phase 1 & Phase 5)
  fastify.post('/comparisons', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.baselineRunId || !body.currentRunId) {
      return reply.status(400).send({ error: 'baselineRunId and currentRunId are required' });
    }

    try {
      const comparison = RegressionMemoryService.compareAudits(body.baselineRunId, body.currentRunId);
      return reply.status(201).send(comparison);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Comparison failed' });
    }
  });

  fastify.post('/audits/compare', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.baselineRunId || !body.currentRunId) {
      return reply.status(400).send({ error: 'baselineRunId and currentRunId are required' });
    }
    try {
      const comparison = RegressionMemoryService.compareAudits(body.baselineRunId, body.currentRunId);
      return reply.send(comparison);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Comparison failed' });
    }
  });

  fastify.get('/comparisons', async (request: FastifyRequest<{ Querystring: { projectId?: string } }>) => {
    let rows: any[];
    if (request.query.projectId) {
      rows = db.prepare('SELECT * FROM audit_comparisons WHERE project_id = ? ORDER BY created_at DESC').all(request.query.projectId);
    } else {
      rows = db.prepare('SELECT * FROM audit_comparisons ORDER BY created_at DESC').all();
    }

    return rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      baselineRunId: r.baseline_run_id,
      currentRunId: r.current_run_id,
      status: r.status,
      summary: JSON.parse(r.summary_json || '{}'),
      newCount: r.new_count,
      persistentCount: r.persistent_count,
      resolvedCount: r.resolved_count,
      recurringCount: r.recurring_count,
      createdAt: r.created_at
    }));
  });

  fastify.get('/comparisons/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const r = db.prepare('SELECT * FROM audit_comparisons WHERE id = ?').get(request.params.id) as any;
    if (!r) return reply.status(404).send({ error: 'Comparison not found' });
    return {
      id: r.id,
      projectId: r.project_id,
      baselineRunId: r.baseline_run_id,
      currentRunId: r.current_run_id,
      status: r.status,
      summary: JSON.parse(r.summary_json || '{}'),
      newCount: r.new_count,
      persistentCount: r.persistent_count,
      resolvedCount: r.resolved_count,
      recurringCount: r.recurring_count,
      createdAt: r.created_at
    };
  });

  // 11. Accessibility Results (Phase 4)
  fastify.get('/accessibility/:runId', async (request: FastifyRequest<{ Params: { runId: string } }>) => {
    const rows = db.prepare('SELECT * FROM accessibility_results WHERE run_id = ? ORDER BY created_at DESC').all(request.params.runId) as any[];
    return rows.map(r => ({
      id: r.id,
      runId: r.run_id,
      projectId: r.project_id,
      ruleId: r.rule_id,
      description: r.description,
      impact: r.impact,
      helpUrl: r.help_url,
      targetSelector: r.target_selector,
      htmlSnippet: r.html_snippet,
      failureSummary: r.failure_summary,
      verificationStatus: r.verification_status,
      wcagTags: JSON.parse(r.wcag_tags || '[]'),
      createdAt: r.created_at
    }));
  });

  fastify.get('/audits/:runId/accessibility', async (request: FastifyRequest<{ Params: { runId: string } }>) => {
    const rows = db.prepare('SELECT * FROM accessibility_results WHERE run_id = ? ORDER BY created_at DESC').all(request.params.runId) as any[];
    return rows.map(r => ({
      id: r.id,
      runId: r.run_id,
      projectId: r.project_id,
      ruleId: r.rule_id,
      description: r.description,
      impact: r.impact,
      helpUrl: r.help_url,
      targetSelector: r.target_selector,
      htmlSnippet: r.html_snippet,
      failureSummary: r.failure_summary,
      verificationStatus: r.verification_status,
      wcagTags: JSON.parse(r.wcag_tags || '[]'),
      createdAt: r.created_at
    }));
  });

  // 12. Smart Fix Roadmap (Phase 6)
  fastify.get('/roadmap', async (request: FastifyRequest<{ Querystring: { projectId?: string } }>) => {
    return RoadmapService.getTasks(request.query.projectId);
  });

  fastify.post('/roadmap/generate', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.projectId) {
      return reply.status(400).send({ error: 'projectId is required' });
    }
    const tasks = RoadmapService.generateRoadmapForProject(body.projectId);
    return { success: true, count: tasks.length, tasks };
  });

  fastify.get('/roadmap/tasks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const task = RoadmapService.getTaskById(request.params.id);
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    return task;
  });

  fastify.patch('/roadmap/tasks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const body = (request.body || {}) as any;
    const updated = RoadmapService.updateTask(request.params.id, body);
    if (!updated) return reply.status(404).send({ error: 'Task not found' });
    return updated;
  });

  // 13. Assistant Actions & Ask Veylora (Phase 7)
  fastify.post('/assistant/actions/validate', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.actionType) {
      return reply.status(400).send({ error: 'actionType is required' });
    }
    const result = AssistantActionService.validateAction(body.actionType, body.params || {});
    return result;
  });

  fastify.post('/assistant/actions/execute', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.actionType) {
      return reply.status(400).send({ error: 'actionType is required' });
    }
    const result = await AssistantActionService.executeAction(
      body.actionType,
      body.params || {},
      Boolean(body.confirmed)
    );
    return result;
  });

  fastify.post('/assistant/message', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.message && !body.prompt) {
      return reply.status(400).send({ error: 'message or prompt is required' });
    }

    const prompt = body.message || body.prompt;
    let conversationId = body.conversationId;
    if (!conversationId) {
      const newConv = ChatHistoryService.createConversation();
      conversationId = newConv.id;
    }

    ChatHistoryService.addMessage(conversationId, 'user', prompt.trim(), body.screenContextText);
    const existing = ChatHistoryService.getConversation(conversationId);
    const history = (existing?.messages || []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const aiResult = await AIService.askVeylora(
      prompt.trim(),
      body.currentRoute || '/',
      body.screenContextText,
      history,
      body.languagePreference
    );

    const assistantMsg = ChatHistoryService.addMessage(conversationId, 'assistant', aiResult.answer);

    return {
      conversationId,
      messageId: assistantMsg.id,
      answer: aiResult.answer,
      intent: aiResult.intent,
      language: aiResult.language,
      suggestedActions: [
        { actionType: 'GET_ROADMAP', description: 'View prioritized fix tasks' },
        { actionType: 'GET_ACCESSIBILITY_RESULTS', description: 'Inspect accessibility rule violations' }
      ],
      createdAt: assistantMsg.createdAt
    };
  });

  // 14. Local-First Privacy Controls (Phase 8)
  fastify.get('/privacy/settings', async () => {
    return PrivacyService.getSettings();
  });

  fastify.patch('/privacy/settings', async (request: FastifyRequest) => {
    const body = (request.body || {}) as any;
    return PrivacyService.updateSettings(body);
  });

  fastify.delete('/evidence/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const result = PrivacyService.deleteEvidence(request.params.id);
    if (!result.success) {
      return reply.status(404).send({ error: result.error });
    }
    return { success: true, id: request.params.id };
  });

  fastify.post('/evidence/cleanup', async () => {
    return PrivacyService.cleanExpiredEvidence();
  });

  // 15. Intent-to-Failure Detective (Phase 4 & Phase 5)
  // A. Generate structured journey specification from natural goal
  fastify.post('/detective/spec', async (request: FastifyRequest, reply) => {
    const body = (request.body || {}) as any;
    if (!body.projectId || !body.naturalGoal) {
      return reply.status(400).send({ error: 'projectId and naturalGoal are required' });
    }

    try {
      const investigation = IntentDetectiveService.createDraftInvestigation({
        projectId: body.projectId,
        naturalGoal: body.naturalGoal,
        startingUrl: body.startingUrl,
        testData: body.testData,
        baselineInvestigationId: body.baselineInvestigationId
      });
      return reply.status(201).send({ success: true, investigation });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to generate journey specification' });
    }
  });

  // B. Approve proposed journey spec for execution
  fastify.post('/detective/investigations/:id/approve', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const success = IntentDetectiveService.approveInvestigation(request.params.id);
    if (!success) {
      return reply.status(404).send({ error: `Investigation ${request.params.id} not found` });
    }
    return { success: true, id: request.params.id, status: 'approved' };
  });

  // C. Execute an approved investigation with Playwright and evidence-backed diagnosis
  fastify.post('/detective/investigations/:id/execute', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const result = await IntentDetectiveService.executeInvestigation(request.params.id);
      return reply.send({ success: true, investigation: result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Investigation execution failed' });
    }
  });

  // D. List investigations for a project
  fastify.get('/detective/investigations', async (request: FastifyRequest<{ Querystring: { projectId?: string } }>, reply) => {
    const projectId = request.query.projectId;
    if (!projectId) {
      return reply.status(400).send({ error: 'projectId query parameter is required' });
    }
    const list = IntentDetectiveService.listInvestigations(projectId);
    return { success: true, count: list.length, investigations: list };
  });

  // E. Get single investigation details
  fastify.get('/detective/investigations/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const inv = IntentDetectiveService.getInvestigation(request.params.id);
    if (!inv) {
      return reply.status(404).send({ error: `Investigation ${request.params.id} not found` });
    }
    return { success: true, investigation: inv };
  });

  // F. Create a verified before/after retest for an investigation
  fastify.post('/detective/investigations/:id/retest', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const retest = IntentDetectiveService.createRetest(request.params.id);
      return reply.status(201).send({ success: true, retestInvestigation: retest });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to create retest' });
    }
  });
}

