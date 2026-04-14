import { describe, it, expect } from 'vitest';
import {
  isIframeRedirect,
  buildRedirectUrl,
} from '../../src/network/request-handler';

describe('IframeInterceptService', () => {
  it('redirects tau-video.xyz/embed/* URLs to tau-player://bundle/*', () => {
    const result = buildRedirectUrl('https://tau-video.xyz/embed/abc123?vid=1');
    expect(result).toBe('tau-player://bundle/embed/abc123?vid=1');
  });

  it('redirects tau-video.xyz/embed-2/* URLs to tau-player://bundle/*', () => {
    const result = buildRedirectUrl('https://tau-video.xyz/embed-2/def456');
    expect(result).toBe('tau-player://bundle/embed-2/def456');
  });

  it('preserves query string during redirect', () => {
    const result = buildRedirectUrl(
      'https://tau-video.xyz/embed/abc?vid=1&quality=720'
    );
    expect(result).toBe('tau-player://bundle/embed/abc?vid=1&quality=720');
  });

  it('isIframeRedirect returns true for /embed/ URLs', () => {
    expect(isIframeRedirect('https://tau-video.xyz/embed/abc')).toBe(true);
  });

  it('isIframeRedirect returns true for /embed-2/ URLs', () => {
    expect(isIframeRedirect('https://tau-video.xyz/embed-2/abc')).toBe(true);
  });

  it('does not redirect non-embed tau-video.xyz URLs', () => {
    expect(isIframeRedirect('https://tau-video.xyz/api/video')).toBe(false);
  });

  it('isIframeRedirect returns false for animecix.tv/embed/ URLs', () => {
    expect(isIframeRedirect('https://animecix.tv/embed/abc')).toBe(false);
  });
});
