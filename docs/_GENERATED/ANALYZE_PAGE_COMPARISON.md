# Analyze Page - UI Pattern Comparison

## Overview
This document shows how the Analyze page now follows the same UI patterns as the Clean, Optimize, Status, and Uninstall pages, creating a consistent user experience throughout the Mole desktop application.

---

## Start Screen Pattern

All pages now follow the same start screen layout with a left info panel and right visual panel.

### Clean Page
```
┌─────────────────────────────────────────────────────────┐
│  Clean                              [Sparkles Icon]     │
│  Deep clean your Mac...                                 │
│                                                          │
│  ✓ System Caches                                        │
│  ✓ Browser Data                                         │
│  ✓ Log Files                                            │
│                                                          │
│              [Start Cleaning]                           │
└─────────────────────────────────────────────────────────┘
```

### Optimize Page
```
┌─────────────────────────────────────────────────────────┐
│  Optimize                           [Gauge Icon]        │
│  Boost your Mac's performance...                        │
│                                                          │
│  ✓ System Maintenance                                   │
│  ✓ Memory Management                                    │
│  ✓ Disk Health                                          │
│                                                          │
│              [Start Optimization]                       │
└─────────────────────────────────────────────────────────┘
```

### Status Page
```
┌─────────────────────────────────────────────────────────┐
│  Status                             [Activity Icon]     │
│  Monitor your Mac's health...                           │
│                                                          │
│  ✓ CPU & Memory                                         │
│  ✓ Disk & Network                                       │
│  ✓ Battery Health                                       │
│                                                          │
│              [Start Monitoring]                         │
└─────────────────────────────────────────────────────────┘
```

### Uninstall Page
```
┌─────────────────────────────────────────────────────────┐
│  Uninstall                          [Package-X Icon]    │
│  Completely remove applications...                      │
│                                                          │
│  ✓ Deep Scan                                            │
│  ✓ Complete Removal                                     │
│  ✓ Safe Uninstall                                       │
│                                                          │
│              [Scan Applications]                        │
└─────────────────────────────────────────────────────────┘
```

### Analyze Page (NEW)
```
┌─────────────────────────────────────────────────────────┐
│  Analyze                            [Bar-Chart Icon]    │
│  Visualize disk usage...                                │
│                                                          │
│  ✓ Visual Breakdown                                     │
│  ✓ Large Files                                          │
│  ✓ Directory Explorer                                   │
│                                                          │
│              [Start Analysis]                           │
└─────────────────────────────────────────────────────────┘
```

---

## Color Scheme Consistency

Each page has its own accent color while maintaining the same design patterns.

| Page      | Accent Color | Hex Code | Usage                    |
|-----------|--------------|----------|--------------------------|
| Clean     | Cyan         | #06b6d4  | Icons, progress bars     |
| Optimize  | Purple       | #8b5cf6  | Icons, progress bars     |
| Status    | Green        | #10b981  | Icons, progress bars     |
| Uninstall | Red          | #ef4444  | Icons, warning states    |
| **Analyze** | **Pink**   | **#ec4899** | **Icons, progress bars** |

---

## Component Comparison

### Summary Cards

All pages use the same 3-column summary card layout in their results/monitoring views.

#### Clean Page - Results
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 💾 5.2 GB    │  │ 📄 1,234     │  │ ⏱ 2m 34s    │
│ Total        │  │ Total Items  │  │ Duration     │
└──────────────┘  └──────────────┘  └──────────────┘
```

#### Optimize Page - Results
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ ✅ 8         │  │ ⏱ 5m 12s    │  │ 🎯 High      │
│ Completed    │  │ Duration     │  │ Impact       │
└──────────────┘  └──────────────┘  └──────────────┘
```

#### Status Page - Monitoring
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 💻 45.2%     │  │ 🧠 62.1%     │  │ 💾 78.3%     │
│ CPU          │  │ Memory       │  │ Disk         │
└──────────────┘  └──────────────┘  └──────────────┘
```

#### Uninstall Page - Results
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 🗑 5 apps    │  │ 💾 2.3 GB    │  │ ⏱ 1m 45s    │
│ Removed      │  │ Freed        │  │ Duration     │
└──────────────┘  └──────────────┘  └──────────────┘
```

#### Analyze Page - Results (NEW)
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 💾 256.4 GB  │  │ 📊 7         │  │ 📄 15        │
│ Total Size   │  │ Categories   │  │ Large Files  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Progress Indicators

All pages use consistent progress indicator styling during operations.

### Clean Page - Cleaning
```
        ⟳ 🗑
   Cleaning...
Removing system caches
████████████░░░░░░░░
  2.1 GB of 5.2 GB
```

### Optimize Page - Optimizing
```
        ⟳ ⚡
Optimizing System...
Rebuilding Spotlight
████████░░░░░░░░░░░░
   3 of 8 tasks
```

