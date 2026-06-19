# WS5 — Stories

## S1 — Deletion never proceeds without a visible confirmation (safety)
As a user, I must always see a confirmation prompt before anything is deleted.
**Done when:** the analyze view renders the delete prompt whenever delete mode is
active and there is a target or a multi-selection; the nil-target branch no longer
dereferences `deleteTarget`.

## S2 — Python egg-info directories fold during scan
As a user scanning a Python project, `*.egg-info` directories should be folded
like other build artifacts.
**Done when:** `shouldFoldDirWithPath` folds names ending in `.egg-info`; a test
covers it; the dead exact-match map entry is removed.

## S3 — du-based sizing validates paths consistently
As a maintainer, every `du` call should validate its path.
**Done when:** `getDirSizeFast` calls `validatePath` before invoking `du`.

## S4 — Dead code removed
**Done when:** the unused `scanSubdirWithCache` wrapper is removed and the suite
still passes (`calculateDirSizeFast` retained: test-exercised).
