# Status Page Implementation - Recovered Design

## Overview

The Status Page has been restored to its original StartScreen design with proper error handling for the `window.moleDesktop` API. The page now safely checks for API availability before attempting to call `runStatus()`.

## Current Implementation

### Design Pattern
The page uses the **StartScreen** component pattern, consistent with other pages in the app:
- Clean, centered layout with icon and description
- Feature list showing what the page will do
- Single "Start Monitoring" button to trigger action

### Error Handling
The implementation now includes comprehensive error handling:

```typescript
const handleStart = async () => {
  try {
    // Check if moleDesktop API is available
    if (!window.moleDesktop || !window.moleDesktop.runStatus) {
      console.error('Mole Desktop API not available');
      alert('Error: Desktop API not available. Please restart the application.');
      return;
    }

    const result = await window.moleDesktop.runStatus();
    
    if (result.ok) {
      console.log('Status result:', JSON.parse(result.stdout));
      alert('Status monitoring is not yet fully implemented in the UI. Check the console for output.');
    } else {
      console.error('Status command failed:', result.stderr);
      alert(`Error: ${result.stderr}`);
    }
  } catch (error) {
    console.error('Failed to run status:', error);
    alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
```

## Features

### Current Functionality
1. **API Availability Check**: Verifies `window.moleDesktop.runStatus` exists before calling
2. **Error Messages**: User-friendly alerts for different error scenarios
3. **Console Logging**: Outputs full status JSON to console for debugging
4. **Graceful Degradation**: Handles missing API gracefully

### UI Elements
- **Icon**: Activity icon in gradient background (blue to purple)
- **Title**: "Status"
- **Description**: "Monitor your Mac's health with real-time system metrics and performance indicators."
- **Feature Items**:
  - CPU & Memory - Real-time processor and RAM usage
  - Disk & Network - Monitor storage and network activity
  - Battery Health - Check battery status and cycle count
- **Button**: "Start Monitoring"

## Error Scenarios Handled

### 1. API Not Available
**Cause**: `window.moleDesktop` is undefined or `runStatus` method doesn't exist
**Handling**: 
- Logs error to console
- Shows alert: "Error: Desktop API not available. Please restart the application."
- Prevents further execution

### 2. Command Failure
**Cause**: `mole status --json` command fails (exit code ≠ 0)
**Handling**:
- Logs stderr to console
- Shows alert with stderr message
- User can try again

### 3. Unexpected Errors
**Cause**: Network issues, JSON parse errors, etc.
**Handling**:
- Catches all errors
- Logs to console
- Shows alert with error message

## Integration Points

### Existing APIs Used
- `window.moleDesktop.runStatus()` - IPC handler for status command
- `StartScreen` component - Shared UI pattern
- `PageConfig` type - Configuration interface

### Files Modified
- `apps/desktop/src/pages/StatusPage.tsx` - Restored to StartScreen design with error handling

### No Changes Required
- `apps/desktop/main.js` - Already has `mole:status` handler
- `apps/desktop/preload.js` - Already exposes `runStatus()`
- `apps/desktop/src/types/index.ts` - Already has all necessary types

## Testing

### Manual Testing Steps
1. Navigate to Status page in sidebar
2. Click "Start Monitoring" button
3. Check console for JSON output
4. Verify alert shows appropriate message

### Expected Behavior
- **Success**: Alert says "Status monitoring is not yet fully implemented in the UI. Check the console for output."
- **Console**: Shows parsed JSON with system metrics
- **No Errors**: No undefined property errors

## Future Enhancement Path

When ready to implement the full monitoring UI, the following approach is recommended:

### Phase 1: Basic Display
1. Add state for metrics: `useState<SystemMetrics | null>(null)`
2. Replace alert with state update: `setMetrics(JSON.parse(result.stdout))`
3. Conditionally render metrics cards when data available

### Phase 2: Auto-Refresh
1. Add `autoRefresh` state
2. Use `useEffect` with interval for periodic updates
3. Add "Stop Monitoring" button

### Phase 3: Full Dashboard
1. Create metric cards for CPU, Memory, Disk, Network, Battery, GPU
2. Add progress bars and visualizations
3. Implement health score display
4. Add top processes list

## Why This Approach?

### Benefits of Current Implementation
1. **Safe**: Checks API availability before use
2. **Debuggable**: Logs all data to console
3. **Consistent**: Uses same StartScreen pattern as other pages
4. **Informative**: Clear error messages guide user
5. **Non-blocking**: Doesn't crash app on error

### Why Not Full Dashboard Yet?
The full dashboard implementation was causing the `runStatus` error because:
- Component rendered before Electron preload script loaded
- `window.moleDesktop` was undefined during initial render
- No safety checks before API calls

The current implementation ensures stability first, with a clear path to enhancement.

## Troubleshooting

### If "API not available" error persists:
1. Check that Electron app is running (not just Vite dev server)
2. Verify `preload.js` is being loaded in `main.js`
3. Check browser console for preload script errors
4. Restart the entire dev server: `bun run dev`

### If status command fails:
1. Verify mole runtime is prepared: `bun run prepare:runtime`
2. Check that `.mole-runtime/mole` exists and is executable
3. Test command manually: `.mole-runtime/mole status --json`
4. Check stderr output in alert for specific error

## Conclusion

The Status Page is now stable and safe, using the StartScreen pattern with proper error handling. The page successfully calls the `mole status --json` command and outputs results to the console. When ready, the implementation can be enhanced to display a full monitoring dashboard following the documented enhancement path.

