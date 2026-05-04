# Status Page Visual Guide

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         STATUS PAGE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   CPU    │  │  MEMORY  │  │   DISK   │  │  HEALTH  │       │
│  │  [icon]  │  │  [icon]  │  │  [icon]  │  │  [icon]  │       │
│  │   23.5%  │  │   75.0%  │  │   43.4%  │  │  85/100  │       │
│  │ ▓▓▓▓░░░░ │  │ ▓▓▓▓▓▓░░ │  │ ▓▓▓░░░░░ │  │ ▓▓▓▓▓▓░░ │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │   CPU Usage             │  │   Memory Usage          │      │
│  │                         │  │                         │      │
│  │         ╱╲              │  │       ╱╲╱╲              │      │
│  │      ╱╲╱  ╲╱╲           │  │    ╱╲╱    ╲╱╲           │      │
│  │   ╱╲╱          ╲╱╲      │  │ ╱╲╱            ╲╱╲      │      │
│  │ ╱╱                  ╲╲  │  │╱                    ╲╲  │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │   Network Activity      │  │   Disk I/O              │      │
│  │                         │  │                         │      │
│  │   RX ─── TX ───         │  │   Read ─── Write ───    │      │
│  │      ╱╲    ╱╲           │  │       ╱╲      ╱╲        │      │
│  │   ╱╲╱  ╲╱╲╱  ╲╱╲        │  │    ╱╲╱  ╲╱╲╱╲╱  ╲╱╲     │      │
│  │ ╱╱              ╲╲      │  │  ╱╱                ╲╲   │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │ [CPU] CPU Details       │  │ [MEM] Memory Details    │      │
│  │ Cores: 10 cores         │  │ Usage: 12.0 GB / 16.0 GB│      │
│  │ Load: 2.5 / 2.1 / 1.8   │  │ Pressure: normal        │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │ [HDD] Disk Details      │  │ [BAT] Battery           │      │
│  │ Usage: 200 GB / 460 GB  │  │ Charge: 85%             │      │
│  │ Mount: /                │  │ Status: Discharging     │      │
│  │                         │  │ Health: Good (42 cycles)│      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │ [GPU] GPU               │  │ [NET] Network Interfaces│      │
│  │ Name: Apple M1 Pro      │  │ en0                     │      │
│  │ Usage: 15.0%            │  │ ↓ 1.50 MB/s ↑ 0.30 MB/s │      │
│  └─────────────────────────┘  │ en1                     │      │
│                                │ ↓ 0.00 MB/s ↑ 0.00 MB/s │      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ [LIST] Top Processes                                 │      │
│  │ Chrome          PID: 1234    45.2%    12.5%          │      │
│  │ Electron        PID: 5678    23.1%     8.2%          │      │
│  │ Safari          PID: 9012    12.5%     5.1%          │      │
│  │ ...                                                   │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Overview Cards (Top Row)

```
┌──────────────────┐
│ [CPU Icon]       │  ← Icon with accent color
│ CPU              │  ← Label (uppercase, small)
│                  │
│     23.5%        │  ← Large value (36px, bold)
│                  │
│ ▓▓▓▓▓░░░░░░░░░  │  ← Progress bar (color-coded)
└──────────────────┘
```

**Colors:**
- Green: 0-60% (healthy)
- Yellow: 60-80% (warning)
- Red: 80-100% (critical)

**Animations:**
- Hover: Elevate 4px with shadow
- Value change: Smooth number transition
- Progress: Smooth width animation

### 2. Graph Cards

```
┌─────────────────────────────────┐
│ CPU Usage                       │  ← Title (16px, bold)
│                                 │
│ 100 ─────────────────────────── │  ← Y-axis labels
│  75 ─────────────────────────── │
│  50 ─────────────────────────── │
│  25 ─────────────────────────── │
│   0 ─────────────────────────── │
│         ╱╲                      │  ← Line graph
│      ╱╲╱  ╲╱╲                   │
│   ╱╲╱          ╲╱╲              │
│ ╱╱                  ╲╲          │  ← Gradient fill
│ ░░░░░░░░░░░░░░░░░░░░░░          │
└─────────────────────────────────┘
```

**Features:**
- Auto-scaling Y-axis
- 60 data points (2 minutes)
- Smooth line interpolation
- Gradient area fill
- Grid lines for reference

**Multi-line Graphs (Network, Disk I/O):**
```
┌─────────────────────────────────┐
│ Network Activity                │
│                                 │
│  RX ■  TX ■                     │  ← Legend
│                                 │
│      ╱╲    ╱╲                   │  ← Two lines
│   ╱╲╱  ╲╱╲╱  ╲╱╲                │    (different colors)
│ ╱╱              ╲╲              │
└─────────────────────────────────┘
```

### 3. Detail Sections

```
┌─────────────────────────────────┐
│ [Icon] Section Title            │  ← Icon + title
│ ─────────────────────────────── │
│                                 │
│ Label 1          Value 1        │  ← Key-value pairs
│ Label 2          Value 2        │    (monospace values)
│                                 │
└─────────────────────────────────┘
```

**Layout:**
- 2-column grid for detail sections
- Icon with accent color
- Uppercase labels (12px)
- Monospace values (14px, bold)

### 4. Network Interfaces List