### Status Page - Loading
```
        ⟳ 📊
Loading Metrics...
Collecting system data
████████████████████
```

### Uninstall Page - Scanning
```
        ⟳ 🔍
Analyzing Applications...
Scanning directories
████████████░░░░░░░░
```

### Analyze Page - Scanning (NEW)
```
        ⟳ 🔍
Scanning Disk...
Analyzing /Users/username
████████████░░░░░░░░
   45% complete
```

---

## List Item Patterns

All pages use similar list item designs with icons, titles, and metadata.

### Clean Page - Category List
```
┌────────────────────────────────────────────────┐
│ 💾 System Caches          1.2 GB              │
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├────────────────────────────────────────────────┤
│ 🌐 Browser Data           2.3 GB              │
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────────────────┘
```

### Optimize Page - Task List
```
┌────────────────────────────────────────────────┐
│ 🔍 Rebuild Spotlight      [High Impact]       │
│    Rebuild search index for faster searches   │
├────────────────────────────────────────────────┤
│ 🛡 Repair Permissions     [Medium Impact]     │
│    Fix file permissions and access rights     │
└────────────────────────────────────────────────┘
```

### Uninstall Page - App List
```
┌────────────────────────────────────────────────┐
│ ☑ Slack.app               [App] 245 MB        │
│   /Applications/Slack.app                      │
├────────────────────────────────────────────────┤
│ ☑ Docker.app              [App] 1.2 GB        │
│   /Applications/Docker.app                     │
└────────────────────────────────────────────────┘
```

### Analyze Page - Category List (NEW)
```
┌────────────────────────────────────────────────┐
│ 📦 Applications           45.2 GB    17.6%    │
│ ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├────────────────────────────────────────────────┤
│ 🎬 Media                  92.3 GB    36.0%    │
│ ████████████████████████████████░░░░░░░░░░░ │
└────────────────────────────────────────────────┘
```

### Analyze Page - File List (NEW)
```
┌────────────────────────────────────────────────┐
│ 📦 VirtualBox.dmg                    8.2 GB   │
│    /Users/username/Downloads/VirtualBox.dmg   │
├────────────────────────────────────────────────┤
│ 📦 Xcode.app                         7.8 GB   │
│    /Applications/Xcode.app                     │
└────────────────────────────────────────────────┘
```

---

## Button Styles

All pages use the same button hierarchy and styling.

### Primary Action Button
```css
/* Used for main actions like "Start", "Clean Now", "Uninstall" */
background: var(--accent-primary);
color: white;
padding: 16px 32px;
border-radius: 9999px;
font-weight: 600;
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
```

**Examples:**
- Clean: "Start Cleaning", "Clean Now"
- Optimize: "Start Optimization", "Optimize"
- Status: "Start Monitoring"
- Uninstall: "Scan Applications", "Uninstall"
- **Analyze: "Start Analysis"** ✅

### Secondary Action Button
```css
/* Used for alternative actions like "Back", "Cancel", "Export" */
background: var(--surface-elevated);
color: var(--text-primary);
padding: 12px 20px;
border-radius: 12px;
border: 1px solid rgba(0, 0, 0, 0.08);
```

**Examples:**
- Clean: "Back", "Select All"
- Optimize: "Select Recommended"
- Status: "Stop"
- Uninstall: "Cancel", "Select All"
- **Analyze: "Scan Again", "Export Report"** ✅

---

## Glassmorphism Effects

All pages use the same glassmorphism styling for cards and surfaces.

### Surface Properties (Consistent Across All Pages)
```css
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.3);
box-shadow: 
  0 8px 32px rgba(0, 0, 0, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.5);
border-radius: 16px-20px;
```

### Applied To:
- ✅ Summary cards
- ✅ Category/task cards
- ✅ List items
- ✅ Progress containers
- ✅ Info panels

---

## Animation Consistency

All pages use the same animation timings and easing functions.

