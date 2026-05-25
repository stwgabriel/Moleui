# Changelog

## [1.44.0] - 2026-05-23

### Added
- Added a native desktop application menu with Settings, edit/window actions, and development reload tools.
- Added Analyze page loading overlays, disk usage flow animation, and directional folder navigation transitions.
- Added battery prediction utility coverage for charging and discharging forecasts.

### Changed
- Refined Analyze results around a storage map, disk usage list totals, and size-sorted file management rows.
- Refined Uninstall selection with larger packed app bubbles, refreshed scan controls, and a primary uninstall action.
- Enabled desktop GPU rasterization flags for smoother rendering.

### Fixed
- Fixed battery forecast charts to end at the predicted full or empty time.

## [1.43.1] - 2026-05-22

### Added
- Added repeatable `--task` filtering for `mo optimize` so specific optimization tasks can be run directly.
- Added root web development and build scripts, with Turbo outputs configured for Next.js builds.

### Changed
- Refined desktop Uninstall selection controls, scroll shadows, and refresh/select-all actions.
- Refined desktop Optimize progress indicators and Clean page copy/visual polish.

### Fixed
- Fixed Storage page file and folder list row corners to match the parent list container.
- Fixed optimize dry-runs to avoid invoking the login items AppleScript audit.

## [1.43.0] - 2026-05-20

### Added
- Added finer-grained desktop cleanup categories for every CLI cleanup section, including installer, project artifact, and purge-driven groups.
- Added desktop runtime packaging coverage for purge, installer, Touch ID, and completion shell subcommands.
- Added My Mac battery drain prediction with charging-state handling.

### Changed
- Refined the desktop Clean page layout, category orbit states, group selection controls, and dry-run result parsing.

### Fixed
- Fixed desktop clean dry-runs so command failures surface as errors instead of clean categories.
- Fixed exit code 2 dry-run responses to be treated as empty cleanup groups.

## [1.42.0] - 2026-05-19

### Added
- Added non-privileged Apple GPU utilization parsing via `ioreg` as the primary metrics source with fallback to `powermetrics`.
- Added support for `--all` (select all found installers) and `--yes` / `-y` (skip confirmation prompt) CLI flags to the installer subcommand.

### Changed
- Improved installer safety by checking for a TTY stdin before asking for confirmation in non-interactive environments.
- Optimized Apple GPU usage caching TTL down to 1 second and set active collection timeout to 600ms.

### Fixed
- Fixed Optimize page flow by refactoring run IDs and user cancellation mechanics to avoid UI state races.

## [1.41.1] - 2026-05-19

### Added
- Added fresh Analyze scans for desktop refreshes so cached directory sizes can be bypassed when needed.
- Added Analyze result sorting by size or last access date, list/map view modes, and disk usage proportion details.

### Changed
- Improved desktop startup by replacing the separate Electron splash window with an in-app loading overlay and lazy-loaded pages.
- Refined desktop navigation order, Analyze/Clean/Uninstall layouts, and persisted state handling.

### Fixed
- Fixed macOS desktop release packaging to require Developer ID signing and notarization.
- Fixed Homebrew and npm desktop installers to target the packaged `Moleui.app` bundle name.

## [1.41.0] - 2026-05-17

### Added
- Added right-click context menu to Analyze page items with Reveal in Finder and Delete actions.
- Added IPC handlers for `open-path-in-finder` and `delete-path` with safe-path validation and trash-based deletion.
- Added dry-run preview parsing and rewrite logic to Optimize page for human-friendly action summaries.
- Added new IPC bridges (`copyText`, `revealPath`, `openPathInFinder`, `deletePath`, `openActivityMonitor`, `signalProcess`) in preload.

### Changed
- Redesigned Clean page with glassmorphic soft-card layout, accent radial backgrounds, and muted pill styling.
- Redesigned Uninstall page with glass card aesthetics, pill-shaped search input, multi-select toolbar, and memoized icon rendering.
- Refined Optimize page timeline with parsed section/item structure and preview-vs-main output routing.
- Lightened card shadows on StartScreen and MyMac action cards for a softer visual tone.
- Updated GitHub screenshots for Analyze, Clean, MyMac, Optimize, and Uninstall pages.
- Suppressed noisy `status --json` success logs in preload CLI logger.

### Fixed
- Fixed batch uninstall to skip interactive file-selection prompts when running with `--yes` from the desktop app.

## [1.40.0] - 2026-05-15

### Changed
- Redesigned desktop sidebar from a bottom pill-bar to a fixed vertical layout with app logo and updated iconography.
- Redesigned StartScreen component with distinct `feature` and `uninstall` visual variants, replacing the generic card layout.
- Updated page titles and icons across Clean, Optimize, Analyze, and Uninstall pages for clarity and consistency.
- Streamlined MyMac dashboard grid layout and hid redundant quick-action navigation cards.
- Disabled user text selection globally in the desktop app for a native feel.

### Fixed
- Fixed Analyze results grid to use a consistent two-column layout instead of responsive breakpoints.

## [1.39.0] - 2026-05-13

### Added
- Added targeted cleanup section execution with repeatable `--section` support for desktop-driven cleanups.
- Added full-process status JSON output via `--process-limit 0`, including process command paths for desktop process actions.

### Changed
- Improved GPU and battery status reporting with Apple GPU naming, GPU temperature collection, and richer desktop metrics data.
- Improved Homebrew cask detection performance by caching cask lists during uninstall scans.

## [1.36.1] - 2026-05-08

### Fixed
- Fixed release workflow Bun setup so the tag-triggered desktop build can run and publish Homebrew assets.

## [1.36.0] - 2026-05-08

### Added
- Added the `moleui` npm launcher package for installing and launching the desktop app from npm.
- Added Homebrew cask update automation for the Moleui Desktop app.

### Changed
- Reworked release automation to publish CLI binaries, desktop artifacts, npm package metadata, and Homebrew updates from the `V1.36.0` tag.
- Updated repository, installer, and workflow references for the `stwgabriel/moleui` release location.

### Fixed
- Fixed desktop artifact naming used by the npm launcher and Homebrew cask deployment.
- Fixed package import paths after the repository move to `stwgabriel/moleui`.