```
┌─────────────────────────────────┐
│ [Network Icon] Network Interfaces│
│ ─────────────────────────────── │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ en0                         │ │  ← Interface name
│ │ ↓ 1.50 MB/s  ↑ 0.30 MB/s    │ │  ← RX (green) / TX (orange)
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ en1                         │ │
│ │ ↓ 0.00 MB/s  ↑ 0.00 MB/s    │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

### 5. Top Processes List

```
┌──────────────────────────────────────┐
│ [List Icon] Top Processes            │
│ ──────────────────────────────────── │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Chrome                           │ │  ← Process name
│ │ PID: 1234                        │ │  ← PID (small, gray)
│ │                    45.2%   12.5% │ │  ← CPU% (blue) / Mem% (purple)
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Electron                         │ │
│ │ PID: 5678                        │ │
│ │                    23.1%    8.2% │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ... (scrollable)                     │
│                                      │
└──────────────────────────────────────┘
```

## Color Palette

### Light Mode
```
Background:     #f0f4f8  (soft blue-grey)
Surface:        rgba(255, 255, 255, 0.85)  (glass)
Text Primary:   #0f172a  (near black)
Text Secondary: #475569  (slate)
Text Tertiary:  #94a3b8  (light slate)

Accent Blue:    #3b82f6  (CPU, primary)
Accent Purple:  #8b5cf6  (Memory)
Accent Green:   #10b981  (Success, RX)
Accent Orange:  #f59e0b  (Warning, TX)
Accent Red:     #ef4444  (Danger)
Accent Cyan:    #06b6d4  (Disk read)
Accent Pink:    #ec4899  (Disk write)
```

### Dark Mode
```
Background:     #0f172a  (deep slate)
Surface:        rgba(30, 41, 59, 0.8)  (dark glass)
Text Primary:   #f8fafc  (near white)
Text Secondary: #cbd5e1  (light slate)
Text Tertiary:  #64748b  (medium slate)

(Accent colors adjusted for contrast)
```

## Responsive Breakpoints

### Desktop (> 1400px)
- 4-column overview cards
- 2-column graphs
- 2-column detail sections

### Tablet (900px - 1400px)
- 2-column overview cards
- 1-column graphs
- 1-column detail sections

### Mobile (< 900px)
- 1-column overview cards
- 1-column graphs
- 1-column detail sections

## Animation Timeline

```
Page Load:
0ms    → Render HTML structure
50ms   → Fade in overview cards
100ms  → Fetch first metrics
150ms  → Populate cards with data
200ms  → Render graphs
250ms  → Fade in detail sections

Real-time Updates (every 2000ms):
0ms    → Fetch metrics
50ms   → Parse JSON
100ms  → Update card values (250ms transition)
150ms  → Update graphs (smooth line animation)
200ms  → Update detail sections
```

## Interaction States

### Card Hover
```
Default:  transform: translateY(0)
          box-shadow: 0 4px 16px rgba(0,0,0,0.08)

Hover:    transform: translateY(-4px)
          box-shadow: 0 8px 24px rgba(0,0,0,0.12)
          
Duration: 250ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Progress Bar
```
Width:    Animates from current to new value
Color:    Transitions based on threshold
Duration: 250ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Graph Lines
```
New Point: Slides in from right
Old Point: Slides out to left
Duration:  Instant (no animation, just data shift)
```

## Accessibility

### ARIA Labels
- Cards: `role="status"` with `aria-live="polite"`
- Graphs: `role="img"` with descriptive `aria-label`
- Sections: Proper heading hierarchy (h3)

### Keyboard Navigation
- Tab through all interactive elements
- Focus indicators on all focusable items
- Escape to close/navigate away

### Screen Readers
- Value changes announced via `aria-live`
- Graph data available as text alternative
- Semantic HTML structure

## Performance Metrics

### Target Performance
- Initial render: < 100ms
- Metrics fetch: < 500ms
- Graph render: < 50ms per graph
- Memory usage: < 50MB for page
- CPU usage: < 5% when idle

### Optimization Techniques
- Canvas rendering (hardware-accelerated)
- Ring buffer (fixed memory)
- Debounced fetching
- Selective DOM updates
- CSS transforms (GPU-accelerated)

## Browser Compatibility

### Supported Features
- ✅ Canvas 2D API
- ✅ CSS backdrop-filter
- ✅ CSS Grid
- ✅ CSS Custom Properties
- ✅ ES6+ JavaScript
- ✅ Async/Await
- ✅ IPC (Electron)

### Fallbacks
- No backdrop-filter: Solid background
- No CSS Grid: Flexbox fallback
- No Canvas: Static text display

## Example Data Flow

```
User navigates to #status
    ↓
renderer.js detects route change
    ↓
statusPage.init(container) called
    ↓
render() creates HTML structure
    ↓
startAutoRefresh() begins polling
    ↓
fetchMetrics() calls IPC
    ↓
main.js spawns "mole status --json"
    ↓
CLI returns JSON metrics
    ↓
updateMetrics() processes data
    ↓
updateUI() renders all components
    ↓
[Wait 2 seconds]
    ↓
Repeat fetch cycle...
```

## Troubleshooting Visual Issues

### Graphs Not Showing
- Check canvas dimensions (width/height attributes)
- Verify data array has values
- Inspect console for errors
- Ensure lucide icons loaded

### Cards Not Updating
- Check IPC communication
- Verify JSON parsing
- Inspect network tab
- Check timer is running

### Layout Broken
- Verify CSS Grid support
- Check responsive breakpoints
- Inspect element dimensions
- Test in different window sizes

### Colors Wrong
- Check dark mode detection
- Verify CSS custom properties
- Inspect computed styles
- Test color contrast ratios

## Future Visual Enhancements

1. **Sparklines**: Mini graphs in overview cards
2. **Heatmaps**: CPU core usage visualization
3. **Radial Gauges**: Circular progress indicators
4. **3D Effects**: Depth and parallax
5. **Particle Effects**: Animated backgrounds
6. **Themes**: User-selectable color schemes
7. **Customization**: Drag-and-drop layout
8. **Widgets**: Detachable mini-monitors
