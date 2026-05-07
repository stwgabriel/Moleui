# CleanPage Real-Time Console Logs

## Overview

The CleanPage now displays real-time CLI output in a terminal-style console during both scanning and cleaning operations. This provides transparency and allows users to see exactly what's being analyzed and cleaned.

## Features

### 1. **Terminal-Style Console Display**
- Glassmorphic card with macOS-style window controls (red, yellow, green dots)
- Monospace font for authentic terminal appearance
- Command indicator showing the running command (`mole clean --dry-run` or `mole clean`)

### 2. **Real-Time Log Streaming**
- All stdout and stderr from the clean script displayed in real-time
- Logs appear as they're generated, not after completion
- Auto-scrolling to keep the latest logs visible

### 3. **Color-Coded Log Types**
- **Info logs** (default): Light grey text for normal output
- **Success logs**: Green text for completion messages
- **Error logs**: Red text for errors and warnings

### 4. **Timestamps**
- Each log entry includes a timestamp showing when it was received
- Format: `HH:MM:SS AM/PM` (localized time)
- Timestamps are dimmed for reduced visual noise

### 5. **Auto-Scroll Behavior**
- Console automatically scrolls to show the latest logs
- Smooth scrolling animation for better UX
- Users can scroll up to review earlier logs

## Implementation Details

### State Management

```typescript
interface LogEntry {
  text: string;
  timestamp: number;
  type: 'info' | 'success' | 'error';
}

const [logs, setLogs] = useState<LogEntry[]>([]);
const logEndRef = useRef<HTMLDivElement>(null);
```

### Log Addition Function

```typescript
const addLog = (text: string, type: LogEntry['type'] = 'info') => {
  const cleanText = stripAnsi(text).trim();
  if (cleanText) {
    setLogs((prev) => [...prev, { text: cleanText, timestamp: Date.now(), type }]);
  }
};
```

### Auto-Scroll Effect

```typescript
useEffect(() => {
  if (logEndRef.current) {
    logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }
}, [logs]);
```

### Event Listeners

**During Scanning:**
```typescript
window.moleDesktop.clean.onStdout((text) => {
  outputBuffer.push(text);
  const cleanText = stripAnsi(text);
  setCurrentOperation(cleanText.trim());
  addLog(text, 'info');
});

window.moleDesktop.clean.onStderr((text) => {
  console.error('Clean stderr:', text);
  addLog(text, 'error');
});
```

**During Cleaning:**
```typescript
window.moleDesktop.clean.onStdout((text) => {
  const cleanText = stripAnsi(text);
  setCurrentOperation(cleanText.trim());
  addLog(text, 'info');

  // Parse size information for progress tracking
  const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)/i);
  if (sizeMatch) {
    const value = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2];
    const bytes = parseSizeToBytes(value, unit);
    setCleanedSize((prev) => Math.min(prev + bytes, totalSize));
  }
});
```

## UI Components

### Console Card Structure

```tsx
<Card variant="glass" className="flex-1 p-4 overflow-hidden flex flex-col">
  {/* Window Controls */}
  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
    <div className="flex gap-1.5">
      <div className="w-3 h-3 rounded-full bg-red-500/80" />
      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
      <div className="w-3 h-3 rounded-full bg-green-500/80" />
    </div>
    <span className="text-xs font-mono text-text-tertiary ml-2">
      mole clean --dry-run
    </span>
  </div>

  {/* Log Output */}
  <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-xs space-y-1">
    {logs.map((log, index) => (
      <div
        key={index}
        className={`${
          log.type === 'error'
            ? 'text-red-400'
            : log.type === 'success'
              ? 'text-green-400'
              : 'text-text-secondary'
        }`}
      >
        <span className="text-text-tertiary opacity-50 mr-2">
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        {log.text}
      </div>
    ))}
    <div ref={logEndRef} />
  </div>
</Card>
```

## Scanning Stage

During the scanning stage:
- Console shows `mole clean --dry-run` command
- Displays all output from the dry-run scan
- Shows which categories are being analyzed
- Displays found files and their sizes
- Completion message with total cleanable size

