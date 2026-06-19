# WS1 — Stories

## S1 — Independent of the upstream remote
**Done when:** the `upstream` git remote is removed; only `origin`
(`stwgabriel/moleui`) remains. (Done during setup.)

## S2 — Installs verify against the owner's releases
As a user installing/updating, attestation must verify against the project's own
release workflow, not the upstream author.
**Done when:** `install.sh` uses `--owner stwgabriel`.

## S3 — No upstream-maintainer release actions
As the owner, the release workflow must not push to `tw93/homebrew-core` or open a
Homebrew-core PR as `tw93`.
**Done when:** the "Official Core" step is removed from `release.yml`; the personal
tap step remains; the workflow still parses.

## S4 — Maintainer tooling and docs reference the owner's repo
**Done when:** `format-on-edit.sh` goimports `-local`, the release-notes skill and
its scripts, `AGENTS.md`, the Homebrew tap generator, the funding/issue-template
config, and the quick-launcher bundle id all reference `stwgabriel`/`moleui`.

## S5 — Stale CLI tests align with the detached source
**Done when:** `tests/update.bats` and `tests/scripts.bats` assert
`stwgabriel/moleui` URLs (matching the already-updated source), so CI is green.
(Local run blocked: `bats` not installed here; CI-verified.)
