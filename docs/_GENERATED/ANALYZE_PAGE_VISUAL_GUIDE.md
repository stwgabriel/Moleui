# Analyze Page - Visual Design Guide

## Page Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     ANALYZE PAGE FLOW                        │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │ Start Screen │ (hasStarted = false)
    └──────┬───────┘
           │
           │ Click "Start Analysis"
           ▼
    ┌──────────────┐
    │ Path Select  │ (hasStarted = true, stage = 'idle')
    └──────┬───────┘
           │
           │ Click "Start Analysis"
           ▼
    ┌──────────────┐
    │   Scanning   │ (stage = 'scanning')
    └──────┬───────┘
           │
           │ Scan Complete
           ▼
    ┌──────────────┐
    │   Results    │ (stage = 'results')
    └──────┬───────┘
           │
           │ Click "Scan Again"
           └──────────┐
                      │
                      ▼
               ┌──────────────┐
               │ Path Select  │
               └──────────────┘
```

## Screen Layouts

### 1. Start Screen (Idle State)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────┐  ┌──────────────────────────┐   │
│  │                          │  │                           │   │
│  │  Analyze                 │  │                           │   │
│  │                          │  │      [Bar Chart Icon]     │   │
│  │  Visualize disk usage... │  │         (Large)           │   │
│  │                          │  │                           │   │
│  │  ┌────────────────────┐ │  │                           │   │
│  │  │ 📊 Visual Breakdown│ │  │                           │   │
│  │  │ See storage usage  │ │  │                           │   │
│  │  └────────────────────┘ │  │                           │   │
│  │                          │  │                           │   │
│  │  ┌────────────────────┐ │  │                           │   │
│  │  │ 🔍 Large Files     │ │  │                           │   │
│  │  │ Identify biggest   │ │  │                           │   │
│  │  └────────────────────┘ │  │                           │   │
│  │                          │  │                           │   │
│  │  ┌────────────────────┐ │  │                           │   │
│  │  │ 📁 Directory       │ │  │                           │   │
│  │  │ Navigate folders   │ │  │                           │   │
│  │  └────────────────────┘ │  │                           │   │
│  │                          │  │                           │   │
│  └─────────────────────────┘  └──────────────────────────┘   │
│                                                                 │
│                  ┌──────────────────────┐                      │
│                  │  Start Analysis  →   │                      │
│                  └──────────────────────┘                      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 2. Path Selection Screen

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        [Pie Chart Icon]                         │
│                                                                 │
│                     Analyze Disk Usage                          │
│          Scan your disk to visualize storage usage...          │
│                                                                 │
│                      SCAN LOCATION                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 📁  /Users/username                    [Browse] │         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ 💾 Entire    │  │ 🏠 Home      │  │ 📥 Downloads │        │
│  │    Disk      │  │    Folder    │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│                  ┌──────────────────────┐                      │
│                  │ ▶ Start Analysis     │                      │
│                  └──────────────────────┘                      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 3. Scanning State

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                      ┌─────────────┐                           │
│                      │   ⟳ 🔍     │  (Spinning border)         │
│                      └─────────────┘                           │
│                                                                 │
│                     Scanning Disk...                            │
│                   Analyzing /Users/username                     │
│                                                                 │
│              ┌────────────────────────────────┐                │
│              │████████████░░░░░░░░░░░░░░░░░░│                │
│              └────────────────────────────────┘                │
│                        45% complete                             │
│                                                                 │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 4. Results Screen

```
┌────────────────────────────────────────────────────────────────┐
│                     Storage Analysis                            │
│              /Users/username • 256.4 GB total                   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ 💾 256.4 GB  │  │ 📊 7         │  │ 📄 15        │        │
│  │ Total Size   │  │ Categories   │  │ Large Files  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│  📊 Storage by Category                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 📦 Applications          45.2 GB              17.6%      │ │
│  │ ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 📄 Documents             38.1 GB              14.9%      │ │
│  │ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 🎬 Media                 92.3 GB              36.0%      │ │
│  │ ████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░ │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📄 Largest Files                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 📦 VirtualBox.dmg                              8.2 GB    │ │
│  │    /Users/username/Downloads/VirtualBox.dmg              │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 📦 Xcode.app                                   7.8 GB    │ │
│  │    /Applications/Xcode.app                               │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 📁 node_modules                                6.4 GB    │ │
│  │    /Users/username/projects/app/node_modules             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│         ┌──────────────┐        ┌──────────────┐              │
│         │ 🔄 Scan Again│        │ 📥 Export    │              │
│         └──────────────┘        └──────────────┘              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

