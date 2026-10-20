export type SupportedLanguage = 'en' | 'te-Telu' | 'te-Latn';

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  displayName: string;
  isExplicitOverride: boolean;
  directives: string;
}

export class LanguageService {
  private static readonly TELUGU_SCRIPT_REGEX = /[\u0C00-\u0C7F]/;

  private static readonly TANGLISH_WORDS = new Set([
    'bro', 'ela', 'cheyyali', 'cheppu', 'enti', 'endi', 'kavale', 'kavali',
    'babu', 'bagunda', 'ekkada', 'chesanu', 'chesukovachu', 'chesukovale',
    'unna', 'undi', 'unnaru', 'ayyetattu', 'avutundha', 'kudhurutundha',
    'tesukuntavu', 'chustunnam', 'chudu', 'pettali', 'manchi', 'daggara',
    'meeru', 'nenu', 'naaku', 'ippudu', 'motham', 'kani', 'ante', 'antey',
    'gurinchi', 'cheppandi', 'ivvandi', 'cheste', 'chesthey', 'chala'
  ]);

  /**
   * Detects the language of the prompt or honors explicit overrides.
   * Supports: English ('en'), Telugu script ('te-Telu'), and Tanglish ('te-Latn').
   */
  public static detectLanguage(prompt: string, explicitPreference?: string): LanguageDetectionResult {
    const text = prompt.trim();
    const lower = text.toLowerCase();

    // 1. Explicit request in user prompt or header preference
    if (explicitPreference === 'te' || lower.includes('తెలుగులో') || lower.includes('తెలుగు లో') || lower.includes('telugu script')) {
      return {
        language: 'te-Telu',
        displayName: 'Telugu (తెలుగు లిపి)',
        isExplicitOverride: true,
        directives: this.getDirectives('te-Telu')
      };
    }

    if (explicitPreference === 'tanglish' || lower.includes('tanglish lo') || lower.includes('tanglish') || lower.includes('telugu lo cheppu')) {
      return {
        language: 'te-Latn',
        displayName: 'Tanglish (Telugu in Latin script)',
        isExplicitOverride: true,
        directives: this.getDirectives('te-Latn')
      };
    }

    if (explicitPreference === 'en' || lower.includes('in english') || lower.includes('english lo') || lower.includes('explain in english')) {
      return {
        language: 'en',
        displayName: 'English',
        isExplicitOverride: true,
        directives: this.getDirectives('en')
      };
    }

    // 2. Check for Telugu script Unicode characters
    if (this.TELUGU_SCRIPT_REGEX.test(text)) {
      return {
        language: 'te-Telu',
        displayName: 'Telugu (తెలుగు లిపి)',
        isExplicitOverride: false,
        directives: this.getDirectives('te-Telu')
      };
    }

    // 3. Check for Tanglish vocabulary in Latin script
    const tokens = lower.split(/[^a-zA-Z]+/).filter(Boolean);
    let tanglishCount = 0;
    for (const token of tokens) {
      if (this.TANGLISH_WORDS.has(token)) {
        tanglishCount++;
      }
    }

    if (tanglishCount >= 1) {
      return {
        language: 'te-Latn',
        displayName: 'Tanglish (Telugu in Latin script)',
        isExplicitOverride: false,
        directives: this.getDirectives('te-Latn')
      };
    }

    // 4. Default to English
    return {
      language: 'en',
      displayName: 'English',
      isExplicitOverride: false,
      directives: this.getDirectives('en')
    };
  }

  /**
   * Returns precise model instructions for maintaining natural tone and UI consistency
   */
  public static getDirectives(language: SupportedLanguage): string {
    switch (language) {
      case 'te-Telu':
        return `LANGUAGE DIRECTIVE (TELUGU SCRIPT):
- Respond in natural, fluent, and grammatical Telugu script (తెలుగు లిపి).
- CRITICAL: Keep technical terms, product names, code, and UI button labels in English for practical clarity (e.g. "Projects page", "Create Project button", "Playwright runner", "Allowed Domains", "Viewport", "Scenarios", "Findings").
- Do NOT make awkward literal translations of software terms (e.g. do not translate "Playwright" or "button").
- Maintain clear, helpful formatting with bullet points and bold headers in Telugu.`;

      case 'te-Latn':
        return `LANGUAGE DIRECTIVE (CONVERSATIONAL TANGLISH):
- Respond in natural, friendly, conversational Tanglish (Telugu written using the Latin/English alphabet).
- Write in the casual, polite style Telugu engineers and tech founders speak daily (e.g., "Project create cheyyadaniki, left sidebar lo unna **Projects** page open cheyyandi. Tarvatha **Create Project** button click chesi...").
- CRITICAL: Keep UI button labels, technical terms, URLs, and code in English (e.g. "Playwright", "Findings Explorer", "Allowed Domains", "Run Execution").
- Avoid translating technical English words awkwardly; blend Telugu grammar with English tech vocabulary smoothly.`;

      case 'en':
      default:
        return `LANGUAGE DIRECTIVE (ENGLISH):
- Respond in direct, professional, concise English markdown.
- Avoid unnecessary filler words or boilerplate pleasantries.
- Use numbered steps for workflows and bullet points for feature details.`;
    }
  }

  public static detect = LanguageService.detectLanguage;
}

