# WS1 — Detach & Rebrand (PRD)

## Problem

The repo is a fork of `tw93/Mole`. The owner decided (2026-06-19) to detach: remove
the upstream remote, drop unused upstream coupling, and reframe the project around
its new identity as **primarily a desktop app** (Moleui). The source already points
update/install/release URLs at `stwgabriel/moleui`, but several places still
coupled to `tw93`, and some CLI tests were left asserting the old URLs.

## Goals

- No live coupling to `tw93`: releases and installs verify against the owner's repo;
  maintainer tooling/docs reference `stwgabriel/moleui`.
- Preserve legitimate `tw93` references that are NOT branding.
- Keep the repo buildable; align stale CLI tests with the already-detached source.

## Non-goals

- Rewriting git history (owner chose to keep it).
- Renaming the `mole`/`mo` binary or `MOLE_*` env vars (muscle memory + scripts).
- Re-attributing past contributions: `tw93` stays in `CONTRIBUTORS.svg` (a real
  past contributor; erasing that would be wrong).

## Preserved on purpose (not branding)

- `lib/clean/app_caches.sh`: `~/Library/Caches/com.tw93.MiaoYan/*` is cleanup logic
  for a real third-party app bundle id, not a self-reference.
- `lib/core/app_protection.sh` comment and `cmd/status/metrics_disk_test.go`
  fixture use `/Users/tw93/...` as benign example paths.
- `tests/purge.bats` comment links to the historical upstream issue #647.

## Success criteria

- `git remote` shows only `origin` (done).
- No `tw93` repo coupling in install/release/tooling/docs/CLI tests.
- `release.yml` no longer attempts an upstream Homebrew-core PR.
- `bash -n` clean on changed shell; `release.yml` parses; Go/desktop unaffected.
- Remaining `tw93` strings are only the preserved-on-purpose set above.
