# Optimize Page Visual Guide

## Screen 1: Task Selection

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              Select Optimization Tasks                          │
│         Choose tasks to improve your Mac's performance          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐           │
│  │ 🔍 Rebuild Spotlight │  │ 🛡️  Repair Disk      │           │
│  │    Index             │  │    Permissions       │           │
│  │                      │  │                      │           │
│  │ Rebuild Spotlight    │  │ Fix file permissions │           │
│  │ search index for     │  │ and access rights    │           │
│  │ faster searches      │  │                      │           │
│  │                      │  │                      │           │
│  │ [HIGH IMPACT] [LONG] │  │ [MEDIUM] [MEDIUM]    │           │
│  │                   ○  │  │                   ✓  │           │
│  └──────────────────────┘  └──────────────────────┘           │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐           │
│  │ 🌐 Flush DNS Cache   │  │ 💾 Optimize          │           │
│  │                      │  │    Databases         │           │
│  │ Clear DNS cache for  │  │                      │           │
│  │ better network       │  │ Rebuild and optimize │           │
│  │ performance          │  │ system databases     │           │
│  │                      │  │                      │           │
│  │ [LOW] [QUICK]        │  │ [HIGH] [MEDIUM]      │           │
│  │                   ○  │  │                   ✓  │           │
│  └──────────────────────┘  └──────────────────────┘           │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐           │
│  │ 🔤 Clear Font Cache  │  │ 🧠 Purge Inactive    │           │
│  │                      │  │    Memory            │           │
│  │ Rebuild font cache   │  │                      │           │
│  │ to fix rendering     │  │ Free up inactive     │           │
│  │ issues               │  │ memory for better    │           │
│  │                      │  │ performance          │           │
│  │ [LOW] [QUICK]        │  │ [MEDIUM] [QUICK]     │           │
│  │                   ○  │  │                   ✓  │           │
│  └──────────────────────┘  └──────────────────────┘           │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐           │
│  │ 💿 Verify Disk       │  │ 🚀 Optimize Login    │           │
│  │                      │  │    Items             │           │
│  │ Check disk for       │  │                      │           │
│  │ errors and           │  │ Review and optimize  │           │
│  │ inconsistencies      │  │ startup applications │           │
│  │                      │  │                      │           │
│  │ [HIGH] [LONG]        │  │ [MEDIUM] [QUICK]     │           │
│  │                   ○  │  │                   ○  │           │
│  └──────────────────────┘  └──────────────────────┘           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│         [⚡ Optimize (3)]  [⭐ Select Recommended]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Details

**Task Cards:**
- Glassmorphic background with blur effect
- 2px transparent border (purple on selection)
- Icon with custom color background (48x48px)
- Task name in bold (16px)
- Description in secondary color (13px)
- Impact badge (HIGH/MEDIUM/LOW) with color coding
- Duration badge (LONG/MEDIUM/QUICK)
- Checkbox indicator (circle → check-circle)

**Hover Effects:**
- Card lifts up 4px
- Shadow increases
- Border shows purple tint
- Icon scales 1.1x and rotates 5°

**Selected State:**
- Purple border (--optimize-color)
- Purple background tint (8% opacity)
- Purple glow shadow
- Checkmark icon scales 1.2x

**Buttons:**
- "Optimize (N)" - Primary purple button, disabled when N=0
- "Select Recommended" - Secondary button, selects high/medium tasks

---

## Screen 2: Optimizing Progress

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                        ┌─────────┐                              │
│                        │    ⚡   │                              │
│                        │  ◐◐◐◐   │  ← Spinning animation       │
│                        └─────────┘                              │
│                                                                 │
│                   Optimizing System...                          │
│                                                                 │
│                  Repair Disk Permissions                        │
│                                                                 │
│              ████████████░░░░░░░░░░░░░░                        │
│                                                                 │
│                    2 of 3 tasks completed                       │
│                                                                 │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Details

**Progress Icon:**
- 120x120px container
- Purple background tint (8% opacity)
- Zap icon (48x48px) in center
- Spinning border animation (1s linear infinite)

**Text:**
- Title: "Optimizing System..." (28px, bold)
- Subtitle: Current task name (15px, secondary color)
- Counter: "X of Y tasks completed" (14px, monospace)

**Progress Bar:**
- 400px wide, 8px tall
- Rounded ends (full radius)
- Purple gradient fill
- Smooth width transition (250ms)

---

