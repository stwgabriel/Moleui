# Uninstall Feature Implementation

## Overview

The Uninstall feature has been successfully integrated into the Mole Desktop app, providing a complete workflow for scanning, selecting, and removing applications with all their associated files using the CLI backend with a modern UI frontend.

## Architecture

### Backend (CLI)
- **Script**: `bin/uninstall.sh`
- **Commands**:
  - `mole uninstall --list` - Returns JSON array of installed applications
  - `mole uninstall --dry-run <app1> <app2>` - Shows what files would be removed
  - `mole uninstall <app1> <app2>` - Executes the uninstallation

### Frontend (React)
- **Component**: `apps/desktop/src/pages/UninstallPage.tsx`
- **IPC Bridge**: `apps/desktop/preload.js` exposes `window.moleDesktop.uninstall` API
- **Main Process**: `apps/desktop/main.js` handles IPC communication with CLI

## Workflow Stages

### 1. Idle Stage
**Purpose**: Initial landing page with feature overview

**UI Elements**:
- Large hero icon (PackageX)
- Feature cards explaining:
  - Deep Scan - Find all app-related files
  - Complete Removal - Delete apps with preferences and caches
  - Safe Uninstall - Protected system files remain untouched
- "Scan Applications" button

**User Action**: Click "Scan Applications" to start

---

### 2. Loading Stage
**Purpose**: Scan system for installed applications

**Backend Command**: `mole uninstall --list`

**UI Elements**:
- Animated spinner
- Status message: "Analyzing Applications..."
- Progress indicator showing scan status

**Data Flow**:
1. Frontend calls `window.moleDesktop.uninstall.list()`
2. Main process executes `mole uninstall --list`
3. CLI scans `/Applications`, `~/Applications`, and other app directories
4. Returns JSON array of apps with metadata:
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

**Transition**: Automatically moves to Selection stage when scan completes

---

### 3. Selection Stage
**Purpose**: Allow user to select which apps to uninstall

**UI Elements**:
- Header showing "X of Y selected"
- "Select All" / "Deselect All" button
- "Continue" button (disabled when no apps selected)
- Scrollable list of app cards with:
  - Checkbox for selection
  - App name and path
  - Source badge (Homebrew or App)
  - Size display

**User Interactions**:
- Click card or checkbox to toggle selection
- Click "Select All" to select/deselect all apps
- Click "Continue" to proceed to confirmation

**State Management**:
- `apps`: Array of App objects from CLI
- `selectedApps`: Set of selected app indices

---

### 4. Confirmation Stage
**Purpose**: Show detailed file analysis and get final confirmation

**Backend Command**: `mole uninstall --dry-run <app1> <app2> ...`

**UI Elements**:
- Warning header with AlertTriangle icon
- Grid of selected apps (compact cards)
- "Analyzing files..." section with:
  - Loading spinner (while scanning)
  - Real-time CLI output display
  - File paths that will be removed
- Action buttons:
  - "Cancel" - Return to selection
  - "Uninstall X Apps" - Proceed with removal

**Data Flow**:
1. Frontend calls `window.moleDesktop.uninstall.dryRun(appNames)`
2. Main process executes `mole uninstall --dry-run <apps>`
3. CLI streams output showing:
   - Files to be removed
   - System files (marked with warning)
   - Total size to be freed
4. Output is displayed in real-time via IPC streaming

**CLI Output Format**:
```
Files to be removed:
✓ Visual Studio Code, 512 MB
  ✓ /Applications/Visual Studio Code.app
  ✓ ~/Library/Application Support/Code
  ✓ ~/Library/Caches/com.microsoft.VSCode
  ⚠ System: /Library/LaunchAgents/com.microsoft.VSCode.plist

Would remove 1 app, 512 MB
```

---

### 5. Executing Stage
**Purpose**: Perform the actual uninstallation

**Backend Command**: `mole uninstall <app1> <app2> ...`

**UI Elements**:
- Header: "Uninstalling Applications"
- Warning card: "Do not close this window"
- Real-time progress display showing:
  - Current operation
  - Files being removed
  - Progress indicator

**Data Flow**:
1. Frontend calls `window.moleDesktop.uninstall.execute(appNames)`
2. Main process executes `mole uninstall <apps>`
3. CLI streams output showing:
   - Progress: [1/3] Uninstalling AppName...
   - Files removed: ✓ /path/to/file
   - Completion summary
4. Output is displayed in real-time

