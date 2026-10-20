import { VerificationStatus } from '../types/canonical.js';

export interface RawFindingInput {
  title: string;
  category: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  confidence: 'high' | 'medium' | 'low';
  observedFacts: string;
  possibleCause?: string;
  recommendedAction?: string;
  pageUrl: string;
  stepNumber?: number;
  selectorSummary?: string;
  ruleId?: string;
  isHeuristic?: boolean;
  proposedVerificationStatus?: VerificationStatus;
}

export interface SanitizedFinding {
  title: string;
  category: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  confidence: 'high' | 'medium' | 'low';
  observedFacts: string;
  possibleCause: string;
  recommendedAction: string;
  pageUrl: string;
  stepNumber: number;
  selectorSummary: string;
  ruleId?: string;
  isHeuristic: boolean;
  verificationStatus: VerificationStatus;
}

export class EvidenceGuardService {
  /**
   * Sensitive data redaction patterns (passwords, tokens, payment cards, authorization headers)
   */
  private static sensitivePatterns = [
    /Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi,
    /([a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,})/g, // JWT
    /(password|passwd|pwd|secret|apiKey|api_key|authToken|auth_token)\s*[:=]\s*["']?([^"'\s&]+)["']?/gi,
    /\b(?:\d[ -]*?){13,16}\b/g // Credit cards
  ];

  /**
   * Redacts sensitive secrets, passwords, and tokens from any text string.
   */
  static redactSensitiveText(input: string): string {
    if (!input) return '';
    let sanitized = input;

    // Redact Bearer tokens
    sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]');

    // Redact password/secret key values
    sanitized = sanitized.replace(
      /(password|passwd|pwd|secret|apiKey|api_key|authToken|auth_token)\s*[:=]?\s*["']?([^"'\s&]+)["']?/gi,
      '$1=[REDACTED_PASSWORD]'
    );


    // Redact JWT patterns
    sanitized = sanitized.replace(
      /([a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,})/g,
      '[REDACTED_JWT]'
    );

    // Redact 13-16 digit card sequences
    sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD]');

    return sanitized;
  }

  /**
   * Sanitizes and enforces authoritative verification guardrails on finding inputs.
   * STRICT RULE: An AI hypothesis CANNOT promote itself to VERIFIED.
   * Only deterministic rule engines (axe-core, console crash, HTTP 4xx/5xx, selector missing)
   * can produce VERIFIED status.
   */
  static sanitizeAndClassifyFinding(raw: RawFindingInput): SanitizedFinding {
    const isHeuristic = Boolean(raw.isHeuristic);

    let verificationStatus: VerificationStatus = 'NEEDS_REVIEW';

    if (isHeuristic) {
      // AI-generated statement: cannot promote itself to VERIFIED
      if (raw.proposedVerificationStatus === 'VERIFIED') {
        console.warn(`[EvidenceGuard] Prevented AI finding "${raw.title}" from self-promoting to VERIFIED.`);
        verificationStatus = 'AI_HYPOTHESIS';
      } else {
        verificationStatus = raw.proposedVerificationStatus || 'AI_HYPOTHESIS';
      }
    } else {
      // Deterministic checker (axe-core violation, failed click, console error)
      verificationStatus = raw.proposedVerificationStatus || 'VERIFIED';
    }

    // Sanitize texts
    const title = this.redactSensitiveText(raw.title || 'Untitled UX Observation').trim();
    const observedFacts = this.redactSensitiveText(raw.observedFacts || 'No detailed observations recorded.').trim();
    const possibleCause = this.redactSensitiveText(raw.possibleCause || 'Under investigation.').trim();
    const recommendedAction = this.redactSensitiveText(raw.recommendedAction || 'Review element styling and behavior.').trim();
    const selectorSummary = this.redactSensitiveText(raw.selectorSummary || 'body').trim();

    // Ensure valid severity
    const validSeverities = ['critical', 'serious', 'moderate', 'minor'] as const;
    const severity = validSeverities.includes(raw.severity) ? raw.severity : 'moderate';

    // Ensure valid confidence
    const validConfidences = ['high', 'medium', 'low'] as const;
    const confidence = validConfidences.includes(raw.confidence) ? raw.confidence : 'medium';

    return {
      title,
      category: raw.category || 'interaction_friction',
      severity,
      confidence,
      observedFacts,
      possibleCause,
      recommendedAction,
      pageUrl: raw.pageUrl || '/',
      stepNumber: raw.stepNumber || 1,
      selectorSummary,
      ruleId: raw.ruleId,
      isHeuristic,
      verificationStatus
    };
  }

  static redactText(input: string): string {
    return this.redactSensitiveText(input);
  }

  static sanitizeAndValidateFinding(raw: any): SanitizedFinding {
    return this.sanitizeAndClassifyFinding({
      ...raw,
      isHeuristic: raw.isAiGenerated !== undefined ? raw.isAiGenerated : raw.isHeuristic,
      proposedVerificationStatus: raw.verificationStatus || raw.proposedVerificationStatus
    });
  }
}

