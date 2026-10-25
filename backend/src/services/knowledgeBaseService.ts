import { IntentClassificationResult, IntentClassifierService } from './intentClassifierService.js';
import { LanguageDetectionResult, LanguageService, SupportedLanguage } from './languageService.js';

export interface ScreenKnowledge {
  route: string;
  name: string;
  description: string;
  keyControls: Array<{ name: string; action: string; purpose: string }>;
  commonWorkflows: string[];
  troubleshooting: string[];
}

export class KnowledgeBaseService {
  private static screens: Record<string, ScreenKnowledge> = {
    '/': {
      route: '/',
      name: 'Workbench & Overview',
      description: 'The primary dashboard showing testing activity, recent test runs, critical findings breakdown, and quick launch triggers.',
      keyControls: [
        { name: 'Launch New Test Run', action: 'Opens modal to select project, personas, and scenarios to trigger Playwright execution.', purpose: 'Start a synthetic journey test.' },
        { name: 'View All Runs', action: 'Navigates to /runs page.', purpose: 'Inspect ongoing or completed test runs.' },
        { name: 'View Critical Findings', action: 'Filters findings by critical severity.', purpose: 'Prioritize fixing blocker issues.' }
      ],
      commonWorkflows: [
        'Review recent testing health score and severity distribution.',
        'Launch an automated Playwright journey across active personas.',
        'Jump to the highest severity UX findings.'
      ],
      troubleshooting: [
        'If recent runs are empty, click "Launch New Test Run" or navigate to /scenarios to define a test journey.',
        'If a run displays "failed", click on the run to view step-by-step console errors and screenshots.'
      ]
    },
    '/detective': {
      route: '/detective',
      name: 'Intent-to-Failure Detective',
      description: 'The signature capability that investigates whether a user-defined website goal can be completed, explains where the journey fails with evidence, and verifies whether a proposed fix actually works.',
      keyControls: [
        { name: 'Natural Goal Input', action: 'Input target journey description.', purpose: 'Define what a user should be able to accomplish in plain English.' },
        { name: 'Synthesize Journey Spec', action: 'Generates structured steps, preconditions, and fixtures.', purpose: 'Creates a testable journey specification for review before execution.' },
        { name: 'Approve & Investigate Goal', action: 'Launches Playwright runner against the target website.', purpose: 'Executes the journey, captures step evidence, and pinpoints breaking failures.' },
        { name: 'Retest Proposed Fix', action: 'Executes a verified before/after retest.', purpose: 'Validates whether a code or UX change actually resolved the detected failure.' }
      ],
      commonWorkflows: [
        'Formulate a website goal such as checkout, registration, or contact form submission.',
        'Review the generated journey specification and safe sandbox test fixtures.',
        'Execute the investigation with Playwright to discover failure points.',
        'Inspect the evidence-backed diagnosis and send findings to the Smart Fix Roadmap.',
        'Retest the journey after applying a fix to verify resolution.'
      ],
      troubleshooting: [
        'If the investigation is inconclusive, verify the target URL is reachable and within Allowed Domains.',
        'Consequential actions (such as checkout payments) use safe synthetic test data to avoid real transactions.'
      ]
    },
    '/projects': {
      route: '/projects',
      name: 'Project Management',
      description: 'Configure targets for UX analysis, such as staging websites or prototypes, including domain allowlists and viewports.',
      keyControls: [
        { name: 'Create Project', action: 'Opens project creation form.', purpose: 'Define target website URL, allowed domain patterns, and default viewport.' },
        { name: 'Allowed Domains Field', action: 'Input comma-separated domain wildcards.', purpose: 'Prevents browser automation from wandering outside authorized staging domains.' },
        { name: 'Viewport Preset', action: 'Select Desktop (1440x900), Tablet (768x1024), or Mobile (390x844).', purpose: 'Sets the default viewport dimensions for Playwright.' }
      ],
      commonWorkflows: [
        'Create a new project targeting your staging environment.',
        'Configure the domain allowlist (e.g., staging.example.com) for safety compliance.',
        'Inspect existing project configurations and attached scenarios.'
      ],
      troubleshooting: [
        'If a Playwright test terminates early with a domain error, ensure all subdomains or SSO redirect domains are added to "Allowed Domains".'
      ]
    },
    '/synthetic-agents': {
      route: '/synthetic-agents',
      name: 'Synthetic Agent Sandbox',
      description: 'Define synthetic user models with distinct cognitive traits, device contexts, accessibility needs, and goal orientations.',
      keyControls: [
        { name: 'Create Synthetic Agent', action: 'Opens agent creation drawer.', purpose: 'Create a synthetic user profile.' },
        { name: 'Familiarity Slider', action: 'Choose Novice, Moderate, or Expert.', purpose: 'Influences synthetic scanning speed and heuristic tolerance.' },
        { name: 'Patience & Reading Tendency', action: 'Configure patience level and skimmer vs methodical behavior.', purpose: 'Simulates drop-offs and banner blindness.' },
        { name: 'Accessibility Needs', action: 'Toggle needs like high contrast, keyboard navigation, or screen reader labels.', purpose: 'Detects accessibility violations specific to user groups.' }
      ],
      commonWorkflows: [
        'Select template synthetic agents like First-time Visitor or Mobile-First Browser.',
        'Adjust traits to reflect your product target demographic.',
        'Enable or disable specific synthetic agents for targeted test runs.'
      ],
      troubleshooting: [
        'Ensure at least one synthetic agent is enabled before initiating a test run.'
      ]
    },
    '/personas': {
      route: '/personas',
      name: 'Synthetic Agent Sandbox',
      description: 'Define synthetic user models with distinct cognitive traits, device contexts, accessibility needs, and goal orientations.',
      keyControls: [
        { name: 'Create Synthetic Agent', action: 'Opens agent creation drawer.', purpose: 'Create a synthetic user profile.' },
        { name: 'Familiarity Slider', action: 'Choose Novice, Moderate, or Expert.', purpose: 'Influences synthetic scanning speed and heuristic tolerance.' },
        { name: 'Patience & Reading Tendency', action: 'Configure patience level and skimmer vs methodical behavior.', purpose: 'Simulates drop-offs and banner blindness.' },
        { name: 'Accessibility Needs', action: 'Toggle needs like high contrast, keyboard navigation, or screen reader labels.', purpose: 'Detects accessibility violations specific to user groups.' }
      ],
      commonWorkflows: [
        'Select template synthetic agents like First-time Visitor or Mobile-First Browser.',
        'Adjust traits to reflect your product target demographic.',
        'Enable or disable specific synthetic agents for targeted test runs.'
      ],
      troubleshooting: [
        'Ensure at least one synthetic agent is enabled before initiating a test run.'
      ]
    },
    '/scenarios': {
      route: '/scenarios',
      name: 'Scenarios & Test Plans',
      description: 'Define natural-language user journeys, starting URLs, action budgets, and stop conditions for browser automation.',
      keyControls: [
        { name: 'Build New Scenario', action: 'Opens scenario editor at /scenarios/new.', purpose: 'Define journey steps, starting URL, and budget.' },
        { name: 'Action Budget', action: 'Numeric counter (default 15).', purpose: 'Limits maximum browser actions to prevent infinite loops.' },
        { name: 'Stop Conditions', action: 'Define failure criteria (e.g., 404, unhandled error, console crash).', purpose: 'Triggers safe early run termination.' },
        { name: 'AI Generate Plan', action: 'Generates journey steps from a natural-language description.', purpose: 'Accelerates test plan authoring.' }
      ],
      commonWorkflows: [
        'Formulate a journey like "User completes checkout using guest mode".',
        'Specify starting URL and required form fixtures.',
        'Review and approve steps before execution.'
      ],
      troubleshooting: [
        'If an action fails during run, verify target selector or increase action budget.'
      ]
    },
    '/runs': {
      route: '/runs',
      name: 'Execution Runs & Live Runner',
      description: 'Monitor real Playwright browser executions step-by-step, review live console logs, action events, and cancel active runs.',
      keyControls: [
        { name: 'Start Execution', action: 'Launches Playwright headless Chromium runner.', purpose: 'Executes approved journey steps.' },
        { name: 'Cancel Run', action: 'Sends abort signal to terminate browser session.', purpose: 'Stops misbehaving or stalled runs safely.' },
        { name: 'Step Inspector', action: 'Click any step to inspect action details, duration, and captured screenshot.', purpose: 'Detailed verification of executed actions.' }
      ],
      commonWorkflows: [
        'Trigger a multi-persona run against a scenario.',
        'Watch live step-by-step progress, screenshots, and response times.',
        'Inspect console errors or network warnings recorded during execution.'
      ],
      troubleshooting: [
        'If a run hangs, click "Cancel Run" to release browser resources immediately.',
        'Ensure local backend is running on 127.0.0.1:3001 to execute Playwright.'
      ]
    },
    '/findings': {
      route: '/findings',
      name: 'UX Findings Explorer & Evidence Guard',
      description: 'Explore detected UX friction points categorized by severity, grounded in real browser evidence, screenshots, and DOM states.',
      keyControls: [
        { name: 'Severity Filter', action: 'Filter by Critical, High, Medium, or Low.', purpose: 'Focus on high-priority friction.' },
        { name: 'Verification Status Filter', action: 'Filter by VERIFIED, AI_HYPOTHESIS, or NEEDS_REVIEW.', purpose: 'Distinguish facts from model hypotheses.' },
        { name: 'Lifecycle Filter', action: 'Filter by NEW, PERSISTENT, RESOLVED, or RECURRING.', purpose: 'Track issue persistence.' },
        { name: 'Inspect Evidence', action: 'Opens screenshot with target highlight and DOM snippet.', purpose: 'Verify that findings are factual, not imagined.' }
      ],
      commonWorkflows: [
        'Filter for Critical findings affecting novice users.',
        'Read Observed Facts vs Recommended Action.',
        'Export findings or jump to Before/After comparison.'
      ],
      troubleshooting: [
        'All findings link directly to an evidence ID and run step. If screenshot is missing, verify artifact storage directory permissions.'
      ]
    },
    '/comparisons': {
      route: '/comparisons',
      name: 'Verified Before / After Comparisons',
      description: 'Side-by-side comparative inspection of two test runs to verify whether a redesign resolved previously identified friction.',
      keyControls: [
        { name: 'Select Baseline Run (A)', action: 'Choose initial test run.', purpose: 'Represents previous or unimproved user journey.' },
        { name: 'Select Candidate Run (B)', action: 'Choose updated test run.', purpose: 'Represents redesigned or patched user journey.' },
        { name: 'Compare Metrics', action: 'Calculates delta in steps, duration, and findings.', purpose: 'Provides empirical evidence of UX improvement.' },
        { name: 'Export Comparison', action: 'Downloads JSON summary.', purpose: 'Evidence report for pull requests.' }
      ],
      commonWorkflows: [
        'Select baseline run before CSS or flow refactoring.',
        'Select candidate run executed on the patched staging URL.',
        'Inspect resolved findings (FIX VERIFIED) vs unvisited pages (INCONCLUSIVE).'
      ],
      troubleshooting: [
        'Runs must belong to the same project or scenario to provide meaningful comparison deltas.'
      ]
    },
    '/roadmap': {
      route: '/roadmap',
      name: 'Smart Fix Roadmap',
      description: 'Prioritized task list generated using an explainable mathematical formula combining severity, evidence confidence, recurrence, domain bonus, and effort discount.',
      keyControls: [
        { name: 'Priority Tier Filter', action: 'Filter tasks by P0 (Critical/Blocker), P1 (High), P2 (Medium), P3 (Low).', purpose: 'Focus developer effort.' },
        { name: 'Generate Roadmap', action: 'Triggers automated formula scoring and conservative root-cause grouping.', purpose: 'Create or update fix tasks.' },
        { name: 'Mark Status', action: 'Progress tasks from OPEN -> PLANNED -> IN_PROGRESS -> READY_FOR_VERIFICATION -> VERIFIED_FIXED.', purpose: 'Track engineering progress.' }
      ],
      commonWorkflows: [
        'Review highest priority P0 tasks.',
        'Inspect the formula rationale explaining why the item is ranked at its score.',
        'Link task to retest verification.'
      ],
      troubleshooting: [
        'Fix completion does not automatically mark an issue verified until a passing retest runs.'
      ]
    },
    '/reports': {
      route: '/reports',
      name: 'Executive Reports & Export',
      description: 'Generate structured UX audit reports, executive summaries, and download portable standalone HTML or JSON files.',
      keyControls: [
        { name: 'Generate Report', action: 'Compiles run metrics, findings, and evidence into a formal document.', purpose: 'Create presentation-ready audit.' },
        { name: 'Export JSON', action: 'Downloads raw structured report JSON.', purpose: 'Integrate into CI/CD or design team issue trackers.' },
        { name: 'Export Standalone HTML', action: 'Generates self-contained HTML file with embedded styling and SVG mockups.', purpose: 'Share report with faculty, clients, or stakeholders without backend dependencies.' }
      ],
      commonWorkflows: [
        'Select completed test run.',
        'Review AI-assisted executive summary and limitations notice.',
        'Download standalone HTML report for offline presentation.'
      ],
      troubleshooting: [
        'HTML exports are self-contained and do not require internet access or active local servers to view.'
      ]
    },
    '/settings': {
      route: '/settings',
      name: 'Workbench & Privacy Settings',
      description: 'Manage local SQLite storage, sensitive-data redaction, transparent AI transmission boundaries, and evidence retention.',
      keyControls: [
        { name: 'AI Assistance Master Toggle', action: 'Enable or disable all external AI provider calls.', purpose: 'Allows 100% offline rule-based operation.' },
        { name: 'Share Screenshots Toggle', action: 'Disabled by default. Explicitly controls visual capture sharing.', purpose: 'Strict data privacy.' },
        { name: 'Retention Period', action: 'Select 7, 14, 30, 90, or 365 days.', purpose: 'Automates disk cleanup.' },
        { name: 'Prune Expired', action: 'Manually cleans historical evidence older than retention threshold.', purpose: 'Free disk space.' }
      ],
      commonWorkflows: [
        'Configure data sharing boundaries.',
        'Prune expired evidence.',
        'Export full workspace JSON backup.'
      ],
      troubleshooting: [
        'All settings persist locally in SQLite under privacy_settings table.'
      ]
    }
  };

