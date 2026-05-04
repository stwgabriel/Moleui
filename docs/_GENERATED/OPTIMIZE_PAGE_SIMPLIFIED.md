# Optimize Page Simplification

## Summary

Removed the task selection UI from the optimize page to match the CLI behavior. The CLI `bin/optimize.sh` runs all optimizations automatically without any selection mechanism, so the desktop GUI now reflects this.

## Changes Made

### 1. **optimize-page.js** - Removed Task Selection Logic

**Before:**
- Complex state with `selectedTasks`, `completedTasks`, `currentTask`, `progress`
- Task selection UI with checkboxes
- "Select Recommended" button
- Task list with 8 predefined tasks
- Progress bar based on completed tasks

**After:**
- Simple state: `stage`, `output`, `exitCode`
- Three stages: `idle`, `optimizing`, `complete`
- Real-time CLI output display
- No task selection - runs all optimizations automatically

### 2. **State Management**

```javascript
// Old state
{
  stage: 'selection',
  selectedTasks: new Set(),
  completedTasks: [],
  currentTask: null,
  progress: 0,
  hasStarted: false
}

// New state
{
  stage: 'idle',
  output: '',
  exitCode: null
}
```

### 3. **UI Flow**

**Idle State:**
- Shows overview of what optimize does
- Lists 4 key features:
  - System Maintenance
  - Memory Management
  - Disk Health
  - Security Checks
- Single "Start Optimization" button

**Optimizing State:**
- Shows spinner with "Optimizing System..." message
- Displays real-time CLI output in scrollable terminal-style box
- Auto-scrolls to bottom as new output arrives

**Complete State:**
- Shows success/error icon based on exit code
- Displays complete CLI output
- "Done" button to return to idle state

### 4. **styles.css** - Added Output Display Styles

```css
/* Output Display */
.optimize-output {
  width: 100%;
  max-width: 800px;
  max-height: 400px;
  overflow-y: auto;
  background: var(--surface-elevated);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-top: var(--space-4);
}

.optimize-output pre {
  margin: 0;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-wrap: break-word;
}
```

Added error state styling:
```css
.optimize-complete-icon.error {
  background: rgba(239, 68, 68, 0.12);
  color: var(--accent-danger);
}
```

## Benefits

1. **Consistency** - Desktop GUI now matches CLI behavior exactly
2. **Simplicity** - Removed ~200 lines of unnecessary selection logic
3. **Transparency** - Users see exactly what the CLI is doing
4. **Accuracy** - No false promises about task selection that doesn't exist
5. **Maintainability** - Single source of truth (CLI) for what gets optimized

## How It Works

1. User clicks "Start Optimization"
2. Desktop app calls `window.moleDesktop.optimize.execute({ dryRun: false })`
3. CLI runs `bin/optimize.sh` which:
   - Collects system health data
   - Determines what needs optimization
   - Runs all applicable optimizations
   - Performs security checks
   - Offers to apply updates and fixes
4. Desktop app captures stdout/stderr in real-time
5. Shows complete output when finished

## Technical Details

### Real-time Output Capture

```javascript
window.moleDesktop.optimize.onStdout((text) => {
  state.output += text;
  const outputEl = container.querySelector('.optimize-output pre');
  if (outputEl) {
    outputEl.textContent = state.output;
    outputEl.scrollTop = outputEl.scrollHeight; // Auto-scroll
  }
});
```

### Exit Code Handling

```javascript
const result = await window.moleDesktop.optimize.execute({ dryRun: false });
state.exitCode = result.exitCode;
state.stage = 'complete';
```

- Exit code 0 = success (green check icon)
- Exit code non-zero = error (red alert icon)

## Future Enhancements

If task selection is desired in the future, it would need to be implemented in the CLI first:

```bash
# Example future CLI enhancement
mole optimize --tasks=spotlight,dns,permissions
```

Then the desktop GUI could be updated to pass selected tasks to the CLI.

## Files Modified

- `apps/desktop/optimize-page.js` - Removed task selection, added output display
- `apps/desktop/styles.css` - Added `.optimize-output` styles and error state

## Testing

To test the changes:

1. Start the desktop app: `bun run desktop:dev`
2. Navigate to Optimize page
3. Click "Start Optimization"
4. Verify real-time output appears
5. Verify completion state shows success/error correctly
6. Click "Done" to return to idle state
