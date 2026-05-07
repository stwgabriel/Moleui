# Uninstall Auto-Confirm Fix

## Problem

When executing uninstall from the desktop app, the CLI would hang at the confirmation prompt:

```
Proceed with uninstallation? [y/N]
```

Since the CLI is spawned by Electron in a non-interactive mode, it cannot receive user input via `stdin`, causing the process to hang indefinitely.

## Root Cause

The uninstall script (`bin/uninstall.sh`) was designed for interactive terminal use and always prompts for confirmation when app names are provided as arguments:

```bash
printf "Proceed with uninstallation? [y/N] "
local confirm
read -r confirm  # This blocks forever in non-interactive mode
```

## Solution

Added a `--yes` (or `-y`) flag to skip the interactive confirmation prompt.

### Changes Made

#### 1. Added `--yes` Flag to CLI (`bin/uninstall.sh`)

**Argument Parsing:**
```bash
local auto_confirm=0
for arg in "$@"; do
    case "$arg" in
        # ... other flags ...
        "--yes" | "-y")
            auto_confirm=1
            ;;
        # ... rest of cases ...
    esac
done
```

**Conditional Confirmation:**
```bash
if [[ $auto_confirm -eq 0 ]]; then
    printf "Proceed with uninstallation? [y/N] "
    local confirm
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Aborted."
        return 0
    fi
else
    echo "Auto-confirming uninstallation (--yes flag provided)"
fi
```

#### 2. Updated Electron IPC Handler (`apps/desktop/main.js`)

Added `--yes` flag to the execute command:

```javascript
ipcMain.handle("mole:uninstall:execute", async (event, appNames) => {
  const args = ["uninstall", "--yes", ...appNames];  // Added --yes
  return runMole(args, {
    onStdout: (text) => {
      event.sender.send("mole:uninstall:execute:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:uninstall:execute:stderr", text);
    }
  });
});
```

## Usage

### From Desktop App
The `--yes` flag is automatically added by the Electron app, so no user action is needed.

### From CLI (Manual)
Users can now skip the confirmation prompt:

```bash
# With confirmation prompt (interactive)
mole uninstall "Visual Studio Code"

# Skip confirmation (non-interactive)
mole uninstall --yes "Visual Studio Code"
mole uninstall -y "Visual Studio Code"
```

### Combined with Other Flags
```bash
# Dry-run with auto-confirm (shows what would be removed)
mole uninstall --dry-run --yes "App Name"

# Permanent deletion with auto-confirm
mole uninstall --permanent --yes "App Name"
```

## Behavior

### Interactive Mode (Default)
When `--yes` is NOT provided:
1. CLI scans for matching apps
2. Displays list of matched apps
3. Prompts: `Proceed with uninstallation? [y/N]`
4. Waits for user input
5. Proceeds only if user types `y` or `Y`

### Non-Interactive Mode (--yes)
When `--yes` IS provided:
1. CLI scans for matching apps
2. Displays list of matched apps
3. Prints: `Auto-confirming uninstallation (--yes flag provided)`
4. Proceeds immediately without waiting

## Safety Considerations

### Why This Is Safe

1. **Desktop App Context**: The desktop app already has a two-step confirmation:
   - Step 1: User selects apps in the selection stage
   - Step 2: User reviews files and clicks "Uninstall X Apps" button
   
   By the time the CLI is invoked, the user has already confirmed twice.

2. **Dry-Run Preview**: The desktop app runs `--dry-run` first to show exactly what will be removed, giving users a chance to cancel before execution.

3. **Trash by Default**: Files are moved to Trash (not permanently deleted) unless `--permanent` is explicitly specified, allowing recovery if needed.

4. **CLI Still Prompts by Default**: The `--yes` flag is opt-in. Terminal users still get the confirmation prompt unless they explicitly use `--yes`.

### When to Use `--yes`

✅ **Appropriate Use Cases:**
- Desktop/GUI applications (like our Electron app)
- Automated scripts with prior confirmation
- CI/CD pipelines
- Batch operations where apps are pre-validated

❌ **Inappropriate Use Cases:**
- Blindly adding to all commands
- Scripts without user awareness
- Untrusted automation

## Testing

### Manual Test Cases

1. **Desktop App Execution**
   - [ ] Select app in UI
   - [ ] Click "Uninstall"
   - [ ] Verify it proceeds without hanging
   - [ ] Verify app is removed successfully

2. **CLI Interactive Mode**
   ```bash
   mole uninstall "TestApp"
   # Should prompt for confirmation
   ```

3. **CLI Non-Interactive Mode**
   ```bash
   mole uninstall --yes "TestApp"
   # Should proceed without prompt
   ```

4. **CLI Dry-Run with Auto-Confirm**
   ```bash
   mole uninstall --dry-run --yes "TestApp"
   # Should show files without prompt
   ```

### Expected Output

**Before Fix (Hanging):**
```
◎ Matched 1 app(s):
1. TestApp  100MB  |  Last: 1w ago

Proceed with uninstallation? [y/N] ▌
[Process hangs here forever]
```

**After Fix (Working):**
```
◎ Matched 1 app(s):
1. TestApp  100MB  |  Last: 1w ago

Auto-confirming uninstallation (--yes flag provided)
[1/1] Uninstalling TestApp...
✓ /Applications/TestApp.app
✓ ~/Library/Application Support/TestApp
✓ [1/1] TestApp

Removed 1 app, freed 100 MB
```

## Related Files

- `bin/uninstall.sh` - Added `--yes` flag parsing and conditional confirmation
- `apps/desktop/main.js` - Updated IPC handler to pass `--yes` flag
- `apps/desktop/src/pages/UninstallPage.tsx` - No changes needed (uses IPC)

## Future Enhancements

### Potential Improvements

1. **Environment Variable**: Support `MOLE_AUTO_CONFIRM=1` for non-interactive environments
2. **Timeout**: Add timeout to confirmation prompt (e.g., 30 seconds)
3. **Force Flag**: Add `--force` as alias for `--yes` (common convention)
4. **Quiet Mode**: Add `--quiet` to suppress all output except errors

### Alternative Approaches Considered

1. **Auto-detect TTY**: Skip prompt if `stdin` is not a TTY
   - ❌ Rejected: Breaks piped input scenarios
   
2. **Always skip in Electron**: Detect if running from Electron
   - ❌ Rejected: Requires environment detection, less explicit
   
3. **Separate command**: Add `mole uninstall-batch` for non-interactive
   - ❌ Rejected: Adds complexity, `--yes` is more standard

## Summary

The `--yes` flag fix resolves the hanging issue when executing uninstall from the desktop app by allowing the CLI to skip the interactive confirmation prompt. This is safe because the desktop app already provides comprehensive confirmation through its UI workflow. The flag is opt-in and doesn't change the default interactive behavior for terminal users.
