process.env.NODE_ENV = 'test';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { db, initDatabase } from '../src/db/index.js';
import { config } from '../src/config.js';
import { PlaywrightRunnerService } from '../src/services/playwrightRunnerService.js';

describe('Veylora UX — Real Playwright Browser Automation Tests', () => {
  test('Executes real headless browser journey, captures screenshot, and records evidence', async () => {
    initDatabase();

    const now = new Date().toISOString();
    const testProjId = `proj-pw-test-${Date.now()}`;
    const runId = `run-pw-test-${Date.now()}`;

    // Create a local test HTML file in scratch directory
    const testHtmlDir = path.join(config.artifactsDir, 'test_pages');
    if (!fs.existsSync(testHtmlDir)) fs.mkdirSync(testHtmlDir, { recursive: true });
    const testHtmlPath = path.join(testHtmlDir, 'test_journey.html');

    const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Staging Onboarding Flow</title></head>
<body style="font-family:sans-serif; padding:40px;">
  <h1 id="hero-title">Welcome to Staging Platform</h1>
  <button id="start-btn" onclick="document.getElementById('status').innerText = 'Started';">Get Started</button>
  <div id="status">Idle</div>
  <form id="signup-form" style="margin-top:20px;">
    <label for="email-input">Email Address</label>
    <input id="email-input" type="email" placeholder="user@example.com" />
  </form>
</body>
</html>`;
    fs.writeFileSync(testHtmlPath, htmlContent, 'utf-8');

    // Convert file path to file:// URL
    const fileUrl = 'file:///' + testHtmlPath.replace(/\\/g, '/');

    // 1. Insert test project
    db.prepare(`
      INSERT INTO projects (id, name, source_type, source_url, allowed_domains, viewport, created_at, updated_at)
      VALUES (?, 'Playwright Test Project', 'website', ?, '["localhost", "127.0.0.1"]', 'desktop-1440', ?, ?)
    `).run(testProjId, fileUrl, now, now);

    // 2. Insert test scenario with concrete steps
    const testScenId = `scen-pw-test-${Date.now()}`;
    const testSteps = [
      { stepNumber: 1, actionType: 'goto', value: fileUrl, description: 'Navigate to test entrypoint', expectedOutcome: 'Page loaded' },
      { stepNumber: 2, actionType: 'inspect', targetSelector: '#hero-title', description: 'Inspect hero title', expectedOutcome: 'Hero title present' },
      { stepNumber: 3, actionType: 'click', targetSelector: '#start-btn', description: 'Click start button', expectedOutcome: 'Status changed' },
      { stepNumber: 4, actionType: 'fill', targetSelector: '#email-input', value: 'tester@veylora.dev', description: 'Fill email field', expectedOutcome: 'Value populated' }
    ];

    db.prepare(`
      INSERT INTO scenarios (id, project_id, title, natural_goal, starting_url, success_condition, stop_conditions, steps, test_data_fixtures, negative_paths, created_at, updated_at)
      VALUES (?, ?, 'Playwright Scenario', 'Complete flow', ?, 'Status started', '[]', ?, '{}', '[]', ?, ?)
    `).run(testScenId, testProjId, fileUrl, JSON.stringify(testSteps), now, now);

    // 3. Insert run
    db.prepare(`
      INSERT INTO runs (
        id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps,
        viewport, browser, model_mode, action_budget, actions_executed, started_at,
        task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run
      ) VALUES (?, ?, '["persona-1"]', ?, 'queued', 0, 4, 'desktop-1440', 'chromium', 'live', 10, 0, ?, 'in_progress', 0, 0, '{}', 0)
    `).run(runId, testProjId, JSON.stringify([testScenId]), now);

    // 4. Execute Playwright runner synchronously for test
    await PlaywrightRunnerService.executeRun(runId);

    // 5. Verify run completed in SQLite
    const completedRun = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
    assert.equal(completedRun.status, 'completed', 'Run status should be completed');
    assert.ok(completedRun.actions_executed >= 3, 'Should execute actions');
    assert.ok(completedRun.duration_seconds >= 0, 'Duration should be recorded');

    // 6. Verify action events recorded in SQLite
    const events = db.prepare('SELECT * FROM action_events WHERE run_id = ? ORDER BY sequence_no ASC').all(runId) as any[];
    assert.ok(events.length >= 3, 'Must record action events in SQLite');
    assert.equal(events[0].action_type, 'goto');
    assert.equal(events[0].result, 'completed');

    // 7. Verify real screenshot saved to disk and recorded in evidence table
    const evidence = db.prepare('SELECT * FROM evidence WHERE run_id = ?').all(runId) as any[];
    assert.ok(evidence.length >= 1, 'Evidence records must exist');
    assert.ok(evidence[0].local_path, 'Evidence must record local screenshot path');

    const screenshotDiskPath = path.join(config.artifactsDir, evidence[0].local_path.replace('/artifacts/', ''));
    assert.ok(fs.existsSync(screenshotDiskPath), `Screenshot file must actually exist on disk at ${screenshotDiskPath}`);
    const stats = fs.statSync(screenshotDiskPath);
    assert.ok(stats.size > 1000, `Screenshot PNG must be non-empty image (size: ${stats.size} bytes)`);

    // 8. Verify report was generated in SQLite
    const report = db.prepare('SELECT * FROM reports WHERE run_id = ?').get(runId) as any;
    assert.ok(report, 'Executive report must be created in SQLite');
    assert.ok(report.executive_summary.length > 20, 'Report must have executive summary');

    // Clean up temporary test file
    try { fs.unlinkSync(testHtmlPath); } catch {}
  });
});