**CLI Output Format**:
```
[1/3] Uninstalling Visual Studio Code...
✓ /Applications/Visual Studio Code.app
✓ ~/Library/Application Support/Code
✓ ~/Library/Caches/com.microsoft.VSCode
✓ [1/3] Visual Studio Code

Removed 1 app, freed 512 MB
```

---

### 6. Results Stage
**Purpose**: Show final results and allow user to return

**UI Elements**:
- Success/Error icon (CheckCircle or AlertCircle)
- Result message
- Output log in scrollable card
- "Done" button to return to idle stage

**Success Display**:
- Green CheckCircle icon
- "Uninstall Complete"
- "Applications have been successfully removed"
- Full CLI output

**Error Display**:
- Red AlertCircle icon
- "Uninstall Failed"
- "An error occurred during uninstallation"
- Error message and stderr output

---

### 7. Error Stage
**Purpose**: Handle and display errors that occur during any stage

**UI Elements**:
- Red AlertCircle icon
- Error title
- Error message
- "Try Again" button to return to idle stage

**Error Scenarios**:
- Scan failed
- Failed to parse application list
- Failed to analyze files
- Analysis failed
- Uninstall failed

---

## IPC Communication

### Preload API (`window.moleDesktop.uninstall`)

```typescript
interface UninstallAPI {
  // Commands
  list(): Promise<CommandResult>;
  dryRun(appNames: string[]): Promise<CommandResult>;
  execute(appNames: string[]): Promise<CommandResult>;
  
  // Stream listeners
  onListStdout(callback: (data: string) => void): void;
  onListStderr(callback: (data: string) => void): void;
  onDryRunStdout(callback: (data: string) => void): void;
  onDryRunStderr(callback: (data: string) => void): void;
  onExecuteStdout(callback: (data: string) => void): void;
  onExecuteStderr(callback: (data: string) => void): void;
  
  // Cleanup
  removeListeners(): void;
}

interface CommandResult {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}
```

### Main Process Handlers

```javascript
// List applications
ipcMain.handle("mole:uninstall:list", async (event) => {
  return runMole(["uninstall", "--list"], {
    onStdout: (text) => event.sender.send("mole:uninstall:list:stdout", text),
    onStderr: (text) => event.sender.send("mole:uninstall:list:stderr", text)
  });
});

// Dry-run analysis
ipcMain.handle("mole:uninstall:dry-run", async (event, appNames) => {
  return runMole(["uninstall", "--dry-run", ...appNames], {
    onStdout: (text) => event.sender.send("mole:uninstall:dry-run:stdout", text),
    onStderr: (text) => event.sender.send("mole:uninstall:dry-run:stderr", text)
  });
});

// Execute uninstall
ipcMain.handle("mole:uninstall:execute", async (event, appNames) => {
  return runMole(["uninstall", ...appNames], {
    onStdout: (text) => event.sender.send("mole:uninstall:execute:stdout", text),
    onStderr: (text) => event.sender.send("mole:uninstall:execute:stderr", text)
  });
});
```

## State Management

### React State

```typescript
const [stage, setStage] = useState<Stage>('idle');
const [apps, setApps] = useState<App[]>([]);
const [selectedApps, setSelectedApps] = useState<Set<number>>(new Set());
const [scanStatus, setScanStatus] = useState('');
const [dryRunOutput, setDryRunOutput] = useState<string[]>([]);
const [executeOutput, setExecuteOutput] = useState<string[]>([]);
const [error, setError] = useState<{ title: string; message: string } | null>(null);
const [result, setResult] = useState<CommandResult | null>(null);
```

### Stage Transitions

```
idle → loading → selection → confirmation → executing → results
  ↓       ↓          ↓            ↓            ↓          ↓
  ←───────┴──────────┴────────────┴────────────┴──────────┘
                    (reset)
```

## CLI Integration

### JSON Output Format

The CLI's `--list` command outputs JSON when stdout is not a TTY (piped):

```json
[
  {
    "name": "Visual Studio Code",
    "bundle_id": "com.microsoft.VSCode",
    "source": "App",
    "uninstall_name": "Visual Studio Code",
    "path": "/Applications/Visual Studio Code.app",
    "size": "512 MB"
  },
  {
    "name": "Docker",
    "bundle_id": "com.docker.docker",
    "source": "Homebrew",
    "uninstall_name": "docker",
    "path": "/Applications/Docker.app",
    "size": "1.2 GB"
  }
]
```

### Text Output Parsing

