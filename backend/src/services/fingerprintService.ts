import crypto from 'crypto';

export class FingerprintService {
  /**
   * Normalizes a page URL to a stable path identifier.
   * Strips scheme, host, query params, hashes, and trailing slashes so
   * http://localhost:3000/checkout?token=123#step1 normalizes to /checkout.
   */
  static normalizePath(rawUrl: string): string {
    if (!rawUrl) return '/';
    try {
      if (rawUrl.startsWith('file://')) {
        const parts = rawUrl.split('/');
        return '/' + (parts[parts.length - 1] || 'index.html');
      }
      const parsed = new URL(rawUrl, 'http://localhost');
      let pathname = parsed.pathname || '/';
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.substring(0, pathname.length - 1);
      }
      return pathname.toLowerCase();
    } catch {
      return '/' + rawUrl.split('?')[0].replace(/^[a-z]+:\/\/[^/]+/i, '').toLowerCase();
    }
  }

  /**
   * Sanitizes and normalizes an element selector or target summary.
   * Removes volatile random IDs, timestamps, or transient React IDs (e.g. :r1:).
   */
  static normalizeTarget(target: string): string {
    if (!target) return 'unknown_target';
    return target
      .toLowerCase()
      .trim()
      .replace(/:r[0-9a-z]+:/g, '') // Strip React 18 useId tokens
      .replace(/\d{10,}/g, '') // Strip timestamps
      .replace(/#[a-z0-9_-]*\d{4,}[a-z0-9_-]*/gi, '') // Strip auto-generated dynamic IDs
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generates a deterministic, reproducible finding fingerprint.
   * Rule/Category + Normalized Page Path + Normalized Target.
   */
  static generateFingerprint(
    category: string,
    pageUrl: string,
    targetOrSelector: string,
    ruleId?: string
  ): string {
    const normCategory = (category || 'general').toLowerCase().trim();
    const normRule = (ruleId || '').toLowerCase().trim();
    const normPath = this.normalizePath(pageUrl);
    const normTarget = this.normalizeTarget(targetOrSelector);

    const raw = `${normCategory}|${normRule}|${normPath}|${normTarget}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Object-based alias for generateFingerprint
   */
  static generate(params: {
    category: string;
    pageUrl: string;
    selectorSummary?: string;
    targetOrSelector?: string;
    ruleId?: string;
  }): string {
    return this.generateFingerprint(
      params.category,
      params.pageUrl,
      params.selectorSummary || params.targetOrSelector || '',
      params.ruleId
    );
  }
}

