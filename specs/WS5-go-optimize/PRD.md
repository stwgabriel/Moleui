# WS5 — Go Fixes & Optimization (PRD)

## Problem

The audit ([../reports/codebase-audit-2026-06-19.md](../reports/codebase-audit-2026-06-19.md))
found correctness and safety issues in `cmd/analyze`:

1. **Silent-delete edge case (safety).** The delete confirmation renders only when
   `deleteTarget != nil` ([view.go]), but a multi-selection can enter delete mode
   with an unresolved target, so Enter could delete with no on-screen prompt.
2. **`*.egg-info` fold never matches.** `foldDirs["*.egg-info"]` is an exact-match
   key, so real `mypkg.egg-info` dirs are never folded and get fully scanned.
3. **`getDirSizeFast` skips path validation.** It runs `du` without `validatePath`,
   unlike every other `du` call site.
4. **Dead code.** `scanSubdirWithCache` wrapper has no callers.

## Goals

- Fix the safety and correctness issues with no change to the Trash-routed
  deletion mechanism or protected-path checks.
- Keep `go test ./...` and `go vet` green; add regression coverage.

## Non-goals

- Micro-optimizing the O(n^2) selected-size recompute on each keypress: at real
  entry counts (tens) it is negligible; deferred and noted.
- Removing `calculateDirSizeFast`: it is exercised by a test
  (`analyze_test.go`), so per the repo test-orphan rule it stays.

## Success criteria

- Delete confirmation always renders while delete mode is active and there is a
  pending target or multi-selection.
- `mypkg.egg-info` folds during scan (covered by a new test).
- `getDirSizeFast` validates its path.
- Dead `scanSubdirWithCache` removed; full Go suite green.