## Screen 3: Optimization Complete

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                        ┌─────────┐                              │
│                        │    ✓    │  ← Bounce animation         │
│                        │         │                              │
│                        └─────────┘                              │
│                                                                 │
│                 Optimization Complete!                          │
│                                                                 │
│          Successfully completed 3 optimization tasks            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ 🛡️  Repair Disk Permissions                       │ │  │
│  │  │    ✓ Completed successfully                       │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ 💾 Optimize Databases                             │ │  │
│  │  │    ✓ Completed successfully                       │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ 🧠 Purge Inactive Memory                          │ │  │
│  │  │    ✓ Completed successfully                       │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                        [✓ Done]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Details

**Success Icon:**
- 120x120px container
- Green background (12% opacity)
- Check-circle icon (60x60px)
- Bounce-in animation (600ms with overshoot)

**Title:**
- "Optimization Complete!" (32px, bold)
- Subtitle with task count (16px, secondary)

**Completed Tasks List:**
- Scrollable container (max 400px height)
- Each task card slides in from right (400ms staggered)
- Task icon with original color
- Task name (15px, bold)
- Green checkmark + "Completed successfully" (13px)
- Green border accent (1px)

**Done Button:**
- Primary button style
- Returns to selection screen
- Resets all state

---

## Color Palette

### Task Colors
- **Rebuild Spotlight**: `#3b82f6` (Blue)
- **Repair Permissions**: `#10b981` (Green)
- **Flush DNS**: `#06b6d4` (Cyan)
- **Optimize Databases**: `#8b5cf6` (Purple)
- **Clear Font Cache**: `#f59e0b` (Amber)
- **Purge Memory**: `#ec4899` (Pink)
- **Verify Disk**: `#ef4444` (Red)
- **Optimize Login**: `#14b8a6` (Teal)

### Impact Badges
- **High Impact**: Red background, red text
- **Medium Impact**: Amber background, amber text
- **Low Impact**: Blue background, blue text

### Duration Badges
- **All Durations**: Gray background, secondary text

---

## Animations

### Task Card Hover
```css
transform: translateY(-4px);
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
transition: 250ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Task Card Selection
```css
border-color: #8b5cf6;
background: rgba(139, 92, 246, 0.08);
box-shadow: 0 8px 24px rgba(139, 92, 246, 0.25);
```

### Icon Hover
```css
transform: scale(1.1) rotate(5deg);
transition: 150ms cubic-bezier(0, 0, 0.2, 1);
```

### Progress Spinner
```css
animation: spin 1s linear infinite;
border: 4px solid rgba(139, 92, 246, 0.1);
border-top-color: #8b5cf6;
```

### Completion Icon
```css
animation: scaleInBounce 600ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
/* Bounces in with overshoot */
```

### Task List Slide-In
```css
animation: slideInRight 400ms cubic-bezier(0.4, 0, 0.2, 1);
/* Slides from right with smooth easing */
```

---

## Responsive Breakpoints

### Desktop (>900px)
- Grid: 2-3 columns
- Full descriptions
- Large icons (48px)

### Tablet (600-900px)
- Grid: 2 columns
- Compact descriptions
- Medium icons (40px)

### Mobile (<600px)
- Grid: 1 column
- Stacked layout
- Smaller icons (36px)
- Reduced padding

---

## Accessibility Features

- ✅ Semantic HTML structure
- ✅ ARIA labels on all interactive elements
- ✅ Keyboard navigation (Tab, Enter, Space)
- ✅ Focus indicators (2px blue outline)
- ✅ Color contrast WCAG AA compliant
- ✅ Reduced motion support
- ✅ Screen reader announcements

---

## Dark Mode

All colors automatically adjust via CSS custom properties:

- Backgrounds become darker
- Borders become more subtle
- Shadows become deeper
- Text contrast maintained
- Glassmorphism adjusted for dark backgrounds

---

## Performance

- **Smooth 60fps animations** - Hardware accelerated transforms
- **Efficient re-renders** - Only updates changed elements
- **Lazy icon loading** - Lucide icons loaded on demand
- **Debounced output parsing** - Prevents UI thrashing
- **Memory cleanup** - Removes event listeners on destroy

---

## User Flow

1. **Select Tasks** → User clicks task cards to select
2. **Click Optimize** → Transitions to progress screen
3. **Watch Progress** → Real-time updates from stdout
4. **View Results** → Animated completion screen
5. **Click Done** → Returns to selection for next run

---

## Integration

The optimize page integrates seamlessly with:

- ✅ Sidebar navigation
- ✅ Page transitions (slide up/down)
- ✅ Lucide icon system
- ✅ IPC communication
- ✅ Design system variables
- ✅ Dark mode toggle
- ✅ Responsive layout

---

## Summary

The Optimize page provides a **beautiful, intuitive, and performant** interface for system optimization tasks. It follows the Mole Desktop design language with glassmorphic surfaces, smooth animations, and excellent user feedback throughout the optimization process.
