# Uninstall UI Visual Guide

## Before & After Comparison

### 1. Idle State (Initial Screen)

#### Before
```
┌─────────────────────────────────────┐
│                                     │
│         [Package-X Icon]            │
│                                     │
│   Ready to Uninstall Applications   │
│                                     │
│   Scan your system to find...      │
│                                     │
│      [🔍 Scan Applications]         │
│                                     │
└─────────────────────────────────────┘
```

#### After (Matches Other Pages)
```
┌─────────────────────────────────────────────────────────┐
│  Left Column (60%)          │  Right Column (40%)       │
│                             │                           │
│  Uninstall                  │                           │
│  Completely remove apps...  │      [Package-X Icon]     │
│                             │      (Large, Animated)    │
│  ┌─ Deep Scan              │                           │
│  │  Find all app files     │                           │
│  └─────────────────────    │                           │
│  ┌─ Complete Removal       │                           │
│  │  Delete with prefs      │                           │
│  └─────────────────────    │                           │
│  ┌─ Safe Uninstall         │                           │
│  │  Protected files safe   │                           │
│  └─────────────────────    │                           │
│                             │                           │
│         [Scan Applications]                             │
└─────────────────────────────────────────────────────────┘
```

### 2. Loading State (Analyzing)

#### Before
```
┌─────────────────────────────────────┐
│                                     │
│           [Spinner]                 │
│                                     │
│    Scanning Applications...         │
│                                     │
│  Please wait while we analyze...    │
│                                     │
│  ✓ Scanning directories             │
│  ✓ Collecting metadata              │
│  ✓ Building index                   │
│                                     │
└─────────────────────────────────────┘
```

#### After (Real-Time CLI Output)
```
┌─────────────────────────────────────────────────────────┐
│                    [Spinner]                            │
│           Analyzing Applications...                     │
│      Scanning your system for installed apps           │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ $ mole uninstall --list                           │ │
│  │ Scanning /Applications...                         │ │
│  │ Found: Chrome.app (234 MB)                        │ │
│  │ Found: Slack.app (156 MB)                         │ │
│  │ Scanning ~/Applications...                        │ │
│  │ Found: VSCode.app (512 MB)                        │ │
│  │ Checking Homebrew installations...                │ │
│  │ Found: node (45 MB)                               │ │
│  │ Found: python (123 MB)                            │ │
│  │ ✓ Scan complete                                   │ │
│  │ ✓ Found 47 applications                           │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3. Confirmation State

#### Before
```
┌─────────────────────────────────────┐
│      ⚠️  Confirm Uninstallation     │
│                                     │
│  Selected Apps:                     │
│  • Chrome (234 MB)                  │
│  • Slack (156 MB)                   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  [Spinner]                  │   │
│  │  Analyzing files...         │   │
│  └─────────────────────────────┘   │
│                                     │
│    [Cancel]  [Uninstall 2 Apps]    │
└─────────────────────────────────────┘
```

#### After (Live Dry-Run Output)
```
┌─────────────────────────────────────────────────────────┐
│            ⚠️  Confirm Uninstallation                   │
│   The following apps and files will be removed:         │
│                                                         │
│  Selected Apps:                                         │
│  ┌─ Chrome (234 MB) • App                             │
│  └─ Slack (156 MB) • App                              │
│                                                         │
│  Files to be removed:  [⟳ Analyzing...]                │
│  ┌───────────────────────────────────────────────────┐ │
│  │ $ mole uninstall --dry-run Chrome Slack           │ │
│  │ Would remove: /Applications/Chrome.app            │ │
│  │ Would remove: ~/Library/Caches/Chrome             │ │
│  │ Would remove: ~/Library/Preferences/Chrome.plist  │ │
│  │ Would remove: /Applications/Slack.app             │ │
│  │ Would remove: ~/Library/Caches/Slack              │ │
│  │ Would remove: ~/Library/Logs/Slack                │ │
│  │ Total: 390 MB in 47 files                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│         [Cancel]  [🗑️ Uninstall 2 Apps]                │
└─────────────────────────────────────────────────────────┘
```

### 4. Executing State

#### Before
```
┌─────────────────────────────────────┐
│                                     │
│           [Spinner]                 │
│                                     │
│   Uninstalling Applications...      │
│                                     │
│  Please wait while we remove...     │
│                                     │
│     ℹ️  Do not close this window    │
│                                     │
└─────────────────────────────────────┘
```

#### After (Live Uninstall Progress)
```
┌─────────────────────────────────────────────────────────┐
│                    [Spinner]                            │
│          Uninstalling Applications...                   │
│     Please wait while we remove selected apps           │
│          ℹ️  Do not close this window                   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ $ mole uninstall Chrome Slack                     │ │
│  │ Removing Chrome.app...                            │ │
│  │ ✓ Removed /Applications/Chrome.app                │ │
│  │ ✓ Removed ~/Library/Caches/Chrome                 │ │
│  │ ✓ Removed ~/Library/Preferences/Chrome.plist      │ │
│  │ Removing Slack.app...                             │ │
│  │ ✓ Removed /Applications/Slack.app                 │ │
│  │ ✓ Removed ~/Library/Caches/Slack                  │ │
│  │ ✓ Removed ~/Library/Logs/Slack                    │ │
│  │ ✓ Uninstall complete                              │ │
│  │ Freed 390 MB of disk space                        │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Design Elements

