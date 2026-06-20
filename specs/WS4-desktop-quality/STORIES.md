# WS4 — Stories

## S1 — Dead code is gone
**Done when:** `HomePage.tsx`, `SmartCarePage.tsx`, the four unused `storage.ts`
helpers (+ their constants), and the `'home'` `PageId` member are removed; build
stays green; `MyMacPage`'s storage usage is unaffected.

## S2 — Clerk access is reactive and typed
As a user, the avatar and account name should reflect the current Clerk user
without a manual refresh.
**Done when:** `UserAvatar` and `SettingsWindow` read the user via `useUser()`
instead of `(window as any).Clerk`.

## S3 — Sign-out is fail-safe
As a user, signing out must always return me to the login screen.
**Done when:** `handleSignOut` calls `useClerk().signOut()` in a try/finally and
always runs `moleDesktop.auth.signOut()` even if the Clerk call fails.

## S4 — App windows cannot spawn uncontrolled child windows
**Done when:** `denyChildWindows` (a `setWindowOpenHandler` returning `deny`) is
applied to the main, settings, and CLI-monitor windows; the login window is left
as-is so Clerk auth popups still work.
