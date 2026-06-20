# WS4 — Tasks

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

- [x] T1 (S1) Delete `apps/desktop/src/pages/HomePage.tsx`, `SmartCarePage.tsx`.
- [x] T2 (S1) `utils/storage.ts`: remove `hasSeenHomePage`, `markHomePageSeen`,
  `getPreferredPage`, `setPreferredPage` + their constants (keep MyMac helpers).
- [x] T3 (S1) `types/index.ts`: drop `'home'` from `PageId`.
- [x] T4 (S1) `lib/featureAccents.ts`: `AccentPageId = PageId`.
- [x] T5 (S2) `components/account/UserAvatar.tsx`: `useUser()`.
- [x] T6 (S2) `components/settings/SettingsWindow.tsx`: `useUser()` for the user.
- [x] T7 (S3) `SettingsWindow.tsx`: `useClerk().signOut()` in try/finally.
- [x] T8 (S4) `main.js`: `denyChildWindows` on main/settings/CLI windows.

## Verify
- [x] V1 `node --check apps/desktop/main.js`.
- [x] V2 `apps/desktop` `tsc --noEmit` green.
- [x] V3 `apps/desktop` `bun run build` green.

## Deferred (noted in report)
- Remaining `any`: `ProcessDonutIconLabel` (MyMacPage), `window.moleDesktop as any`
  casts in `UninstallPage`.
