#!/usr/bin/env node
// Verifies pushed git tag matches animecix-v2/package.json version.
// Exits 1 on mismatch, 0 on match. Called from CI BEFORE npm install.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const pkgVersion = pkg.version;

const ref = process.env.GITHUB_REF_NAME ?? process.argv[2];
if (!ref) {
  console.error('verify-tag: no tag provided (set GITHUB_REF_NAME or pass as arg1)');
  process.exit(1);
}
const tagVersion = ref.replace(/^v/, '');
if (tagVersion !== pkgVersion) {
  console.error(`::error::Tag ${ref} (version ${tagVersion}) does not match package.json version ${pkgVersion}`);
  process.exit(1);
}
console.log(`verify-tag: OK (tag ${ref} matches package.json ${pkgVersion})`);
