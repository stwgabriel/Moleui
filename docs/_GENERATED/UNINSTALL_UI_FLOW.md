# Uninstall Feature - UI Flow Guide

## Visual Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                      1. IDLE STAGE                          │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐         │
│  │  Uninstall          │  │                     │         │
│  │                     │  │    [PackageX Icon]  │         │
│  │  Completely remove  │  │                     │         │
│  │  applications...    │  │                     │         │
│  │                     │  └─────────────────────┘         │
│  │  ┌───────────────┐  │                                  │
│  │  │ 🔍 Deep Scan  │  │                                  │
│  │  └───────────────┘  │                                  │
│  │  ┌───────────────┐  │                                  │
│  │  │ 🗑️  Complete  │  │                                  │
│  │  │    Removal    │  │                                  │
│  │  └───────────────┘  │                                  │
│  │  ┌───────────────┐  │                                  │
│  │  │ 🛡️  Safe      │  │                                  │
│  │  │    Uninstall  │  │                                  │
│  │  └───────────────┘  │                                  │
│  └─────────────────────┘                                  │
│                                                             │
│              [Scan Applications Button]                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    User clicks button
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    2. LOADING STAGE                         │
│                                                             │
│                    ⏳ Analyzing Applications...             │
│                                                             │
│                    Scanning your system for                │
│                    installed applications                  │
│                                                             │
│                    ┌─────────────────┐                     │
│                    │ 📁 Scanning...  │                     │
│                    └─────────────────┘                     │
│                                                             │
│                    ✓ Found 42 applications                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Scan completes
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   3. SELECTION STAGE                        │
│                                                             │
│  Select Applications to Uninstall                          │
│  12 of 42 selected                                         │
│                                                             │
│  [Select All]  [Continue →]                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ☑ Visual Studio Code          [App]      512 MB    │  │
│  │   /Applications/Visual Studio Code.app              │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ ☑ Docker                    [Homebrew]    1.2 GB    │  │
│  │   /Applications/Docker.app                          │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ ☐ Slack                        [App]      256 MB    │  │
│  │   /Applications/Slack.app                           │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ ☑ Postman                      [App]      384 MB    │  │
│  │   /Applications/Postman.app                         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    User selects apps and clicks Continue
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  4. CONFIRMATION STAGE                      │
│                                                             │
│  ⚠️  Confirm Uninstallation                                 │
│  The following applications and their associated files     │
│  will be removed:                                          │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │ 📦 VS Code       │  │ 📦 Docker        │              │
│  │ 512 MB • App     │  │ 1.2 GB • Brew    │              │
│  └──────────────────┘  └──────────────────┘              │
│  ┌──────────────────┐                                      │
│  │ 📦 Postman       │                                      │
│  │ 384 MB • App     │                                      │
│  └──────────────────┘                                      │
│                                                             │
│  Analyzing files...  ⏳ Scanning...                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ✓ Visual Studio Code, 512 MB                        │  │
│  │   ✓ /Applications/Visual Studio Code.app            │  │
│  │   ✓ ~/Library/Application Support/Code              │  │
│  │   ✓ ~/Library/Caches/com.microsoft.VSCode           │  │
│  │   ⚠️  System: /Library/LaunchAgents/...             │  │
│  │                                                       │  │
│  │ ✓ Docker, 1.2 GB                                     │  │
│  │   ✓ /Applications/Docker.app                        │  │
│  │   ✓ ~/Library/Application Support/Docker            │  │
│  │   ...                                                │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  [✕ Cancel]              [🗑️  Uninstall 3 Apps]           │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    User clicks Uninstall
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   5. EXECUTING STAGE                        │
│                                                             │
│  Uninstalling Applications                                 │
│  Removing selected applications and their files...         │
│                                                             │
│  ℹ️  Do not close this window until the process completes  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Progress: 2 of 3                                     │  │
│  │ ████████████████░░░░░░░░  66%                       │  │
│  │                                                       │  │
│  │ ⏳ Uninstalling Docker...                            │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ✓ Visual Studio Code                                 │  │
│  │   ✓ /Applications/Visual Studio Code.app            │  │
│  │   ✓ ~/Library/Application Support/Code              │  │
│  │   ✓ ~/Library/Caches/com.microsoft.VSCode           │  │
│  │                                                       │  │
│  │ ⏳ Docker (in progress)                              │  │
│  │   ✓ /Applications/Docker.app                        │  │
│  │   ✓ ~/Library/Application Support/Docker            │  │
│  │   ...                                                │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Uninstall completes
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    6. RESULTS STAGE                         │
│                                                             │
│                    ✅ Uninstall Complete                    │
│                                                             │
│              Applications have been successfully           │
│                     removed                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Removed 3 apps, freed 2.1 GB                         │  │
│  │                                                       │  │
│  │ ✓ [1/3] Visual Studio Code                          │  │
│  │ ✓ [2/3] Docker                                       │  │
│  │ ✓ [3/3] Postman                                      │  │
│  │                                                       │  │
│  │ All selected applications have been removed.         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│                    [✓ Done]                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    User clicks Done
                            ↓
                    Returns to IDLE STAGE
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     ERROR STAGE                             │
│                                                             │
│                    ❌ Error Title                           │
│                                                             │
│              Detailed error message explaining             │
│                   what went wrong                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Error details:                                       │  │
│  │ - Stack trace or stderr output                       │  │
│  │ - Helpful context                                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│                    [Try Again]                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    User clicks Try Again
                            ↓
                    Returns to IDLE STAGE
