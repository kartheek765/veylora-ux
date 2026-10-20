export class SSRFProtectionService {
  private static prohibitedHosts = [
    '169.254.169.254', // AWS/GCP/Azure link-local metadata
    'metadata.google.internal',
    '169.254.169.253',
    'fd00:ec2::254',
    '0.0.0.0'
  ];

  /**
   * Safely normalize and validate a target URL.
   * Strips embedded credentials, enforces HTTP/HTTPS, and validates syntax.
   */
  static normalizeUrl(rawUrl: string): { valid: boolean; normalized?: string; error?: string } {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { valid: false, error: 'URL is required and must be a string' };
    }

    let urlString = rawUrl.trim();
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      // If user provided an explicit protocol (e.g. ftp://, file://, javascript:, data:), reject it immediately
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(urlString)) {
        const protoMatch = urlString.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)/);
        return { valid: false, error: `Protocol "${protoMatch ? protoMatch[1] : ''}" is prohibited. Only HTTP and HTTPS are permitted.` };
      }
      // Default to https if no protocol specified (e.g., "example.com/checkout")
      urlString = `https://${urlString}`;
    }

    try {
      const parsed = new URL(urlString);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: `Protocol "${parsed.protocol}" is prohibited. Only HTTP and HTTPS are permitted.` };
      }

      // Disallow user credentials embedded in URL (e.g. user:pass@host)
      if (parsed.username || parsed.password) {
        return { valid: false, error: 'Embedded credentials in target URL are prohibited for security.' };
      }

      // Check for empty hostname
      if (!parsed.hostname) {
        return { valid: false, error: 'Target URL must include a valid hostname.' };
      }

      return { valid: true, normalized: parsed.href };
    } catch (e: any) {
      return { valid: false, error: `Malformed URL: ${e?.message || e}` };
    }
  }

  /**
   * Evaluates if a destination URL is safe to navigate to.
   * Blocks cloud metadata endpoints, prohibited IP ranges, multicast, and unauthorized schemes.
   */
  static isSafeDestination(
    rawUrl: string, 
    allowedDomains: string[] = [], 
    options: { allowLocalTesting?: boolean } = {}
  ): { safe: boolean; reason?: string } {
    try {
      const parsed = new URL(rawUrl);

      // Support local file fixtures during testing
      const isTestEnv = process.env.NODE_ENV === 'test' || options.allowLocalTesting;
      if (parsed.protocol === 'file:' && isTestEnv) {
        return { safe: true };
      }

      // Strictly allow ONLY http: and https: for website audits
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { safe: false, reason: `Protocol "${parsed.protocol}" is prohibited. Only HTTP and HTTPS are permitted.` };
      }

      const hostname = parsed.hostname.toLowerCase();

      // Check cloud metadata endpoints
      if (this.prohibitedHosts.includes(hostname)) {
        return { safe: false, reason: `Access to cloud metadata address "${hostname}" is strictly blocked.` };
      }

      // Check link-local (169.254.x.x)
      if (/^169\.254\./.test(hostname)) {
        return { safe: false, reason: `Access to link-local address "${hostname}" is blocked.` };
      }

      // Check multicast (224.0.0.0 - 239.255.255.255)
      if (/^(22[4-9]|23[0-9])\./.test(hostname)) {
        return { safe: false, reason: `Access to multicast address "${hostname}" is blocked.` };
      }

      // Check loopback / localhost
      const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || /^127\./.test(hostname);
      const isPrivateNetwork = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname);

      const allowLocal = options.allowLocalTesting ?? (
        process.env.ALLOW_LOCAL_TESTING === 'true' || 
        process.env.NODE_ENV === 'test' || 
        process.env.NODE_ENV === 'development'
      );

      if (isLoopback) {
        if (!allowLocal) {
          const isExplicit = allowedDomains.some(d => d.trim().toLowerCase() === hostname);
          if (!isExplicit) {
            return { safe: false, reason: `Loopback access to "${hostname}" is restricted in production mode without explicit domain allowlist.` };
          }
        }
        return { safe: true };
      }

      if (isPrivateNetwork) {
        const isExplicit = allowedDomains.some(d => d.trim().toLowerCase() === hostname);
        if (!isExplicit && !allowLocal) {
          return { safe: false, reason: `Access to internal private network address "${hostname}" is blocked.` };
        }
      }

      // Check allowed domains if specified
      if (allowedDomains && allowedDomains.length > 0) {
        let domainMatched = false;
        for (const pattern of allowedDomains) {
          const cleanPattern = pattern.trim().toLowerCase();
          if (!cleanPattern) continue;

          if (cleanPattern.startsWith('*.')) {
            const rootDomain = cleanPattern.substring(2);
            if (hostname === rootDomain || hostname.endsWith('.' + rootDomain)) {
              domainMatched = true;
              break;
            }
          } else if (hostname === cleanPattern || hostname.endsWith('.' + cleanPattern)) {
            domainMatched = true;
            break;
          }
        }

        if (!domainMatched) {
          return {
            safe: false,
            reason: `Host "${hostname}" is outside project allowed domains list: [${allowedDomains.join(', ')}]`
          };
        }
      }

      return { safe: true };
    } catch (e: any) {
      return { safe: false, reason: `Malformed URL destination: ${e?.message || e}` };
    }
  }

  static validateUrl(rawUrl: string, allowedDomains: string[] = []): { safe: boolean; reason?: string } {
    return this.isSafeDestination(rawUrl, allowedDomains);
  }
}