## Color Palette

### Primary Colors
```
Analyze Pink:     #ec4899  ━━━━━━━━━━  Main accent color
Pink Light:       #f472b6  ━━━━━━━━━━  Gradient end
Pink Background:  rgba(236, 72, 153, 0.08)  Background tint
```

### Category Colors
```
Applications:     #3b82f6  ━━━━━━━━━━  Blue
Documents:        #10b981  ━━━━━━━━━━  Green
Media:            #ec4899  ━━━━━━━━━━  Pink
Developer:        #8b5cf6  ━━━━━━━━━━  Purple
System:           #06b6d4  ━━━━━━━━━━  Cyan
Caches:           #f59e0b  ━━━━━━━━━━  Amber
Other:            #64748b  ━━━━━━━━━━  Slate
```

## Component Specifications

### Summary Cards
```
┌─────────────────────────┐
│  💾                     │  Icon: 48x48px
│                         │  Background: rgba(236, 72, 153, 0.12)
│  256.4 GB               │  Value: 24px, bold, monospace
│  Total Size             │  Label: 12px, uppercase, 0.05em spacing
└─────────────────────────┘
Padding: 20px
Border Radius: 20px
Border: 1px solid rgba(255, 255, 255, 0.3)
Shadow: 0 4px 16px rgba(0, 0, 0, 0.08)
```

### Category Item
```
┌────────────────────────────────────────────────────┐
│  📦  Applications          45.2 GB        17.6%    │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────────────────────┘
Icon: 40x40px, colored background
Name: 15px, semi-bold
Size: 13px, monospace
Percentage: 18px, bold, monospace
Progress Bar: 6px height, rounded
```

### File Item
```
┌────────────────────────────────────────────────────┐
│  📦  VirtualBox.dmg                      8.2 GB    │
│      /Users/username/Downloads/VirtualBox.dmg      │
└────────────────────────────────────────────────────┘
Icon: 36x36px, colored background
Name: 14px, medium weight
Path: 12px, monospace, tertiary color
Size: 14px, semi-bold, monospace
```

### Quick Path Button
```
┌──────────────────┐
│  💾 Entire Disk  │
└──────────────────┘
Padding: 12px 16px
Border Radius: 12px
Border: 1px solid rgba(0, 0, 0, 0.08)
Font: 13px, medium weight
Hover: Lift 2px, pink tint
```

### Action Button
```
┌────────────────────────┐
│  ▶ Start Analysis      │
└────────────────────────┘
Min Width: 280px
Padding: 16px 32px
Border Radius: 9999px (full)
Background: #3b82f6 (primary blue)
Font: 15px, semi-bold
Shadow: 0 4px 16px rgba(0, 0, 0, 0.08)
Hover: Lift 2px, accent shadow
```

## Animation Timings

### Page Transitions
```
fadeIn:           250ms cubic-bezier(0.4, 0, 0.2, 1)
slideInUp:        400ms cubic-bezier(0.4, 0, 0.2, 1)
slideOutDown:     400ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Hover Effects
```
Button Hover:     150ms cubic-bezier(0, 0, 0.2, 1)
Card Hover:       250ms cubic-bezier(0.4, 0, 0.2, 1)
Icon Hover:       250ms cubic-bezier(0.175, 0.885, 0.32, 1.275)
```

### Progress Animations
```
Spinner Rotation: 1s linear infinite
Progress Bar:     250ms cubic-bezier(0.4, 0, 0.2, 1)
```

## Spacing System

### Vertical Spacing
```
Between sections:     24px (--space-6)
Between cards:        16px (--space-4)
Between list items:   12px (--space-3)
Card padding:         20px (--space-5)
Button padding:       16px (--space-4)
```

### Horizontal Spacing
```
Icon to text:         12px (--space-3)
Button gap:           12px (--space-3)
Grid gap:             16px (--space-4)
```

## Responsive Breakpoints

### Desktop (> 900px)
- Summary: 3 columns
- Full sidebar visible
- Large icons and text

### Mobile (≤ 900px)
- Summary: 1 column
- Sidebar collapsed
- Smaller icons and text
- Vertical button stack

## Glassmorphism Effects

### Surface Properties
```css
background: rgba(255, 255, 255, 0.85)
backdrop-filter: blur(20px) saturate(180%)
border: 1px solid rgba(255, 255, 255, 0.3)
box-shadow: 
  0 8px 32px rgba(0, 0, 0, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.5)
