# Mole GUI Plan

## Goal

Create a macOS desktop interface for Mole using `Tauri + React`, with the existing `mo` CLI as the execution backend.

The GUI should cover the full Mole surface area without reimplementing cleanup or uninstall logic in the app layer.

## Product Principle

- The GUI is a visual control surface for the CLI, not a second backend.
- Destructive behavior stays inside existing Mole commands.
- The interface should expose review, preview, confidence, and logs more clearly than the terminal.
- Safety defaults from the CLI must be preserved, not simplified away.

## Codebase Reality

The current repo already provides a strong base for a GUI:

- `mo status --json` already exists in `cmd/status/main.go`
- `mo analyze --json` already exists in `cmd/analyze/main.go`
- `mo uninstall --list` switches to JSON in non-TTY mode in `bin/uninstall.sh`
- destructive commands already have `--dry-run`, confirmation, path validation, whitelist handling, and operation logging

Relevant references:

- `README.md`
- `mole`
- `lib/core/help.sh`
- `cmd/status/main.go`
- `cmd/analyze/main.go`
- `bin/uninstall.sh`
- `SECURITY_AUDIT.md`

## Recommended Stack

- Shell: `Tauri`
- UI: `React`
- Styling: existing design system to be decided later, but keep it minimal and desktop-oriented
- Process integration: Tauri-side command runner that launches `mo`

Why this stack:

- good fit for a macOS desktop app
- can spawn and monitor local subprocesses
- small runtime footprint
- easy to build rich dashboard and workflow UIs
- lets Mole keep its CLI-first architecture

## Full Coverage Strategy

Tauri + React can cover all current functionality, but not every command is equally machine-readable today.

### Structured commands available now

- `mo status --json`
- `mo analyze --json [path]`
- `mo uninstall --list`

These should be the first native GUI screens.

### Commands that should run as managed jobs first

- `mo clean`
- `mo optimize`
- `mo purge`
- `mo installer`
- `mo touchid`
- `mo update`
- `mo remove`
- `mo completion`

These can be launched through a controlled job runner in the GUI, with:

- preflight option selection
- dry-run first where supported
- live stdout/stderr stream
- clear confirmation before destructive execution
- final summary and log retention

### Commands that should gain structured output later

For a more native interface, add machine-readable modes over time for:

- `clean`
- `optimize`
- `purge`
- `installer`
- `touchid`

This will let the GUI evolve from transcript-based execution to fully structured review cards and progress steps.

## Proposed Information Architecture

### 1. Dashboard

Primary source: `mo status --json`

Purpose:

- health summary
- CPU, memory, disk, network, battery, processes
- recommended next actions
- recent job outcomes

### 2. Smart Care

Purpose:

- unified top-level guided maintenance flow
- combines scan recommendations from `clean`, `optimize`, and `installer`
- acts as the GUI equivalent of CleanMyMac's care routine, but grounded in Mole's actual commands

Phase 1 approach:

- present Smart Care as a launcher and orchestrator
- run selected commands as sequential managed jobs

Phase 2 approach:

- consume structured outputs and render findings before execution

### 3. Cleanup

Primary backend: `mo clean`

Purpose:

- cache and junk cleanup
- browser leftovers
- developer cache cleanup
- dry-run preview before apply

### 4. Uninstaller

Primary backend:

- `mo uninstall --list`
- `mo uninstall [APP_NAME...]`

Purpose:

- search and filter installed apps
- show size, app metadata, uninstall target name
- review removal before execution
- keep Trash as the default path

This should borrow the clarity of AppCleaner without imitating its exact UI.

### 5. Space Explorer

Primary backend: `mo analyze --json [path]`

Purpose:

- visual storage inspection
- large file discovery
- drilldown across folders and volumes
- action path into Finder reveal, open, or safe delete flow

This is the area most strongly informed by DaisyDisk.

### 6. Project Purge

Primary backend: `mo purge`

