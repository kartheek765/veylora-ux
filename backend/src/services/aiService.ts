import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import { ModelUsageService, ServiceType } from './modelUsageService.js';
import { KnowledgeBaseService } from './knowledgeBaseService.js';
import { IntentClassifierService } from './intentClassifierService.js';
import { LanguageService } from './languageService.js';

export interface UXPlanGenerationInput {
  naturalGoal: string;
  startingUrl: string;
  allowedDomains: string[];
  personaName?: string;
  actionBudget?: number;
}

export interface UXPlanStep {
  stepNumber: number;
  actionType: 'goto' | 'click' | 'fill' | 'scroll' | 'inspect';
  targetSelector?: string;
  value?: string;
  description: string;
  expectedOutcome: string;
}

export interface UXAnalysisInput {
  runId: string;
  projectName: string;
  personaName: string;
  startingUrl: string;
  events: Array<{
    sequenceNo: number;
    actionType: string;
    targetSummary: string;
    result: string;
    url: string;
    durationMs: number;
  }>;
  consoleErrors: string[];
  networkErrors: string[];
}

export interface UXFindingOutput {
  title: string;
  category: 'information_architecture' | 'interaction_friction' | 'layout_rendering' | 'form_input' | 'error_recovery' | 'accessibility_contrast';
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  confidence: 'high' | 'medium' | 'low';
  observedFacts: string;
  possibleCause: string;
  recommendedAction: string;
  stepNumber: number;
}

export class AIService {
  private static genAI: GoogleGenerativeAI | null = null;

