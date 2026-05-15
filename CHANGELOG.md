# Changelog

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