  /**
   * Returns complete product knowledge for a specific screen or fallback
   */
  public static getScreenKnowledge(route: string): ScreenKnowledge {
    const cleanRoute = route.split('?')[0].split('#')[0];
    return this.screens[cleanRoute] || {
      route: cleanRoute,
      name: 'Veylora UX Workbench',
      description: 'Local-first AI-assisted UX testing and synthetic-user simulation workbench.',
      keyControls: [
        { name: 'Navigation Sidebar', action: 'Access all sections: Overview, Projects, Synthetic Agent Sandbox, Scenarios, Runs, Findings, Comparisons, Roadmap, Reports, Settings, Detective.', purpose: 'Main application navigation.' }
      ],
      commonWorkflows: [
        'Create projects, configure synthetic agents, launch real Playwright tests, and review evidence-grounded findings.'
      ],
      troubleshooting: [
        'Use sidebar navigation to jump between workbench modules.'
      ]
    };
  }

  /**
   * Generate an intent-aware, language-tailored system prompt for Ask Veylora.
   * Screen context is included ONLY as secondary supporting background information,
   * NOT as the default forced subject of the response.
   */
  public static generateSystemPrompt(
    screenRoute: string,
    intentResult: IntentClassificationResult,
    languageResult: LanguageDetectionResult,
    screenContextText?: string
  ): string {
    const screen = this.getScreenKnowledge(screenRoute);

    return `You are "Ask Veylora", the built-in AI product guide and assistant for Veylora UX ("See the friction. Prove the path.").
You are an expert on the Veylora UX platform: its architecture, routes, workflows, persona simulation, Playwright browser runner, Intent-to-Failure Detective, UX findings, evidence traceability, and reports.

${languageResult.directives}

CORE ARCHITECTURE & PRODUCT FACTS:
- 100% Local-first: zero cloud databases. Application state persists in local SQLite (backend/data/veylora.sqlite).
- Real browser testing with Playwright + Chromium: safe domain allowlists, action budgets, cancellation controls, and real screenshots/DOM evidence.
- Intent-to-Failure Detective: user formulates natural goals, Veylora converts to structured journey spec, investigates with Playwright, and diagnoses failures with evidence.
- Smart Fix Roadmap: prioritizes tasks with transparent formula (Severity*4 + Confidence*2.5 + Recurrence*2 + Domain*2.5 - Effort*1.5) into P0-P3 tiers.
- Verified Before/After: distinguishes confirmed fixes from inconclusive observations where pages were not retested.
- Privacy & Safety: 7-day automatic chat retention, sensitive form field redaction, zero untrusted website script execution.

DETECTED USER INTENT:
- Intent Category: ${intentResult.intent}
- Reason: ${intentResult.reason}
- Screen Context Relevant: ${intentResult.isScreenContextRelevant ? 'YES (Use active screen as primary subject)' : 'NO (Answer question directly without forcing it to active screen)'}

ACTIVE SCREEN (SUPPORTING CONTEXT ONLY):
- Route: ${screen.route} (${screen.name})
- Overview: ${screen.description}
- Controls on this screen:
${screen.keyControls.map(c => `  * "${c.name}": ${c.purpose} (Action: ${c.action})`).join('\n')}
${screenContextText ? `\nACTIVE SCREEN RAW TEXT:\n${screenContextText}` : ''}

CRITICAL ANSWERING RULES:
1. DIRECT ANSWER FIRST: Address the user's specific question immediately.
2. DO NOT OVERUSE SCREEN CONTEXT:
   - If the user asks a GENERAL KNOWLEDGE question (e.g. "What is Playwright?", "What is WCAG?", "What is the weather?"): Explain the concept directly. DO NOT mention or describe the active screen. If asked about live weather or external APIs, state the limitation honestly.
   - If the user asks a HOW-TO or NAVIGATION question (e.g. "How do I create a project?", "How do I export a report?"): Provide exact numbered steps using the REAL Veylora routes and buttons, regardless of what screen the user is currently on!
   - If the user asks about the CURRENT SCREEN (e.g. "Explain this screen", "What are the buttons here?"): Then and only then focus primarily on the active screen controls.
3. NEVER INVENT OR FABRICATE: Cite only real Veylora routes and buttons. If a capability does not exist, state so clearly.
4. SECRECY: Never expose internal API keys, server secrets, or raw internal usage counters.
5. PRESERVE TECHNICAL TERMS: Keep UI button names (e.g. "Create Project button", "Launch New Test Run") and technical terms (e.g. "Playwright", "SQLite", "Viewport") in English even when answering in Telugu or Tanglish.`;
  }

