# Status Page Implementation

## Overview

The Status page provides real-time system monitoring with beautiful glassmorphic UI, live graphs, and detailed metrics. It integrates with the CLI `mole status --json` command to fetch system metrics every 2 seconds.

## Features

### 1. Overview Cards
Four prominent cards showing key metrics at a glance:
- **CPU Usage** - Current CPU utilization percentage
- **Memory Usage** - RAM usage percentage
- **Disk Usage** - Primary disk usage percentage
- **Health Score** - Overall system health (0-100)

Each card includes:
- Large numeric display with unit
- Color-coded progress bar (green → yellow → red)
- Smooth animations on value changes
- Hover effects with elevation

### 2. Real-Time Graphs
Four interactive canvas-based graphs showing historical data:

#### CPU Usage Graph
- Line graph with area fill
- Shows last 60 data points (2 minutes of history)
- Blue color scheme
- Auto-scaling Y-axis

#### Memory Usage Graph
- Line graph with area fill
- Shows last 60 data points
- Purple color scheme
- Percentage-based (0-100%)

#### Network Activity Graph
- Dual-line graph (RX and TX)
- Green for download, orange for upload
- Shows combined rates across all interfaces
- MB/s units with auto-scaling

#### Disk I/O Graph
- Dual-line graph (Read and Write)
- Cyan for read, pink for write
- MB/s units with auto-scaling
- Smooth gradient fills

### 3. Detailed Statistics

#### CPU Details
- Core count (P-cores and E-cores for Apple Silicon)
- Load averages (1, 5, 15 minutes)

#### Memory Details
- Used/Total in GB
- Memory pressure status (normal/warn/critical)

#### Disk Details
- Used/Total in GB
- Mount point

#### Battery
- Current charge percentage
- Status (Charging/Discharging/Full)
- Health and cycle count

#### GPU
- GPU name/model
- Current usage percentage

#### Network Interfaces
- List of all active interfaces
- Real-time RX/TX rates per interface
- Color-coded upload/download indicators

#### Top Processes
- Top 10 processes by CPU usage
- Shows PID, name, CPU%, and memory%
- Scrollable list
- Monospace font for alignment

## Technical Implementation

### Architecture

```
status-page.js (Frontend)
    ↓
window.moleDesktop.runStatus() (IPC)
    ↓
main.js (Electron Main Process)
    ↓
spawn("mole", ["status", "--json"])
    ↓
cmd/status/main.go (CLI)
    ↓
JSON metrics output
```

### Data Flow

1. **Initialization**: When user navigates to #status, `statusPage.init()` is called
2. **Auto-refresh**: Timer triggers `fetchMetrics()` every 2 seconds
3. **IPC Call**: Calls `window.moleDesktop.runStatus()` via Electron IPC
4. **CLI Execution**: Main process spawns `mole status --json`
5. **Parse Response**: JSON output is parsed into metrics object
6. **Update History**: New data points added to ring buffers (max 60 points)
7. **Render UI**: All cards, graphs, and stats updated with new data
8. **Cleanup**: When leaving page, `statusPage.destroy()` stops the timer

### Key Classes and Methods

#### StatusPage Class

```javascript
class StatusPage {
  constructor()           // Initialize state
  init(container)         // Mount to DOM and start refresh
  destroy()               // Stop refresh timer
  startAutoRefresh()      // Begin 2s polling
  stopAutoRefresh()       // Stop polling
  fetchMetrics()          // Call CLI via IPC
  updateMetrics(metrics)  // Process new data
  updateUI(metrics)       // Render all UI elements
  updateOverviewCard()    // Update card values
  updateGraph()           // Render canvas graph
  updateDetailedStats()   // Update detail sections
  render()                // Initial HTML render
}
```

#### Data Structures

```javascript
metricsHistory = {
  cpu: [],              // CPU usage percentages
  memory: [],           // Memory usage percentages
  network_rx: [],       // Network download rates (MB/s)
  network_tx: [],       // Network upload rates (MB/s)
  disk_io_read: [],     // Disk read rates (MB/s)
  disk_io_write: [],    // Disk write rates (MB/s)
  timestamps: []        // Timestamps for each data point
}
```

### Canvas Graph Rendering

The `updateGraph()` method handles all graph rendering:

1. **Clear Canvas**: Reset canvas to transparent
2. **Calculate Scale**: Find max value and round to nice number
3. **Draw Grid**: 5 horizontal grid lines with labels
4. **Draw Lines**: Plot data points with smooth lines
5. **Fill Area**: Gradient fill under line
6. **Draw Legend**: For multi-line graphs (network, disk I/O)

Features:
- Auto-scaling Y-axis based on data
- Smooth line interpolation
- Gradient area fills with transparency
- Grid lines for readability
- Color-coded legends

### Styling

All styles follow the glassmorphism design system:

- **Glass surfaces**: `backdrop-filter: blur(20px)`
- **Smooth transitions**: 250ms cubic-bezier easing
- **Hover effects**: Elevation changes with shadow
- **Color coding**: 
  - Green (success): < 60%
  - Yellow (warning): 60-80%
  - Red (danger): > 80%
- **Responsive grid**: Adapts to screen size
- **Dark mode**: Automatic via `prefers-color-scheme`

### Performance Optimizations

1. **Debouncing**: Only one fetch at a time (`isRefreshing` flag)
2. **Ring Buffer**: Fixed-size history (60 points max)
3. **Canvas Rendering**: Hardware-accelerated
4. **Selective Updates**: Only changed elements re-render
5. **Cleanup**: Timer stopped when leaving page

## CLI Integration

