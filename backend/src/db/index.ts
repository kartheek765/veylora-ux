import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}
if (!fs.existsSync(config.artifactsDir)) {
  fs.mkdirSync(config.artifactsDir, { recursive: true });
}

export const db = new Database(config.dbPath);

// Enable pragmas
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initDatabase() {
  // Run schema creation in transaction
  const migration = db.transaction(() => {
    // 1. Projects
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL,
        source_url TEXT NOT NULL,
        allowed_domains TEXT NOT NULL,
        viewport TEXT NOT NULL,
        readiness_status TEXT NOT NULL DEFAULT 'demo-ready',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
    `);

    // 2. Personas
    db.exec(`
      CREATE TABLE IF NOT EXISTS personas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_profile TEXT NOT NULL,
        primary_goal TEXT NOT NULL,
        secondary_goal TEXT,
        traits TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 1,
        avatar_color TEXT,
        is_template INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 3. Scenarios
    db.exec(`
      CREATE TABLE IF NOT EXISTS scenarios (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        natural_goal TEXT NOT NULL,
        starting_url TEXT NOT NULL,
        success_condition TEXT NOT NULL,
        action_budget INTEGER NOT NULL DEFAULT 15,
        time_budget_seconds INTEGER NOT NULL DEFAULT 45,
        stop_conditions TEXT NOT NULL,
        steps TEXT NOT NULL,
        test_data_fixtures TEXT NOT NULL,
        negative_paths TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_scenarios_project_id ON scenarios(project_id);
    `);

    // 4. Runs
    db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        persona_ids TEXT NOT NULL,
        scenario_ids TEXT NOT NULL,
        status TEXT NOT NULL,
        current_step_index INTEGER NOT NULL DEFAULT 0,
        total_steps INTEGER NOT NULL DEFAULT 0,
        viewport TEXT NOT NULL,
        browser TEXT NOT NULL,
        model_mode TEXT NOT NULL,
        action_budget INTEGER NOT NULL DEFAULT 15,
        actions_executed INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        task_outcome TEXT NOT NULL,
        console_errors_count INTEGER NOT NULL DEFAULT 0,
        network_errors_count INTEGER NOT NULL DEFAULT 0,
        findings_count TEXT NOT NULL,
        is_demo_run INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_runs_project_id ON runs(project_id);
      CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
    `);

    // 5. Action Events
    db.exec(`
      CREATE TABLE IF NOT EXISTS action_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        persona_id TEXT,
        sequence_no INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        target_summary TEXT NOT NULL,
        result TEXT NOT NULL,
        observed_state_change TEXT,
        url TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        evidence_id TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_action_events_run_id ON action_events(run_id);
    `);

    // 6. Findings
    db.exec(`
      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        persona_id TEXT,
        scenario_id TEXT,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        confidence TEXT NOT NULL,
        title TEXT NOT NULL,
        likely_impact TEXT,
        observed_facts TEXT NOT NULL,
        possible_cause TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        reproduction_notes TEXT,
        evidence_id TEXT,
        page_url TEXT NOT NULL,
        step_number INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'needs_review',
        is_heuristic INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_findings_run_id ON findings(run_id);
      CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
    `);

    // 7. Evidence
    db.exec(`
      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        action_event_id TEXT,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        page_title TEXT,
        timestamp TEXT NOT NULL,
        step_number INTEGER NOT NULL DEFAULT 1,
        redaction_status TEXT NOT NULL DEFAULT 'clean',
        local_path TEXT,
        svg_mockup_data TEXT,
        caption TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_evidence_run_id ON evidence(run_id);
    `);

    // 8. Reports
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        purpose TEXT,
        generation_time TEXT NOT NULL,
        app_version TEXT NOT NULL,
        report_schema_version TEXT NOT NULL,
        executive_summary TEXT NOT NULL,
        limitations_notice TEXT NOT NULL
      );
    `);

    // 9. Ask Veylora Conversations
    db.exec(`
      CREATE TABLE IF NOT EXISTS ask_veylora_conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ask_veylora_conv_expires ON ask_veylora_conversations(expires_at);
    `);

    // 10. Ask Veylora Messages
    db.exec(`
      CREATE TABLE IF NOT EXISTS ask_veylora_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        screen_context TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES ask_veylora_conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ask_veylora_msg_conv ON ask_veylora_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_ask_veylora_msg_expires ON ask_veylora_messages(expires_at);
    `);

    // 11. Model Usage Accounting Records (Server-side rolling 24-hour windows)
    db.exec(`
      CREATE TABLE IF NOT EXISTS model_usage_records (
        id TEXT PRIMARY KEY,
        service_type TEXT NOT NULL, -- 'ux_analysis' | 'ask_veylora'
        stage INTEGER NOT NULL,     -- 1: primary, 2: fallback_1, 3: fallback_2
        model_id TEXT NOT NULL,
        successful_requests INTEGER NOT NULL DEFAULT 0,
        window_started_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_model_usage_service_stage ON model_usage_records(service_type, stage);
    `);

    // 12. Schema Migrations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    // Check applied migrations
    const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>;
    const appliedVersions = new Set(appliedRows.map(r => r.version));

    // Migration 2: UX Regression Memory, axe-core Accessibility, Smart Roadmap & Privacy
    if (!appliedVersions.has(2)) {
      const findingCols = db.pragma('table_info(findings)') as Array<{ name: string }>;
      const existingColNames = new Set(findingCols.map(c => c.name));

      if (!existingColNames.has('fingerprint')) {
        db.exec('ALTER TABLE findings ADD COLUMN fingerprint TEXT');
      }
      if (!existingColNames.has('verification_status')) {
        db.exec("ALTER TABLE findings ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'");
      }
      if (!existingColNames.has('lifecycle_status')) {
        db.exec("ALTER TABLE findings ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'NEW'");
      }
      if (!existingColNames.has('selector_summary')) {
        db.exec('ALTER TABLE findings ADD COLUMN selector_summary TEXT');
      }
      if (!existingColNames.has('rule_id')) {
        db.exec('ALTER TABLE findings ADD COLUMN rule_id TEXT');
      }
      if (!existingColNames.has('first_seen_at')) {
        db.exec('ALTER TABLE findings ADD COLUMN first_seen_at TEXT');
      }
      if (!existingColNames.has('last_seen_at')) {
        db.exec('ALTER TABLE findings ADD COLUMN last_seen_at TEXT');
      }
      if (!existingColNames.has('resolved_at')) {
        db.exec('ALTER TABLE findings ADD COLUMN resolved_at TEXT');
      }

      db.exec('CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON findings(fingerprint)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_findings_verification ON findings(verification_status)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_findings_lifecycle ON findings(lifecycle_status)');

      // Comparisons Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_comparisons (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          baseline_run_id TEXT NOT NULL,
          current_run_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'completed',
          summary_json TEXT NOT NULL,
          new_count INTEGER NOT NULL DEFAULT 0,
          persistent_count INTEGER NOT NULL DEFAULT 0,
          resolved_count INTEGER NOT NULL DEFAULT 0,
          recurring_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (baseline_run_id) REFERENCES runs(id) ON DELETE CASCADE,
          FOREIGN KEY (current_run_id) REFERENCES runs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_audit_comparisons_project ON audit_comparisons(project_id);
      `);

      // Accessibility Results Table (axe-core findings)
      db.exec(`
        CREATE TABLE IF NOT EXISTS accessibility_results (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          rule_id TEXT NOT NULL,
          description TEXT NOT NULL,
          impact TEXT NOT NULL,
          help_url TEXT,
          target_selector TEXT NOT NULL,
          html_snippet TEXT,
          failure_summary TEXT,
          verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
          wcag_tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_accessibility_run_id ON accessibility_results(run_id);
      `);

      // Fix Tasks Table (Smart Fix Roadmap)
      db.exec(`
        CREATE TABLE IF NOT EXISTS fix_tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          root_cause_group TEXT,
          recommended_action TEXT NOT NULL,
          severity TEXT NOT NULL,
          confidence TEXT NOT NULL,
          priority_score REAL NOT NULL,
          priority_tier TEXT NOT NULL,
          priority_rationale TEXT NOT NULL,
          effort_band TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          dependencies TEXT NOT NULL DEFAULT '[]',
          associated_finding_ids TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_fix_tasks_project ON fix_tasks(project_id);
      `);

      // Privacy Settings Table (Local-First Privacy Mode)
      db.exec(`
        CREATE TABLE IF NOT EXISTS privacy_settings (
          id TEXT PRIMARY KEY,
          ai_assistance_enabled INTEGER NOT NULL DEFAULT 1,
          share_findings_text INTEGER NOT NULL DEFAULT 1,
          share_dom_summaries INTEGER NOT NULL DEFAULT 1,
          share_screenshots INTEGER NOT NULL DEFAULT 0,
          retain_evidence_days INTEGER NOT NULL DEFAULT 30,
          redact_sensitive_fields INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL
        );
      `);

      const privCount = (db.prepare('SELECT COUNT(*) as cnt FROM privacy_settings').get() as any).cnt;
      if (privCount === 0) {
        db.prepare(`
          INSERT INTO privacy_settings (id, ai_assistance_enabled, share_findings_text, share_dom_summaries, share_screenshots, retain_evidence_days, redact_sensitive_fields, updated_at)
          VALUES ('default', 1, 1, 1, 0, 30, 1, ?)
        `).run(new Date().toISOString());
      }

      // Record migration v2
      db.prepare(`
        INSERT INTO schema_migrations (version, name, applied_at)
        VALUES (2, 'v2_regression_memory_accessibility_roadmap_privacy', ?)
      `).run(new Date().toISOString());
    }

    // Migration 3: Intent-to-Failure Detective & Verified Retests
    if (!appliedVersions.has(3)) {
      const findingCols = db.pragma('table_info(findings)') as Array<{ name: string }>;
      const existingFindingCols = new Set(findingCols.map(c => c.name));
      if (!existingFindingCols.has('investigation_id')) {
        db.exec('ALTER TABLE findings ADD COLUMN investigation_id TEXT');
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS detective_investigations (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          run_id TEXT,
          baseline_investigation_id TEXT,
          natural_goal TEXT NOT NULL,
          starting_url TEXT NOT NULL,
          preconditions_json TEXT NOT NULL DEFAULT '[]',
          ordered_steps_json TEXT NOT NULL DEFAULT '[]',
          expected_outcomes_json TEXT NOT NULL DEFAULT '[]',
          failure_conditions_json TEXT NOT NULL DEFAULT '[]',
          allowed_domains_json TEXT NOT NULL DEFAULT '[]',
          max_steps INTEGER NOT NULL DEFAULT 10,
          execution_budget INTEGER NOT NULL DEFAULT 15,
          test_data_json TEXT NOT NULL DEFAULT '{}',
          is_approved_by_user INTEGER NOT NULL DEFAULT 0,
          has_consequential_actions INTEGER NOT NULL DEFAULT 0,
          consequential_warning TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          outcome TEXT,
          breaking_step_index INTEGER,
          breaking_action_summary TEXT,
          observed_defect_summary TEXT,
          evidence_id TEXT,
          finding_id TEXT,
          diagnosis_json TEXT,
          retest_status TEXT,
          comparison_notes TEXT,
          created_at TEXT NOT NULL,
          completed_at TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_detective_proj ON detective_investigations(project_id);
        CREATE INDEX IF NOT EXISTS idx_detective_created ON detective_investigations(created_at);
        CREATE INDEX IF NOT EXISTS idx_detective_status ON detective_investigations(status);
      `);

      // Record migration v3
      db.prepare(`
        INSERT INTO schema_migrations (version, name, applied_at)
        VALUES (3, 'v3_intent_to_failure_detective', ?)
      `).run(new Date().toISOString());
    }
  });

  migration();
  seedInitialDataIfEmpty();
}