  /**
   * Local rule-based fallback response for Ask Veylora when all AI providers are offline or unconfigured.
   * Completely intent-aware and supports English, Telugu script, and Tanglish.
   */
  public static getLocalHelpResponse(
    question: string,
    screenRoute: string,
    intentResult?: IntentClassificationResult,
    languageResult?: LanguageDetectionResult | string
  ): string {
    const effectiveIntent = intentResult || IntentClassifierService.classify(question, screenRoute);
    const effectiveLang = typeof languageResult === 'string'
      ? { language: languageResult as any, displayName: languageResult, isExplicitOverride: true, directives: '' }
      : (languageResult || LanguageService.detect(question));
    const screen = this.getScreenKnowledge(screenRoute);
    const qLower = question.toLowerCase();
    const lang = effectiveLang.language;

    // 1. GENERAL KNOWLEDGE: "What is Playwright?", "What is WCAG?", Weather, etc.
    if (effectiveIntent.intent === 'GENERAL_KNOWLEDGE') {
      if (qLower.includes('playwright')) {
        if (lang === 'te-Telu') {
          return `### Playwright అంటే ఏమిటి?\n\n**Playwright** అనేది Microsoft వారి ఓపెన్ సోర్స్ బ్రౌజర్ ఆటోమేషన్ ఫ్రేమ్‌వర్క్. ఇది Chromium, Firefox, మరియు WebKit బ్రౌజర్‌లను ఆటోమేట్ చేయడానికి ఉపయోగపడుతుంది.\n\n**Veylora UX లో Playwright పాత్ర:**\n• మీ వెబ్‌సైట్‌పై నిజమైన బ్రౌజర్ టెస్టులను నడుపుతుంది.\n• యూజర్ క్లిక్స్, ఫారమ్ ఫిల్లింగ్, మరియు నావిగేషన్లను రికార్డ్ చేస్తుంది.\n• ప్రతి స్టెప్ వద్ద స్క్రీన్‌షాట్‌లు మరియు DOM స్టేట్స్‌ను ఎవిడెన్స్‌గా క్యాప్చర్ చేస్తుంది.\n• బటన్లు లేదా లింక్స్ క్లిక్ అవ్వకపోతే ఖచ్చితంగా ఫెయిల్యూర్‌ను డిటెక్ట్ చేస్తుంది.`;
        }
        if (lang === 'te-Latn') {
          return `### Playwright ante enti?\n\n**Playwright** anedhi Microsoft develop chesina open-source browser automation tool. Idhi Chromium, Firefox, mariyu WebKit browsers ni headless or headed mode lo run cheyyadaniki use avthundhi.\n\n**Veylora UX lo Playwright role:**\n• Mee target website meedha real browser journeys ni execute chestundhi.\n• User clicks, scrolling, form inputs ni automate chestundhi.\n• Prathi action step daggara real screenshots mariyu console errors ni evidence ga capture chestundhi.\n• Any UI blockers or broken flows unte exact step daggara catch chestundhi.`;
        }
        return `### What is Playwright?\n\n**Playwright** is a modern, open-source browser automation framework created by Microsoft. It automates Chromium, Firefox, and WebKit browsers with speed, reliability, and full devtools protocol access.\n\n**How Veylora UX Uses Playwright:**\n• **Real Browser Automation**: Executes synthetic persona journeys against your staging website or prototype.\n• **Evidence Capture**: Records high-resolution screenshots, DOM states, console exceptions, and network response codes.\n• **Safety & Boundaries**: Enforces strict domain allowlists and action budgets to prevent runaway automation.\n• **Deterministic Verification**: Provides repeatable facts on whether a button click, form submission, or navigation succeeded.`;
      }

      if (qLower.includes('weather')) {
        if (lang === 'te-Telu') {
          return `నేను **Veylora UX** ప్రొడక్ట్ అసిస్టెంట్‌ని. నాకు లైవ్ వెదర్ డేటా యాక్సెస్ లేదు. కానీ Veylora ప్రాజెక్ట్‌లు, ప్లేరైట్ టెస్ట్‌లు, లేదా UX ఆడిట్స్ గురించి ఏదైనా అడగవచ్చు!`;
        }
        if (lang === 'te-Latn') {
          return `Nenu **Veylora UX** product assistant ni bro. Naaku live weather data access ledu. Kaani Veylora projects, Playwright testing, or UX audit gurinchi edhaina adagachu!`;
        }
        return `I am the **Veylora UX** product assistant. I do not have access to live meteorological weather data. However, I can help you test user journeys, configure Playwright, review accessibility audits, or prioritize fix tasks!`;
      }

      if (qLower.includes('wcag') || qLower.includes('axe')) {
        if (lang === 'te-Latn') {
          return `### WCAG & axe-core ante enti?\n\n**WCAG (Web Content Accessibility Guidelines)** anedhi websites ni accessibility standards ki anugunam ga unchadaniki global standard.\n\nVeylora UX **axe-core** engine ni use chesi color contrast, missing button labels, invalid ARIA roles, mariyu keyboard focus ring suppression ni automatically audit chestundhi.`;
        }
        return `### What is WCAG & axe-core?\n\n**WCAG** (Web Content Accessibility Guidelines) is the internationally recognized standard for digital accessibility.\n\nVeylora UX integrates **axe-core** inside Playwright to evaluate automated WCAG 2.1 AA criteria, verifying color contrast, missing accessible names, and interactive keyboard focus visibility.`;
      }

      return `**Veylora Assistant:** I can directly explain UX concepts, Playwright testing, accessibility, or Veylora features. How can I help you today?`;
    }

    // 2. HOW-TO / NAVIGATION QUESTIONS
    if (effectiveIntent.intent === 'HOW_TO_NAVIGATE' || (qLower.includes('create') && qLower.includes('project')) || qLower.includes('ప్రాజెక్ట్')) {
      if (lang === 'te-Telu') {
        return `### ప్రాజెక్ట్ ఎలా క్రియేట్ చేయాలి (How to Create a Project)\n\n1. ఎడమవైపు సైడ్‌బార్‌లో ఉన్న **Projects** ఆప్షన్‌ను క్లిక్ చేయండి.\n2. పైన ఉన్న **Create Project** లేదా **New Project** బటన్‌ను క్లిక్ చేయండి.\n3. మీ ప్రాజెక్ట్ పేరు మరియు టార్గెట్ వెబ్‌సైట్ URL (ఉదా: \`https://staging.example.com\`) నమోదు చేయండి.\n4. **Allowed Domains** లో మీ డొమైన్‌ను పేర్కొనండి (బ్రౌజర్ బయటకు వెళ్లకుండా రక్షణ కోసం).\n5. డిఫాల్ట్ వ్యూపోర్ట్ (Desktop 1440px, Tablet, లేదా Mobile) ఎంచుకోండి.\n6. **Save Project** పై క్లిక్ చేయండి. ఇప్పుడు మీరు ఈ ప్రాజెక్ట్‌పై టెస్ట్‌లు రన్ చేయవచ్చు!`;
      }
      if (lang === 'te-Latn') {
        return `### Project ela create cheyyali?\n\nProject create cheyyadaniki ee steps follow avvandi:\n1. Left sidebar lo unna **Projects** (\`/projects\`) tab paina click cheyyandi.\n2. Top-right lo unna **New Project** button click cheyyandi.\n3. Mee project name mariyu staging website URL (e.g. \`https://staging.example.com\`) enter cheyyandi.\n4. **Allowed Domains** field lo mee domain ivvandi (safety kosam browser vere sites ki vellakunda restrict chestundhi).\n5. Target default Viewport (Desktop 1440px, Tablet, or Mobile) select chesukondi.\n6. **Save Project** click cheyyandi. Anthe, mee project test runs ki ready!`;
      }
      return `### How to Create a Project\n\n1. In the left navigation sidebar, navigate to **Projects** (\`/projects\`).\n2. Click the **New Project** button.\n3. Enter your project name and target staging URL (e.g. \`https://staging.example.com\`).\n4. Configure **Allowed Domains** (e.g. \`staging.example.com\`) to enforce navigation safety boundaries.\n5. Select your default viewport preset (Desktop 1440x900, Tablet, or Mobile).\n6. Click **Save Project**. Your target is now registered for Playwright test journeys!`;
    }

    if (qLower.includes('export') || qLower.includes('report')) {
      if (lang === 'te-Latn') {
        return `### Report ela export cheyyali?\n\n1. Left sidebar lo unna **Reports** page ki vellandi.\n2. Completed test run ni select cheyyandi.\n3. Executive summary mariyu findings breakdown ni review cheyyండి.\n4. Standalone offline presentation kosam **Export Standalone HTML** click cheyyandi, leda CI/CD kosam **Export JSON** select cheyyandi.`;
      }
      return `### How to Export a Report\n\n1. In the left sidebar, click on **Reports**.\n2. Select your desired completed test run.\n3. Review the executive summary, metrics, and evidence breakdown.\n4. Click **Export Standalone HTML** for a self-contained offline presentation file, or **Export JSON** for programmatic integration.`;
    }

    if (qLower.includes('detective') || qLower.includes('investigat')) {
      if (lang === 'te-Latn') {
        return `### Intent-to-Failure Detective ela use cheyyali?\n\n1. Left sidebar lo unna **Intent Detective** (\`/detective\`) page ki vellandi.\n2. Mee website goal ni natural language lo type cheyyandi (e.g. *"A user should submit a contact form"*).\n3. **Generate Journey Spec** click chesi steps mariyu test fixtures ni review cheyyandi.\n4. **Approve & Run Investigation** click chesthe, Playwright real browser lo execute chesi ekkada fail aindho exact evidence tho chupisthundhi!`;
      }
      return `### How to Use Intent-to-Failure Detective\n\n1. Navigate to **Intent Detective** (\`/detective\`) via the left sidebar.\n2. Enter your user goal in natural language (e.g., *"A new customer finds a product and reaches checkout"*).\n3. Review the generated journey specification (ordered steps, preconditions, expected outcomes, and synthetic test data).\n4. Click **Approve & Run Investigation** to launch the Playwright runner.\n5. The Detective identifies the exact breaking step and delivers an evidence-linked diagnosis.`;
    }

    // 3. CURRENT SCREEN QUESTIONS
    if (effectiveIntent.intent === 'CURRENT_SCREEN' || qLower.includes('button') || qLower.includes('control') || qLower.includes('screen') || qLower.includes('this page')) {
      const controlsList = screen.keyControls.map(c => `• **${c.name}**: ${c.purpose}`).join('\n');
      if (lang === 'te-Latn') {
        return `### ${screen.name}\n\nMeeru ippudu **${screen.name}** (\`${screen.route}\`) screen lo unnaru.\n\n${screen.description}\n\n**Ee screen lo unna main controls:**\n${controlsList}\n\n**Common Workflows:**\n${screen.commonWorkflows.map(w => `• ${w}`).join('\n')}`;
      }
      if (lang === 'te-Telu') {
        return `### ${screen.name}\n\nమీరు ప్రస్తుతం **${screen.name}** (\`${screen.route}\`) స్క్రీన్‌లో ఉన్నారు.\n\n${screen.description}\n\n**ఈ స్క్రీన్‌లో అందుబాటులో ఉన్న కంట్రోల్స్:**\n${controlsList}`;
      }
      return `### ${screen.name}\n\nYou are currently viewing the **${screen.name}** screen (\`${screen.route}\`).\n\n${screen.description}\n\n**Key Controls on this Screen:**\n${controlsList}\n\n**Common Workflows:**\n${screen.commonWorkflows.map(w => `• ${w}`).join('\n')}`;
    }

    // 4. DEFAULT HELPFUL FALLBACK
    if (lang === 'te-Latn') {
      return `### Veylora UX Assistant\n\nNenu meeku Veylora UX gurinchi ela help cheyyagalanu?\n\n• **Projects**: Website create cheyyadam mariyu allowed domains set cheyyadam\n• **Intent Detective**: Website user goals ni test chesi failures ni diagnose cheyyadam\n• **Playwright Runs**: Real browser lo test execution mariyu screenshots chudadam\n• **Smart Roadmap**: P0 nundi P3 priority tasks ni track cheyyadam\n\n*Meeru Telugu, Tanglish, leda English lo edhaina adagachu!*`;
    }
    if (lang === 'te-Telu') {
      return `### Veylora UX అసిస్టెంట్\n\nనేను మీకు ఎలా సహాయపడగలను?\n\n• **Projects**: కొత్త ప్రాజెక్ట్‌లను సెటప్ చేయడం\n• **Intent Detective**: యూజర్ గోల్స్ మరియు జర్నీ ఫెయిల్యూర్స్‌ను ఇన్వెస్టిగేట్ చేయడం\n• **Playwright**: బ్రౌజర్ ఆటోమేషన్ మరియు స్క్రీన్‌షాట్ ఎవిడెన్స్ తనిఖీ చేయడం\n• **Smart Roadmap**: ప్రాధాన్యత ఆధారంగా ఫిక్స్‌లను నిర్వహించడం\n\n*మీరు తెలుగులో లేదా ఇంగ్లీషులో నాతో మాట్లాడవచ్చు!*`;
    }

    return `### Veylora UX Assistant\n\nHow can I assist you with Veylora UX?\n\n• **Create Projects**: Setup target URLs and domain allowlists\n• **Intent Detective**: Formulate goals and run failure investigations\n• **Playwright Runs**: Monitor real browser journeys and inspect evidence\n• **Smart Fix Roadmap**: Prioritize fixes using explainable formulas\n• **Verified Before/After**: Prove that design patches actually resolved issues\n\n*Feel free to ask how-to questions, concept explanations, or in Telugu/Tanglish!*`;
  }

  public static generateFallbackAnswer = KnowledgeBaseService.getLocalHelpResponse;
}

