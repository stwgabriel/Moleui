# Uninstall Feature Fix

## Problem

The uninstall feature was only working until the "found apps" stage. After scanning, the app list would not display, and the uninstall process could not proceed.

## Root Cause

The issue was a mismatch between the CLI output format and the UI parsing logic:

1. **CLI Behavior**: When `mole uninstall --list` is run with stdout redirected (not a TTY), it outputs JSON directly:
   ```json
   [
     {"name": "App Name", "bundle_id": "com.example.app", "source": "App", ...},
     ...
   ]
   ```

2. **UI Expectation**: The `streamOutput()` function was trying to parse the output as if it were interactive scanning messages like:
   ```
   Scanning /Applications...
   Found: App Name (10 MB)
   ✓ Found 5 applications
   ```

3. **Result**: The JSON output didn't match any of the parsing patterns in `streamOutput()`, so no apps were displayed and the UI couldn't proceed to the selection stage.

## Solution

### Changes Made

1. **Removed streaming for list command** (`uninstall-page.js`):
   - Removed `onListStdout` and `onListStderr` listeners from `setupStreamListeners()`
   - The `--list` command outputs JSON directly, not streaming text

2. **Updated `startScan()` method** (`uninstall-page.js`):
   - Parse the JSON output directly from `result.stdout`
   - Added validation to ensure the response is an array
   - Display success message in the status container
   - Added better error handling with output preview

3. **Simplified loading UI** (`uninstall-page.js`):
   - Removed `#found-apps-list` container from loading state
   - The list command is fast and returns JSON immediately, so streaming individual apps isn't needed

4. **Removed unused code** (`uninstall-page.js`):
   - Deleted `streamOutput()` method since it's no longer used

### Why This Works

- **Direct JSON parsing**: The `--list` command outputs complete JSON, so we parse it once when the command completes
- **Proper flow**: Loading → Parse JSON → Display selection table
- **Streaming preserved**: Dry-run and execute commands still use streaming for real-time feedback
- **Better error handling**: Shows partial output if JSON parsing fails for debugging

## Testing

To test the fix:

1. Start the desktop app: `bun run desktop:dev`
2. Navigate to the Uninstall page
3. Click "Scan Applications"
4. Verify:
   - Loading spinner appears
   - Success message shows "✓ Found X applications"
   - Selection table displays with all found apps
   - Can select apps and proceed to confirmation
   - Dry-run shows files to remove
   - Execute removes selected apps

## Technical Details

### Command Output Formats

**List command** (`mole uninstall --list`):
- When stdout is a TTY: Human-readable table
- When stdout is piped: JSON array
- Used by: Initial app scanning

**Dry-run command** (`mole uninstall --dry-run <apps>`):
- Streaming text output: "Would remove: /path/to/file"
- Used by: Confirmation stage to show what will be deleted

**Execute command** (`mole uninstall <apps>`):
- Streaming text output: "Removing: /path/to/file", "✓ Removed: /path/to/file"
- Used by: Actual uninstallation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Uninstall Flow                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Scan (--list)                                          │
│     ├─ CLI outputs JSON                                    │
│     ├─ Parse JSON in startScan()                           │
│     └─ Display selection table                             │
│                                                             │
│  2. Confirm (--dry-run)                                    │
│     ├─ CLI streams file paths                              │
│     ├─ streamDryRunOutput() parses and displays            │
│     └─ Show confirmation with file list                    │
│                                                             │
│  3. Execute (no flags)                                     │
│     ├─ CLI streams removal progress                        │
│     ├─ streamExecuteOutput() parses and displays           │
│     └─ Show results                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Files Modified

- `apps/desktop/uninstall-page.js` - Fixed JSON parsing and removed streaming for list command
- `apps/desktop/UNINSTALL_FIX.md` - This documentation

## Related Files (No Changes Needed)

- `apps/desktop/main.js` - IPC handlers work correctly
- `apps/desktop/preload.js` - IPC bridge works correctly
- `bin/uninstall.sh` - CLI outputs correct JSON format
- `apps/desktop/styles.css` - Styling is correct

## Future Improvements

1. **Progress indicator**: Show scanning progress during list command
2. **Incremental loading**: Display apps as they're found (would require CLI changes)
3. **Caching**: Cache app list to speed up subsequent scans
4. **Search/filter**: Add search box to filter apps in selection table
