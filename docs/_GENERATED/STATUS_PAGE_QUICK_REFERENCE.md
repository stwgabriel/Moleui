# Status Page - Quick Reference Card

## 🚀 Quick Start

```bash
# Run the app
bun run desktop:dev

# Navigate to Status page
# Click "Status" in sidebar or go to #status
```

## 📁 Key Files

```
apps/desktop/
├── status-page.js          # Main implementation (650 lines)
├── styles.css              # Styles (line 2009+, 400 lines)
├── renderer.js             # Routing (modified)
├── index.html              # Script tag (modified)
├── main.js                 # IPC handler (existing)
└── preload.js              # API exposure (existing)
```

## 🔧 Main Class

```javascript
class StatusPage {
  // Lifecycle
  init(container)      // Mount and start
  destroy()            // Cleanup and stop
  
  // Data
  fetchMetrics()       // Get from CLI
  updateMetrics(data)  // Process data
  updateUI(data)       // Render UI
  
  // Rendering
  render()             // Initial HTML
  updateOverviewCard() // Update cards
  updateGraph()        // Render graphs
  updateDetailedStats()// Update details
}
```

## 📊 Data Structure

```javascript
metricsHistory = {
  cpu: [],           // CPU usage %
  memory: [],        // Memory usage %
  network_rx: [],    // Download MB/s
  network_tx: [],    // Upload MB/s
  disk_io_read: [],  // Read MB/s
  disk_io_write: [], // Write MB/s
  timestamps: []     // Timestamps
}
```

## 🎨 CSS Classes

### Overview Cards
```css
.status-overview        /* Grid container */
.status-card            /* Individual card */
.status-card-header     /* Icon + label */
.status-card-value      /* Large number */
.status-card-progress   /* Progress bar */
.progress-bar           /* Animated bar */
```

### Graphs
```css
.status-graphs          /* Grid container */
.graph-card             /* Individual graph */
canvas                  /* Graph canvas */
```

### Details
```css
.status-details         /* Grid container */
.detail-section         /* Section card */
.detail-grid            /* 2-column grid */
.detail-item            /* Key-value pair */
.detail-label           /* Label text */
.detail-value           /* Value text */
```

### Lists
```css
.network-interfaces-list
.network-interface-item
.interface-name
.interface-stats

.top-processes-list
.process-item
.process-info
.process-stats
```

## 🔌 API Calls

```javascript
// Fetch metrics
const result = await window.moleDesktop.runStatus();

// Response format
{
  ok: true,
  command: "mole status --json",
  exitCode: 0,
  stdout: "{...json...}",
  stderr: ""
}
```

## 📈 Graph Rendering

```javascript
updateGraph(canvasId, data, label, unit, colors, labels)

// Single line
updateGraph('cpu-graph', [10, 20, 30], 'CPU', '%', '#3b82f6')

// Multi-line
updateGraph('network-graph', 
  [[1, 2, 3], [0.5, 1, 1.5]], 
  'Network', 'MB/s', 
  ['#10b981', '#f59e0b'], 
  ['RX', 'TX'])
```

## 🎯 Key Constants

```javascript
REFRESH_INTERVAL = 2000      // 2 seconds
GRAPH_HISTORY_SIZE = 60      // 60 data points
```

## 🎨 Color Palette

```javascript
// Semantic colors
--accent-primary: #3b82f6    // Blue (CPU)
--accent-secondary: #8b5cf6  // Purple (Memory)
--accent-success: #10b981    // Green (Success, RX)
--accent-warning: #f59e0b    // Orange (Warning, TX)
--accent-danger: #ef4444     // Red (Danger)
--clean-color: #06b6d4       // Cyan (Disk read)
--analyze-color: #ec4899     // Pink (Disk write)
```

## 🔄 Lifecycle Flow

```
1. User navigates to #status
   ↓
2. renderer.js calls statusPage.init(container)
   ↓
3. render() creates HTML structure
   ↓
4. startAutoRefresh() begins polling
   ↓
5. fetchMetrics() every 2 seconds
   ↓
6. updateMetrics() processes data
   ↓
7. updateUI() renders components
   ↓
8. User navigates away
   ↓
9. renderer.js calls statusPage.destroy()
   ↓
10. Timer stopped, cleanup complete
```

## 🐛 Common Issues

### Graphs not rendering
```javascript
// Check canvas exists
const canvas = document.querySelector('#cpu-graph');
console.log(canvas); // Should not be null

// Check data
console.log(this.metricsHistory.cpu); // Should have values
```

### No data updates
```javascript
// Check IPC
const result = await window.moleDesktop.runStatus();
console.log(result); // Should have stdout

// Check timer
console.log(this.refreshTimer); // Should not be null
```

