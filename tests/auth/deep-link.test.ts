import { describe, it, expect } from 'vitest';
import {
  parseDeepLinkUrl,
  buildCallbackUrl,
  extractDeepLinkFromArgs,
} from '../../src/auth/deep-link';

describe('DeepLinkService', () => {
  describe('parseDeepLinkUrl', () => {
    it('parseDeepLinkUrl extracts login data from animecix://login{data}', () => {
      const result = parseDeepLinkUrl('animecix://logindata-here');
      expect(result).toEqual({ status: null, data: 'data-here' });
    });

    it('parseDeepLinkUrl extracts status and data from animecix://login{status}|{data}', () => {
      const result = parseDeepLinkUrl('animecix://login200|abc123token');
      expect(result).toEqual({ status: '200', data: 'abc123token' });
    });

    it('parseDeepLinkUrl returns null for non-animecix:// schemes', () => {
      expect(parseDeepLinkUrl('https://evil.com')).toBeNull();
    });

    it('parseDeepLinkUrl returns null for empty path', () => {
      expect(parseDeepLinkUrl('animecix://')).toBeNull();
    });

    it('parseDeepLinkUrl returns null for non-login paths', () => {
      expect(parseDeepLinkUrl('animecix://logout')).toBeNull();
    });

    it('parseDeepLinkUrl returns null for data containing path traversal', () => {
      // Data containing '..' should be rejected
      expect(parseDeepLinkUrl('animecix://login../../etc')).toBeNull();
    });

    it('parseDeepLinkUrl returns null for data containing forward slash', () => {
      expect(parseDeepLinkUrl('animecix://logindata/evil')).toBeNull();
    });
  });

  describe('buildCallbackUrl', () => {
    it('builds correct callback URL: https://animecix.tv/secure/short-login/{data}', () => {
      const url = buildCallbackUrl('abc123token');
      expect(url).toBe('https://animecix.tv/secure/short-login/abc123token');
    });

    it('buildCallbackUrl returns null for empty data', () => {
      expect(buildCallbackUrl('')).toBeNull();
    });

    it('buildCallbackUrl returns null for data containing path traversal', () => {
      expect(buildCallbackUrl('../../evil')).toBeNull();
    });

    it('buildCallbackUrl returns null for data containing forward slash', () => {
      expect(buildCallbackUrl('path/evil')).toBeNull();
    });
  });

  describe('extractDeepLinkFromArgs', () => {
    it('extractDeepLinkFromArgs finds animecix:// arg in argv array', () => {
      const result = extractDeepLinkFromArgs(['--flag', 'animecix://login200|token', '--other']);
      expect(result).toBe('animecix://login200|token');
    });

    it('extractDeepLinkFromArgs returns null when no animecix:// arg present', () => {
      expect(extractDeepLinkFromArgs(['--flag', '--other'])).toBeNull();
    });
  });
});
