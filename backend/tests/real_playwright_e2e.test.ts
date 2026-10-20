process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { db, initDatabase } from '../src/db/index.js';
import { config } from '../src/config.js';
import { PlaywrightRunnerService } from '../src/services/playwrightRunnerService.js';
import { SSRFProtectionService } from '../src/services/ssrfProtectionService.js';

describe('Veylora UX — Real Playwright End-to-End & Execution Tests', () => {
  let server: http.Server;
  let serverUrl: string;

  before(async () => {
    initDatabase();

    // Launch controlled local HTTP fixture server
    await new Promise<void>((resolve) => {
      server = http.createServer((req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<!DOCTYPE html>
<html lang="en">
<head><title>Veylora E2E Controlled Fixture</title></head>
<body style="font-family:sans-serif; padding:30px;">
  <h1 id="main-heading">Veylora Test Fixture Website</h1>
  <p id="desc">Deterministic E2E testing environment for Playwright</p>
  <button id="cart-btn" onclick="document.getElementById('status-msg').innerText = 'Cart Item Added';">Add To Cart</button>
  <div id="status-msg">Cart Empty</div>
  <p><a id="nav-link" href="/checkout">Go to Checkout</a></p>
</body>
</html>`);
        } else if (req.url === '/checkout') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<!DOCTYPE html>
<html lang="en">
<head><title>Checkout Page</title></head>
<body style="font-family:sans-serif; padding:30px;">
  <h1 id="checkout-heading">Secure Checkout</h1>
  <input id="coupon-field" type="text" placeholder="Promo code" />
  <button id="apply-btn" onclick="document.getElementById('coupon-res').innerText = 'Promo Applied: SAVE10';">Apply</button>
  <div id="coupon-res">No Promo</div>
</body>
</html>`);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  test('1. Real Website Smoke Test: Launches Playwright, navigates to target, captures title & screenshot, and saves evidence to SQLite', async () => {
    const now = new Date().toISOString();
    const projectId = `proj-smoke-${Date.now()}`;

    // Create project targeting the real local fixture
    db.prepare(`
      INSERT INTO projects (id, name, source_type, source_url, allowed_domains, viewport, created_at, updated_at)
      VALUES (?, 'E2E Smoke Test Project', 'website', ?, '["127.0.0.1", "localhost"]', 'desktop-1440', ?, ?)
    `).run(projectId, serverUrl, now, now);

    // Execute real smoke test
    const smokeResult = await PlaywrightRunnerService.executeSmokeTest(projectId);

    // Assertions on real Playwright execution
    assert.equal(smokeResult.status, 'passed', 'Smoke test should pass against accessible local fixture');
    assert.equal(smokeResult.pageTitle, 'Veylora E2E Controlled Fixture', 'Should extract real page title');
    assert.ok(smokeResult.finalUrl?.includes('127.0.0.1'), 'Final URL should match fixture URL');
    assert.ok(smokeResult.durationMs > 0, 'Duration must be recorded and non-zero');
    assert.ok(smokeResult.screenshotUrl, 'Screenshot URL must be returned');

    // Verify screenshot file exists physically on disk
    const diskPath = path.join(config.artifactsDir, smokeResult.screenshotUrl!.replace('/artifacts/', ''));
    assert.ok(fs.existsSync(diskPath), `Screenshot file must physically exist at ${diskPath}`);
    const stats = fs.statSync(diskPath);
    assert.ok(stats.size > 500, `Screenshot must be a non-empty image (size: ${stats.size} bytes)`);

    // Verify SQLite run record
    const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(smokeResult.runId) as any;
    assert.ok(run, 'Run record must be persisted in SQLite');
    assert.ok(run.status === 'passed' || run.status === 'completed', 'Run status in DB must be passed or completed');
    assert.ok(run.task_outcome === 'smoke_passed' || run.task_outcome === 'passed' || run.task_outcome === 'completed', 'Task outcome in DB must be smoke_passed, passed or completed');
    assert.equal(run.project_id, projectId, 'Run must link to correct project');

    // Verify SQLite action events and evidence records
    const events = db.prepare('SELECT * FROM action_events WHERE run_id = ?').all(smokeResult.runId) as any[];
    assert.ok(events.length >= 1, 'Smoke test must record navigation action event');
    assert.equal(events[0].action_type, 'smoke_check');
    assert.equal(events[0].result, 'completed');

    const evidence = db.prepare('SELECT * FROM evidence WHERE run_id = ?').all(smokeResult.runId) as any[];
    assert.ok(evidence.length >= 1, 'Evidence record must be saved in SQLite');
    assert.equal(evidence[0].type, 'screenshot');
  });

  test('2. Multi-step Scenario with Passing Assertions: Executes full Playwright journey and completes successfully', async () => {
    const now = new Date().toISOString();
    const projectId = `proj-journey-${Date.now()}`;
    const scenarioId = `scen-journey-${Date.now()}`;
    const runId = `run-journey-${Date.now()}`;

    // Create project
    db.prepare(`
      INSERT INTO projects (id, name, source_type, source_url, allowed_domains, viewport, created_at, updated_at)
      VALUES (?, 'E2E Multi-Step Project', 'website', ?, '["127.0.0.1"]', 'desktop-1440', ?, ?)
    `).run(projectId, serverUrl, now, now);

    // Create scenario with real browser assertions and clicks
    const steps = [
      { stepNumber: 1, actionType: 'goto', value: serverUrl, description: 'Navigate to fixture home', expectedOutcome: 'Home loaded' },
      { stepNumber: 2, actionType: 'assert_text', targetSelector: '#main-heading', value: 'Veylora Test Fixture Website', description: 'Verify heading text', expectedOutcome: 'Heading verified' },
      { stepNumber: 3, actionType: 'click', targetSelector: '#cart-btn', description: 'Click Add to Cart button', expectedOutcome: 'Status changed' },
      { stepNumber: 4, actionType: 'assert_text', targetSelector: '#status-msg', value: 'Cart Item Added', description: 'Verify cart status text', expectedOutcome: 'Cart status verified' },
      { stepNumber: 5, actionType: 'click', targetSelector: '#nav-link', description: 'Click link to navigate to checkout', expectedOutcome: 'Navigated to checkout' },
      { stepNumber: 6, actionType: 'assert_url', value: '/checkout', description: 'Verify URL includes /checkout', expectedOutcome: 'URL matches' },
      { stepNumber: 7, actionType: 'screenshot', description: 'Capture checkout screenshot', expectedOutcome: 'Evidence captured' }
    ];

    db.prepare(`
      INSERT INTO scenarios (
        id, project_id, title, natural_goal, starting_url, success_condition,
        stop_conditions, steps, test_data_fixtures, negative_paths, created_at, updated_at
      ) VALUES (?, ?, 'Multi-step E2E Journey', 'Add to cart and checkout', ?, 'Cart ready and checked out', '[]', ?, '{}', '[]', ?, ?)
    `).run(scenarioId, projectId, serverUrl, JSON.stringify(steps), now, now);

    // Create queued run in SQLite
    db.prepare(`
      INSERT INTO runs (
        id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps,
        viewport, browser, model_mode, action_budget, actions_executed, started_at,
        task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run
      ) VALUES (?, ?, '["persona-1"]', ?, 'queued', 0, 7, 'desktop-1440', 'chromium', 'live', 15, 0, ?, 'in_progress', 0, 0, '{}', 0)
    `).run(runId, projectId, JSON.stringify([scenarioId]), now);

    // Execute run synchronously
    await PlaywrightRunnerService.executeRun(runId);

    // Check completed run
    const completedRun = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
    assert.equal(completedRun.status, 'completed', 'Run status should be completed');
    assert.ok(completedRun.task_outcome === 'completed_goal' || completedRun.task_outcome === 'completed', 'Task outcome should be completed');
    assert.equal(completedRun.actions_executed, 7, 'Should execute all 7 steps');

    // Check action events
    const events = db.prepare('SELECT * FROM action_events WHERE run_id = ? ORDER BY sequence_no ASC').all(runId) as any[];
    assert.equal(events.length, 7, 'Must record 7 action events in SQLite');
    assert.equal(events[1].action_type, 'assert_text');
    assert.equal(events[1].result, 'completed');
    assert.equal(events[3].action_type, 'assert_text');
    assert.equal(events[3].result, 'completed');
    assert.equal(events[5].action_type, 'assert_url');
    assert.equal(events[5].result, 'completed');

    // Check evidence
    const evidenceList = db.prepare('SELECT * FROM evidence WHERE run_id = ?').all(runId) as any[];
    assert.ok(evidenceList.length >= 1, 'Evidence records must exist');
    const screenshotEvidence = evidenceList.find(e => e.type === 'screenshot');
    assert.ok(screenshotEvidence, 'Screenshot evidence must be present');
    const ssPath = path.join(config.artifactsDir, screenshotEvidence.local_path.replace('/artifacts/', ''));
    assert.ok(fs.existsSync(ssPath), `Screenshot file must exist at ${ssPath}`);
  });

  test('3. Deliberately Failing Assertion: Stops execution, marks run as failed, and captures failure evidence without false success', async () => {
    const now = new Date().toISOString();
    const projectId = `proj-fail-${Date.now()}`;
    const scenarioId = `scen-fail-${Date.now()}`;
    const failRunId = `run-fail-${Date.now()}`;

    // Create project
    db.prepare(`
      INSERT INTO projects (id, name, source_type, source_url, allowed_domains, viewport, created_at, updated_at)
      VALUES (?, 'E2E Failing Test Project', 'website', ?, '["127.0.0.1"]', 'desktop-1440', ?, ?)
    `).run(projectId, serverUrl, now, now);

    // Create scenario with intentional failure in Step 2
    const steps = [
      { stepNumber: 1, actionType: 'goto', value: serverUrl, description: 'Navigate to fixture home', expectedOutcome: 'Home loaded' },
      { stepNumber: 2, actionType: 'assert_text', targetSelector: '#main-heading', value: 'NON_EXISTENT_TEXT_ASSERTION_FAILURE', description: 'Assert impossible text', expectedOutcome: 'Will fail' },
      { stepNumber: 3, actionType: 'click', targetSelector: '#cart-btn', description: 'Step 3 must not execute', expectedOutcome: 'Should not run' }
    ];

    db.prepare(`
      INSERT INTO scenarios (
        id, project_id, title, natural_goal, starting_url, success_condition,
        stop_conditions, steps, test_data_fixtures, negative_paths, created_at, updated_at
      ) VALUES (?, ?, 'Failing Scenario', 'Deliberate assertion failure test', ?, 'Never succeeds', '[]', ?, '{}', '[]', ?, ?)
    `).run(scenarioId, projectId, serverUrl, JSON.stringify(steps), now, now);

    // Create run
    db.prepare(`
      INSERT INTO runs (
        id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps,
        viewport, browser, model_mode, action_budget, actions_executed, started_at,
        task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run
      ) VALUES (?, ?, '["persona-1"]', ?, 'queued', 0, 3, 'desktop-1440', 'chromium', 'live', 15, 0, ?, 'in_progress', 0, 0, '{}', 0)
    `).run(failRunId, projectId, JSON.stringify([scenarioId]), now);

    // Execute run
    await PlaywrightRunnerService.executeRun(failRunId);

    // Verify run failed honestly
    const failedRun = db.prepare('SELECT * FROM runs WHERE id = ?').get(failRunId) as any;
    assert.equal(failedRun.status, 'failed', 'Run must be marked as failed in SQLite');
    assert.equal(failedRun.task_outcome, 'failed', 'Task outcome must be failed, NOT passed');
    assert.equal(failedRun.actions_executed, 2, 'Execution must halt after step 2 failed');

    // Verify action event for step 2 records failure
    const events = db.prepare('SELECT * FROM action_events WHERE run_id = ? ORDER BY sequence_no ASC').all(failRunId) as any[];
    assert.equal(events.length, 2, 'Only 2 events should be recorded');
    assert.equal(events[1].action_type, 'assert_text');
    assert.equal(events[1].result, 'failed', 'Step 2 result must be failed');
    assert.ok(events[1].observed_state_change?.includes('not found') || events[1].observed_state_change?.includes('Action error'), 'Must contain descriptive error in observed_state_change');

    // Verify failure screenshot was captured
    const failEvidence = db.prepare('SELECT * FROM evidence WHERE run_id = ?').all(failRunId) as any[];
    assert.ok(failEvidence.length >= 1, 'Failure screenshot must be captured for forensic debugging');
  });

  test('4. Security & SSRF Protection: Blocks cloud metadata endpoints and invalid URL protocols', () => {
    // Check cloud metadata endpoint is blocked
    const metadataCheck = SSRFProtectionService.isSafeDestination('http://169.254.169.254/latest/meta-data/');
    assert.equal(metadataCheck.safe, false, 'Cloud metadata IP must be blocked');

    const googleMetaCheck = SSRFProtectionService.isSafeDestination('http://metadata.google.internal/computeMetadata/v1/');
    assert.equal(googleMetaCheck.safe, false, 'Google cloud metadata hostname must be blocked');

    // Check invalid protocol rejection
    const ftpCheck = SSRFProtectionService.normalizeUrl('ftp://example.com/file');
    assert.equal(ftpCheck.valid, false, 'FTP protocol must be rejected');

    const fileCheck = SSRFProtectionService.normalizeUrl('file:///etc/passwd');
    assert.equal(fileCheck.valid, false, 'File protocol must be rejected');

    const jsCheck = SSRFProtectionService.normalizeUrl('javascript:alert(1)');
    assert.equal(jsCheck.valid, false, 'JavaScript protocol must be rejected');

    // Check embedded credentials rejection
    const credsCheck = SSRFProtectionService.normalizeUrl('http://admin:secret@example.com');
    assert.equal(credsCheck.valid, false, 'Embedded credentials must be rejected');

    // Check valid HTTPS URL normalization
    const validNorm = SSRFProtectionService.normalizeUrl('example.com/pricing');
    assert.equal(validNorm.valid, true);
    assert.equal(validNorm.normalized, 'https://example.com/pricing');
  });

  test('5. Execution Cancellation: Cancels an active session cleanly and marks run as cancelled', async () => {
    const cancelRunId = `run-cancel-${Date.now()}`;
    const projectId = `proj-cancel-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO projects (id, name, source_type, source_url, allowed_domains, viewport, created_at, updated_at)
      VALUES (?, 'Cancellation Project', 'website', 'http://127.0.0.1:8080', '["127.0.0.1"]', 'desktop-1440', ?, ?)
    `).run(projectId, now, now);

    db.prepare(`
      INSERT INTO runs (
        id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps,
        viewport, browser, model_mode, action_budget, actions_executed, started_at,
        task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run
      ) VALUES (?, ?, '["persona-1"]', '[]', 'running', 0, 1, 'desktop-1440', 'chromium', 'live', 10, 0, ?, 'in_progress', 0, 0, '{}', 0)
    `).run(cancelRunId, projectId, now);

    // Cancel the run
    const cancelled = await PlaywrightRunnerService.cancelRun(cancelRunId);
    assert.ok(cancelled, 'cancelRun should succeed');

    const runRecord = db.prepare('SELECT * FROM runs WHERE id = ?').get(cancelRunId) as any;
    assert.equal(runRecord.status, 'cancelled', 'Status in SQLite must be cancelled');
    assert.equal(runRecord.task_outcome, 'cancelled', 'Task outcome must be cancelled');
  });
});
