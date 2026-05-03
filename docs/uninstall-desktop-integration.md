# Uninstall Desktop Integration

## Overview

The uninstall page has been fully integrated with the CLI `uninstall --dry-run` command, bringing all CLI stages to the desktop app with a modern, glassmorphic UI.

## Implementation Summary

### 1. IPC Communication Layer

**File: `apps/desktop/main.js`**
- Added three new IPC handlers:
  - `mole:uninstall:list` - Lists all installed applications (JSON format)
  - `mole:uninstall:dry-run` - Performs dry-run analysis for selected apps
  - `mole:uninstall:execute` - Executes the actual uninstallation

**File: `apps/desktop/preload.js`**
- Exposed secure API to renderer process:
  ```javascript
  window.moleDesktop.uninstall.list()
  window.moleDesktop.uninstall.dryRun(appNames)
  window.moleDesktop.uninstall.execute(appNames)
  ```

### 2. Uninstall Page Module

**File: `apps/desktop/uninstall-page.js`**

A complete state machine managing the uninstall workflow:

#### Stages

1. **Idle** - Initial state with "Scan Applications" button
2. **Loading** - Shows animated spinner with scanning steps:
   - Scanning directories
   - Collecting metadata
   - Building index
3. **Selection** - Interactive table with:
   - Checkbox selection for each app
   - App name, path, source (App/Homebrew), and size
   - Select All / Deselect All functionality
   - Selected count display
   - Continue button (disabled when no selection)
4. **Confirmation** - Review stage showing:
   - Warning header with alert icon
   - List of selected apps with icons
   - Dry-run results (file list to be removed)
   - Cancel and Uninstall buttons
5. **Executing** - Progress indicator with:
   - Spinner animation
   - "Do not close this window" warning
6. **Results** - Final outcome display:
   - Success/error icon and message
   - Full command output
   - Done button to return to idle
7. **Error** - Error handling with retry option

#### Key Features

- **XSS Protection**: All user-generated content is escaped via `escapeHtml()`
- **State Management**: Clean state transitions with proper cleanup
- **Event Handling**: Centralized event listener attachment
- **Responsive UI**: Updates selection counts and button states dynamically
- **Output Formatting**: Syntax highlighting for dry-run results (success, warning, system files)

### 3. UI Integration

**File: `apps/desktop/renderer.js`**
- Modified `buildPageHTML()` to detect uninstall page and render container
- Added initialization hook to mount `UninstallPage` instance
- Integrated with existing page transition animations

**File: `apps/desktop/index.html`**
- Added `<script src="./uninstall-page.js">` before renderer.js

### 4. Design System Implementation

**File: `apps/desktop/styles.css`**

Comprehensive styling following the Liquid Glass design system:

#### Visual Elements

- **Glassmorphism**: Frosted glass surfaces with backdrop blur
- **Animations**: Smooth transitions (fadeIn, pulse, spin)
- **Color Coding**:
  - Primary actions: Blue (`--accent-primary`)
  - Warnings: Amber (`--accent-warning`)
  - Danger: Red (`--accent-danger`)
  - Success: Green (`--accent-success`)
- **Micro-interactions**: Hover effects, scale transforms, shadow elevation

#### Components

- **Loading Spinner**: Rotating border animation
- **App Table**: Sticky header, hover states, checkbox styling
- **Source Badges**: Color-coded (App = blue, Homebrew = amber)
- **Action Buttons**: Primary, secondary, and danger variants
- **Result Lines**: Syntax-highlighted output (success, warning, system)
- **Scrollbars**: Custom styled for consistency

#### Responsive Design

- Dark mode support via `prefers-color-scheme`
- Reduced motion support via `prefers-reduced-motion`
- Custom scrollbar styling for all scrollable containers

## CLI Integration

### Commands Used

