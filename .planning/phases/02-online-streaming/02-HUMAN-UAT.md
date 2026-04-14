---
status: partial
phase: 02-online-streaming
source: [02-VERIFICATION.md]
started: 2026-04-12T15:30:00.000Z
updated: 2026-04-12T15:30:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end video playback
expected: Clicking a video on animecix.tv opens the built-in Vidstack player in an iframe and streams the episode end-to-end
result: [pending]

### 2. ASS subtitle rendering and persistence
expected: ASS subtitles render correctly via JASSUB with language selection available; preference persists across episodes via SQLite
result: [pending]

### 3. Skip intro/outro buttons
expected: Skip intro and skip outro buttons appear at the correct timestamps on videos with skip markers
result: [pending]

### 4. Discord Rich Presence
expected: Discord shows the current anime title, episode number, and play/pause state
result: [pending]

### 5. Google login via deep link
expected: User can log in via Google using the animecix:// deep link without a browser popup regression
result: [pending]

### 6. Ad blocking
expected: Ads and trackers are blocked across the session during browsing
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
