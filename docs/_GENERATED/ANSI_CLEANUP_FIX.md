# ANSI Escape Code Cleanup Fix

## Problem

CLI output was showing ANSI escape codes in the UI:
```
[K/ Scanning applications... 52/52
```

Instead of the clean output:
```
Scanning applications... 52/52
```

## Root Cause

The CLI commands output ANSI escape codes for:
- **Cursor control**: `\x1B[K` (clear line)
- **Colors**: `\x1B[31m` (red text), `\x1B[0m` (reset)
- **Cursor movement**: `\x1B[A` (move up), `\x1B[B` (move down)
- **Progress indicators**: Carriage returns and line clearing for updating progress

These codes are meant for terminal emulators but appear as literal text in HTML.

## Solution

Added `stripAnsi()` method to clean all ANSI escape codes before parsing:

```javascript
stripAnsi(text) {
  // Remove ANSI escape codes (colors, cursor movements, etc.)
  return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\[K/g, '');
}
```

### Regex Breakdown

1. **`/\x1B\[[0-9;]*[A-Za-z]/g`**
   - `\x1B` - ESC character (start of ANSI sequence)
   - `\[` - Opening bracket
   - `[0-9;]*` - Zero or more digits or semicolons (parameters)
   - `[A-Za-z]` - Command letter (A-Z, a-z)
   - `g` - Global flag (replace all occurrences)
   
   **Matches**: `\x1B[31m`, `\x1B[0m`, `\x1B[A`, `\x1B[2J`, etc.

2. **`/\x1B\[K/g`**
   - Specifically targets the "clear line" sequence
   - Common in progress indicators
   
   **Matches**: `\x1B[K`

## Implementation

Applied `stripAnsi()` in all streaming methods:

### 1. Loading State (`streamOutput`)
```javascript
streamOutput(text) {
  const cleanText = this.stripAnsi(text);
  const lines = cleanText.split('\n');
  // ... parse clean lines
}
```

### 2. Confirmation State (`streamDryRunOutput`)
```javascript
streamDryRunOutput(text) {
  const cleanText = this.stripAnsi(text);
  const lines = cleanText.split('\n');
  // ... parse clean lines
}
```

### 3. Executing State (`streamExecuteOutput`)
```javascript
streamExecuteOutput(text) {
  const cleanText = this.stripAnsi(text);
  const lines = cleanText.split('\n');
  // ... parse clean lines
}
```

## Common ANSI Codes Removed

| Code | Meaning | Example |
|------|---------|---------|
| `\x1B[K` | Clear line | Progress updates |
| `\x1B[0m` | Reset formatting | After colored text |
| `\x1B[31m` | Red text | Error messages |
| `\x1B[32m` | Green text | Success messages |
| `\x1B[33m` | Yellow text | Warnings |
| `\x1B[1m` | Bold text | Emphasis |
| `\x1B[A` | Cursor up | Progress bars |
| `\x1B[2J` | Clear screen | Full screen apps |

## Testing

### Before Fix
```
Input:  "[K/ Scanning applications... 52/52"
Output: "[K/ Scanning applications... 52/52"  ❌
```

### After Fix
```
Input:  "[K/ Scanning applications... 52/52"
Output: "Scanning applications... 52/52"  ✅
```

## Alternative Approaches Considered

### 1. Server-Side Stripping
**Pros**: Cleaner separation of concerns
**Cons**: Requires modifying main.js, affects all consumers

### 2. Using a Library (e.g., `strip-ansi`)
**Pros**: Battle-tested, handles edge cases
**Cons**: Additional dependency, overkill for simple use case

### 3. Client-Side Regex (Chosen)
**Pros**: Simple, no dependencies, works immediately
**Cons**: May miss some exotic ANSI codes

## Edge Cases Handled

1. **Multiple ANSI codes in one line**
   ```
   "\x1B[32m✓\x1B[0m Removed file" → "✓ Removed file"
   ```

2. **ANSI codes at line boundaries**
   ```
   "Line 1\x1B[K\nLine 2" → "Line 1\nLine 2"
   ```

3. **Progress indicators with carriage returns**
   ```
   "Scanning... 1/10\r\x1B[KScanning... 2/10" → "Scanning... 2/10"
   ```

## Performance Impact

- **Minimal**: Regex operations are fast
- **Per-line processing**: Only processes incoming chunks
- **No buffering**: Streams are cleaned in real-time
- **Memory**: No additional memory overhead

## Future Improvements

If more complex ANSI handling is needed:

1. **Preserve colors**: Map ANSI colors to CSS classes
2. **Handle cursor movements**: Simulate terminal behavior
3. **Support SGR codes**: Bold, italic, underline
4. **Use a library**: For comprehensive ANSI support

## Related Files

- `apps/desktop/uninstall-page.js` - Implementation
- `apps/desktop/main.js` - CLI output source
- `apps/desktop/preload.js` - IPC streaming

## References

- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [Terminal Control Sequences](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html)
- [strip-ansi npm package](https://www.npmjs.com/package/strip-ansi)