```

## UI Component Breakdown

### Stage 1: Idle
- **Layout**: Two-column grid
- **Left**: Info cards with icons
- **Right**: Large circular gradient with PackageX icon
- **Action**: Single primary button at bottom

### Stage 2: Loading
- **Layout**: Centered content
- **Elements**: 
  - Animated spinner
  - Status text
  - Progress card (when available)

### Stage 3: Selection
- **Layout**: Header + scrollable list
- **Header**: 
  - Title and count
  - Action buttons (Select All, Continue)
- **List**: 
  - Checkable cards
  - App info (name, path, source, size)
  - Click anywhere to toggle

### Stage 4: Confirmation
- **Layout**: Header + selected apps grid + file list + actions
- **Header**: Warning icon and message
- **Grid**: Compact app cards (2 columns)
- **File List**: 
  - Scrollable output
  - Real-time updates
  - File type icons
- **Actions**: Cancel (secondary) + Uninstall (danger)

### Stage 5: Executing
- **Layout**: Header + progress + output
- **Progress**: 
  - Progress bar
  - Current operation
  - Status message
- **Output**: 
  - Scrollable list
  - Real-time updates
  - File removal confirmations

### Stage 6: Results
- **Layout**: Centered content
- **Elements**:
  - Success/error icon
  - Result message
  - Output log (scrollable)
  - Done button

## Color Coding

### Status Colors
- 🔵 **Blue** - Primary actions, info
- 🟢 **Green** - Success, completed
- 🟡 **Amber** - Warning, confirmation needed
- 🔴 **Red** - Danger, errors
- ⚪ **Gray** - Secondary, disabled

### Icon Meanings
- 📦 **Package** - Application
- 🔍 **Search** - Scanning/finding
- 🗑️ **Trash** - Deletion/removal
- 🛡️ **Shield** - Safety/protection
- ⚠️ **Warning** - Caution required
- ✓ **Check** - Completed/success
- ✕ **X** - Cancel/error
- ⏳ **Clock** - In progress
- ℹ️ **Info** - Information
- 📁 **Folder** - Directory/files

## Interaction Patterns

### Selection
- **Click card** → Toggle selection
- **Click checkbox** → Toggle selection
- **Click "Select All"** → Select/deselect all
- **Click "Continue"** → Proceed (if any selected)

### Confirmation
- **Auto-start** → Dry-run begins immediately
- **Real-time** → Output streams as it arrives
- **Click "Cancel"** → Return to selection
- **Click "Uninstall"** → Proceed with removal

### Execution
- **Auto-start** → Uninstall begins immediately
- **Real-time** → Progress updates as it happens
- **No cancel** → Must complete or fail
- **Auto-advance** → Moves to results when done

### Results
- **Click "Done"** → Return to idle
- **Scroll output** → Review full log

## Responsive Behavior

### Window Sizes
- **Minimum**: 1280x820px
- **Optimal**: 1440x900px+
- **Maximum**: Scales to full screen

### Adaptive Elements
- **App grid**: 2 columns → 1 column on narrow windows
- **Selected apps**: 2 columns → 1 column on narrow windows
- **Text**: Truncates with ellipsis when too long
- **Scrolling**: Enabled when content exceeds viewport

## Accessibility

### Keyboard Navigation
- **Tab** - Navigate between interactive elements
- **Space** - Toggle checkboxes
- **Enter** - Activate buttons
- **Escape** - Cancel (when available)

### Screen Readers
- Semantic HTML elements
- ARIA labels on icons
- Status announcements
- Progress updates

### Visual
- High contrast ratios (WCAG AA)
- Clear focus indicators
- Icon + text labels
- Color not sole indicator

## Performance

### Optimization Strategies
- **Virtual scrolling** - For 1000+ apps
- **Debounced updates** - Throttle output streaming
- **Lazy loading** - Load app icons on demand
- **Memoization** - Cache computed values

### Expected Performance
- **Scan**: 2-5 seconds for 100 apps
- **Dry-run**: 1-3 seconds per app
- **Execute**: 2-5 seconds per app
- **UI updates**: 60 FPS smooth animations

## Summary

The Uninstall UI provides a clear, step-by-step workflow that guides users from discovery to completion. Each stage has a specific purpose and clear visual hierarchy. Real-time feedback keeps users informed, while safety measures (dry-run preview, confirmation) prevent accidental deletions. The design follows modern macOS patterns with glassmorphism, smooth animations, and intuitive interactions.
