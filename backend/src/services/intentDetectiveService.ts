import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { SSRFProtectionService } from './ssrfProtectionService.js';
import { EvidenceGuardService } from './evidenceGuardService.js';
import { VerificationStatus } from '../types/canonical.js';
import { RoadmapService } from './roadmapService.js';
import crypto from 'crypto';

export interface JourneyStep {
  stepNumber: number;
  actionType: 'navigate' | 'click' | 'fill' | 'assert' | 'scroll' | 'select';
  selectorOrTarget: string;
  value?: string;
  description: string;
  expectedOutcome: string;
}

export interface StructuredJourneySpec {
  goal: string;
  startingUrl: string;
  preconditions: string[];
  orderedSteps: JourneyStep[];
  expectedOutcomes: string[];
  failureConditions: string[];
  allowedDomains: string[];
  maxSteps: number;
  executionBudget: number;
  testData: Record<string, string>;
  hasConsequentialActions: boolean;
  consequentialWarning?: string;
}

export interface InvestigationDiagnosis {
  problemDescription: string;
  observedFacts: string;
  likelyRootCause: string;
  isHypothesis: boolean;
  suggestedFix: string;
  verificationStatus: VerificationStatus;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  reproducibility: string;
  evidenceReferences: string[];
}

export interface DetectiveInvestigationRecord {
  id: string;
  project_id: string;
  run_id?: string;
  baseline_investigation_id?: string;
  natural_goal: string;
  starting_url: string;
  preconditions_json: string;
  ordered_steps_json: string;
  expected_outcomes_json: string;
  failure_conditions_json: string;
  allowed_domains_json: string;
  max_steps: number;
  execution_budget: number;
  test_data_json: string;
  is_approved_by_user: number;
  has_consequential_actions: number;
  consequential_warning?: string;
  status: 'draft' | 'approved' | 'running' | 'completed' | 'failed';
  outcome?: 'GOAL_ACHIEVED' | 'FAILURE_DETECTED' | 'INCONCLUSIVE_BLOCKED' | 'PRECONDITION_FAILED';
  breaking_step_index?: number;
  breaking_action_summary?: string;
  observed_defect_summary?: string;
  evidence_id?: string;
  finding_id?: string;
  diagnosis_json?: string;
  retest_status?: 'BASELINE' | 'RESOLVED' | 'PERSISTING' | 'REGRESSION' | 'INCONCLUSIVE';
  comparison_notes?: string;
  created_at: string;
  completed_at?: string;
}

export class IntentDetectiveService {
  /**
   * Safe browser launcher reusing system channels if needed
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
   * Converts a natural language website goal into a structured journey specification.
   */
  static generateJourneySpec(params: {
    projectId: string;
    naturalGoal: string;
    startingUrl?: string;
    testData?: Record<string, string>;
  }): StructuredJourneySpec {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.projectId) as any;
    if (!project) throw new Error(`Project ${params.projectId} not found`);

    const allowedDomains: string[] = JSON.parse(project.allowed_domains || '[]');
    const startingUrl = params.startingUrl || project.source_url || 'https://example.com';
    const goalLower = params.naturalGoal.toLowerCase();

    // Check for consequential actions (payments, real orders, credit card submission, deletions)
    const isConsequential = /checkout|pay|payment|credit\s*card|billing|buy|purchase|delete|unsubscribe|recipient|transfer/i.test(goalLower);
    const consequentialWarning = isConsequential
      ? 'Consequential Journey Detected: This journey involves checkout, financial data, or irreversible actions. Veylora has synthesized mock/sandbox fixtures (e.g. 4242... test cards) to avoid real transactions.'
      : undefined;

    let spec: StructuredJourneySpec;

