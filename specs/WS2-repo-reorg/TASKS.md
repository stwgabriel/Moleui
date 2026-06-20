# WS2 — Tasks

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

## Stage 1 — clarity (done)
- [x] T1 (S1) Add `docs/ARCHITECTURE.md` (Mermaid diagram + component table +
  auth/payment flow + build/release).
- [x] T2 (S3) Fix stale Go import in `.kiro/steering/structure.md`.
- [x] T3 (S1) Confirm `README.md` is desktop-first (already is; no change).
- [x] T4 (S2) Document agent-context source of truth; note `agents/` is gitignored
  (not committed, no dedup needed).

## Verify
- [x] V1 Steering doc has no `tw93` reference.
- [x] V2 ARCHITECTURE diagram uses valid Mermaid (GitHub-renderable) flowchart.

## Stage 2 — physical restructure (planned, gated)
- [ ] T5 Execute the engine/apps split per the PRD, in one PR, verified by the full
  Bats suite + `go test ./...` + desktop build + `install.sh` dry-run in CI.
  Blocked locally: `bats` is not installed here. Awaiting owner go-ahead.
