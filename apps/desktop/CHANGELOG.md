# Desktop App Changelog

## [0.7.1] - 2026-05-19

### Added
- Added fresh Analyze refreshes, size/date sorting, list/map views, and disk usage proportion details.

### Changed
- Replaced the separate Electron splash window with an in-app loading overlay and lazy-loaded page bundles.
- Refined sidebar ordering and the Clean, Analyze, and Uninstall page layouts.
- Stopped persisting large uninstall icon payloads in local state.

### Fixed
- Fixed distributed macOS builds by requiring signed and notarized desktop artifacts.
- Fixed installer metadata to reference the packaged `Moleui.app` bundle.

## [0.5.0] - 2026-05-13

### Added
- Added selective cleanup results with sortable sections and desktop cleanup execution for chosen clean sections.
- Added full process visibility on My Mac, including sortable CPU/memory rows and actions to copy, reveal, terminate, force quit, or open Activity Monitor.
- Added quick analyze targets, persisted analyze path state, and regression tests for clean and analyze page behavior.

### Changed
- Redesigned the desktop shell with bottom liquid-glass navigation, a user menu, wider app window sizing, and refreshed My Mac, Clean, Analyze, and Uninstall views.
- Batched desktop app icon loading and stopped persisting large icon payloads with uninstall app state.

### Fixed
- Fixed desktop analyze path normalization for `~` and `~/...` paths before invoking the CLI.
- Fixed stale scan and cleanup cancellation flows so the UI returns to a usable state.

## [0.4.1] - 2026-05-08

### Fixed
- Fixed release workflow setup for desktop artifact builds and Homebrew cask deployment.

## [0.4.0] - 2026-05-08

### Added
- Added a splash screen and bundled desktop brand assets.
- Added persistent page state for clean, optimize, and uninstall workflows.
- Added app icon loading, scan cancellation, search, sort, and richer app selection controls to uninstall.
- Added the user menu with GitHub, donation, and settings entry points.

### Changed
- Refined the desktop UI layout, colors, and page interactions across My Mac, Clean, Analyze, Optimize, Status, and Uninstall.
- Archived legacy desktop renderer files and documentation now replaced by the React app flow.
- Updated the packaged macOS app name and artifact names for npm and Homebrew cask distribution.

### Fixed
- Fixed desktop IPC/type coverage for external links and uninstall icon/list controls.
- Fixed release asset naming so Homebrew and npm can resolve the generated desktop downloads.

## [0.3.0] - 2026-05-06

### Changed
- **Rebrand**: Renamed all user-facing "Mole" references to "Moleui" across the desktop app, README, and UI copy for consistent product identity
- **Version**: Bumped desktop app to `0.3.0` and root workspace to `1.35.0` (aligning with CLI tag `V1.35.0`)

### Added
- **Uninstall Feature**: Complete integration with CLI uninstall workflow
  - Interactive app selection with checkboxes
  - Dry-run preview showing all files to be removed
  - Multi-stage workflow (Idle → Loading → Selection → Confirmation → Executing → Results)
  - Glassmorphic UI following Liquid Glass design system
  - Dark mode support
  - Accessibility features (WCAG 2.1 AA compliant)
  - XSS protection and secure IPC communication

### Changed
- **Runtime Preparation**: Updated `prepare-runtime.mjs` to include all necessary files for uninstall feature
  - Added `bin/uninstall.sh`
  - Added `lib/ui/` directory
  - Added `lib/uninstall/` directory

### Fixed
- Fixed "No such file or directory" error when running uninstall commands
  - The runtime directory now includes all required scripts and libraries

## Files Modified
- `apps/desktop/main.js` - Added IPC handlers for uninstall operations
- `apps/desktop/preload.js` - Exposed uninstall API to renderer
- `apps/desktop/renderer.js` - Integrated uninstall page rendering
- `apps/desktop/index.html` - Added uninstall-page.js script
- `apps/desktop/styles.css` - Added comprehensive styling (~500 lines)
- `apps/desktop/scripts/prepare-runtime.mjs` - Added uninstall dependencies

## Files Created
- `apps/desktop/uninstall-page.js` - Complete uninstall workflow module (~650 lines)
- `apps/desktop/UNINSTALL_TESTING.md` - Testing guide
- `apps/desktop/QUICKSTART.md` - Quick start guide
- `apps/desktop/CHANGELOG.md` - This file
- `docs/uninstall-desktop-integration.md` - Technical documentation
- `docs/uninstall-ui-stages.md` - Visual guide
- `docs/gui-uninstall-implementation.md` - Implementation summary

## Known Issues
- No real-time progress during execution (shows spinner only)
- No app icons (uses generic package icon)
- No search/filter functionality
- No column sorting

## Next Steps
- Add real-time progress streaming
- Display actual app icons
- Implement search and filter
- Add sortable table columns
- Add keyboard shortcuts (Cmd+A, Escape)