Purpose:

- developer/project artifact cleanup
- scoped cleanup under configured project boundaries
- dry-run and job transcript first

### 7. Utilities

Primary backends:

- `mo installer`
- `mo touchid`
- `mo update`
- `mo remove`
- `mo completion`

Purpose:

- secondary maintenance and system integration tools

## UX Rules

- Default to preview before mutation.
- Show expected impact before the final confirm step.
- Make dangerous actions visually distinct.
- Keep CLI terminology where it helps trust and supportability.
- Preserve warning text from the CLI instead of hiding it behind generic UI copy.
- Keep a visible job log and command transcript for advanced users.

## Safety Requirements To Preserve

The GUI should preserve the current safety model described in `SECURITY_AUDIT.md`.

Must keep:

- `--dry-run` as a first-class review step
- explicit confirmation for destructive operations
- path validation boundaries
- protected path and category behavior
- whitelist support where already present
- uninstall-to-Trash default behavior
- bounded sudo behavior
- operation logging and auditability

The GUI must not bypass the CLI's guarded file operation helpers.

## Technical Integration Model

### Tauri-side responsibilities

- locate the installed `mo` binary
- spawn commands with explicit arguments
- detect JSON mode vs transcript mode
- stream output incrementally to the frontend
- capture exit codes, duration, and logs
- support cancellation where safe

### React-side responsibilities

- render native screens for structured data
- render managed job views for transcript-based commands
- present option forms before command execution
- present dry-run results and confirmation screens
- retain recent history for trust and debugging

## Command Integration Matrix

| Mole command | GUI treatment | Phase 1 | Phase 2 |
| --- | --- | --- | --- |
| `status` | native dashboard | JSON | richer visualizations |
| `analyze` | native explorer | JSON | enhanced visualization and action panel |
| `uninstall --list` | native app browser | JSON | richer review and leftover visualization |
| `uninstall` | managed job with review | transcript | structured result output |
| `clean` | managed job | transcript + dry-run | structured categories and estimates |
| `optimize` | managed job | transcript + dry-run | structured tasks and results |
| `purge` | managed job | transcript + dry-run | structured project/artifact summaries |
| `installer` | managed job | transcript + dry-run | structured scan results |
| `touchid` | managed job | transcript | structured status and action results |
| `update` | managed job | transcript | structured update metadata |
| `remove` | managed job | transcript | likely stays transcript |
| `completion` | managed job | transcript | likely stays transcript |

## Visual Direction

Borrow the following product lessons:

### From CleanMyMac

- polished top-level guidance
- clear health framing
- one-click routine entry point
- premium Mac-native finish

### From DaisyDisk

- high-clarity storage visualization
- strong sense of drilldown and focus
- large-file discovery as a visual experience

### From AppCleaner

- focused uninstall flow
- direct review of related files before deletion
- low-friction, high-trust task framing

Avoid:

- generic SaaS dashboard styling
- fake performance theatrics
- noisy gradients and decorative clutter
- ambiguous delete actions
- hiding risks behind minimal copy

## Release Plan

### Phase 1

- Tauri shell and React app scaffolding
- command runner and job log model
- Dashboard using `status --json`
- Space Explorer using `analyze --json`
- Uninstaller browser using `uninstall --list`
- transcript-based managed jobs for `clean`, `optimize`, `purge`, `installer`

### Phase 2

- structured output support for remaining high-value commands
- Smart Care recommendation layer
- richer review screens and action summaries
- improved privileged flow handling

### Phase 3

- polished system settings surface
- deeper history and saved scan states
- more opinionated productivity workflows

## Summary

The right first version is not a rewrite of Mole. It is a desktop shell that:

- uses the current CLI directly
- starts with native views where JSON already exists
- wraps the rest of the product in a controlled job runner
- gradually adds structured output for the remaining workflows

That gives full product coverage early while preserving Mole's current behavior, safety boundaries, and maintenance model.
