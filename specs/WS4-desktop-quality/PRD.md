# WS4 — Desktop Quality (PRD)

## Problem

The desktop audit found dead code and fragile patterns:

1. **Dead code** — `HomePage.tsx`, `SmartCarePage.tsx` (never imported), four unused
   `storage.ts` helpers, and a stale `'home'` member in `PageId`.
2. **Fragile Clerk access** — `(window as any).Clerk?.user` is read outside React
   in `UserAvatar` and `SettingsWindow` (can render stale), and sign-out is not
   atomic (if `Clerk.signOut()` throws, the app never resets to login).
3. **Window hardening gap** — only the billing window had `setWindowOpenHandler`;
   the app windows could spawn uncontrolled child windows via `window.open`.

## Goals

- Remove the dead code (owner explicitly asked to drop unused code).
- Make Clerk access reactive and typed; make sign-out fail-safe.
- Harden app windows against uncontrolled child windows without breaking Clerk
  auth popups in the login window.

## Non-goals (deferred, noted)

- Eliminating every remaining `any` (e.g. `ProcessDonutIconLabel` in `MyMacPage`,
  a few `window.moleDesktop as any` casts in the 1200-line `UninstallPage`). These
  are isolated and lower-risk; tracked for a later pass.

## Success criteria

- Deleted files are gone; no dangling imports; `storage.ts` keeps the live MyMac
  helpers (`getMyMacMetrics`/`setMyMacMetrics`).
- `UserAvatar`/`SettingsWindow` use `useUser()`/`useClerk()`; sign-out always
  resets the app even if Clerk throws.
- `denyChildWindows` applied to main/settings/CLI windows (login excluded).
- `tsc --noEmit` and `bun run build` both green; `main.js` passes `node --check`.
