# WS5 — Tasks

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

- [x] T1 (S1) `cmd/analyze/view.go`: render delete prompt on target OR
  multi-selection; guard the nil-target branch.
- [x] T2 (S2) `cmd/analyze/scanner.go`: fold names ending in `.egg-info`.
- [x] T3 (S2) `cmd/analyze/constants.go`: drop the dead `"*.egg-info"` map entry
  (replace with a pointer comment).
- [x] T4 (S2) `cmd/analyze/scanner_test.go`: add `TestShouldFoldDirWithPathFoldsEggInfo`.
- [x] T5 (S3) `cmd/analyze/insights.go`: `validatePath` in `getDirSizeFast`.
- [x] T6 (S4) `cmd/analyze/scanner.go`: remove dead `scanSubdirWithCache` wrapper.

## Verify
- [x] V1 `go vet ./cmd/analyze` clean.
- [x] V2 `go test ./cmd/... ./internal/...` green (analyze, status, units).
- [~] V3 Safety review of the delete-path change (safety-reviewer agent).

## Deferred (noted in report)
- O(n^2) selected-size recompute on keypress (negligible at real sizes).
