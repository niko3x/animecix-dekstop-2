import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import {
  resolveOfflinePath,
  parseOfflineUrl,
  getOfflineMimeType,
} from '../../src/offline/offline-protocol';

const BASE_PATH = path.join(os.tmpdir(), 'animecix-offline-test-base');

describe('resolveOfflinePath', () => {
  it('resolves a relative filename within the base directory', () => {
    const result = resolveOfflinePath('video.mp4', BASE_PATH);
    expect(result).toBe(path.resolve(BASE_PATH, 'video.mp4'));
  });

  it('resolves nested paths within the base directory', () => {
    const result = resolveOfflinePath('abc123/episode.mp4', BASE_PATH);
    expect(result).toBe(path.resolve(BASE_PATH, 'abc123', 'episode.mp4'));
  });

  it('returns null for path traversal with ../../../etc/passwd', () => {
    const result = resolveOfflinePath('../../../etc/passwd', BASE_PATH);
    expect(result).toBeNull();
  });

  it('returns null for URL-encoded traversal %2e%2e%2fetc/passwd', () => {
    const result = resolveOfflinePath('%2e%2e%2fetc/passwd', BASE_PATH);
    expect(result).toBeNull();
  });

  it('returns null for nested traversal assets/../../../etc/passwd', () => {
    const result = resolveOfflinePath('assets/../../../etc/passwd', BASE_PATH);
    expect(result).toBeNull();
  });

  it('returns null for invalid URI component', () => {
    const result = resolveOfflinePath('%zz', BASE_PATH);
    expect(result).toBeNull();
  });
});

describe('parseOfflineUrl', () => {
  it('parses video URL correctly', () => {
    const result = parseOfflineUrl('animecix-offline://episode/abc123/video');
    expect(result).toEqual({ episodeId: 'abc123', type: 'video' });
  });

  it('parses subtitle URL with language code', () => {
    const result = parseOfflineUrl('animecix-offline://episode/abc123/sub/tr');
    expect(result).toEqual({ episodeId: 'abc123', type: 'sub', language: 'tr' });
  });

  it('parses subtitle URL with en language code', () => {
    const result = parseOfflineUrl('animecix-offline://episode/abc123/sub/en');
    expect(result).toEqual({ episodeId: 'abc123', type: 'sub', language: 'en' });
  });

  it('returns null for invalid URL pattern', () => {
    const result = parseOfflineUrl('animecix-offline://invalid');
    expect(result).toBeNull();
  });

  it('returns null for missing episode segment', () => {
    const result = parseOfflineUrl('animecix-offline://abc123/video');
    expect(result).toBeNull();
  });

  it('returns null for sub URL without language', () => {
    const result = parseOfflineUrl('animecix-offline://episode/abc123/sub');
    expect(result).toBeNull();
  });

  it('returns null for completely invalid URL', () => {
    const result = parseOfflineUrl('not-a-url');
    expect(result).toBeNull();
  });
});

describe('getOfflineMimeType', () => {
  it('returns video/mp4 for .mp4', () => {
    expect(getOfflineMimeType('.mp4')).toBe('video/mp4');
  });

  it('returns text/x-ssa for .ass', () => {
    expect(getOfflineMimeType('.ass')).toBe('text/x-ssa');
  });

  it('returns video/mp2t for .ts', () => {
    expect(getOfflineMimeType('.ts')).toBe('video/mp2t');
  });

  it('returns text/plain for .srt', () => {
    expect(getOfflineMimeType('.srt')).toBe('text/plain');
  });

  it('returns text/vtt for .vtt', () => {
    expect(getOfflineMimeType('.vtt')).toBe('text/vtt');
  });

  it('returns application/json for .json', () => {
    expect(getOfflineMimeType('.json')).toBe('application/json');
  });

  it('returns application/octet-stream for unknown extension', () => {
    expect(getOfflineMimeType('.xyz')).toBe('application/octet-stream');
  });
});

describe('registerOfflineProtocol', () => {
  it('is exported as a function', async () => {
    const mod = await import('../../src/offline/offline-protocol');
    expect(typeof mod.registerOfflineProtocol).toBe('function');
  });
});
