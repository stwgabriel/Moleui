# Mole GUI Action List

## Goal

Ship a `Tauri + React` desktop interface for Mole that uses the existing CLI as the backend and covers the full command surface over time.

## Phase 1: Foundations

- confirm the GUI will live in this repo or in a sibling repo
- define the target app name for the desktop shell
- scaffold a Tauri + React app
- define a shared command runner abstraction for all `mo` subprocess calls
- define a job model for stdout, stderr, exit code, duration, and saved transcript

## Phase 2: CLI Contract Mapping

- document the command contract for `status`, `analyze`, and `uninstall --list`
- document supported options for `clean`, `optimize`, `purge`, `installer`, `touchid`, `update`, `remove`, and `completion`
- define which commands always run through a dry-run step first
- define which commands need additional GUI confirmation before execution
- define cancellation rules per command

## Phase 3: Read-Heavy Native Screens

- build Dashboard with `mo status --json`
- build Space Explorer with `mo analyze --json`
- build Uninstaller browser with `mo uninstall --list`
- store recent scans locally for faster navigation and richer UX
- add empty, loading, error, and stale-data states for each screen

## Phase 4: Managed Job Screens

- build a generic Job Runner screen for transcript-based commands
- support live output streaming into the UI
- add dry-run execution mode for `clean`, `optimize`, `purge`, and `installer`
- add final confirm and execute step after preview
- capture and display warnings without collapsing them into generic UI copy

## Phase 5: Smart Care Orchestration

- create a Smart Care entry screen
- define which commands participate in Smart Care in v1
- sequence `clean`, `optimize`, and `installer` as managed jobs
- summarize outcomes in a single post-run report
- leave room for structured recommendation cards later

## Phase 6: Safety UX

- make `dry-run` the default entry point for destructive workflows
- label Trash vs permanent deletion clearly in uninstall flows
- expose protected-path and whitelist messaging where relevant
- preserve CLI warnings and skipped-item reasons
- add a visible operation log/history screen

## Phase 7: Privileged Flow Handling

- test how Tauri-launched subprocesses behave for commands that request sudo
- ensure password prompts are understandable and not hidden behind the app window
- add preflight messaging before privileged commands run
- document fallback behavior if a command must still be completed in Terminal

## Phase 8: Structured Output Expansion

- add JSON output mode for `clean`
- add JSON output mode for `optimize`
- add JSON output mode for `purge`
- add JSON output mode for `installer`
- add structured result summaries for `touchid` and `update`

## Phase 9: Native Workflow Upgrade

- replace transcript-only cleanup flows with category review cards
- replace transcript-only optimize flow with task-level statuses
- replace transcript-only purge flow with project and artifact summaries
- add structured post-action summaries with reclaimed space, skipped items, and warnings

## Phase 10: Final Product Polish

- refine layout for 13-inch and larger Mac displays
- tighten keyboard navigation and accessibility
- add richer visual treatment for storage analysis and health summaries
- review onboarding and first-run guidance
- validate logs, errors, and destructive confirmations end to end

## Suggested Build Order

1. Tauri shell and subprocess runner
2. Dashboard using `status --json`
3. Space Explorer using `analyze --json`
4. Uninstaller browser using `uninstall --list`
5. Generic Job Runner
6. `clean` and `optimize` managed job flows
7. `purge` and `installer` managed job flows
8. Smart Care orchestration
9. Structured output expansion for remaining commands

## Definition Of Done For V1

- users can inspect system health in a native dashboard
- users can inspect disk usage in a native explorer
- users can browse uninstall candidates in a native app list
- users can run `clean`, `optimize`, `purge`, and `installer` from the GUI
- destructive flows preserve preview, confirmation, and logging
- the app clearly communicates what it ran and what happened
