# Changelog

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