function seedInitialDataIfEmpty() {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number }).cnt;
  if (count > 0) return;

  const now = new Date().toISOString();

  // Seed default Project 1
  db.prepare(`
    INSERT INTO projects (id, name, description, source_type, source_url, allowed_domains, viewport, readiness_status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'proj-1',
    'ApexFlow Cloud Onboarding',
    'Self-serve developer team signup, workspace configuration, and initial API key generation journey.',
    'website',
    'https://staging.apexflow.dev/signup',
    JSON.stringify(['staging.apexflow.dev', 'auth.staging.apexflow.dev']),
    'desktop-1440',
    'demo-ready',
    'Testing v2.4 staging release with redesigned 3-step organization wizard.',
    now,
    now
  );

  // Seed default Project 2
  db.prepare(`
    INSERT INTO projects (id, name, description, source_type, source_url, allowed_domains, viewport, readiness_status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'proj-2',
    'Lumina E-Commerce Checkout',
    'Guest shopping bag to order confirmation journey, focusing on address autocomplete and payment method choice.',
    'website',
    'https://staging-shop.lumina-craft.com/cart',
    JSON.stringify(['staging-shop.lumina-craft.com']),
    'mobile-390',
    'demo-ready',
    'Mobile viewport testing; coupon code interaction and form keyboard dismiss issues reported.',
    now,
    now
  );

  // Seed default 5 Personas
  const personas = [
    {
      id: 'persona-1',
      name: 'First-time Visitor (Elena)',
      shortProfile: 'First encounter with the product. Scans headers quickly, expects clear visual affordances, and abandons if signup is ambiguous.',
      primaryGoal: 'Quickly evaluate tool value and reach workspace without being forced into an opaque sales schedule.',
      traits: { familiarity: 'novice', patience: 'low', readingTendency: 'skimmer', navigationConfidence: 'hesitant', accessibilityNeeds: ['Requires high contrast CTA buttons'], deviceContext: 'MacBook Air (13-inch)', language: 'English (US)' },
      color: '#6366F1'
    },
    {
      id: 'persona-2',
      name: 'Returning Customer (Marcus)',
      shortProfile: 'Familiar with common SaaS patterns. Prefers keyboard navigation, rapid shortcuts, and hates redundant step confirmations.',
      primaryGoal: 'Sign in directly via enterprise SSO or token and access team audit logs within 3 clicks.',
      traits: { familiarity: 'expert', patience: 'medium', readingTendency: 'minimalist', navigationConfidence: 'confident', accessibilityNeeds: ['Keyboard-only navigable focus outlines'], deviceContext: 'Desktop Chrome 128 (Windows 11)', language: 'English (UK)' },
      color: '#14B8A6'
    },
    {
      id: 'persona-3',
      name: 'Cautious Form Filler (Dr. Aris)',
      shortProfile: 'Very cautious with data entry. Inspects privacy labels, verifies password requirements methodically, and re-checks every field.',
      primaryGoal: 'Submit organizational profile with zero validation ambiguity and clear error indicators.',
      traits: { familiarity: 'moderate', patience: 'high', readingTendency: 'methodical', navigationConfidence: 'hesitant', accessibilityNeeds: ['Screen reader assistive labels'], deviceContext: 'Dell XPS 15 (Edge 128)', language: 'English (US)' },
      color: '#F59E0B'
    },
    {
      id: 'persona-4',
      name: 'Mobile-First Browser (Priya)',
      shortProfile: 'Uses single-handed phone browsing on 4G network. Vulnerable to tiny tap targets, sticky headers obscuring inputs, and modal clipping.',
      primaryGoal: 'Complete one-click cart checkout via digital wallet or simple form on mobile screen.',
      traits: { familiarity: 'moderate', patience: 'low', readingTendency: 'skimmer', navigationConfidence: 'exploratory', accessibilityNeeds: ['Minimum 48px tap targets'], deviceContext: 'iPhone 15 Pro (Safari Mobile)', language: 'English (India)' },
      color: '#EC4899'
    },
    {
      id: 'persona-5',
      name: 'Goal-Focused Shopper (David)',
      shortProfile: 'High intent buyer who knows the exact SKU desired. Dislikes upsell interstitials or forced account creation before seeing shipping rates.',
      primaryGoal: 'Proceed from product page directly to payment with transparent order total displayed at all steps.',
      traits: { familiarity: 'moderate', patience: 'medium', readingTendency: 'minimalist', navigationConfidence: 'confident', accessibilityNeeds: [], deviceContext: 'iPad Pro (Safari iPadOS)', language: 'English (US)' },
      color: '#8B5CF6'
    }
  ];

  for (const p of personas) {
    db.prepare(`
      INSERT INTO personas (id, name, short_profile, primary_goal, traits, enabled, version, avatar_color, is_template, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?, 1, ?, ?)
    `).run(p.id, p.name, p.shortProfile, p.primaryGoal, JSON.stringify(p.traits), p.color, now, now);
  }
}
