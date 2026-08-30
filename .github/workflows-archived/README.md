# Archived workflows

Workflows kept for reference but not run. GitHub only reads
`.github/workflows/`, so nothing in this directory triggers.

## release.yml

Archived 2026-08-30. The tag-driven delivery pipeline: it built CLI binaries
for Homebrew, built and signed the desktop app, created the GitHub Release,
bumped the personal Homebrew tap, and published to npm.

It never completed a successful run. The last attempt failed on two counts:

- `fatal: Authentication failed for github.com/stwgabriel/homebrew-tap`, an
  expired `PAT_TOKEN`
- "Failed to resolve release checksums", followed by npm publish exiting 1

It also depends on Apple signing and notarization secrets
(`MACOS_CERTIFICATE`, `APPLE_API_KEY`, `APPLE_TEAM_ID` and others) that the
replacement deliberately does not need.

`release-build.yml` replaces the part that is actually wanted today: build the
desktop app on a GitHub runner when a release is published, and attach the
artifacts to it. It produces unsigned builds and does no publishing.

Restoring this file means re-provisioning the tap PAT, the npm token, and the
Apple signing chain, and it only makes sense if the CLI ships as a product
again. See the open question about retiring the CLI.
