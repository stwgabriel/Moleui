# Changelog

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
