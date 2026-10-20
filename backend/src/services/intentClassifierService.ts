export type UserIntent =
  | 'GENERAL_KNOWLEDGE'
  | 'VEYLORA_FEATURE'
  | 'CURRENT_SCREEN'
  | 'HOW_TO_NAVIGATE'
  | 'PROJECT_SPECIFIC'
  | 'RUN_FINDING_ANALYSIS'
  | 'ACTION_REQUEST'
  | 'CLARIFICATION_REQUIRED';

export interface IntentClassificationResult {
  intent: UserIntent;
  confidence: number;
  reason: string;
  isScreenContextRelevant: boolean;
}

export class IntentClassifierService {
  /**
   * Deterministically classifies user prompt into one of 8 canonical intents.
   * Ensures general questions (like "What is Playwright?") or workflow how-tos
   * (like "How do I create a project?") are not incorrectly forced into the active screen context.
   */
  public static classify(prompt: string, currentRoute: string = '/'): IntentClassificationResult {
    const text = prompt.trim().toLowerCase();

    // 1. ACTION_REQUEST: User is explicitly requesting a browser action, retest, or roadmap generation
    if (
      text.startsWith('run test') ||
      text.startsWith('start test') ||
      text.startsWith('retest') ||
      text.includes('request retest') ||
      text.includes('generate roadmap') ||
      text.includes('execute action') ||
      text.startsWith('investigate goal') ||
      text.includes('start investigation')
    ) {
      return {
        intent: 'ACTION_REQUEST',
        confidence: 0.95,
        reason: 'User explicitly requested a system action or browser execution.',
        isScreenContextRelevant: true
      };
    }

    // 2. CURRENT_SCREEN: User is explicitly asking about what is on their active screen
    const screenExplicitKeywords = [
      'explain this screen',
      'what is on this screen',
      'what does this screen do',
      'what does this page do',
      'explain this page',
      'what does this button do',
      'this button',
      'what are the buttons here',
      'what buttons are on this screen',
      'what can i do here',
      'what is this screen',
      'about this screen',
      'current screen',
      'ee screen',
      'ee page'
    ];

    if (screenExplicitKeywords.some(kw => text.includes(kw))) {
      return {
        intent: 'CURRENT_SCREEN',
        confidence: 0.95,
        reason: 'User explicitly inquired about the active screen context and visible controls.',
        isScreenContextRelevant: true
      };
    }

    // 3. RUN_FINDING_ANALYSIS: Inquiring about a specific run failure, finding, or evidence
    const analysisKeywords = [
      'why did this run fail',
      'why did run',
      'run fail',
      'failed step',
      'explain finding',
      'why is this finding',
      'show evidence for',
      'console error in run',
      'network failure in run',
      'failure summary'
    ];

    if (
      analysisKeywords.some(kw => text.includes(kw)) ||
      /\brun-\d+\b/i.test(text) ||
      /\bf-\d+\b/i.test(text)
    ) {
      return {
        intent: 'RUN_FINDING_ANALYSIS',
        confidence: 0.9,
        reason: 'User is analyzing a specific test run, failure step, or finding evidence.',
        isScreenContextRelevant: true
      };
    }

    // 4. HOW_TO_NAVIGATE: Step-by-step workflow navigation instructions
    const howToKeywords = [
      'how do i create a project',
      'how to create a project',
      'how do i create project',
      'project ela create cheyyali',
      'how do i add a persona',
      'how to add a persona',
      'how do i run a test',
      'how to run a test',
      'how do i start a run',
      'how do i export a report',
      'how to export a report',
      'how do i download html',
      'how do i build a scenario',
      'how to build a scenario',
      'how do i set allowed domains',
      'where can i see screenshots',
      'how do i compare runs',
      'how to compare runs',
      'how to create',
      'how do i create',
      'how to navigate',
      'ela create cheyyali',
      'ela run cheyyali',
      'ela export cheyyali',
      'ఎలా',
      'ప్రాజెక్ట్',
      'చేయాలి'
    ];

    if (howToKeywords.some(kw => text.includes(kw))) {
      return {
        intent: 'HOW_TO_NAVIGATE',
        confidence: 0.92,
        reason: 'User requested practical step-by-step instructions to perform a workflow in Veylora.',
        isScreenContextRelevant: false // The how-to applies globally, not constrained to active screen!
      };
    }

    // 5. PROJECT_SPECIFIC: Inquiring about user projects or database records
    if (
      text.includes('my projects') ||
      text.includes('show projects') ||
      text.includes('list projects') ||
      text.includes('what projects do i have') ||
      text.includes('project details') ||
      text.includes('project settings for')
    ) {
      return {
        intent: 'PROJECT_SPECIFIC',
        confidence: 0.88,
        reason: 'User is asking about specific project data configured in the workspace.',
        isScreenContextRelevant: false
      };
    }

    // 6. VEYLORA_FEATURE: Architectural or conceptual explanations of Veylora capabilities
    const featureKeywords = [
      'what is regression memory',
      'what is intent-to-failure detective',
      'what is detective',
      'how does detective work',
      'what are personas',
      'what is smart fix roadmap',
      'how is priority score calculated',
      'what is evidence guard',
      'what is action budget',
      'what are negative paths',
      'what is safe mode',
      'why local-first',
      'what does veylora do',
      'veylora gurinchi cheppu',
      'personas gurinchi cheppu',
      'roadmap gurinchi cheppu'
    ];

    if (featureKeywords.some(kw => text.includes(kw))) {
      return {
        intent: 'VEYLORA_FEATURE',
        confidence: 0.9,
        reason: 'User asked about a Veylora feature or system capability.',
        isScreenContextRelevant: false
      };
    }

    // 7. GENERAL_KNOWLEDGE: External concepts, general programming, technology definitions, or weather
    const generalKeywords = [
      'what is playwright',
      'playwright ante enti',
      'what is wcag',
      'what is axe-core',
      'what is sqlite',
      'what is headless browser',
      'what is dom',
      'what is typescript',
      'what is fastify',
      'what is the weather',
      'weather in',
      'who are you',
      'tell me a joke',
      'who created you'
    ];

    if (generalKeywords.some(kw => text.includes(kw))) {
      return {
        intent: 'GENERAL_KNOWLEDGE',
        confidence: 0.95,
        reason: 'User asked a general knowledge, concept, or external technology question unrelated to screen layout.',
        isScreenContextRelevant: false
      };
    }

    // Fallback: If very short or single word, might need clarification
    if (text.length <= 3) {
      return {
        intent: 'CLARIFICATION_REQUIRED',
        confidence: 0.6,
        reason: 'User input was too brief to classify reliably.',
        isScreenContextRelevant: false
      };
    }

    // Default heuristic: If user asks "what is X", default to general/feature knowledge rather than active screen
    if (text.startsWith('what is') || text.startsWith('what are') || text.startsWith('define')) {
      return {
        intent: 'GENERAL_KNOWLEDGE',
        confidence: 0.75,
        reason: 'Definitional inquiry; answering concept directly rather than anchoring to screen.',
        isScreenContextRelevant: false
      };
    }

    // Otherwise, treat as general Veylora inquiry with supporting screen context
    return {
      intent: 'VEYLORA_FEATURE',
      confidence: 0.7,
      reason: 'General inquiry where screen context can serve as supporting background information.',
      isScreenContextRelevant: true
    };
  }
}