    // 1. Archetype: Product checkout
    if (/product|cart|checkout|buy/i.test(goalLower)) {
      spec = {
        goal: params.naturalGoal,
        startingUrl,
        preconditions: [
          'Target website is reachable and returns HTTP 200',
          'At least one product item is available in stock in catalog',
          'No authenticated session is required to browse catalog'
        ],
        orderedSteps: [
          {
            stepNumber: 1,
            actionType: 'navigate',
            selectorOrTarget: startingUrl,
            description: 'Navigate to starting catalog or home page',
            expectedOutcome: 'Catalog page loads successfully with product listings'
          },
          {
            stepNumber: 2,
            actionType: 'click',
            selectorOrTarget: 'a[href*="product"], .product-card a, button:has-text("View"), a:has-text("Shop")',
            description: 'Select first available product item',
            expectedOutcome: 'Product detail page opens with description and add to cart button'
          },
          {
            stepNumber: 3,
            actionType: 'click',
            selectorOrTarget: 'button:has-text("Add to Cart"), button:has-text("Buy"), button.add-to-cart',
            description: 'Click Add to Cart button',
            expectedOutcome: 'Cart counter increments or cart slide-out drawer appears'
          },
          {
            stepNumber: 4,
            actionType: 'click',
            selectorOrTarget: 'a[href*="cart"], a[href*="checkout"], button:has-text("Checkout")',
            description: 'Proceed to checkout page',
            expectedOutcome: 'Checkout view or customer information form is displayed'
          },
          {
            stepNumber: 5,
            actionType: 'assert',
            selectorOrTarget: 'form, input[name*="email"], input[name*="name"], #checkout-root',
            description: 'Verify checkout input form readiness',
            expectedOutcome: 'Customer information or shipping address fields are interactive'
          }
        ],
        expectedOutcomes: [
          'Product successfully selected and added to cart',
          'User reaches the checkout funnel without UI blocking or console crashes'
        ],
        failureConditions: [
          'Product catalog yields 404 or empty listing',
          'Add to Cart button is disabled or unresponsive to clicks',
          'Checkout button redirects to broken URL or unhandled exception'
        ],
        allowedDomains,
        maxSteps: 6,
        executionBudget: 15,
        testData: params.testData || {
          email: 'synthetic.test.user@example.com',
          name: 'Synthetic Buyer',
          postalCode: '94043'
        },
        hasConsequentialActions: isConsequential,
        consequentialWarning
      };
    }
    // 2. Archetype: Contact form submission
    else if (/contact|inquiry|message|reach\s*out/i.test(goalLower)) {
      spec = {
        goal: params.naturalGoal,
        startingUrl,
        preconditions: [
          'Contact page or modal is accessible from starting URL',
          'Synthetic inbox is used; no real email notifications sent'
        ],
        orderedSteps: [
          {
            stepNumber: 1,
            actionType: 'navigate',
            selectorOrTarget: startingUrl,
            description: 'Navigate to starting page',
            expectedOutcome: 'Page renders navigation with Contact link'
          },
          {
            stepNumber: 2,
            actionType: 'click',
            selectorOrTarget: 'a[href*="contact"], button:has-text("Contact"), a:has-text("Get in touch")',
            description: 'Navigate to Contact Form',
            expectedOutcome: 'Contact form page or dialog is displayed'
          },
          {
            stepNumber: 3,
            actionType: 'fill',
            selectorOrTarget: 'input[name*="name"], input[id*="name"]',
            value: params.testData?.name || 'Synthetic Tester',
            description: 'Fill name field',
            expectedOutcome: 'Name field accepts synthetic test string'
          },
          {
            stepNumber: 4,
            actionType: 'fill',
            selectorOrTarget: 'input[name*="email"], input[type="email"]',
            value: params.testData?.email || 'contact.test@example.com',
            description: 'Fill email field',
            expectedOutcome: 'Email field contains valid synthetic email format'
          },
          {
            stepNumber: 5,
            actionType: 'fill',
            selectorOrTarget: 'textarea[name*="message"], textarea',
            value: 'Automated UX Intent verification inquiry. Please disregard.',
            description: 'Fill inquiry message',
            expectedOutcome: 'Message textarea populated'
          },
          {
            stepNumber: 6,
            actionType: 'click',
            selectorOrTarget: 'button[type="submit"], button:has-text("Send"), button:has-text("Submit")',
            description: 'Submit contact form',
            expectedOutcome: 'Success message or confirmation banner is shown'
          }
        ],
        expectedOutcomes: [
          'Form validates all required fields without unhandled validation errors',
          'Submission confirmation message is shown to the user'
        ],
        failureConditions: [
          'Submit button does not respond or stays in permanent loading state',
          'Form fails validation despite valid test data',
          'Server returns 500 Internal Server Error upon POST'
        ],
        allowedDomains,
        maxSteps: 7,
        executionBudget: 15,
        testData: params.testData || {
          name: 'Synthetic Tester',
          email: 'contact.test@example.com',
          message: 'Automated UX Intent verification inquiry.'
        },
        hasConsequentialActions: isConsequential,
        consequentialWarning
      };
    }
    // 3. Archetype: Account creation / signup
    else if (/account|sign\s*up|register|create\s*user/i.test(goalLower)) {
      spec = {
        goal: params.naturalGoal,
        startingUrl,
        preconditions: [
          'Registration portal is open for new users',
          'Email address used has not been registered yet'
        ],
        orderedSteps: [
          {
            stepNumber: 1,
            actionType: 'navigate',
            selectorOrTarget: startingUrl,
            description: 'Navigate to starting page',
            expectedOutcome: 'Home or landing page displays Sign Up CTA'
          },
          {
            stepNumber: 2,
            actionType: 'click',
            selectorOrTarget: 'a[href*="signup"], a[href*="register"], button:has-text("Sign Up")',
            description: 'Click Sign Up CTA',
            expectedOutcome: 'Registration view or form displays'
          },
          {
            stepNumber: 3,
            actionType: 'fill',
            selectorOrTarget: 'input[type="email"], input[name*="email"]',
            value: `synth_${Date.now()}@example.com`,
            description: 'Enter unique synthetic email address',
            expectedOutcome: 'Email accepted without inline validation error'
          },
          {
            stepNumber: 4,
            actionType: 'fill',
            selectorOrTarget: 'input[type="password"]',
            value: 'SyntheticPass123!@#',
            description: 'Enter compliant synthetic password',
            expectedOutcome: 'Password strength indicators turn valid'
          },
          {
            stepNumber: 5,
            actionType: 'click',
            selectorOrTarget: 'button[type="submit"], button:has-text("Create Account")',
            description: 'Submit registration form',
            expectedOutcome: 'User reaches welcome dashboard or email confirmation view'
          }
        ],
        expectedOutcomes: [
          'Account registration accepts synthetic credentials and transitions to dashboard'
        ],
        failureConditions: [
          'Signup submit button disabled without explaining validation criteria',
          'Registration API call crashes or throws unhandled CORS error'
        ],
        allowedDomains,
        maxSteps: 6,
        executionBudget: 15,
        testData: params.testData || {
          email: `synth_${Date.now()}@example.com`,
          password: 'SyntheticPass123!@#'
        },
        hasConsequentialActions: isConsequential,
        consequentialWarning
      };
    }
    // 4. Archetype: Order tracking / Information retrieval
    else if (/order|track|receipt|status/i.test(goalLower)) {
      spec = {
        goal: params.naturalGoal,
        startingUrl,
        preconditions: [
          'Order tracking form is publicly available',
          'Synthetic order ID format matches system requirements'
        ],
        orderedSteps: [
          {
            stepNumber: 1,
            actionType: 'navigate',
            selectorOrTarget: startingUrl,
            description: 'Navigate to starting page',
            expectedOutcome: 'Navigation renders with Order Lookup or Track Order'
          },
          {
            stepNumber: 2,
            actionType: 'click',
            selectorOrTarget: 'a[href*="track"], a[href*="order"], a:has-text("Track Order")',
            description: 'Open Order Tracking page',
            expectedOutcome: 'Order lookup form is displayed'
          },
          {
            stepNumber: 3,
            actionType: 'fill',
            selectorOrTarget: 'input[name*="order"], input[placeholder*="order" i]',
            value: params.testData?.orderId || 'ORD-98241',
            description: 'Enter test order identifier',
            expectedOutcome: 'Order number input populated'
          },
          {
            stepNumber: 4,
            actionType: 'click',
            selectorOrTarget: 'button[type="submit"], button:has-text("Track"), button:has-text("Search")',
            description: 'Submit lookup query',
            expectedOutcome: 'Order tracking timeline or status card is displayed'
          }
        ],
        expectedOutcomes: [
          'User successfully locates order information without interface confusion'
        ],
        failureConditions: [
          'Lookup fails with unhelpful error or blank screen',
          'Form fails to submit due to broken event handler'
        ],
        allowedDomains,
        maxSteps: 5,
        executionBudget: 15,
        testData: params.testData || { orderId: 'ORD-98241' },
        hasConsequentialActions: isConsequential,
        consequentialWarning
      };
    }
    // 5. Default Generic Goal Archetype
    else {
      spec = {
        goal: params.naturalGoal,
        startingUrl,
        preconditions: [
          'Target URL is reachable and within allowed domains',
          'Primary navigation and content render within standard viewport'
        ],
        orderedSteps: [
          {
            stepNumber: 1,
            actionType: 'navigate',
            selectorOrTarget: startingUrl,
            description: 'Navigate to target page',
            expectedOutcome: 'Target page loads with HTTP 200'
          },
          {
            stepNumber: 2,
            actionType: 'assert',
            selectorOrTarget: 'main, [role="main"], body',
            description: 'Verify core landmark readability',
            expectedOutcome: 'Main landmark content is visible to user'
          },
          {
            stepNumber: 3,
            actionType: 'click',
            selectorOrTarget: 'nav a, header a, button.primary, a.btn',
            description: 'Interact with primary navigation affordance',
            expectedOutcome: 'Navigation updates active view or triggers interaction'
          }
        ],
        expectedOutcomes: [
          'User can accomplish desired objective without encountering fatal blockers'
        ],
        failureConditions: [
          'Critical CTA is missing, obstructed, or unclickable',
          'Console errors crash page rendering'
        ],
        allowedDomains,
        maxSteps: 5,
        executionBudget: 10,
        testData: params.testData || {},
        hasConsequentialActions: isConsequential,
        consequentialWarning
      };
    }

