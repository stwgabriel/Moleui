# Mole Desktop POC

This app is a minimal proof of concept for shipping Mole as a desktop app that bundles the CLI inside the app.

Current scope:

- packages a desktop app for macOS
- bundles a generated Mole runtime into the app
- runs `mole status --json` from the desktop process
- renders the raw command output in the window

Build commands from the repo root:

- `bun install`
- `bun run desktop:dev`
- `bun run desktop:build`

Build output:

- unpacked app and installer artifacts land in `apps/desktop/dist/`

Notes:

- this is intentionally minimal and only wires one CLI command
- the generated runtime lives in `apps/desktop/.mole-runtime/` and is rebuilt before dev and dist runs
- the resulting `.dmg` is unsigned, so macOS may require opening it via Finder context menu on first launch
