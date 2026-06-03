# Desktop App Changelog

## [0.11.0] - 2026-05-31

### Added
- Added app-grouped process monitoring on My Mac, with expandable process details and search across apps, PIDs, and commands.
- Added richer process and uninstall app icon resolution using bundle metadata, Spotlight matches, application indexing, and generated fallback icons.

### Changed
- Refined the My Mac dashboard into equal-width metric columns with tighter Mac details, edge-faded charts, and free-space labels for RAM and storage.
- Refined Clean and Uninstall page spacing so the main visual controls sit more naturally in the desktop layout.

### Fixed
- Fixed process icon fetching to request icons for all visible processes instead of only the highest CPU and memory rows.

## [0.10.0] - 2026-05-23

### Added
- Added a native application menu with Settings, edit/window actions, and development reload tools.
- Added Analyze loading overlays, disk usage flow animation, and directional folder navigation transitions.
- Added battery prediction utility coverage for charging and discharging forecasts.

### Changed
- Refined Analyze results around a storage map, disk usage list totals, and size-sorted file management rows.
- Refined Uninstall selection with larger packed app bubbles, refreshed scan controls, and a primary uninstall action.
- Enabled GPU rasterization flags for smoother desktop rendering.

### Fixed
- Fixed battery forecast charts to end at the predicted full or empty time.

## [0.9.1] - 2026-05-22

### Changed
- Refined Uninstall selection controls, scroll shadows, and refresh/select-all actions.
- Refined Optimize progress indicators and Clean page copy/visual polish.

### Fixed
- Fixed Storage page file and folder list row corners to match the parent list container.

## [0.9.0] - 2026-05-20

### Added
- Added per-section cleanup categories for the Clean page so each CLI cleanup area can scan and report independently.
- Added group-level selection controls for excluding cleanup categories before cleaning.
- Added battery drain prediction and charging indicators to My Mac.

### Changed
- Refined the Clean page orbit cards, category rows, responsive sizing, and scan-state presentation.
- Updated desktop runtime preparation to package purge, installer, Touch ID, and completion commands.

### Fixed
- Fixed Clean page dry-run parsing for arrow-prefixed items, exit code 2 empty responses, and command failures.

## [0.8.0] - 2026-05-19

### Added
- Added support for custom clean command options (`clean`, `purge`, `installer`) via the IPC bridge.
- Added interactive orbiting visualizers and dynamic card pulsing animations for the Clean page.

### Changed
- Redesigned the Clean page results section to support detailed file-group items inspection and action routing.
- Tweaked font spacing, sizes, and layout constraints on the Start Screen.
- Switched My Mac storage cache schema to use network/battery metrics and unified histories.

### Fixed
- Fixed Optimize page execution logic to track execution runs by unique ID, preventing race conditions when cancelling.

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