The CLI's dry-run and execute commands output human-readable text with ANSI codes:

```
✓ AppName, 512 MB
  ✓ /path/to/file
  ⚠ System: /system/file
```

The frontend strips ANSI codes using:
```typescript
const stripAnsi = (text: string) => {
  return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\[K/g, '');
};
```

## Design System Integration

### Colors
- **Primary**: Blue accent for actions
- **Warning**: Amber for confirmation stage
- **Danger**: Red for uninstall button
- **Success**: Green for completion
- **Error**: Red for errors

### Components Used
- `Button` - Primary, secondary, danger variants
- `Card` - Glassmorphic surfaces
- Lucide icons - Consistent iconography

### Animations
- Stage transitions use slide animations
- Loading spinners for async operations
- Hover effects on interactive elements

## Safety Features

### Protected Apps
The CLI protects system-critical apps from uninstallation:
- System apps in `/System/Applications`
- Essential utilities (Finder, System Preferences, etc.)

### Dry-Run Preview
Users see exactly what will be removed before confirming:
- All file paths listed
- System files marked with warning icon
- Total size calculation

### Confirmation Required
Two-step confirmation process:
1. Select apps in selection stage
2. Review files and confirm in confirmation stage

### Trash vs Permanent
By default, files are moved to Trash (recoverable):
- Can be changed with `--permanent` flag
- Provides safety net for accidental deletions

## Testing

### Manual Testing Checklist

- [ ] Scan applications successfully
- [ ] Display correct app count
- [ ] Select/deselect individual apps
- [ ] Select/deselect all apps
- [ ] Show dry-run output in real-time
- [ ] Display file paths correctly
- [ ] Execute uninstall successfully
- [ ] Show progress during execution
- [ ] Display completion message
- [ ] Handle errors gracefully
- [ ] Reset to idle state after completion

### Error Scenarios to Test

- [ ] No applications found
- [ ] CLI not available
- [ ] Permission denied
- [ ] App already removed
- [ ] Disk full
- [ ] Network drive apps

## Future Enhancements

### Potential Improvements

1. **Search/Filter**: Add search bar to filter apps by name
2. **Sort Options**: Sort by name, size, last used, source
3. **Batch Operations**: Save selection presets
4. **Undo Support**: Restore from Trash after uninstall
5. **Size Calculation**: Show total size of selected apps
6. **App Icons**: Display actual app icons instead of generic icon
7. **Last Used Date**: Show when app was last opened
8. **Dependencies**: Warn about dependent apps
9. **Homebrew Integration**: Show cask info for Homebrew apps
10. **Export List**: Export app list to CSV/JSON

### Performance Optimizations

1. **Virtual Scrolling**: For large app lists (1000+ apps)
2. **Incremental Loading**: Load apps in batches
3. **Caching**: Cache app metadata between scans
4. **Background Scanning**: Scan in background on app launch

## Troubleshooting

### Common Issues

**Issue**: Apps not showing up in scan
- **Cause**: Non-standard installation location
- **Solution**: CLI scans standard locations only

**Issue**: Dry-run output not displaying
- **Cause**: IPC streaming not working
- **Solution**: Check preload.js is loaded correctly

**Issue**: Uninstall fails with permission error
- **Cause**: App requires admin privileges
- **Solution**: CLI will prompt for sudo password

**Issue**: App still appears after uninstall
- **Cause**: App was running during uninstall
- **Solution**: Quit app before uninstalling

## Related Files

### Frontend
- `apps/desktop/src/pages/UninstallPage.tsx` - Main React component
- `apps/desktop/src/components/ui/Button.tsx` - Button component
- `apps/desktop/src/components/ui/Card.tsx` - Card component

### Backend
- `bin/uninstall.sh` - CLI uninstall command
- `lib/uninstall/batch.sh` - Batch uninstall logic
- `lib/uninstall/brew.sh` - Homebrew integration

### IPC Bridge
- `apps/desktop/preload.js` - Exposes API to renderer
- `apps/desktop/main.js` - IPC handlers in main process

### Legacy (Deprecated)
- `apps/desktop/uninstall-page.js` - Original vanilla JS implementation (no longer used)

## Summary

The Uninstall feature provides a complete, user-friendly workflow for removing applications from macOS. It leverages the existing CLI backend for robust file scanning and removal, while providing a modern React-based UI with real-time progress updates and comprehensive error handling. The implementation follows the project's design system and safety-first philosophy, ensuring users can confidently remove unwanted applications without risking system stability.
