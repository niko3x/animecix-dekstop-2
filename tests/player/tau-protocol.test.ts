import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import { resolveAssetPath, getMimeType } from '../../src/player/tau-protocol';

const BASE_PATH = path.join(os.tmpdir(), 'tau-test-base');

describe('resolveAssetPath', () => {
  it('returns basePath + /index.html for "/" pathname', () => {
    const result = resolveAssetPath('/', BASE_PATH);
    expect(result).toBe(path.resolve(BASE_PATH, 'index.html'));
  });

  it('returns basePath + /index.html for empty pathname', () => {
    const result = resolveAssetPath('', BASE_PATH);
    expect(result).toBe(path.resolve(BASE_PATH, 'index.html'));
  });

  it('resolves /assets/index-abc123.js correctly', () => {
    const result = resolveAssetPath('/assets/index-abc123.js', BASE_PATH);
    expect(result).toBe(path.resolve(BASE_PATH, 'assets', 'index-abc123.js'));
  });

  it('resolves /jassub/jassub-worker.js correctly', () => {
    const result = resolveAssetPath('/jassub/jassub-worker.js', BASE_PATH);
    expect(result).toBe(path.resolve(BASE_PATH, 'jassub', 'jassub-worker.js'));
  });

  it('returns null for path traversal with /../../../etc/passwd', () => {
    const result = resolveAssetPath('/../../../etc/passwd', BASE_PATH);
    expect(result).toBeNull();
  });

  it('returns null for URL-encoded traversal /..%2F..%2Fetc/passwd', () => {
    const result = resolveAssetPath('/..%2F..%2Fetc/passwd', BASE_PATH);
    expect(result).toBeNull();
  });

  it('returns null for nested traversal /assets/../../../etc/passwd', () => {
    const result = resolveAssetPath('/assets/../../../etc/passwd', BASE_PATH);
    expect(result).toBeNull();
  });
});

describe('getMimeType', () => {
  it('returns text/html for .html', () => {
    expect(getMimeType('.html')).toBe('text/html');
  });

  it('returns application/javascript for .js', () => {
    expect(getMimeType('.js')).toBe('application/javascript');
  });

  it('returns application/wasm for .wasm', () => {
    expect(getMimeType('.wasm')).toBe('application/wasm');
  });

  it('returns font/woff2 for .woff2', () => {
    expect(getMimeType('.woff2')).toBe('font/woff2');
  });

  it('returns text/css for .css', () => {
    expect(getMimeType('.css')).toBe('text/css');
  });

  it('returns application/json for .json', () => {
    expect(getMimeType('.json')).toBe('application/json');
  });

  it('returns image/png for .png', () => {
    expect(getMimeType('.png')).toBe('image/png');
  });

  it('returns image/x-icon for .ico', () => {
    expect(getMimeType('.ico')).toBe('image/x-icon');
  });

  it('returns image/svg+xml for .svg', () => {
    expect(getMimeType('.svg')).toBe('image/svg+xml');
  });

  it('returns font/woff for .woff', () => {
    expect(getMimeType('.woff')).toBe('font/woff');
  });

  it('returns font/ttf for .ttf', () => {
    expect(getMimeType('.ttf')).toBe('font/ttf');
  });

  it('returns application/octet-stream for unknown extension', () => {
    expect(getMimeType('.xyz')).toBe('application/octet-stream');
  });
});

describe('registerTauProtocol', () => {
  it('is exported as a function', async () => {
    const mod = await import('../../src/player/tau-protocol');
    expect(typeof mod.registerTauProtocol).toBe('function');
  });
});