### Memory leak
```javascript
// Ensure cleanup called
statusPage.destroy(); // Stops timer

// Check history size
console.log(this.metricsHistory.cpu.length); // Should be ≤ 60
```

## 🧪 Testing Commands

```bash
# Check syntax
node --check apps/desktop/status-page.js

# Run app
bun run desktop:dev

# Build app
bun run desktop:build

# Test CLI directly
./apps/desktop/.mole-runtime/mole status --json
```

## 📝 Quick Edits

### Change refresh interval
```javascript
// In status-page.js
const REFRESH_INTERVAL = 5000; // 5 seconds
```

### Change graph history
```javascript
// In status-page.js
const GRAPH_HISTORY_SIZE = 120; // 4 minutes
```

### Change colors
```css
/* In styles.css */
.status-card:hover {
  transform: translateY(-8px); /* More elevation */
}
```

### Add new metric
```javascript
// 1. Add to metricsHistory
this.metricsHistory.new_metric = [];

// 2. Update in updateMetrics()
this.metricsHistory.new_metric.push(metrics.new_value);

// 3. Add UI element in render()
<div id="new-metric-value">0</div>

// 4. Update in updateUI()
this.updateStatValue('new-metric-value', metrics.new_value);
```

## 🎯 Performance Tips

```javascript
// Use requestAnimationFrame for smooth updates
requestAnimationFrame(() => {
  this.updateGraph('cpu-graph', data);
});

// Debounce rapid updates
if (this.isRefreshing) return;

// Limit history size
if (this.metricsHistory.cpu.length > GRAPH_HISTORY_SIZE) {
  this.metricsHistory.cpu.shift();
}

// Use CSS transforms (GPU-accelerated)
transform: translateY(-4px); // ✅ Fast
top: -4px;                   // ❌ Slow
```

## 🔍 Debugging

```javascript
// Enable verbose logging
console.log('Fetching metrics...');
console.log('Metrics:', metrics);
console.log('History:', this.metricsHistory);

// Check DOM elements
console.log('Container:', this.container);
console.log('Canvas:', document.querySelector('#cpu-graph'));

// Monitor performance
console.time('updateUI');
this.updateUI(metrics);
console.timeEnd('updateUI');
```

## 📚 Documentation

- **STATUS_PAGE_IMPLEMENTATION.md** - Full technical docs
- **STATUS_PAGE_VISUAL_GUIDE.md** - Visual reference
- **STATUS_PAGE_SUMMARY.md** - High-level overview
- **STATUS_PAGE_QUICK_REFERENCE.md** - This file

## 🚦 Status Indicators

### Health Score Colors
```javascript
if (score > 80) return 'green';      // Healthy
if (score > 60) return 'yellow';     // Warning
return 'red';                        // Critical
```

### Progress Bar Colors
```javascript
if (percent > 80) return 'var(--accent-danger)';
if (percent > 60) return 'var(--accent-warning)';
return 'var(--accent-success)';
```

## 🎬 Animation Durations

```css
--duration-instant: 100ms   /* Immediate feedback */
--duration-fast: 150ms      /* Quick transitions */
--duration-normal: 250ms    /* Standard transitions */
--duration-slow: 400ms      /* Deliberate transitions */
```

## 🔗 Related Files

```
cmd/status/
├── main.go              # CLI entry point
├── metrics.go           # Metrics collection
├── metrics_cpu.go       # CPU metrics
├── metrics_memory.go    # Memory metrics
├── metrics_disk.go      # Disk metrics
├── metrics_network.go   # Network metrics
├── metrics_battery.go   # Battery metrics
└── metrics_gpu.go       # GPU metrics
```

## 💡 Pro Tips

1. **Use DevTools** - Inspect elements, check console
2. **Test dark mode** - Toggle system theme
3. **Resize window** - Test responsive layout
4. **Monitor memory** - Check for leaks over time
5. **Profile rendering** - Use Performance tab
6. **Test edge cases** - Disconnect network, high CPU
7. **Check accessibility** - Use VoiceOver
8. **Verify cleanup** - Navigate away and back

## 🎓 Learning Resources

- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Electron IPC](https://www.electronjs.org/docs/latest/api/ipc-renderer)
- [CSS Grid](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Glassmorphism](https://glassmorphism.com/)

## ✅ Checklist

Before committing:
- [ ] No console errors
- [ ] Graphs render correctly
- [ ] Data updates every 2s
- [ ] Responsive layout works
- [ ] Dark mode looks good
- [ ] Cleanup works (navigate away)
- [ ] No memory leaks
- [ ] Accessibility tested

---

**Quick Reference Version:** 1.0  
**Last Updated:** May 3, 2026  
**Status:** ✅ Production Ready