**Layout:**
```
┌─────────────────────────────────────┐
│  🔍 Scanning System...              │
│  Analyzing selected categories      │
├─────────────────────────────────────┤
│ ● ● ●  mole clean --dry-run        │
│ ─────────────────────────────────── │
│ 10:30:45 Starting system scan...    │
│ 10:30:46 → System                   │
│ 10:30:46 ✓ Cleared cache (1.2 GB)  │
│ 10:30:47 → User essentials          │
│ 10:30:47 ✓ Cleared logs (450 MB)   │
│ ...                                 │
└─────────────────────────────────────┘
```

## Cleaning Stage

During the cleaning stage:
- Console shows `mole clean` command
- Displays real-time cleanup operations
- Shows which files are being removed
- Progress bar at the top shows overall completion
- Percentage and size indicators

**Layout:**
```
┌─────────────────────────────────────┐
│  🗑️  Cleaning...                    │
│  ████████░░░░░░░░░░░░░░░░░░ 45%    │
│  2.1 GB of 4.5 GB (45%)             │
├─────────────────────────────────────┤
│ ● ● ●  mole clean                   │
│ ─────────────────────────────────── │
│ 10:32:15 Starting cleanup...        │
│ 10:32:16 Removing system caches...  │
│ 10:32:17 ✓ Removed 1.2 GB          │
│ 10:32:18 Cleaning user data...      │
│ ...                                 │
└─────────────────────────────────────┘
```

## Styling

### Console Colors

```css
/* Info logs (default) */
.text-text-secondary

/* Success logs */
.text-green-400

/* Error logs */
.text-red-400

/* Timestamps */
.text-text-tertiary opacity-50
```

### Window Controls

```css
/* macOS-style traffic lights */
.bg-red-500/80    /* Close button */
.bg-yellow-500/80 /* Minimize button */
.bg-green-500/80  /* Maximize button */
```

### Font

```css
font-mono text-xs  /* Monospace font, small size */
```

## Benefits

1. **Transparency**: Users see exactly what's happening
2. **Trust**: Real-time feedback builds confidence
3. **Debugging**: Easier to identify issues if something goes wrong
4. **Education**: Users learn what the tool is doing
5. **Professional**: Terminal-style output looks polished and technical

## Future Enhancements

### Potential Improvements

1. **Log Filtering**: Add buttons to filter by log type (info/success/error)
2. **Copy Logs**: Add button to copy all logs to clipboard
3. **Export Logs**: Save logs to a file for debugging
4. **Search Logs**: Add search functionality to find specific entries
5. **Log Levels**: Add verbose/debug mode for more detailed output
6. **Syntax Highlighting**: Highlight file paths, sizes, and operations
7. **Collapsible Sections**: Group logs by category with expand/collapse
8. **Performance Metrics**: Show scan/clean speed and time estimates

### Accessibility

- Ensure sufficient contrast for all log types
- Add ARIA labels for screen readers
- Support keyboard navigation for scrolling
- Provide text alternatives for color-coded information

## Testing

### Manual Testing Steps

1. **Start Scan**
   - Click "Start Cleaning" on idle screen
   - Verify console appears with window controls
   - Verify logs stream in real-time
   - Verify auto-scrolling works
   - Verify timestamps are correct

2. **Review Logs**
   - Scroll up to review earlier logs
   - Verify scrolling doesn't break auto-scroll for new logs
   - Check color coding (info/success/error)
   - Verify text is readable

3. **Start Cleaning**
   - Click "Clean Now" on results screen
   - Verify console shows cleaning logs
   - Verify progress bar updates
   - Verify size calculations are correct

4. **Error Handling**
   - Test with permission errors
   - Verify error logs appear in red
   - Verify error messages are clear

5. **Reset**
   - Click "Done" after completion
   - Verify logs are cleared
   - Verify state resets properly

## Related Files

- `apps/desktop/src/pages/CleanPage.tsx` - Main implementation
- `apps/desktop/src/utils/format.ts` - Text formatting utilities
- `apps/desktop/src/components/ui/Card.tsx` - Card component
- `bin/clean.sh` - Clean script that generates output

## Notes

- ANSI color codes are stripped from CLI output using `stripAnsi()`
- Logs are stored in component state and cleared on reset
- Auto-scroll uses `scrollIntoView` with smooth behavior
- Empty log entries (whitespace only) are filtered out
- Timestamps use browser's locale for formatting
