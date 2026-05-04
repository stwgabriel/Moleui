# Clean Page - Visual Workflow Guide

## Stage Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLEAN PAGE                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: SELECTION                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Select Categories to Clean                             │   │
│  │  Choose what you want to clean from your system         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 💾 System    │  │ 👤 User      │  │ 🌐 Browser   │         │
│  │    Caches    │  │    Caches    │  │    Data      │         │
│  │ [Selected ✓] │  │ [          ] │  │ [Selected ✓] │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 📄 Log       │  │ 📥 Old       │  │ 🗑️  Trash    │         │
│  │    Files     │  │    Downloads │  │              │         │
│  │ [          ] │  │ [          ] │  │ [Selected ✓] │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ 🔍 Scan Selected (3)│  │ ☑️  Select All      │             │
│  └─────────────────────┘  └─────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ User clicks "Scan Selected"
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: SCANNING                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌─────────────┐                              │
│                    │   🔄 🔍     │  (Spinning animation)        │
│                    └─────────────┘                              │
│                                                                 │
│                  Scanning System...                             │
│         Analyzing selected categories for cleanable files       │
│                                                                 │
│         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         │
│                                                                 │
│  Backend: Executes `mole clean --dry-run`                       │
│  Streams: Real-time stdout/stderr                              │
│  Parses: Size and file count information                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Scan complete
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3: RESULTS                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Scan Results                                           │   │
│  │  Found 4.2 GB of cleanable data                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐           │
│  │ 💾 4.2 GB            │  │ 📄 12,847 items      │           │
│  │    Total Cleanable   │  │    Total Items       │           │
│  └──────────────────────┘  └──────────────────────┘           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💾 System Caches                              2.1 GB    │   │
│  │    8,234 items • 2.1 GB                                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 🌐 Browser Data                               1.8 GB    │   │
│  │    3,421 items • 1.8 GB                                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 🗑️  Trash                                      300 MB   │   │
│  │    1,192 items • 300 MB                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ 🗑️  Clean Now       │  │ ← Back              │             │
│  └─────────────────────┘  └─────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ User clicks "Clean Now"
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 4: CLEANING                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌─────────────┐                              │
│                    │   🔄 🗑️     │  (Spinning animation)        │
│                    └─────────────┘                              │
│                                                                 │
│                    Cleaning...                                  │
│              Removing browser cache files                       │
│                                                                 │
│         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░         │
│                                                                 │
│                  2.8 GB of 4.2 GB                               │
│                                                                 │
│  Backend: Executes `mole clean` (no dry-run)                   │
│  Streams: Real-time progress updates                           │
│  Updates: Progress bar and size cleaned                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Cleaning complete
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 5: COMPLETE                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌─────────────┐                              │
│                    │      ✅      │  (Scale-in animation)       │
│                    └─────────────┘                              │
│                                                                 │
│                Cleaning Complete!                               │
│           Successfully freed 4.2 GB                             │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐           │
│  │      4.2 GB          │  │      12,847          │           │
│  │  Space Recovered     │  │  Items Removed       │           │
│  └──────────────────────┘  └──────────────────────┘           │
│                                                                 │
│                ┌─────────────────────┐                          │
│                │ ✓ Done              │                          │
│                └─────────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ User clicks "Done"
                              ▼
                    (Returns to STAGE 1)