1. **List Applications**
   ```bash
   mole uninstall --list
   ```
   Returns JSON array with:
   - `name`: Display name
   - `bundle_id`: Bundle identifier
   - `source`: "App" or "Homebrew"
   - `uninstall_name`: Name to pass to uninstall command
   - `path`: Full path to .app
   - `size`: Human-readable size

2. **Dry Run**
   ```bash
   mole uninstall --dry-run <app1> <app2> ...
   ```
   Returns detailed file list showing:
   - App bundle path
   - Related files (preferences, caches, etc.)
   - System files (launch agents, daemons)
   - Estimated total size

3. **Execute Uninstall**
   ```bash
   mole uninstall <app1> <app2> ...
   ```
   Performs actual removal and returns:
   - Success/failure status
   - Files removed count
   - Total size freed
   - Any warnings or errors

## User Flow

```
┌─────────────┐
│    Idle     │ ← User clicks "Scan Applications"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Loading   │ ← Calls mole:uninstall:list
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Selection  │ ← User selects apps, clicks "Continue"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Confirmation │ ← Calls mole:uninstall:dry-run, shows files
└──────┬──────┘
       │
       ├─ Cancel → Back to Selection
       │
       ▼ Confirm
┌─────────────┐
│  Executing  │ ← Calls mole:uninstall:execute
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Results   │ ← Shows success/error, user clicks "Done"
└──────┬──────┘
       │
       ▼
    Back to Idle
```

## Security Considerations

1. **XSS Prevention**: All dynamic content is escaped before rendering
2. **Context Isolation**: Electron's contextBridge ensures secure IPC
3. **Input Validation**: App names are validated before passing to CLI
4. **Safe Defaults**: Dry-run always executed before actual uninstall
5. **User Confirmation**: Multiple confirmation steps prevent accidental deletion

## Testing Checklist

- [ ] Scan applications successfully loads app list
- [ ] Selection checkboxes work correctly
- [ ] Select All / Deselect All toggles properly
- [ ] Continue button disabled when no selection
- [ ] Dry-run displays file list correctly
- [ ] Cancel returns to selection stage
- [ ] Uninstall executes and shows results
- [ ] Error handling displays appropriate messages
- [ ] Dark mode styling works correctly
- [ ] Reduced motion preference respected
- [ ] Scrolling works in all scrollable containers
- [ ] Homebrew apps detected and labeled correctly

## Future Enhancements

1. **Search/Filter**: Add search bar to filter app list
2. **Sorting**: Allow sorting by name, size, source, last used
3. **Bulk Actions**: Quick select by source (all Homebrew apps)
4. **Size Visualization**: Show size bars or charts
5. **Undo Support**: Integration with Trash for recoverable uninstalls
6. **Progress Streaming**: Real-time progress updates during execution
7. **App Icons**: Display actual app icons instead of generic package icon
8. **Keyboard Navigation**: Full keyboard support for accessibility

## Files Modified

- `apps/desktop/main.js` - Added IPC handlers
- `apps/desktop/preload.js` - Exposed uninstall API
- `apps/desktop/renderer.js` - Integrated uninstall page
- `apps/desktop/index.html` - Added script tag
- `apps/desktop/styles.css` - Added comprehensive styling

## Files Created

- `apps/desktop/uninstall-page.js` - Complete uninstall workflow module
- `docs/uninstall-desktop-integration.md` - This documentation

## Dependencies

- **Electron IPC**: For main ↔ renderer communication
- **Lucide Icons**: For all UI icons
- **CLI Commands**: `mole uninstall --list`, `--dry-run`, and execute

## Performance Notes

- App scanning is performed by CLI (optimized Go/Bash code)
- Desktop app only handles UI rendering and state management
- JSON parsing is fast for typical app counts (< 500 apps)
- Dry-run results are streamed and formatted on-demand
- No blocking operations in renderer process

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus indicators on all focusable elements
- Color contrast meets WCAG AA standards
- Reduced motion support for animations
- Screen reader friendly output formatting
