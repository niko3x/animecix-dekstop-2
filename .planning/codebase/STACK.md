# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript 4.5.4 - All application code and controllers
- JavaScript (ES5 target) - Compiled output from TypeScript

**Secondary:**
- HTML/CSS - Rendered by Electron's Chromium engine

## Runtime

**Environment:**
- Node.js - Backend process runtime for Electron main process
- Electron 34.2.0 - Desktop application framework and runtime

**Package Manager:**
- npm - Dependency management
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Electron 34.2.0 - Desktop application framework for cross-platform apps (Windows, macOS, Linux)

**Build/Package:**
- electron-builder 25.1.8 - Build and package Electron applications for distribution
- TypeScript 4.5.4 - Compiler for TypeScript to JavaScript

**Testing:**
- Not detected

## Key Dependencies

**Critical:**
- axios 0.21.1 - HTTP client for making API requests and downloading files
- node-downloader-helper 1.0.18 - Multi-threaded file download utility
- electron-updater 6.3.9 - Automatic update checking and installation for Electron apps
- @cliqz/adblocker-electron 1.22.2 - Ad and tracker blocking for Electron browser

**Network & HTTP:**
- node-fetch 2.6.1 - Fetch API implementation for Node.js
- agentkeepalive - HTTP connection pooling for axios

**Content Processing:**
- node-html-parser 4.0.0 - HTML parsing utility for extracting content
- streamsaver 2.0.5 - Save streams to disk

**Integration:**
- @xhayper/discord-rpc 1.2.0 - Discord Rich Presence client for displaying app status in Discord
- electron-deeplink 1.0.10 - Handle custom protocol URLs (animecix://) for deep linking

**Development:**
- @types/electron 1.6.10 - TypeScript type definitions for Electron
- @types/node-fetch 3.0.3 - TypeScript type definitions for node-fetch
- node-gyp 9.0.0 - Node.js native module build tool

## Configuration

**Environment:**
- `process.env.APP_URL` - Set to `https://animecix.tv` (hardcoded in `main.ts`)
- `process.env.dir` - Set to application directory path

**Build:**
- `tsconfig.json` - TypeScript compiler configuration with ES5 target and CommonJS modules
- `electron-builder.yml` - Build configuration for packaging Electron app
- `.eslintrc.js` - ESLint configuration (present but minimal)

**Runtime:**
- Preload script: `files/preload.js` - Electron context isolation bridge
- Main file: `main.js` (compiled from `main.ts`)
- Icon: `files/icon.png`

## Platform Requirements

**Development:**
- Node.js with npm
- TypeScript compiler
- Electron development environment
- Native build tools (for node-gyp, required for some dependencies)

**Production:**
- Windows (32-bit and 64-bit via electron-builder build scripts)
- macOS (via electron-builder build scripts)
- Linux (Deb and AppImage formats via deployment scripts)

**Key Build Targets (from package.json scripts):**
- Windows: `electron-builder build --win --x64 --ia32`
- macOS: `electron-builder build --mac`
- Linux: `electron-builder build --linux deb` and `--linux AppImage`

---

*Stack analysis: 2026-04-11*