### Glassmorphism Effects
- **Background**: `rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(24px)`
- **Border**: `1px solid rgba(255, 255, 255, 0.4)`
- **Shadow**: Multi-layer shadows for depth
- **Inset Highlight**: Top border glow for glass edge effect

### CLI Output Styling
- **Font**: SF Mono, Monaco, Cascadia Code (monospace)
- **Size**: 13px with 1.6 line-height
- **Color**: `--text-secondary` for normal output
- **Animation**: Fade-in from left (200ms) for each new line
- **First Line**: Blue and bold to indicate command prompt

### Color Coding (Future Enhancement)
- ✓ Success: Green (`--accent-success`)
- ⚠️ Warning: Amber (`--accent-warning`)
- ❌ Error: Red (`--accent-danger`)
- ℹ️ Info: Blue (`--accent-primary`)

### Spacing & Layout
- **Grid**: 60/40 split for idle state
- **Gaps**: 24px between major sections
- **Padding**: 16-24px for containers
- **Border Radius**: 12-16px for modern feel

### Animations
- **Spinner**: 1s linear infinite rotation
- **CLI Lines**: 200ms fade-in with slide
- **Hover**: 150ms smooth transitions
- **Page Transitions**: 400ms slide animations

## Responsive Behavior

### Desktop (>900px)
- Full grid layout with side-by-side columns
- Large visual icons
- Spacious CLI output containers

### Mobile (<900px)
- Stacked layout (single column)
- Smaller icons
- Compact spacing
- Full-width buttons

## Accessibility Features

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to cancel operations

### Screen Readers
- Semantic HTML structure
- ARIA labels for dynamic content
- Status announcements for state changes

### Visual
- High contrast ratios (WCAG AA)
- Clear focus indicators
- Reduced motion support
- Dark mode support

## Performance Optimizations

### Streaming
- Incremental DOM updates (not full re-renders)
- Efficient line-by-line appending
- Auto-scroll only when needed

### Memory
- Proper listener cleanup
- No memory leaks from IPC handlers
- Efficient event handling

### Rendering
- CSS animations (GPU accelerated)
- Minimal reflows/repaints
- Debounced scroll events

## Browser Compatibility

### Supported
- ✅ Electron (Chromium-based)
- ✅ Chrome/Edge (latest)
- ✅ Safari (latest)
- ✅ Firefox (latest)

### CSS Features Used
- CSS Grid
- Flexbox
- CSS Custom Properties
- Backdrop Filter (glassmorphism)
- CSS Animations
- Media Queries

## Dark Mode Support

All elements automatically adapt to system dark mode:
- Background colors inverted
- Text colors adjusted for contrast
- Shadows darkened
- Borders adjusted
- Accent colors lightened for visibility