### Command
```bash
mole status --json
```

### Output Format
```json
{
  "collected_at": "2026-05-03T...",
  "host": "MacBook-Pro.local",
  "platform": "darwin",
  "uptime": "2 days, 5 hours",
  "uptime_seconds": 183600,
  "procs": 342,
  "health_score": 85,
  "health_score_msg": "Good",
  "cpu": {
    "usage": 23.5,
    "per_core": [25.0, 22.0, ...],
    "load1": 2.5,
    "load5": 2.1,
    "load15": 1.8,
    "core_count": 10,
    "p_core_count": 6,
    "e_core_count": 4
  },
  "memory": {
    "used": 12884901888,
    "total": 17179869184,
    "used_percent": 75.0,
    "pressure": "normal"
  },
  "disks": [{
    "mount": "/",
    "device": "/dev/disk3s1s1",
    "used": 214748364800,
    "total": 494384795648,
    "used_percent": 43.4,
    "external": false
  }],
  "disk_io": {
    "read_rate": 5.2,
    "write_rate": 2.1
  },
  "network": [{
    "name": "en0",
    "rx_rate_mbs": 1.5,
    "tx_rate_mbs": 0.3,
    "ip": "192.168.1.100"
  }],
  "batteries": [{
    "percent": 85.0,
    "status": "Discharging",
    "time_left": "4h 23m",
    "health": "Good",
    "cycle_count": 42,
    "capacity": 95
  }],
  "gpu": [{
    "name": "Apple M1 Pro",
    "usage": 15.0,
    "memory_used": 2048,
    "memory_total": 16384,
    "core_count": 16
  }],
  "top_processes": [{
    "pid": 1234,
    "name": "Chrome",
    "command": "/Applications/Google Chrome.app/...",
    "cpu": 45.2,
    "memory": 12.5
  }]
}
```

## User Experience

### Loading State
- Initial render shows "0.0" values
- First metrics fetch populates all data
- Smooth fade-in animations

### Real-Time Updates
- Values update every 2 seconds
- Smooth transitions on value changes
- Progress bars animate width and color
- Graphs scroll left as new data arrives

### Interactions
- **Hover**: Cards elevate with shadow
- **Scroll**: Smooth scrolling for long lists
- **Responsive**: Adapts to window size
- **Accessibility**: Proper ARIA labels, keyboard navigation

### Visual Feedback
- Color-coded progress bars
- Animated graphs with gradients
- Monospace fonts for numeric data
- Icons for visual hierarchy

## Future Enhancements

### Potential Features
1. **Configurable Refresh Rate**: User-adjustable polling interval
2. **Graph Time Range**: Toggle between 1min/5min/15min views
3. **Export Data**: Download metrics as CSV/JSON
4. **Alerts**: Threshold-based notifications
5. **Historical View**: View past metrics (requires persistence)
6. **Process Management**: Kill processes from UI
7. **Custom Metrics**: User-defined monitoring
8. **Comparison Mode**: Compare current vs. historical averages

### Performance Improvements
1. **WebGL Graphs**: Hardware-accelerated rendering
2. **Web Workers**: Offload data processing
3. **Incremental Updates**: Only update changed values
4. **Lazy Loading**: Load detail sections on demand

## Testing

### Manual Testing Checklist
- [ ] Navigate to Status page
- [ ] Verify all cards show data
- [ ] Confirm graphs render correctly
- [ ] Check real-time updates (2s interval)
- [ ] Test responsive layout (resize window)
- [ ] Verify dark mode styling
- [ ] Check process list scrolling
- [ ] Navigate away and back (cleanup test)
- [ ] Monitor memory usage over time

### Edge Cases
- No battery (desktop Mac)
- No GPU data available
- Network interfaces down
- High CPU/memory usage (>100%)
- Very long process names
- Rapid navigation (cleanup)

## Troubleshooting

### Graphs Not Rendering
- Check canvas element exists
- Verify `lucide.createIcons()` called
- Inspect console for errors
- Ensure metrics data is valid

### No Data Updates
- Verify `mole status --json` works in terminal
- Check IPC communication in DevTools
- Confirm timer is running
- Check for JavaScript errors

### Performance Issues
- Reduce refresh interval
- Limit graph history size
- Check for memory leaks
- Profile with DevTools

## Code References

### Files
- `apps/desktop/status-page.js` - Frontend implementation
- `apps/desktop/styles.css` - Status page styles (line 2009+)
- `apps/desktop/renderer.js` - Page routing and initialization
- `apps/desktop/main.js` - IPC handler for `mole:status`
- `cmd/status/main.go` - CLI status command
- `cmd/status/metrics.go` - Metrics collection

### Key Functions
- `StatusPage.init()` - Initialize page
- `StatusPage.fetchMetrics()` - Fetch from CLI
- `StatusPage.updateGraph()` - Render canvas graphs
- `StatusPage.updateUI()` - Update all UI elements

## Design System Compliance

The Status page follows the Mole Desktop design system:

✅ Glassmorphism with backdrop-filter blur  
✅ Smooth animations (250ms cubic-bezier)  
✅ Color-coded semantic states  
✅ Responsive grid layout  
✅ Dark mode support  
✅ Accessibility (ARIA, keyboard nav)  
✅ Monospace fonts for data  
✅ Hover effects with elevation  
✅ Progress bars with smooth transitions  
✅ Icon-based visual hierarchy  

## Conclusion

The Status page provides a comprehensive, real-time view of system health with a beautiful, modern interface. It seamlessly integrates with the CLI backend while maintaining the glassmorphic design language throughout the app.
