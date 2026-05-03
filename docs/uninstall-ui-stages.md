# Uninstall UI Stages - Visual Guide

## Stage 1: Idle (Initial State)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    ┌─────────┐                      │
│                    │ 📦 Icon │                      │
│                    └─────────┘                      │
│                                                     │
│         Ready to Uninstall Applications            │
│                                                     │
│   Scan your system to find installed applications  │
│        and remove them completely.                 │
│                                                     │
│              ┌──────────────────┐                  │
│              │ 🔍 Scan Applications │              │
│              └──────────────────┘                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**User Action**: Click "Scan Applications"
**Next Stage**: Loading

---

## Stage 2: Loading (Scanning)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    ⟳ Spinner                        │
│                                                     │
│            Scanning Applications...                │
│                                                     │
│   Please wait while we analyze your installed      │
│                 applications                        │
│                                                     │
│   ✓ Scanning directories                           │
│   ✓ Collecting metadata                            │
│   ✓ Building index                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**CLI Command**: `mole uninstall --list`
**Next Stage**: Selection (on success) or Error (on failure)

---

## Stage 3: Selection (App List)

```
┌─────────────────────────────────────────────────────┐
│ Select Applications to Uninstall                    │
│ 3 of 45 selected                                    │
│                                                     │
│ [Select All]  [Continue →]                         │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────┐  │
│ │ ☐  Application          Source      Size     │  │
│ ├───────────────────────────────────────────────┤  │
│ │ ☑  Chrome               App         450 MB   │  │
│ │    /Applications/Chrome.app                  │  │
│ ├───────────────────────────────────────────────┤  │
│ │ ☐  Docker               Homebrew    1.2 GB   │  │
│ │    /Applications/Docker.app                  │  │
│ ├───────────────────────────────────────────────┤  │
│ │ ☑  Slack                App         180 MB   │  │
│ │    /Applications/Slack.app                   │  │
│ ├───────────────────────────────────────────────┤  │
│ │ ☑  Xcode                App         12.5 GB  │  │
│ │    /Applications/Xcode.app                   │  │
│ └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**User Actions**:
- Check/uncheck apps
- Click "Select All" / "Deselect All"
- Click "Continue" (disabled if no selection)

**Next Stage**: Confirmation

---

## Stage 4: Confirmation (Dry Run)

```
┌─────────────────────────────────────────────────────┐
│              ⚠️  Confirm Uninstallation             │
│                                                     │
│  The following applications and their associated    │
│           files will be removed:                    │
│                                                     │
│ ┌───────────────────────────────────────────────┐  │
│ │ 📦 Chrome                                     │  │
│ │    450 MB • App                               │  │
│ ├───────────────────────────────────────────────┤  │
│ │ 📦 Slack                                      │  │
│ │    180 MB • App                               │  │
│ ├───────────────────────────────────────────────┤  │
│ │ 📦 Xcode                                      │  │
│ │    12.5 GB • App                              │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ Files to be removed:                                │
│ ┌───────────────────────────────────────────────┐  │
│ │ ✓ /Applications/Chrome.app                   │  │
│ │ ✓ ~/Library/Caches/com.google.Chrome         │  │
│ │ ✓ ~/Library/Preferences/com.google.Chrome... │  │
│ │ ⚠ System: /Library/LaunchAgents/...         │  │
│ │ ✓ /Applications/Slack.app                    │  │
│ │ ✓ ~/Library/Caches/com.tinyspeck.slackmac... │  │
│ │ ...                                           │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│     [✕ Cancel]    [🗑️ Uninstall 3 Apps]           │
└─────────────────────────────────────────────────────┘
```

**CLI Command**: `mole uninstall --dry-run Chrome Slack Xcode`
**User Actions**:
- Review file list
- Click "Cancel" → back to Selection
- Click "Uninstall" → proceed to Executing

**Next Stage**: Executing (on confirm) or Selection (on cancel)

---

## Stage 5: Executing (In Progress)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    ⟳ Spinner                        │
│                                                     │
│          Uninstalling Applications...              │
│                                                     │
│   Please wait while we remove the selected         │
│                 applications                        │
│                                                     │
│              ℹ️  Do not close this window           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**CLI Command**: `mole uninstall Chrome Slack Xcode`
**Next Stage**: Results (on completion)

---

## Stage 6: Results (Success)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    ┌─────────┐                      │
│                    │ ✓ Icon  │                      │
│                    └─────────┘                      │
│                                                     │
│              Uninstall Complete                    │
│                                                     │
│   Applications have been successfully removed      │
│                                                     │
│ ┌───────────────────────────────────────────────┐  │
│ │ ✓ Chrome                                      │  │
│ │ ✓ Slack                                       │  │
│ │ ✓ Xcode                                       │  │
│ │                                               │  │
│ │ 3 apps removed                                │  │
│ │ 13.1 GB freed                                 │  │
│ │ 247 files cleaned                             │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│              ┌──────────────┐                      │
│              │ ✓ Done       │                      │
│              └──────────────┘                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**User Action**: Click "Done"
**Next Stage**: Idle (reset)

---

## Stage 6b: Results (Error)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    ┌─────────┐                      │
│                    │ ✕ Icon  │                      │
│                    └─────────┘                      │
│                                                     │
│              Uninstall Failed                      │
│                                                     │
│   An error occurred during uninstallation          │
│                                                     │
│ ┌───────────────────────────────────────────────┐  │
│ │ Error: Permission denied                      │  │
│ │                                               │  │
│ │ Failed to remove:                             │  │
│ │ - /Applications/Xcode.app                     │  │
│ │                                               │  │
│ │ Suggestion: Try running with admin access     │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│              ┌──────────────┐                      │
│              │ ✓ Done       │                      │
│              └──────────────┘                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**User Action**: Click "Done"
**Next Stage**: Idle (reset)

---

## Stage 7: Error (Critical Failure)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    ┌─────────┐                      │
│                    │ ⚠️ Icon │                      │
│                    └─────────┘                      │
│                                                     │
│            Failed to scan applications             │
│                                                     │
│   The mole runtime could not be accessed.          │
│   Please check your installation.                  │
│                                                     │
│              ┌──────────────┐                      │
│              │ Try Again    │                      │
│              └──────────────┘                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**User Action**: Click "Try Again"
**Next Stage**: Idle (reset)

---

## State Transition Diagram

```
                    ┌──────┐
                    │ Idle │
                    └───┬──┘
                        │ Scan
                        ▼
                  ┌──────────┐
                  │ Loading  │
                  └─┬────┬───┘
              Success│    │Error
                    ▼    ▼
            ┌───────────┐ ┌───────┐
            │ Selection │ │ Error │
            └─────┬─────┘ └───┬───┘
                  │ Continue   │
                  ▼            │
          ┌──────────────┐    │
          │Confirmation  │    │
          └─┬──────────┬─┘    │
      Cancel│          │Confirm│
            │          ▼      │
            │    ┌──────────┐ │
            │    │Executing │ │
            │    └────┬─────┘ │
            │         │       │
            │         ▼       │
            │    ┌─────────┐ │
            └───►│ Results │◄┘
                 └────┬────┘
                      │ Done
                      ▼
                  ┌──────┐
                  │ Idle │
                  └──────┘
```

## Color Coding

- **Blue** (`--accent-primary`): Primary actions, info
- **Amber** (`--accent-warning`): Warnings, Homebrew badge
- **Red** (`--accent-danger`): Destructive actions, errors
- **Green** (`--accent-success`): Success states, completed items
- **Gray** (`--text-tertiary`): Secondary info, paths

## Animation Timing

- **Fast** (150ms): Hover effects, button presses
- **Normal** (250ms): State transitions, fades
- **Slow** (400ms): Page transitions, major state changes
- **Continuous**: Spinners (1s rotation), pulse effects (2s)

## Responsive Behavior

All stages adapt to:
- **Light/Dark mode**: Automatic via `prefers-color-scheme`
- **Reduced motion**: Animations disabled via `prefers-reduced-motion`
- **Window size**: Flexible layouts with min/max constraints
- **Content overflow**: Custom scrollbars on all scrollable areas
