import { describe, it, expect } from 'vitest';
import { AdBlocker, isWhitelisted } from '../../src/network/ad-blocker';

describe('AdBlockerService', () => {
  it('allows animecix.tv URLs through (whitelisted)', () => {
    expect(isWhitelisted('https://animecix.tv/anything')).toBe(true);
  });

  it('allows tau-video.xyz URLs through (whitelisted)', () => {
    expect(isWhitelisted('https://tau-video.xyz/api/video')).toBe(true);
  });

  it('does not whitelist generic URLs', () => {
    expect(isWhitelisted('https://example.com')).toBe(false);
    expect(isWhitelisted('https://ads.doubleclick.net/ad')).toBe(false);
  });

  it('parses EasyList filter data without errors', () => {
    // Use a minimal test filter list instead of full EasyList
    const adBlocker = new AdBlocker();
    adBlocker.loadTestFilters('||ads.example.com^');
    expect(() => adBlocker.shouldBlock('https://example.com')).not.toThrow();
  });

  it('blocks known ad URL patterns', () => {
    const adBlocker = new AdBlocker();
    // Load a minimal filter that blocks ads.test.com
    adBlocker.loadTestFilters('||ads.test.com^');
    expect(adBlocker.shouldBlock('https://ads.test.com/banner.js')).toBe(true);
  });

  it('allows animecix.tv URLs through (shouldBlock returns false)', () => {
    const adBlocker = new AdBlocker();
    adBlocker.loadTestFilters('||ads.test.com^');
    expect(adBlocker.shouldBlock('https://animecix.tv/anything')).toBe(false);
  });

  it('allows tau-video.xyz URLs through (shouldBlock returns false)', () => {
    const adBlocker = new AdBlocker();
    adBlocker.loadTestFilters('||ads.test.com^');
    expect(adBlocker.shouldBlock('https://tau-video.xyz/api/video')).toBe(false);
  });

  it('AdBlocker.shouldBlock returns false for generic non-blocked URL', () => {
    const adBlocker = new AdBlocker();
    // No filters loaded — should not block anything
    expect(adBlocker.shouldBlock('https://example.com')).toBe(false);
  });
});