### Page Transitions
```css
fadeIn: 250ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Hover Effects
```css
Button Hover:  150ms cubic-bezier(0, 0, 0.2, 1)
Card Hover:    250ms cubic-bezier(0.4, 0, 0.2, 1)
Icon Hover:    250ms cubic-bezier(0.175, 0.885, 0.32, 1.275)
```

### Transform Effects
```css
Lift:   translateY(-2px)
Slide:  translateX(4px)
Scale:  scale(1.05)
Rotate: rotate(5deg)
```

---

## Responsive Behavior

All pages adapt the same way on mobile devices.

### Desktop (> 900px)
- ✅ 3-column summary grid
- ✅ Full sidebar visible
- ✅ Large icons (48px-60px)
- ✅ Horizontal button layouts

### Mobile (≤ 900px)
- ✅ 1-column summary grid
- ✅ Sidebar collapsed
- ✅ Smaller icons (36px-40px)
- ✅ Vertical button stacks

---

## Dark Mode Adaptation

All pages use the same dark mode color transformations.

### Background Colors
```
Light: #f0f4f8 → Dark: #0f172a
Light: #e1e8ed → Dark: #1e293b
```

### Surface Colors
```
Light: rgba(255, 255, 255, 0.85) → Dark: rgba(30, 41, 59, 0.8)
Light: rgba(255, 255, 255, 0.95) → Dark: rgba(51, 65, 85, 0.9)
```

### Text Colors
```
Primary:   #0f172a → #f8fafc
Secondary: #475569 → #cbd5e1
Tertiary:  #94a3b8 → #64748b
```

---

## State Flow Comparison

All pages follow similar state progression patterns.

### Clean Page
```
Start → Selection → Scanning → Results → Cleaning → Complete
```

### Optimize Page
```
Start → Selection → Optimizing → Complete
```

### Status Page
```
Start → Monitoring (continuous)
```

### Uninstall Page
```
Start → Loading → Selection → Confirmation → Executing → Results
```

### Analyze Page (NEW)
```
Start → Path Selection → Scanning → Results
```

---

## Icon Usage Patterns

All pages use Lucide icons consistently.

### Start Screen Icons (Large Visual)
- Clean: `sparkles`
- Optimize: `gauge`
- Status: `activity`
- Uninstall: `package-x`
- **Analyze: `bar-chart-3`** ✅

### Feature Card Icons
- Clean: `hard-drive`, `globe`, `file-text`
- Optimize: `zap`, `cpu`, `shield`
- Status: `cpu`, `hard-drive`, `battery`
- Uninstall: `search`, `trash`, `shield`
- **Analyze: `pie-chart`, `file-search`, `folder-tree`** ✅

### Action Button Icons
- Clean: `sparkles`, `trash-2`, `arrow-left`
- Optimize: `zap`, `star`
- Status: `activity`, `square`
- Uninstall: `search`, `trash-2`, `x`
- **Analyze: `play`, `refresh-cw`, `download`** ✅

---

## Accessibility Compliance

All pages meet the same accessibility standards.

### Keyboard Navigation
- ✅ Tab order follows visual hierarchy
- ✅ Enter/Space activates buttons
- ✅ Escape cancels operations (where applicable)

### Focus Indicators
```css
*:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  border-radius: 8px;
}
```

### Color Contrast
- ✅ Text: 4.5:1 minimum (WCAG AA)
- ✅ Large text: 3:1 minimum (WCAG AA)
- ✅ UI components: 3:1 minimum (WCAG AA)

### Screen Reader Support
- ✅ Semantic HTML structure
- ✅ ARIA labels on interactive elements
- ✅ Icon alternatives with text

---

## Typography Consistency

All pages use the same font hierarchy.

### Headings
```
Page Title:     36px / 700 / -0.025em
Section Title:  22px / 600 / -0.02em
Card Title:     18px / 600 / -0.01em
```

### Body Text
```
Large:   16px / 400 / 1.6
Default: 14px / 400 / 1.6
Small:   13px / 400 / 1.5
Caption: 12px / 500 / 1.4
```

### Data Display
```
Large Value:  28px / 700 / monospace
Medium Value: 18px / 700 / monospace
Small Value:  14px / 600 / monospace
```

---

## Spacing Consistency

All pages use the same spacing scale.

### Vertical Spacing
```
Between sections:  24px (--space-6)
Between cards:     16px (--space-4)
Between items:     12px (--space-3)
Card padding:      20px (--space-5)
```

### Horizontal Spacing
```
Icon to text:      12px (--space-3)
Button gap:        12px (--space-3)
Grid gap:          16px (--space-4)
```

---

## Summary

The Analyze page now **perfectly matches** the UI patterns established by the other pages:

| Feature | Clean | Optimize | Status | Uninstall | Analyze |
|---------|-------|----------|--------|-----------|---------|
| Start Screen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Summary Cards | ✅ | ✅ | ✅ | ✅ | ✅ |
| Progress Indicator | ✅ | ✅ | ✅ | ✅ | ✅ |
| List Items | ✅ | ✅ | ✅ | ✅ | ✅ |
| Glassmorphism | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dark Mode | ✅ | ✅ | ✅ | ✅ | ✅ |
| Responsive | ✅ | ✅ | ✅ | ✅ | ✅ |
| Accessibility | ✅ | ✅ | ✅ | ✅ | ✅ |
| Animations | ✅ | ✅ | ✅ | ✅ | ✅ |
| Typography | ✅ | ✅ | ✅ | ✅ | ✅ |
| Spacing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Colors | ✅ | ✅ | ✅ | ✅ | ✅ |

**Result**: The Analyze page is now **fully consistent** with the rest of the Mole desktop application, providing users with a familiar and cohesive experience across all features.
