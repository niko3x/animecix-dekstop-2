export interface HeaderRule {
  urlPatterns: string[];
  headers: {
    referer?: string;
    userAgent?: string;
  };
  purpose: string;
}

export const FIREFOX_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0';

export const HEADER_RULES: HeaderRule[] = [
  {
    urlPatterns: ['*://*.tau-video.xyz/file/*'],
    headers: { referer: 'https://tau-video.xyz/', userAgent: FIREFOX_UA },
    purpose:
      'Video file CDN -- needs referer from embed page and Firefox UA to authorize',
  },
  {
    urlPatterns: ['*://*.tau-video.xyz/api/*'],
    headers: { referer: 'https://tau-video.xyz/' },
    purpose: 'Tau-video API requests -- needs referer for auth',
  },
];

/**
 * Pure function: check if a URL matches any rule (for testing and header rewriter).
 * Converts Electron URL pattern wildcards to regex and tests the given URL.
 */
export function matchesHeaderRule(
  url: string,
  rules: HeaderRule[]
): HeaderRule | null {
  for (const rule of rules) {
    for (const pattern of rule.urlPatterns) {
      // Convert Electron URL pattern to regex.
      // Steps:
      //   1. Protect all * chars with a placeholder
      //   2. Escape all regex special chars (including dots)
      //   3. Replace scheme wildcard placeholder (___STAR___://) with [a-z]+://
      //   4. Replace remaining placeholders with .*
      const regexStr =
        '^' +
        pattern
          .replace(/\*/g, '___STAR___')
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/___STAR___:\/\//g, '[a-z]+://')
          .replace(/___STAR___/g, '.*') +
        '$';
      const regex = new RegExp(regexStr);
      if (regex.test(url)) return rule;
    }
  }
  return null;
}
