#!/usr/bin/env node
// Usage: node generate-update-manifest.mjs <darwin|win32>
//
// Reads artifacts from out/make/, computes base64 SHA512 of each,
// writes latest-mac.yml or latest.yml, then uploads it to the draft
// GitHub Release matching $GITHUB_REF_NAME via the releases API.
//
// Requires env: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), GITHUB_REF_NAME.
//
// Exit codes: 0 success, 1 missing artifact, 2 upload failed.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const platform = process.argv[2];
if (!['darwin', 'win32'].includes(platform)) {
  console.error('Usage: generate-update-manifest.mjs <darwin|win32>');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'));
const version = pkg.version;

function sha512Base64(filePath) {
  const h = createHash('sha512');
  h.update(readFileSync(filePath));
  return h.digest('base64');
}

function findFirst(dir, regex) {
  const walk = (d) => {
    const entries = readdirSync(d);
    for (const entry of entries) {
      const full = join(d, entry);
      const s = statSync(full);
      if (s.isDirectory()) { const hit = walk(full); if (hit) return hit; }
      else if (regex.test(entry)) return full;
    }
    return null;
  };
  return walk(dir);
}

const makeDir = join(PROJECT_ROOT, 'out', 'make');
let artifactPath, artifactName, manifestName;
if (platform === 'darwin') {
  artifactPath = findFirst(makeDir, /\.zip$/i);              // electron-updater reads ZIP, not DMG
  manifestName = 'latest-mac.yml';
} else {
  artifactPath = findFirst(makeDir, /Setup\.exe$/i);
  manifestName = 'latest.yml';
}
if (!artifactPath) {
  console.error(`::error::No ${platform} artifact found under out/make/`);
  process.exit(1);
}
artifactName = artifactPath.split(/[\\/]/).pop();
const size = statSync(artifactPath).size;
const sha512 = sha512Base64(artifactPath);

const yaml =
  `version: ${JSON.stringify(version)}\n` +
  `files:\n` +
  `  - url: ${JSON.stringify(artifactName)}\n` +
  `    sha512: ${JSON.stringify(sha512)}\n` +
  `    size: ${size}\n` +
  `path: ${JSON.stringify(artifactName)}\n` +
  `sha512: ${JSON.stringify(sha512)}\n` +
  `releaseDate: ${JSON.stringify(new Date().toISOString())}\n`;

const manifestPath = join(PROJECT_ROOT, 'out', manifestName);
writeFileSync(manifestPath, yaml, 'utf8');
console.log(`Wrote ${manifestPath}`);

// Upload to the draft release matching this tag
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;        // owner/repo
const tag = process.env.GITHUB_REF_NAME;
if (!token || !repo || !tag) {
  console.error('::error::Missing GITHUB_TOKEN / GITHUB_REPOSITORY / GITHUB_REF_NAME');
  process.exit(2);
}

// 1. Find draft release for this tag
const rels = await fetch(`https://api.github.com/repos/${repo}/releases`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
}).then(r => r.json());
const rel = rels.find(r => r.tag_name === tag && r.draft === true);
if (!rel) {
  console.error(`::error::No draft release for tag ${tag} in ${repo}`);
  process.exit(2);
}

// 2. Delete any existing asset with the same name (re-run idempotency)
const existing = (rel.assets || []).find(a => a.name === manifestName);
if (existing) {
  await fetch(`https://api.github.com/repos/${repo}/releases/assets/${existing.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// 3. Upload
const uploadUrl = rel.upload_url.replace(/\{\?name,label\}$/, `?name=${encodeURIComponent(manifestName)}`);
const up = await fetch(uploadUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/x-yaml',
    'Content-Length': String(Buffer.byteLength(yaml, 'utf8')),
  },
  body: yaml,
});
if (!up.ok) {
  console.error(`::error::Upload failed: ${up.status} ${await up.text()}`);
  process.exit(2);
}
console.log(`Uploaded ${manifestName} to draft release ${tag}`);