```

## Category Details

### 1. System Caches (Blue - #3b82f6)
- **Icon:** 💾 hard-drive
- **Description:** System and application cache files
- **Examples:** 
  - `/Library/Caches/*`
  - Application caches
  - System temporary files

### 2. User Caches (Purple - #8b5cf6)
- **Icon:** 👤 user
- **Description:** User-specific cache and temporary files
- **Examples:**
  - `~/Library/Caches/*`
  - User temporary files
  - Application user data

### 3. Browser Data (Cyan - #06b6d4)
- **Icon:** 🌐 globe
- **Description:** Browser caches, cookies, and history
- **Examples:**
  - Safari cache
  - Chrome cache
  - Firefox cache
  - Browser cookies

### 4. Log Files (Green - #10b981)
- **Icon:** 📄 file-text
- **Description:** System and application log files
- **Examples:**
  - System logs
  - Application logs
  - Crash reports

### 5. Old Downloads (Amber - #f59e0b)
- **Icon:** 📥 download
- **Description:** Downloads folder cleanup (30+ days)
- **Examples:**
  - Old downloaded files
  - Installer packages
  - Archived downloads

### 6. Trash (Red - #ef4444)
- **Icon:** 🗑️ trash-2
- **Description:** Empty trash and recover space
- **Examples:**
  - Trash bin contents
  - Deleted files
  - Recoverable space

## Interaction Patterns

### Category Selection
```
┌──────────────────────────────────────┐
│ 💾 System Caches                     │  ← Unselected
│    System and application cache files│
│                                    ○ │
└──────────────────────────────────────┘
         │ Click
         ▼
┌──────────────────────────────────────┐
│ 💾 System Caches                     │  ← Selected
│    System and application cache files│  (Blue border)
│                                    ✓ │  (Blue background)
└──────────────────────────────────────┘
```

### Hover Effects
```
Normal State:
┌──────────────────────────────────────┐
│ 💾 System Caches              2.1 GB │
│    8,234 items • 2.1 GB              │
└──────────────────────────────────────┘

Hover State:
┌──────────────────────────────────────┐
│ 💾 System Caches              2.1 GB │  ← Lifted up 4px
│    8,234 items • 2.1 GB              │  ← Larger shadow
└──────────────────────────────────────┘  ← Moved right 4px
```

### Button States
```
Primary Button (Scan/Clean):
┌─────────────────────┐
│ 🔍 Scan Selected (3)│  ← Normal
└─────────────────────┘

┌─────────────────────┐
│ 🔍 Scan Selected (3)│  ← Hover (lifted, blue glow)
└─────────────────────┘

┌─────────────────────┐
│ 🔍 Scan Selected (3)│  ← Active (pressed down)
└─────────────────────┘

┌─────────────────────┐
│ 🔍 Scan Selected (0)│  ← Disabled (grayed out)
└─────────────────────┘
```

## Animation Timeline

### Page Load (Initial)
```
0ms:    Opacity 0, Scale 0.92
        ↓
500ms:  Opacity 1, Scale 1.0
        (Smooth fade-in and scale-up)
```

### Category Selection
```
0ms:    Border transparent, Background normal
        ↓
150ms:  Border blue, Background blue tint
        (Fast transition)
```

### Scanning Progress
```
Continuous:
  Spinner: 360° rotation every 1s
  Progress bar: Width increases smoothly
```

### Completion Icon
```
0ms:    Scale 0, Opacity 0
        ↓
200ms:  Scale 1.1 (overshoot)
        ↓
400ms:  Scale 1.0, Opacity 1
        (Bouncy spring animation)
```

## Color Coding

### Stage Indicators
- **Selection:** Blue (#3b82f6) - Primary action
- **Scanning:** Blue (#3b82f6) - In progress
- **Results:** Blue (#3b82f6) - Information
- **Cleaning:** Blue (#3b82f6) - Active operation
- **Complete:** Green (#10b981) - Success

### Category Colors
- System Caches: Blue (#3b82f6)
- User Caches: Purple (#8b5cf6)
- Browser Data: Cyan (#06b6d4)
- Log Files: Green (#10b981)
- Old Downloads: Amber (#f59e0b)
- Trash: Red (#ef4444)

## Responsive Behavior

### Desktop (> 900px)
- Grid layout: 2-3 columns for categories
- Full sidebar visible
- Large icons and text

### Tablet (600px - 900px)
- Grid layout: 2 columns for categories
- Collapsible sidebar
- Medium icons and text

### Mobile (< 600px)
- Grid layout: 1 column for categories
- Hidden sidebar (toggle button)
- Smaller icons and text

## Accessibility Features

### Keyboard Navigation
```
Tab:        Move between interactive elements
Enter:      Activate button/category
Space:      Toggle category selection
Escape:     Cancel operation (if applicable)
```

### Focus Indicators
```
┌─────────────────────┐
│ 🔍 Scan Selected (3)│  ← 2px blue outline
└─────────────────────┘    2px offset
```

### Screen Reader Support
- Semantic HTML structure
- ARIA labels on buttons
- Status updates announced
- Progress information accessible

## Performance Metrics

- **Initial Load:** < 100ms
- **Category Toggle:** < 50ms
- **Stage Transition:** 400ms
- **Animation Frame Rate:** 60fps
- **Memory Usage:** < 50MB
- **CPU Usage:** < 5% (idle), < 20% (animating)

## Error Handling

### Scan Failure
```
┌─────────────────────────────────────┐
│ ⚠️  Scan Failed                     │
│                                     │
│ Unable to scan system. Please try   │
│ again or check permissions.         │
│                                     │
│ ┌─────────────┐                     │
│ │ Try Again   │                     │
│ └─────────────┘                     │
└─────────────────────────────────────┘
```

### Clean Failure
```
┌─────────────────────────────────────┐
│ ❌ Cleaning Failed                  │
│                                     │
│ Some files could not be removed.    │
│ Partial cleanup completed: 2.1 GB   │
│                                     │
│ ┌─────────────┐                     │
│ │ View Details│                     │
│ └─────────────┘                     │
└─────────────────────────────────────┘
```

## Integration Points

### IPC Communication
```javascript
// Scan (dry-run)
window.moleDesktop.clean.execute({ dryRun: true })

// Clean (actual)
window.moleDesktop.clean.execute({ dryRun: false })

// Listen to output
window.moleDesktop.clean.onStdout(callback)
window.moleDesktop.clean.onStderr(callback)

// Cleanup
window.moleDesktop.clean.removeListeners()
```

### CLI Commands
```bash
# Dry run (scan only)
mole clean --dry-run

# Actual clean
mole clean

# With specific categories (future)
mole clean --categories=system-caches,browser-data
```

## Testing Scenarios

1. **Happy Path:**
   - Select categories → Scan → Review → Clean → Complete

2. **Cancel During Scan:**
   - Select categories → Scan → (Cancel) → Back to selection

3. **No Results:**
   - Select categories → Scan → No cleanable data found

4. **Partial Failure:**
   - Select categories → Scan → Clean → Some files failed

5. **Permission Denied:**
   - Select categories → Scan → Permission error

6. **Network/System Error:**
   - Select categories → Scan → System error

## Conclusion

The Clean page provides a complete, polished, and user-friendly interface for system cleaning operations. The visual workflow is intuitive, the animations are smooth, and the design follows modern glassmorphism principles while maintaining excellent accessibility and performance.