  private static getGenAIClient(): GoogleGenerativeAI | null {
    if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_LIVE_AI_TESTS) {
      return null;
    }
    if (!config.geminiApiKey || config.geminiApiKey.trim() === '') {
      return null;
    }
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(config.geminiApiKey.trim());
    }
    return this.genAI;
  }

  /**
   * Helper to execute model call with automatic stage progression and accounting.
   * Defined unit: One internal usage credit = one successfully completed provider generation request.
   */
  private static async executeWithCascade<T>(
    serviceType: ServiceType,
    generator: (modelId: string) => Promise<T>,
    fallbackLocal: () => Promise<T>
  ): Promise<{ result: T; usedModel: string | null; isFallback: boolean }> {
    const client = this.getGenAIClient();
    if (!client) {
      // No API key configured: return safe local fallback directly
      const localResult = await fallbackLocal();
      return { result: localResult, usedModel: null, isFallback: true };
    }

    const activeStage = ModelUsageService.getActiveStage(serviceType);
    if (activeStage.stage === 'exhausted') {
      console.info(`[AIService] ${serviceType} stages exhausted for current 24h window. Using local fallback.`);
      const localResult = await fallbackLocal();
      return { result: localResult, usedModel: null, isFallback: true };
    }

    // Determine cascade starting from current active stage
    const stagesConfig = serviceType === 'ux_analysis'
      ? [
          { stage: 1, modelId: config.geminiModel },
          { stage: 2, modelId: config.geminiFallback1 },
          { stage: 3, modelId: config.geminiFallback2 }
        ]
      : [
          { stage: 1, modelId: config.askVeyloraModel },
          { stage: 2, modelId: config.askVeyloraFallback1 },
          { stage: 3, modelId: config.askVeyloraFallback2 }
        ];

    const eligibleStages = stagesConfig.filter(s => s.stage >= (activeStage.stage as number));

    for (const item of eligibleStages) {
      try {
        const timeoutMs = serviceType === 'ask_veylora' ? config.askVeyloraRequestTimeoutMs : config.geminiRequestTimeoutMs;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model request timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        const callPromise = generator(item.modelId);
        const result = await Promise.race([callPromise, timeoutPromise]);

        // Success! Record credit only after verified successful generation
        ModelUsageService.recordSuccessfulRequest(serviceType, item.stage);
        return { result, usedModel: item.modelId, isFallback: false };
      } catch (err: any) {
        console.warn(`[AIService] ${serviceType} stage ${item.stage} (${item.modelId}) failed:`, err?.message || err);
        // Do not charge credit for failed request; try next fallback model
      }
    }

    // If all available stages failed, return local rule-based fallback
    console.info(`[AIService] All ${serviceType} stages failed. Reverting to local rule-based response.`);
    const localResult = await fallbackLocal();
    return { result: localResult, usedModel: null, isFallback: true };
  }

  /**
   * Ask Veylora: Interactive conversational assistant with screen awareness
   */
  static async askVeylora(
    userPrompt: string,
    currentRoute: string = '/',
    screenContextText?: string,
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    languagePreference?: string
  ): Promise<{ answer: string; usedModel: string | null; isFallback: boolean; intent: string; language: string }> {
    const intentResult = IntentClassifierService.classify(userPrompt, currentRoute);
    const languageResult = LanguageService.detectLanguage(userPrompt, languagePreference);

    const { result, usedModel, isFallback } = await this.executeWithCascade(
      'ask_veylora',
      async (modelId: string) => {
        const client = this.getGenAIClient()!;
        const model = client.getGenerativeModel({
          model: modelId,
          generationConfig: {
            maxOutputTokens: config.askVeyloraMaxOutputTokens,
            temperature: 0.3
          }
        });

        const systemPrompt = KnowledgeBaseService.generateSystemPrompt(
          currentRoute,
          intentResult,
          languageResult,
          intentResult.isScreenContextRelevant ? screenContextText : undefined
        );

        // Format history (text-only model interaction; no images sent to Gemma)
        const contents: any[] = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I am Ask Veylora. I will answer directly in accordance with your intent and language directives.' }] }
        ];

        // Append recent chat history (bounded to last 6 turns)
        const recentHistory = chatHistory.slice(-6);
        for (const msg of recentHistory) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        }

        // Add user prompt
        contents.push({
          role: 'user',
          parts: [{ text: userPrompt }]
        });

        const response = await model.generateContent({ contents });
        const text = response.response.text();
        if (!text || text.trim() === '') {
          throw new Error('Empty response from model');
        }
        return text;
      },
      async () => {
        return KnowledgeBaseService.getLocalHelpResponse(
          userPrompt,
          currentRoute,
          intentResult,
          languageResult
        );
      }
    );

    return { answer: result, usedModel, isFallback, intent: intentResult.intent, language: languageResult.language };
  }

  /**
   * Natural-language test-plan generation
   */
  static async generateTestPlan(input: UXPlanGenerationInput): Promise<{ steps: UXPlanStep[]; isFallback: boolean }> {
    const { result, isFallback } = await this.executeWithCascade(
      'ux_analysis',
      async (modelId: string) => {
        const client = this.getGenAIClient()!;
        const model = client.getGenerativeModel({
          model: modelId,
          generationConfig: {
            maxOutputTokens: config.geminiMaxOutputTokens,
            temperature: 0.2
          }
        });

        const prompt = `You are a Senior Browser Automation and UX Testing Engineer.
Generate a structured, safe browser test plan for the following user journey:
- Goal: "${input.naturalGoal}"
- Starting URL: "${input.startingUrl}"
- Allowed Domains: ${JSON.stringify(input.allowedDomains)}
- Persona: "${input.personaName || 'Standard User'}"
- Action Budget: ${input.actionBudget || 10} steps maximum.

STRICT SCHEMA REQUIREMENTS:
Output ONLY a raw JSON array of step objects, with no markdown code blocks and no surrounding commentary.
Each step object must have:
- "stepNumber": integer starting from 1
- "actionType": one of "goto", "click", "fill", "scroll", "inspect"
- "targetSelector": CSS selector or text locator (e.g. "button:has-text('Get Started')", "input[type='email']")
- "value": string (only for "fill" actions, e.g. "alex@example.com")
- "description": clear explanation of what action is taken
- "expectedOutcome": what visual state change proves success`;

        const response = await model.generateContent(prompt);
        let text = response.response.text().trim();
        if (text.startsWith('```json')) text = text.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
        else if (text.startsWith('```')) text = text.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

        const parsed = JSON.parse(text) as UXPlanStep[];
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('Invalid JSON array from AI model');
        }
        return parsed;
      },
      async () => {
        // Safe local rule-based plan generator
        const steps: UXPlanStep[] = [
          {
            stepNumber: 1,
            actionType: 'goto',
            value: input.startingUrl,
            description: `Navigate to initial entry point ${input.startingUrl}`,
            expectedOutcome: 'Landing page loaded with 200 OK and primary header visible'
          },
          {
            stepNumber: 2,
            actionType: 'inspect',
            targetSelector: 'h1, [role="heading"]',
            description: 'Evaluate primary heading, hero CTA contrast, and layout stability',
            expectedOutcome: 'Hero heading visible and legible'
          },
          {
            stepNumber: 3,
            actionType: 'click',
            targetSelector: 'a[href*="signup"], a[href*="register"], button:has-text("Start"), button:has-text("Get Started")',
            description: 'Locate and activate primary onboarding or action trigger',
            expectedOutcome: 'Navigated to primary action form or modal view'
          },
          {
            stepNumber: 4,
            actionType: 'inspect',
            targetSelector: 'form, input[type="email"], input[name="email"]',
            description: 'Inspect form elements, input labels, and accessibility attributes',
            expectedOutcome: 'Input fields contain valid labels and accessible names'
          },
          {
            stepNumber: 5,
            actionType: 'scroll',
            value: '500',
            description: 'Scroll viewport down to inspect secondary affordances and footer links',
            expectedOutcome: 'Page content remains within viewport bounds without layout shifts'
          }
        ];
        return steps;
      }
    );

    return { steps: result, isFallback };
  }

  /**
   * Evidence-grounded UX diagnosis & findings generator
   */
  static async analyzeRunEvidence(input: UXAnalysisInput): Promise<{ findings: UXFindingOutput[]; executiveSummary: string; isFallback: boolean }> {
    const { result, isFallback } = await this.executeWithCascade(
      'ux_analysis',
      async (modelId: string) => {
        const client = this.getGenAIClient()!;
        const model = client.getGenerativeModel({
          model: modelId,
          generationConfig: {
            maxOutputTokens: config.geminiMaxOutputTokens,
            temperature: 0.2
          }
        });

        const prompt = `You are a Principal UX Architect and Accessibility Specialist reviewing real Playwright browser test telemetry.
PROJECT: ${input.projectName}
PERSONA: ${input.personaName}
STARTING URL: ${input.startingUrl}

EXECUTED ACTION EVENTS:
${JSON.stringify(input.events, null, 2)}

CONSOLE ERRORS:
${JSON.stringify(input.consoleErrors, null, 2)}

NETWORK ERRORS:
${JSON.stringify(input.networkErrors, null, 2)}

TASK:
Analyze the observations, console errors, and action events to identify genuine UX friction points.
Distinguish OBSERVED FACTS (what the browser actually recorded) from INFERRED EXPLANATIONS (possible causes and recommendations).
Do NOT invent errors or screenshots that did not occur.

OUTPUT FORMAT:
Output ONLY raw JSON matching this structure (no markdown fences, no surrounding commentary):
{
  "executiveSummary": "2-3 sentence high-level summary of the journey friction and impact on ${input.personaName}.",
  "findings": [
    {
      "title": "Clear descriptive title",
      "category": "interaction_friction" | "form_input" | "layout_rendering" | "information_architecture" | "error_recovery" | "accessibility_contrast",
      "severity": "critical" | "serious" | "moderate" | "minor",
      "confidence": "high" | "medium" | "low",
      "observedFacts": "Factual browser observation from event telemetry",
      "possibleCause": "Architectural or design explanation",
      "recommendedAction": "Concrete fix for developer/designer",
      "stepNumber": 1
    }
  ]
}`;

        const response = await model.generateContent(prompt);
        let text = response.response.text().trim();
        if (text.startsWith('```json')) text = text.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
        else if (text.startsWith('```')) text = text.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

        const parsed = JSON.parse(text) as { executiveSummary: string; findings: UXFindingOutput[] };
        return parsed;
      },
      async () => {
        // Safe local rule-based heuristic analysis
        const findings: UXFindingOutput[] = [];

        // Check console errors
        if (input.consoleErrors.length > 0) {
          findings.push({
            title: `Unhandled Console Script Exception (${input.consoleErrors.length} captured)`,
            category: 'error_recovery',
            severity: 'serious',
            confidence: 'high',
            observedFacts: `Browser logged console error: "${input.consoleErrors[0].substring(0, 120)}" during journey execution.`,
            possibleCause: 'Uncaught JavaScript promise rejection or missing null-check in client component.',
            recommendedAction: 'Wrap client handler with defensive error boundary and display friendly fallback UI.',
            stepNumber: 2
          });
        }

        // Check failed events
        const failedEvents = input.events.filter(e => e.result === 'failed' || e.result === 'timeout');
        if (failedEvents.length > 0) {
          const firstFail = failedEvents[0];
          findings.push({
            title: `Action Blocked on "${firstFail.targetSummary}"`,
            category: 'interaction_friction',
            severity: 'critical',
            confidence: 'high',
            observedFacts: `Action #${firstFail.sequenceNo} (${firstFail.actionType}) on target "${firstFail.targetSummary}" failed or timed out after ${firstFail.durationMs}ms.`,
            possibleCause: 'Element was obscured by sticky modal, not attached to DOM, or had non-clickable overlay.',
            recommendedAction: 'Ensure target element has prominent z-index, accessible hit-area, and is not covered by fixed banners.',
            stepNumber: firstFail.sequenceNo
          });
        }

        // Check slow response
        const slowEvents = input.events.filter(e => e.durationMs > 2500);
        if (slowEvents.length > 0) {
          findings.push({
            title: 'High Interaction Latency Exceeds 2.5s',
            category: 'interaction_friction',
            severity: 'moderate',
            confidence: 'high',
            observedFacts: `Step #${slowEvents[0].sequenceNo} required ${slowEvents[0].durationMs}ms to complete state transition.`,
            possibleCause: 'Synchronous network request or heavy re-render blocking the main thread.',
            recommendedAction: 'Provide immediate optimistic UI or progress indicator within 100ms of click.',
            stepNumber: slowEvents[0].sequenceNo
          });
        }

        // If no issues triggered, return positive heuristic finding
        if (findings.length === 0) {
          findings.push({
            title: 'Journey Completed Without Critical Errors',
            category: 'information_architecture',
            severity: 'minor',
            confidence: 'medium',
            observedFacts: `All ${input.events.length} planned actions executed with valid visual feedback and 0 uncaught console errors.`,
            possibleCause: 'Clear navigational affordances and responsive interactive elements.',
            recommendedAction: 'Consider testing under constrained network throttles (e.g. Fast 3G) to inspect mobile loading states.',
            stepNumber: 1
          });
        }

        const summary = `The synthetic persona "${input.personaName}" completed ${input.events.length} actions across ${input.startingUrl}. ${findings.length} actionable UX observations were cataloged based on live browser telemetry.`;

        return { findings, executiveSummary: summary };
      }
    );

    return {
      findings: result.findings,
      executiveSummary: result.executiveSummary,
      isFallback
    };
  }
}
