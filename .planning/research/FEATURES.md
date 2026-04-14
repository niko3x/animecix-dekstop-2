# Features Research

**Project:** AnimeciX Desktop v2
**Mode:** Ecosystem / Features
**Confidence:** MEDIUM-HIGH

## Key Findings

- The v2 gap is almost entirely in the **offline stack** (streaming cache, offline playback, offline subtitles) and **reliability** (download resume, persistent queue, SSL fix).
- Ad blocking and request header manipulation are **invisible infrastructure** — if they break, video stops working. They're table stakes disguised as features.
- Discord RPC is the primary **social differentiator** — Turkish anime community is Discord-heavy, and "Watching X - Ep 12" presence drives installs by word of mouth.
- **Streaming cache** is the headline differentiator unique to this app. Browser can't do it. Website can't do it. It's the strongest argument for "why desktop over browser."

## Table Stakes (must have or users leave)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Video playback (HLS + MP4) | Core purpose. Broken player = uninstall. | High | Tau-website + Vidstack |
| Ad blocking | Desktop app must be cleaner than browser + uBlock. | Medium | @cliqz/adblocker-electron |
| Single instance lock | Multiple windows = broken auth, duplicate downloads. | Low | Already implemented |
| Request header manipulation | Many video hosts reject without correct Referer/User-Agent. | Medium | Critical for host compatibility |
| Native window chrome | Users expect OS-native window. | Low | Frameless window |
| Auto-updates | Stale apps break when animecix.tv evolves. | Medium | electron-updater |
| Persistent login session | Re-login every launch = immediate uninstall. | Low | Cookie-managed by Electron session |
| Deep link auth (animecix://) | Google OAuth in Electron requires protocol redirect. | Medium | Needs robust URL validation in v2 |
| Download video to disk | Primary reason users install desktop over browser. | High | Multi-threaded. Needs resume + retry in v2 |
| Download progress UI | Users abandon downloads they can't track. | Medium | Needs persistence across restarts |
| Offline playback of downloaded files | Completing the download loop. | High | **New in v2.** Requires custom protocol or localhost server |
| Download notifications | Desktop expectation for long-running operations. | Low | NotificationHelper exists |
| HTTPS security (no MITM) | Security baseline. | Low | **Currently broken in v1 (rejectUnauthorized: false)** |

## Differentiators (competitive advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Streaming cache (watch-and-save) | Opportunistic offline: zero friction vs manual downloads. | High | **v2 headline feature.** Intercept HLS/MP4, cache segments |
| Offline ASS subtitle support | Turkish fansubs use ASS (typeset, karaoke). SRT would be a regression. | Medium | JASSUB already in tau-website |
| Discord Rich Presence | "Watching X - Ep 12" on Discord drives installs. | Low | Wire correct metadata in v2 |
| Multi-threaded downloads | Measurably faster than single-connection. | High | v2 needs per-thread retry and HTTP Range resume |
| Download queue management | "Queue all episodes, walk away" workflow. | Medium | v2: persistent queue via SQLite |
| Download pause / resume | Metered connections, interrupted downloads. | Medium | **Missing in v1.** HTTP Range resume needed |
| System tray presence | App stays alive for background downloads. | Low | Not in v1. Add in v2 |
| Download storage management | Show disk usage, delete episodes, warn on low storage. | Medium | v2 candidate, requires local file index |

## Anti-Features (deliberately NOT build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom frontend / local UI | Duplicating animecix.tv doubles maintenance. | Load the website. Use IPC to extend. |
| Linux support (v1) | Third platform triples QA surface. | Defer to v2+ milestone. |
| Video transcoding | Separate product scope. | Play as-is. |
| Real-time chat / social | animecix.tv owns community. | Discord RPC is sufficient. |
| Built-in browser / tabs | Scope creep. | Single window, single URL. |
| DRM (Widevine) | Legal complexity. Not used by animecix. | Not applicable. |
| Subtitle editing tools | Separate product. | Display as-is. |
| Local user profile / watch history | Sync nightmares with website. | Use website session. |
| Torrent / P2P | Legal risk, different infrastructure. | HTTP multi-threaded download. |

## Feature Dependencies

```
Google Login (deep link) → Single Instance Lock
Offline Playback → Download (files must exist on disk)
Offline Playback → Custom protocol handler or localhost server
Offline Playback → Offline Subtitle Support
Streaming Cache → Request interception (session.webRequest or protocol)
Streaming Cache → Cache storage layer (disk, indexed by source URL)
Streaming Cache → Offline Playback (to serve cached content)
Offline Subtitle Support → JASSUB in tau-website (already present)
Offline Subtitle Support → Subtitle file download alongside video
Download Queue (persistent) → SQLite local DB
Download Resume → HTTP Range headers + chunk metadata on disk
Discord RPC → Tau-website postMessage API (metadata flow via IPC)
System Tray → Download Queue (tray only valuable for background downloads)
Auto-update → GitHub Releases publish pipeline
```

## MVP Recommendation

**Must ship:**
1. Fix `rejectUnauthorized: false` — security baseline
2. Offline video playback from downloaded files
3. Offline ASS subtitle support
4. Streaming cache — headline differentiator
5. Persistent download queue (SQLite)

**Ship but can be rough (fast-follow):**
6. Download pause/resume
7. System tray
8. Discord RPC episode metadata accuracy

**Defer:**
- Download storage management UI
- Global keyboard shortcuts
- Per-video quality selection
- Linux support

---
*Features research: 2026-04-11*
