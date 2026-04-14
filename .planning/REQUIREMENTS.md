# Requirements: AnimeciX Desktop v2

**Defined:** 2026-04-11
**Core Value:** Users can watch anime seamlessly — online or offline — with full subtitle support, download management, and native desktop integration.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### App Shell

- [x] **SHELL-01**: User sees a native frameless window with minimize/maximize/close controls
- [x] **SHELL-02**: App enforces single instance lock — second launch focuses existing window
- [x] **SHELL-03**: App loads animecix.tv as main content in the window
- [x] **SHELL-04**: User login session persists across app restarts and updates

### Video Playback

- [ ] **PLAY-01**: User can watch videos via tau-website (Vidstack) player running locally inside Electron
- [ ] **PLAY-02**: Player supports HLS streaming and MP4 multi-quality sources
- [ ] **PLAY-03**: Player renders ASS subtitles via JASSUB with language selection
- [ ] **PLAY-04**: Player shows skip intro/outro buttons based on tau-video API markers
- [ ] **PLAY-05**: Videos automatically cache to disk as user streams, available for offline rewatch

### Downloads

- [ ] **DL-01**: User can download videos to disk with multi-threaded download and progress tracking
- [ ] **DL-02**: User can queue multiple downloads with configurable concurrency
- [ ] **DL-03**: Download queue persists across app restarts (SQLite storage)
- [ ] **DL-04**: User can pause and resume downloads (HTTP Range-based)
- [ ] **DL-05**: User can play downloaded videos offline using tau-website player
- [ ] **DL-06**: Offline playback includes ASS subtitle support (subtitles downloaded alongside video)
- [ ] **DL-07**: User receives desktop notifications on download completion

### Authentication & Security

- [ ] **AUTH-01**: User can log in via Google using animecix:// deep link protocol
- [x] **AUTH-02**: App uses proper HTTPS with certificate validation (no rejectUnauthorized bypass)
- [x] **AUTH-03**: All windows use contextIsolation with contextBridge for IPC
- [ ] **AUTH-04**: App manipulates request headers (referer, user-agent) for video host compatibility

### Network & Content

- [ ] **NET-01**: App blocks ads and trackers with maintained filter lists
- [x] **NET-02**: Preload bridge exposes typed IPC API between website and Electron main process

### Native Integrations

- [ ] **INTG-01**: App auto-updates via electron-updater with GitHub Releases
- [ ] **INTG-02**: Discord Rich Presence shows current anime title and episode
- [ ] **INTG-03**: App minimizes to system tray for background downloads
- [ ] **INTG-04**: User can view download storage usage and delete downloaded episodes

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Platform

- **PLAT-01**: Linux support (deb and AppImage builds)

### Downloads

- **DL-08**: Global keyboard shortcuts for media control
- **DL-09**: Per-video quality selection before download

### Player

- **PLAY-06**: Picture-in-picture mode
- **PLAY-07**: Watch history sync between devices

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom frontend / local UI | App loads animecix.tv; duplicating UI doubles maintenance |
| Linux support (v1) | Third platform triples QA surface; defer to v2 |
| Video transcoding | Separate product scope; play files as-is |
| Real-time chat / social | animecix.tv owns community; Discord RPC sufficient |
| Built-in browser / tabs | Scope creep; single window, single URL |
| DRM (Widevine) | Legal complexity; not used by animecix |
| Subtitle editing tools | Separate product; display as-is |
| Local user profile / watch history | Sync issues with website; use website session |
| Torrent / P2P downloads | Legal risk; HTTP multi-threaded download sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 1 | Complete |
| SHELL-02 | Phase 1 | Complete |
| SHELL-03 | Phase 1 | Complete |
| SHELL-04 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| NET-02 | Phase 1 | Complete |
| PLAY-01 | Phase 2 | Pending |
| PLAY-02 | Phase 2 | Pending |
| PLAY-03 | Phase 2 | Pending |
| PLAY-04 | Phase 2 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| NET-01 | Phase 2 | Pending |
| INTG-02 | Phase 2 | Pending |
| DL-01 | Phase 3 | Pending |
| DL-02 | Phase 3 | Pending |
| DL-03 | Phase 3 | Pending |
| DL-04 | Phase 3 | Pending |
| DL-05 | Phase 3 | Pending |
| DL-06 | Phase 3 | Pending |
| DL-07 | Phase 3 | Pending |
| PLAY-05 | Phase 3 | Pending |
| INTG-03 | Phase 3 | Pending |
| INTG-04 | Phase 3 | Pending |
| INTG-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after roadmap creation — all 26 requirements mapped*
