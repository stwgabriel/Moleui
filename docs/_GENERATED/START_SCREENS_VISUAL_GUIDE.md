# Start Screens Visual Guide

## Overview

This guide shows the visual design of the new start screens for Clean and Optimize pages.

## Clean Page Start Screen

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │                      │  │                      │        │
│  │  Clean               │  │                      │        │
│  │                      │  │        ✨            │        │
│  │  Deep clean your Mac │  │     (Sparkles)       │        │
│  │  to reclaim disk     │  │                      │        │
│  │  space and improve   │  │                      │        │
│  │  performance.        │  │                      │        │
│  │                      │  │                      │        │
│  │  💾 System Caches    │  │                      │        │
│  │  Remove temporary    │  │                      │        │
│  │  files and system    │  │                      │        │
│  │  caches              │  │                      │        │
│  │                      │  │                      │        │
│  │  🌐 Browser Data     │  │                      │        │
│  │  Clear browser       │  │                      │        │
│  │  caches, cookies,    │  │                      │        │
│  │  and history         │  │                      │        │
│  │                      │  │                      │        │
│  │  📄 Log Files        │  │                      │        │
│  │  Remove old system   │  │                      │        │
│  │  and application     │  │                      │        │
│  │  logs                │  │                      │        │
│  │                      │  │                      │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                               │
│              ┌──────────────────────┐                       │
│              │  Start Cleaning      │                       │
│              └──────────────────────┘                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Color Scheme

- **Primary Color**: Cyan (`#06b6d4`)
- **Background**: Glassmorphic surface with blur
- **Text**: Primary text on left, large icon on right
- **Button**: Primary action button (blue)

### Key Features

1. **System Caches** - Hard drive icon
2. **Browser Data** - Globe icon
3. **Log Files** - File text icon

## Optimize Page Start Screen

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │                      │  │                      │        │
│  │  Optimize            │  │                      │        │
│  │                      │  │        📊            │        │
│  │  Boost your Mac's    │  │      (Gauge)         │        │
│  │  performance with    │  │                      │        │
│  │  system optimization │  │                      │        │
│  │  tasks.              │  │                      │        │
│  │                      │  │                      │        │
│  │  ⚡ System           │  │                      │        │
│  │     Maintenance      │  │                      │        │
│  │  Rebuild indexes and │  │                      │        │
│  │  optimize databases  │  │                      │        │
│  │                      │  │                      │        │
│  │  💻 Memory           │  │                      │        │
│  │     Management       │  │                      │        │
│  │  Free up inactive    │  │                      │        │
│  │  memory for better   │  │                      │        │
│  │  performance         │  │                      │        │
│  │                      │  │                      │        │
│  │  🛡️  Disk Health     │  │                      │        │
│  │  Verify disk         │  │                      │        │
│  │  integrity and       │  │                      │        │
│  │  repair permissions  │  │                      │        │
│  │                      │  │                      │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                               │
│              ┌──────────────────────┐                       │
│              │  Start Optimization  │                       │
│              └──────────────────────┘                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Color Scheme

- **Primary Color**: Purple (`#8b5cf6`)
- **Background**: Glassmorphic surface with blur
- **Text**: Primary text on left, large icon on right
- **Button**: Primary action button (blue)

### Key Features

1. **System Maintenance** - Zap icon
2. **Memory Management** - CPU icon
3. **Disk Health** - Shield icon

## Comparison with Uninstall Page

All three pages now share the same start screen pattern:

| Feature | Uninstall | Clean | Optimize |
|---------|-----------|-------|----------|
| Layout | 60/40 grid | 60/40 grid | 60/40 grid |
| Icon | Package-X | Sparkles | Gauge |
| Color | Red | Cyan | Purple |
| Features | 3 items | 3 items | 3 items |
| Button | "Scan Applications" | "Start Cleaning" | "Start Optimization" |

## Design Tokens Used

### Spacing
- `--space-3` (12px) - Small gaps
- `--space-4` (16px) - Medium gaps
- `--space-6` (24px) - Large gaps
- `--space-8` (32px) - XL gaps

### Typography
- Page title: 48px, weight 700
- Description: 16px, line-height 1.6
- Feature title: 18px, weight 600
- Feature description: 14px

### Border Radius
- `--radius-xl` (20px) - Feature cards
- `--radius-md` (12px) - Button

### Colors
- `--clean-color`: #06b6d4 (Cyan)
- `--optimize-color`: #8b5cf6 (Purple)
- `--accent-primary`: #3b82f6 (Blue)
- `--text-primary`: #0f172a (Near black)
- `--text-secondary`: #475569 (Slate)

## Responsive Behavior

### Desktop (>768px)
- Two-column grid (60/40)
- Large icon (120px)
- Full feature descriptions

### Mobile (<768px)
- Single column stack
- Icon below content
- Smaller icon (80px)
- Compact spacing

## Animation Details

### Page Load
- Fade in: 250ms ease-smooth
- Slide up: translateY(20px) → 0

### Button Hover
- Transform: translateY(-2px)
- Shadow: elevation increase
- Duration: 150ms

### Icon
- Scale: 1.0 → 1.05 on hover
- Rotation: 0deg → 5deg
- Duration: 250ms

## Accessibility Features

### Semantic HTML
```html
<h1 class="page-title">Clean</h1>
<p class="page-description">Description</p>
<div class="info-list">
  <div class="info-item">
    <h3 class="info-item-title">Feature</h3>
    <p class="info-item-description">Details</p>
  </div>
</div>
```

### ARIA Labels
- Icons have descriptive labels
- Buttons have clear action text
- Headings create proper hierarchy

### Keyboard Navigation
- Tab order: Title → Features → Button
- Enter/Space activates button
- Focus indicators visible

### Color Contrast
- Text: 4.5:1 minimum (WCAG AA)
- Large text: 3:1 minimum
- Icons: sufficient contrast on backgrounds

## Implementation Notes

### State Management
Both pages use `hasStarted` flag:
- `false` → Show start screen
- `true` → Show selection screen

### Event Handling
```javascript
startBtn.addEventListener('click', () => {
  state.hasStarted = true;
  render();
});
```

### Reset Logic
```javascript
doneBtn.addEventListener('click', () => {
  state.hasStarted = false;
  // Reset other state...
  render();
});
```

## User Flow

```
Start Screen → Click Button → Selection Screen → Process → Complete → Start Screen
     ↑                                                                      ↓
     └──────────────────────────────────────────────────────────────────────┘
```

## Conclusion

The new start screens provide a consistent, beautiful introduction to the Clean and Optimize features, matching the design language established by the Uninstall page. They follow the Mole design system, maintain accessibility standards, and create a cohesive user experience across all major features.
