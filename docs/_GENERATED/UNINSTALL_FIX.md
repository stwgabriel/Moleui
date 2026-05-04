# Uninstall Feature Fix

## Problems Fixed

### 1. App List Not Displaying After Scan

**Problem**: The uninstall feature was only working until the "found apps" stage. After scanning, the app list would not display, and the uninstall process could not proceed.

**Root Cause**: Mismatch between CLI output format and UI parsing logic:
- CLI outputs JSON directly when stdout is piped (not a TTY)
- UI was trying to parse it as streaming text with patterns like "Found: App Name (10 MB)"
- JSON didn't match any parsing patterns, so no apps were displayed

**Solution**: 
- Parse JSON directly in `startScan()` method
- Remove streaming listeners for list command
- Simplify loading UI since JSON is returned immediately

### 2. Dry-Run Hanging Forever on "Analyzing..."

**Problem**: After selecting apps, the confirmation screen would show "Analyzing..." forever and never display the files to be removed.

**Root Cause**: The batch uninstall script waits for user confirmation even in dry-run mode:
- Script displays files to remove
- Then prompts: "Remove X apps, Y MB [Enter] confirm, [ESC] cancel: "
- Waits for keyboard input with `read -r -s -n1`
- In non-interactive context (Electron), no input ever comes
- Process hangs indefinitely

**Solution**: Skip confirmation prompt in dry-run mode and non-interactive contexts:
- Check for `MOLE_DRY_RUN=1` flag
- Check if stdin/stdout are TTYs (`-t 0 && -t 1`)
- Exit early in dry-run mode after displaying files
- Proceed without confirmation in non-interactive mode

## Changes Made

### 1. Desktop App (`apps/desktop/uninstall-page.js`)

#### Fixed JSON Parsing
```javascript
async startScan() {
  // Parse JSON directly from stdout
  const jsonOutput = result.stdout.trim();
  this.apps = JSON.parse(jsonOutput);
  
  // Validate response is an array
  if (!Array.isArray(this.apps)) {
    this.showError('Invalid response format', 'Expected array of applications');
    return;
  }
}
```

#### Removed List Streaming
- Removed `onListStdout` and `onListStderr` listeners
- List command outputs complete JSON, not streaming text

#### Updated Dry-Run Parsing
```javascript
streamDryRunOutput(text) {
  // Parse actual output format: "  ✓ /path/to/file"
  const fileMatch = trimmedLine.match(/^[✓✔☑][\s]+(.+)$/);
  const systemMatch = trimmedLine.match(/^[⚠!][\s]+System:[\s]+(.+)$/);
  
  // Look for "Would remove X apps" or "DRY RUN" messages
  if (trimmedLine.includes('Would remove') || trimmedLine.includes('DRY RUN')) {
    // Hide loading, show summary
  }
}
```

### 2. CLI Script (`lib/uninstall/batch.sh`)

#### Skip Confirmation in Dry-Run Mode
```bash
# Skip confirmation in dry-run mode or when not interactive
if [[ "${MOLE_DRY_RUN:-0}" == "1" ]]; then
    echo -e "${YELLOW}${ICON_DRY_RUN} DRY RUN${NC} - Would remove ${app_total} ${app_text}, ${size_display}"
    echo ""
    _restore_uninstall_traps
    return 0
fi

# Only prompt for confirmation in interactive mode
if [[ -t 0 && -t 1 ]]; then
    # Show prompt and wait for input
else
    # Non-interactive mode - proceed without confirmation
fi
```

## Testing

To test the fixes:

1. **Start desktop app**: `bun run desktop:dev`
2. **Navigate to Uninstall page**
3. **Click "Scan Applications"**
   - ✅ Loading spinner appears
   - ✅ Success message shows "✓ Found X applications"
   - ✅ Selection table displays with all found apps
4. **Select one or more apps**
5. **Click "Continue"**
   - ✅ Confirmation screen appears
   - ✅ Files to remove are listed in real-time
   - ✅ Summary shows "DRY RUN - Would remove X apps, Y MB"
   - ✅ No hanging on "Analyzing..."
6. **Click "Uninstall"**
   - ✅ Execute screen shows progress
   - ✅ Files are removed with success indicators
   - ✅ Results screen shows completion

## Technical Details

### Command Behaviors

**List** (`mole uninstall --list`):
- TTY: Human-readable table
- Piped: JSON array
- Returns immediately

**Dry-Run** (`mole uninstall --dry-run <apps>`):
- Shows files that would be removed
- In dry-run mode: Exits after listing files
- In interactive mode: Waits for confirmation
- In non-interactive mode: Proceeds without confirmation

**Execute** (`mole uninstall <apps>`):
- Removes selected apps and related files
- Streams progress output
- In interactive mode: Prompts for confirmation
- In non-interactive mode: Proceeds without confirmation

### Output Format Examples

**List (JSON)**:
```json
[
  {
    "name": "Visual Studio Code",
    "bundle_id": "com.microsoft.VSCode",
    "source": "App",
    "uninstall_name": "Visual Studio Code",
    "path": "/Applications/Visual Studio Code.app",
    "size": "512 MB"
  }
]
```

**Dry-Run (Text)**:
```
Files to be removed:

✓ Visual Studio Code, 512 MB
  ✓ /Applications/Visual Studio Code.app
  ✓ ~/Library/Application Support/Code
  ✓ ~/Library/Caches/com.microsoft.VSCode
  ✓ ~/Library/Preferences/com.microsoft.VSCode.plist

🔍 DRY RUN - Would remove 1 app, 512 MB
```

## Files Modified

1. `apps/desktop/uninstall-page.js` - Fixed JSON parsing and dry-run output parsing
2. `lib/uninstall/batch.sh` - Skip confirmation in dry-run and non-interactive modes
3. `apps/desktop/UNINSTALL_FIX.md` - This documentation

## Related Files (No Changes Needed)

- `apps/desktop/main.js` - IPC handlers work correctly
- `apps/desktop/preload.js` - IPC bridge works correctly  
- `bin/uninstall.sh` - CLI routing works correctly
- `apps/desktop/styles.css` - Styling is correct

## Future Improvements

1. **Progress indicator**: Show scanning progress during list command
2. **File grouping**: Group files by type (app, caches, preferences, logs)
3. **Size per file**: Show individual file sizes in dry-run
4. **Caching**: Cache app list to speed up subsequent scans
5. **Search/filter**: Add search box to filter apps in selection table
6. **Batch selection**: Keyboard shortcuts for selecting multiple apps