```

### Elevated Surface
```css
background: rgba(255, 255, 255, 0.95)
backdrop-filter: blur(24px) saturate(200%)
border: 1px solid rgba(255, 255, 255, 0.4)
box-shadow: 
  0 20px 60px rgba(0, 0, 0, 0.12),
  0 8px 24px rgba(0, 0, 0, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.6)
```

## Icon Usage

### Lucide Icons
```
Start Screen:     bar-chart-3 (large visual)
Idle State:       pie-chart (main icon)
Scanning:         search (with spinner)
Path Input:       folder
Browse Button:    folder-open
Quick Paths:      hard-drive, home, download
Categories:       package, file-text, image, code, hard-drive, database, folder
Files:            file, package, folder
Actions:          play, refresh-cw, download
Summary:          hard-drive, folder, file
Section Headers:  pie-chart, file-text
```

## Accessibility Features

### Keyboard Navigation
- Tab order: Start button → Path input → Browse → Quick paths → Start scan
- Enter key: Activates focused button
- Escape key: Cancels current operation (future)

### Screen Reader Labels
```html
<button aria-label="Start disk analysis">Start Analysis</button>
<input aria-label="Scan path" placeholder="/Users/username">
<div role="progressbar" aria-valuenow="45" aria-valuemin="0" aria-valuemax="100">
```

### Focus Indicators
```css
*:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

## Dark Mode Adaptations

### Background Colors
```
Light:  #f0f4f8 → Dark:  #0f172a
Light:  #e1e8ed → Dark:  #1e293b
```

### Surface Colors
```
Light:  rgba(255, 255, 255, 0.85) → Dark:  rgba(30, 41, 59, 0.8)
Light:  rgba(255, 255, 255, 0.95) → Dark:  rgba(51, 65, 85, 0.9)
```

### Text Colors
```
Primary:    #0f172a → #f8fafc
Secondary:  #475569 → #cbd5e1
Tertiary:   #94a3b8 → #64748b
```

### Shadows
```
Light:  rgba(0, 0, 0, 0.08) → Dark:  rgba(0, 0, 0, 0.4)
Light:  rgba(0, 0, 0, 0.12) → Dark:  rgba(0, 0, 0, 0.5)
```

## Performance Considerations

### Optimization Techniques
1. **CSS Containment**: Use `contain: layout style` on cards
2. **Will-Change**: Apply to animated elements
3. **Transform**: Use for animations (GPU accelerated)
4. **Debouncing**: Throttle scroll events
5. **Virtual Scrolling**: For 1000+ items (future)

### Loading States
- Skeleton screens for initial load
- Progressive rendering for large lists
- Lazy loading for off-screen content

## Browser Compatibility

### Supported Features
- CSS Grid (all modern browsers)
- CSS Custom Properties (all modern browsers)
- Backdrop Filter (Safari 9+, Chrome 76+, Firefox 103+)
- Flexbox (all modern browsers)

### Fallbacks
```css
@supports not (backdrop-filter: blur(20px)) {
  .surface {
    background: rgba(255, 255, 255, 0.95);
  }
}
```

## Conclusion

The Analyze page follows a consistent visual language with:
- ✅ Modern glassmorphism design
- ✅ Smooth animations and transitions
- ✅ Responsive layout for all screen sizes
- ✅ Accessible keyboard navigation
- ✅ Dark mode support
- ✅ Performance optimizations
- ✅ Cross-browser compatibility

All design decisions align with the established patterns from Clean, Optimize, Status, and Uninstall pages, creating a cohesive user experience throughout the application.
