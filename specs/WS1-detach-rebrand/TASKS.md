# WS1 — Tasks

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

- [x] T1 (S1) Remove the `upstream` git remote (done during setup).
- [x] T2 (S2) `install.sh`: attestation `--owner tw93` -> `stwgabriel` (+ comment).
- [x] T3 (S3) `release.yml`: remove the "Official Core" Homebrew-core PR step;
  keep the personal-tap step; YAML still parses.
- [x] T4 (S4) `.github/FUNDING.yml`: drop `tw93`.
- [x] T5 (S4) `.github/ISSUE_TEMPLATE/config.yml`: security email ->
  `security@stwgabriel.com`.
- [x] T6 (S4) `.claude/hooks/format-on-edit.sh`: goimports `-local
  github.com/stwgabriel/moleui`.
- [x] T7 (S4) `.claude/skills/release-notes/{SKILL.md,scripts/*}`: repo + sponsor
  login -> `stwgabriel/moleui` / `stwgabriel`.
- [x] T8 (S4) `AGENTS.md`: release docs + sponsor query -> `stwgabriel/moleui`.
- [x] T9 (S4) `scripts/update_homebrew_tap_formula.sh`: URL regex -> `stwgabriel/moleui`.
- [x] T10 (S4) `scripts/setup-quick-launchers.sh`: bundle id ->
  `com.stwgabriel.moleui.<subcommand>`.
- [x] T11 (S5) `tests/update.bats`, `tests/scripts.bats`: assert
  `stwgabriel/moleui` URLs.

## Verify
- [x] V1 `bash -n` clean on all changed shell files.
- [x] V2 `release.yml` parses (python yaml).
- [x] V3 `tw93` inventory: only preserved-on-purpose refs remain.
- [!] V4 bats suite: `bats` not installed locally; CI-verified.

## Preserved on purpose
- `com.tw93.MiaoYan` cleanup, `/Users/tw93/` example paths, `CONTRIBUTORS.svg`,
  `tests/purge.bats` upstream-issue link.