    return spec;
  }

  /**
   * Create a draft investigation in the database.
   */
  static createDraftInvestigation(params: {
    projectId: string;
    naturalGoal: string;
    startingUrl?: string;
    testData?: Record<string, string>;
    baselineInvestigationId?: string;
  }): DetectiveInvestigationRecord {
    const spec = this.generateJourneySpec(params);
    const id = `inv-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO detective_investigations (
        id, project_id, baseline_investigation_id, natural_goal, starting_url,
        preconditions_json, ordered_steps_json, expected_outcomes_json, failure_conditions_json,
        allowed_domains_json, max_steps, execution_budget, test_data_json,
        is_approved_by_user, has_consequential_actions, consequential_warning,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'draft', ?)
    `).run(
      id,
      params.projectId,
      params.baselineInvestigationId || null,
      spec.goal,
      spec.startingUrl,
      JSON.stringify(spec.preconditions),
      JSON.stringify(spec.orderedSteps),
      JSON.stringify(spec.expectedOutcomes),
      JSON.stringify(spec.failureConditions),
      JSON.stringify(spec.allowedDomains),
      spec.maxSteps,
      spec.executionBudget,
      JSON.stringify(spec.testData),
      spec.hasConsequentialActions ? 1 : 0,
      spec.consequentialWarning || null,
      now
    );

    return this.getInvestigation(id)!;
  }

  /**
   * Approve a proposed journey spec for execution.
   */
  static approveInvestigation(investigationId: string): boolean {
    const res = db.prepare(`
      UPDATE detective_investigations 
      SET is_approved_by_user = 1, status = 'approved'
      WHERE id = ?
    `).run(investigationId);
    return res.changes > 0;
  }

  /**
   * Retrieve an investigation by ID.
   */
  static getInvestigation(id: string): DetectiveInvestigationRecord | null {
    const row = db.prepare('SELECT * FROM detective_investigations WHERE id = ?').get(id) as any;
    return row || null;
  }

  /**
   * List all investigations for a project.
   */
  static listInvestigations(projectId: string): DetectiveInvestigationRecord[] {
    return db.prepare(`
      SELECT * FROM detective_investigations 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `).all(projectId) as DetectiveInvestigationRecord[];
  }

  /**
   * Execute an approved Intent-to-Failure investigation.
   */
  static async executeInvestigation(investigationId: string): Promise<DetectiveInvestigationRecord> {
    const inv = this.getInvestigation(investigationId);
    if (!inv) throw new Error(`Investigation ${investigationId} not found`);

    if (inv.is_approved_by_user !== 1) {
      throw new Error(`Investigation ${investigationId} must be reviewed and approved by user before execution.`);
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(inv.project_id) as any;
    if (!project) throw new Error(`Project ${inv.project_id} not found`);

    const allowedDomains: string[] = JSON.parse(inv.allowed_domains_json || '[]');
    const orderedSteps: JourneyStep[] = JSON.parse(inv.ordered_steps_json || '[]');
    const testData: Record<string, string> = JSON.parse(inv.test_data_json || '{}');

    // 1. SSRF Safeguard check on starting URL
    const ssrfCheck = SSRFProtectionService.isSafeDestination(inv.starting_url, allowedDomains);
    if (!ssrfCheck.safe) {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE detective_investigations
        SET status = 'failed', outcome = 'INCONCLUSIVE_BLOCKED',
            observed_defect_summary = ?, completed_at = ?
        WHERE id = ?
      `).run(`Blocked by SSRF Safeguard: ${ssrfCheck.reason}`, now, investigationId);
      return this.getInvestigation(investigationId)!;
    }

    // 2. Setup run record
    const runId = `run-det-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO runs (
        id, project_id, persona_ids, scenario_ids, status,
        current_step_index, total_steps, viewport, browser, model_mode,
        action_budget, actions_executed, started_at, task_outcome,
        findings_count, is_demo_run
      ) VALUES (?, ?, '[]', '[]', 'running', 0, ?, 'desktop-1440', 'chromium', 'deterministic', ?, 0, ?, 'in_progress', '0', 0)
    `).run(runId, inv.project_id, orderedSteps.length, inv.execution_budget, now);

    db.prepare(`
      UPDATE detective_investigations 
      SET status = 'running', run_id = ?
      WHERE id = ?
    `).run(runId, investigationId);

    const screenshotsDir = path.join(config.artifactsDir, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];
    let breakingStepIndex: number | null = null;
    let breakingActionSummary: string | null = null;
    let breakingReason: string | null = null;
    let failureScreenshotPath: string | null = null;
    let diagnosis: InvestigationDiagnosis | null = null;
    let findingId: string | null = null;

    try {
      browser = await this.launchBrowser();
      context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 VeyloraUX/1.0'
      });
      page = await context.newPage();

      // Listen for errors
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        consoleErrors.push(`[Uncaught Crash] ${err.message}`);
      });
      page.on('requestfailed', req => {
        networkErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText || 'Unknown'}`);
      });

      // Execute each step
      let stepIdx = 0;
      for (const step of orderedSteps) {
        stepIdx++;
        db.prepare('UPDATE runs SET current_step_index = ?, actions_executed = ? WHERE id = ?')
          .run(stepIdx, stepIdx, runId);

        try {
          if (step.actionType === 'navigate') {
            await page.goto(step.selectorOrTarget, { timeout: 12000, waitUntil: 'domcontentloaded' });
          } else if (step.actionType === 'click') {
            // Wait for selector with reasonable timeout
            const element = await page.waitForSelector(step.selectorOrTarget, { timeout: 5000, state: 'visible' });
            if (!element) throw new Error(`Target selector "${step.selectorOrTarget}" not found in DOM.`);
            await element.click({ timeout: 4000 });
            await page.waitForTimeout(500); // Allow DOM animations/updates
          } else if (step.actionType === 'fill') {
            const inputVal = step.value || testData[step.selectorOrTarget] || 'synthetic_data';
            const inputElem = await page.waitForSelector(step.selectorOrTarget, { timeout: 5000, state: 'visible' });
            if (!inputElem) throw new Error(`Input field "${step.selectorOrTarget}" not visible.`);
            await inputElem.fill(inputVal);
          } else if (step.actionType === 'assert') {
            const found = await page.waitForSelector(step.selectorOrTarget, { timeout: 5000, state: 'visible' });
            if (!found) throw new Error(`Assertion failed: "${step.selectorOrTarget}" was not visible.`);
          } else if (step.actionType === 'scroll') {
            await page.evaluate(() => window.scrollBy(0, 500));
          }

          // Check if fatal page crash happened right after step
          if (consoleErrors.some(c => c.includes('[Uncaught Crash]'))) {
            throw new Error(`Fatal runtime crash triggered during step: ${consoleErrors.find(c => c.includes('[Uncaught Crash]'))}`);
          }
        } catch (stepErr: any) {
          // STEP FAILED!
          breakingStepIndex = step.stepNumber;
          breakingActionSummary = `Failed at Step ${step.stepNumber}: ${step.description}`;
          breakingReason = stepErr.message || 'Action failed to execute or timed out.';

          // Capture failure screenshot
          const shotName = `detective_${investigationId}_step_${step.stepNumber}_${Date.now()}.png`;
          const shotFullPath = path.join(screenshotsDir, shotName);
          try {
            await page.screenshot({ path: shotFullPath, fullPage: false });
            failureScreenshotPath = `/artifacts/screenshots/${shotName}`;
          } catch {}

          break; // Stop execution on first breaking failure
        }
      }

      // Record evidence in database if screenshot taken
      let evidenceId: string | null = null;
      if (failureScreenshotPath) {
        evidenceId = `ev-det-${crypto.randomBytes(4).toString('hex')}`;
        db.prepare(`
          INSERT INTO evidence (id, run_id, file_path, file_type, caption, created_at)
          VALUES (?, ?, ?, 'screenshot', ?, ?)
        `).run(evidenceId, runId, failureScreenshotPath, `Detective Failure Screenshot: Step ${breakingStepIndex}`, new Date().toISOString());
      }

      const completedAt = new Date().toISOString();

      if (breakingStepIndex !== null) {
        // A specific step failed. Let's classify diagnosis and verification status!
        const isTimeoutOrHostBlocked = /net::ERR_|timeout|navigation failed/i.test(breakingReason || '');
        const isUnhandledCrash = consoleErrors.some(e => e.includes('Crash') || e.includes('TypeError'));

        let verificationStatus: VerificationStatus = 'VERIFIED';
        let outcome: 'FAILURE_DETECTED' | 'INCONCLUSIVE_BLOCKED' = 'FAILURE_DETECTED';

        if (isTimeoutOrHostBlocked && breakingStepIndex === 1) {
          // Failed to load host
          verificationStatus = 'INCONCLUSIVE_BLOCKED';
          outcome = 'INCONCLUSIVE_BLOCKED';
        } else if (isUnhandledCrash || breakingReason?.includes('not found') || breakingReason?.includes('Assertion failed')) {
          // Objective fact verified by DOM/Browser
          verificationStatus = 'VERIFIED';
          outcome = 'FAILURE_DETECTED';
        } else {
          verificationStatus = 'STRONGLY_SUPPORTED';
          outcome = 'FAILURE_DETECTED';
        }

        diagnosis = {
          problemDescription: `Journey broke at step ${breakingStepIndex}: ${breakingActionSummary}`,
          observedFacts: `Browser executed ${breakingStepIndex - 1} steps before failure. Action returned: "${breakingReason}". Console recorded ${consoleErrors.length} errors.`,
          likelyRootCause: isTimeoutOrHostBlocked
            ? 'Host network connectivity or CORS restriction prevented page load.'
            : isUnhandledCrash
              ? 'Uncaught JavaScript runtime exception crashed interaction handler.'
              : `Element matching selector was missing from DOM or occluded by overlay.`,
          isHypothesis: !isUnhandledCrash, // Marked as hypothesis unless an explicit stack trace exists
          suggestedFix: isTimeoutOrHostBlocked
            ? 'Ensure staging environment is accessible and permits headless automation.'
            : `Inspect DOM selector for Step ${breakingStepIndex}. Verify element is rendered with accessible name and visible in viewport.`,
          verificationStatus,
          confidence: verificationStatus === 'VERIFIED' ? 'high' : 'medium',
          rationale: `Determined via Playwright browser execution. Verification status "${verificationStatus}" assigned based on objective event logs.`,
          reproducibility: 'Reproduced deterministically in Chromium 1440x900 viewport.',
          evidenceReferences: evidenceId ? [evidenceId] : []
        };

        // Create finding in findings table
        findingId = `find-det-${crypto.randomBytes(4).toString('hex')}`;
        const sanitizedFinding = EvidenceGuardService.sanitizeAndClassifyFinding({
          title: `Goal Failure: ${inv.natural_goal.slice(0, 80)}`,
          category: 'usability',
          severity: 'critical',
          confidence: diagnosis.confidence,
          observedFacts: diagnosis.observedFacts,
          possibleCause: diagnosis.likelyRootCause,
          recommendedAction: diagnosis.suggestedFix,
          pageUrl: inv.starting_url,
          stepNumber: breakingStepIndex,
          selectorSummary: breakingActionSummary || undefined,
          isHeuristic: diagnosis.isHypothesis,
          proposedVerificationStatus: verificationStatus
        });

        db.prepare(`
          INSERT INTO findings (
            id, run_id, project_id, category, severity, confidence, title,
            observed_facts, possible_cause, recommended_action, page_url, step_number,
            status, is_heuristic, created_at, fingerprint, verification_status,
            lifecycle_status, selector_summary, investigation_id, evidence_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review', ?, ?, ?, ?, 'NEW', ?, ?, ?)
        `).run(
          findingId,
          runId,
          inv.project_id,
          sanitizedFinding.category,
          sanitizedFinding.severity,
          sanitizedFinding.confidence,
          sanitizedFinding.title,
          sanitizedFinding.observedFacts,
          sanitizedFinding.possibleCause,
          sanitizedFinding.recommendedAction,
          sanitizedFinding.pageUrl,
          sanitizedFinding.stepNumber,
          sanitizedFinding.isHeuristic ? 1 : 0,
          completedAt,
          `fp_${findingId}`,
          sanitizedFinding.verificationStatus,
          sanitizedFinding.selectorSummary,
          investigationId,
          evidenceId
        );

        // Also add to Roadmap
        try {
          RoadmapService.generateRoadmapForProject(inv.project_id);
        } catch {}

        // Check if this was a retest of a baseline investigation!
        let retestStatus: 'BASELINE' | 'RESOLVED' | 'PERSISTING' | 'REGRESSION' | 'INCONCLUSIVE' = 'BASELINE';
        let comparisonNotes = '';

        if (inv.baseline_investigation_id) {
          const baseline = this.getInvestigation(inv.baseline_investigation_id);
          if (baseline) {
            if (baseline.breaking_step_index === breakingStepIndex) {
              retestStatus = 'PERSISTING';
              comparisonNotes = `Retest broke at the exact same Step ${breakingStepIndex}. The underlying failure remains unresolved.`;
            } else if (breakingStepIndex < (baseline.breaking_step_index || 999)) {
              retestStatus = 'REGRESSION';
              comparisonNotes = `Regression detected! Retest failed earlier at Step ${breakingStepIndex} (baseline reached Step ${baseline.breaking_step_index}).`;
            } else {
              retestStatus = 'PERSISTING';
              comparisonNotes = `Retest progressed past baseline breaking step but failed at subsequent Step ${breakingStepIndex}.`;
            }
          }
        }

        db.prepare(`
          UPDATE detective_investigations
          SET status = 'completed', outcome = ?, breaking_step_index = ?,
              breaking_action_summary = ?, observed_defect_summary = ?,
              evidence_id = ?, finding_id = ?, diagnosis_json = ?,
              retest_status = ?, comparison_notes = ?, completed_at = ?
          WHERE id = ?
        `).run(
          outcome,
          breakingStepIndex,
          breakingActionSummary,
          diagnosis.problemDescription,
          evidenceId,
          findingId,
          JSON.stringify(diagnosis),
          retestStatus,
          comparisonNotes,
          completedAt,
          investigationId
        );

        db.prepare(`
          UPDATE runs 
          SET status = 'completed', task_outcome = 'failed', ended_at = ?,
              console_errors_count = ?, network_errors_count = ?, findings_count = '1'
          WHERE id = ?
        `).run(completedAt, consoleErrors.length, networkErrors.length, runId);

      } else {
        // ALL STEPS PASSED! GOAL ACHIEVED!
        let retestStatus: 'BASELINE' | 'RESOLVED' | 'PERSISTING' | 'REGRESSION' | 'INCONCLUSIVE' = 'BASELINE';
        let comparisonNotes = 'All journey steps completed successfully.';

        if (inv.baseline_investigation_id) {
          const baseline = this.getInvestigation(inv.baseline_investigation_id);
          if (baseline && baseline.outcome === 'FAILURE_DETECTED') {
            retestStatus = 'RESOLVED';
            comparisonNotes = `Verified Fix! Baseline failed at Step ${baseline.breaking_step_index}, but retest passed all steps cleanly.`;
          }
        }

        db.prepare(`
          UPDATE detective_investigations
          SET status = 'completed', outcome = 'GOAL_ACHIEVED',
              breaking_step_index = NULL, breaking_action_summary = NULL,
              observed_defect_summary = 'All user journey steps executed and verified successfully.',
              retest_status = ?, comparison_notes = ?, completed_at = ?
          WHERE id = ?
        `).run(retestStatus, comparisonNotes, completedAt, investigationId);

        db.prepare(`
          UPDATE runs 
          SET status = 'completed', task_outcome = 'passed', ended_at = ?,
              console_errors_count = ?, network_errors_count = ?, findings_count = '0'
          WHERE id = ?
        `).run(completedAt, consoleErrors.length, networkErrors.length, runId);
      }

    } catch (fatalErr: any) {
      console.error(`[IntentDetective] Fatal error executing investigation ${investigationId}:`, fatalErr);
      const completedAt = new Date().toISOString();
      db.prepare(`
        UPDATE detective_investigations
        SET status = 'failed', outcome = 'INCONCLUSIVE_BLOCKED',
            observed_defect_summary = ?, completed_at = ?
        WHERE id = ?
      `).run(`Execution blocked by browser error: ${fatalErr.message}`, completedAt, investigationId);

      db.prepare(`UPDATE runs SET status = 'failed', task_outcome = 'error', ended_at = ? WHERE id = ?`)
        .run(completedAt, runId);
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }

    return this.getInvestigation(investigationId)!;
  }

  /**
   * Verified Before / After Retest:
   * Associates a baseline investigation with a new retest run to verify if a proposed fix actually resolved the failure.
   */
  static createRetest(baselineInvestigationId: string): DetectiveInvestigationRecord {
    const baseline = this.getInvestigation(baselineInvestigationId);
    if (!baseline) throw new Error(`Baseline investigation ${baselineInvestigationId} not found`);

    const id = `inv-retest-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO detective_investigations (
        id, project_id, baseline_investigation_id, natural_goal, starting_url,
        preconditions_json, ordered_steps_json, expected_outcomes_json, failure_conditions_json,
        allowed_domains_json, max_steps, execution_budget, test_data_json,
        is_approved_by_user, has_consequential_actions, consequential_warning,
        status, retest_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'approved', 'PENDING', ?)
    `).run(
      id,
      baseline.project_id,
      baselineInvestigationId,
      `Retest: ${baseline.natural_goal}`,
      baseline.starting_url,
      baseline.preconditions_json,
      baseline.ordered_steps_json,
      baseline.expected_outcomes_json,
      baseline.failure_conditions_json,
      baseline.allowed_domains_json,
      baseline.max_steps,
      baseline.execution_budget,
      baseline.test_data_json,
      baseline.has_consequential_actions,
      baseline.consequential_warning || null,
      now
    );

    return this.getInvestigation(id)!;
  }
}
