# Clean Page Simplification

## Overview

The Clean page has been simplified to match the CLI behavior - removing the category selection stage and automatically scanning/cleaning all categories.

## Changes Made

### Removed Features
- ❌ Category selection UI with checkboxes
- ❌ "Select All" button
- ❌ Individual category toggles
- ❌ "Scan Selected (N)" button

### New Flow

**Before (5 stages):**
```
idle → selection → scanning → results → cleaning → complete
```

**After (4 stages):**
```
idle → scanning → results → cleaning → complete
```

### Stage Descriptions

#### 1. Idle (Start Screen)
- Shows overview of what will be cleaned
- Lists 4 main categories:
  - System & User Caches
  - Browser Data
  - App Leftovers
  - Developer Tools
- Single "Scan System" button

#### 2. Scanning
- Executes `mo clean --dry-run` via CLI
- Shows spinner with "Scanning System..." message
- Parses CLI output in real-time
- Progress bar at 60% (indeterminate)

#### 3. Results
- Shows all categories found by CLI scan
- Displays total cleanable space
- Shows number of categories found
- Lists each category with:
  - Icon and color
  - Category name
  - Item count and size
- "Clean Now" button to proceed
- "Back" button to return to idle

#### 4. Cleaning
- Executes `mo clean` (without --dry-run)
- Shows spinner with "Cleaning..." message
- Real-time progress updates from CLI output
- Progress bar shows percentage complete

#### 5. Complete
- Success icon and message
- Shows space recovered
- Shows total items removed
- "Done" button to return to idle

## Technical Changes

### State Structure
```javascript
// Before
state = {
  stage: 'selection',
  selectedCategories: new Set(),
  scanResults: {},
  totalSize: 0,
  cleanedSize: 0,
  currentOperation: '',
  hasStarted: false
}

// After
state = {
  stage: 'idle',
  scanResults: {},
  totalSize: 0,
  cleanedSize: 0,
  currentOperation: '',
  categories: []  // Array of category objects with name, icon, color, size, fileCount
}
```

### Category Mapping

The CLI outputs sections like:
- System
- User essentials
- App caches
- Browsers
- Cloud & Office
- Developer tools
- Applications
- Virtualization
- Application Support
- App leftovers
- Device backups & firmware
- Time Machine
- Large files

These are mapped to display categories with icons and colors:

```javascript
const sectionMap = {
  'System': { name: 'System Caches', icon: 'shield', color: '#3b82f6' },
  'User essentials': { name: 'User Caches', icon: 'user', color: '#8b5cf6' },
  'App caches': { name: 'App Caches', icon: 'package', color: '#06b6d4' },
  'Browsers': { name: 'Browser Data', icon: 'globe', color: '#10b981' },
  'Cloud & Office': { name: 'Cloud & Office', icon: 'cloud', color: '#f59e0b' },
  'Developer tools': { name: 'Developer Tools', icon: 'code', color: '#ec4899' },
  // ... etc
}
```

### CLI Output Parsing

The parser looks for:
1. **Section headers**: Lines with `→` or `▸` followed by section name
2. **Cleanup lines**: Lines with `✓` or `✔` containing size information
3. **Size extraction**: Regex pattern `(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)`

Example CLI output:
```
→ System
  ✓ System cache files, 1.5 GB
  ✓ Temporary files, 450 MB

→ Browsers
  ✓ Chrome cache, 950 MB
  ✓ Safari cache, 320 MB
```

### Event Handlers

Simplified event handlers:
- `#start-scan-btn` → `startScan()`
- `#clean-button` → `startCleaning()`
- `#back-button` → Return to idle stage
- `#done-button` → Reset state and return to idle

Removed handlers:
- Category click toggles
- Select all button
- Scan selected button

## Benefits

1. **Consistency**: Desktop app now matches CLI behavior
2. **Simplicity**: Fewer clicks to start cleaning
3. **Comprehensive**: Always scans all categories (no missed items)
4. **Less confusion**: No need to understand what each category means
5. **Faster workflow**: One click to scan, one click to clean

## User Experience

### Before
1. Click "Start Cleaning"
2. Select categories (or "Select All")
3. Click "Scan Selected (N)"
4. Review results
5. Click "Clean Now"
6. Wait for completion
7. Click "Done"

### After
1. Click "Scan System"
2. Review results
3. Click "Clean Now"
4. Wait for completion
5. Click "Done"

**Result**: 2 fewer steps, simpler mental model

## Fallback Behavior

If CLI output parsing fails (no categories detected), the app uses mock data for testing:
- System Caches: 1.5 GB, 450 items
- User Caches: 800 MB, 320 items
- App Caches: 2.1 GB, 680 items
- Browser Data: 950 MB, 210 items
- Developer Tools: 1.2 GB, 150 items

This ensures the UI always shows something during development/testing.

## Future Enhancements

Potential improvements:
1. Real-time category updates during scan (streaming parser)
2. Estimated time remaining during cleaning
3. Detailed log viewer for power users
4. Whitelist management UI
5. Schedule automatic cleanups
6. Before/after disk space visualization

## Files Modified

- `apps/desktop/clean-page.js` - Complete rewrite of stage flow and parsing logic

## Testing Checklist

- [ ] Idle screen displays correctly
- [ ] "Scan System" button triggers dry-run
- [ ] Scanning stage shows spinner
- [ ] Results page shows parsed categories
- [ ] Results page shows correct total size
- [ ] "Clean Now" button triggers actual clean
- [ ] Cleaning stage shows progress
- [ ] Complete stage shows final stats
- [ ] "Done" button resets to idle
- [ ] "Back" button works from results
- [ ] CLI output parsing handles all section types
- [ ] Fallback mock data works when parsing fails
- [ ] Error handling for failed scans/cleans
- [ ] Icons render correctly (Lucide)
- [ ] Colors match design system
