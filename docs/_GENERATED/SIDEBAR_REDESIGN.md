# Sidebar Redesign - Apple-like Design

## Overview

Updated the sidebar to follow a more Apple-like design language with improved layout and interaction patterns using Lucide icons.

## Key Changes

### 1. **Collapse Button Position & Visibility**
- **Expanded State**: Collapse button positioned at top-right of sidebar using `PanelLeftClose` icon
- **Collapsed State**: Button hidden from sidebar; floating `PanelLeftOpen` button appears at top-left of page content
- Uses Lucide icons for consistent design language

### 2. **Menu Items Vertical Centering**
- Navigation items now centered vertically using `flex-col justify-center`
- Creates balanced, Apple-like sidebar appearance
- Items remain centered regardless of sidebar state

### 3. **App Branding**
- Footer displays "Moleui" as the app name
- Consistent with package.json productName: "Moleui Desktop"
- HTML title: "Moleui Desktop"

### 4. **Refined Styling**

#### Sidebar Container
- Reduced width: `240px` (expanded) → `72px` (collapsed)
- Increased border radius: `20px` for softer, more modern look
- Smooth transitions: `300ms` duration with ease-smooth timing

#### Navigation Items
- Cleaner hover states with subtle background color
- Active indicator: Left-side accent bar (1px width, 5px height)
- Icon scale animation on hover: `scale(1.1)`
- Removed horizontal translation on hover for cleaner feel
- Better spacing: `gap-3` between icon and label

#### Collapse Button
- Lucide `PanelLeftClose` icon (5x5) for collapse action
- Lucide `PanelLeftOpen` icon (5x5) for expand action
- Hidden when sidebar is collapsed (cleaner appearance)
- Floating button appears on page content when collapsed
- Scale animations: `hover:scale-105`, `active:scale-95`
- Rounded corners: `rounded-lg`

### 5. **Controlled State Management**
- Sidebar now supports both controlled and uncontrolled modes
- Parent component (App.tsx) manages sidebar expansion state
- Floating expand button appears on page content when sidebar is collapsed
- Seamless state synchronization between sidebar and app

### 6. **Accessibility Improvements**
- Proper `aria-expanded` attributes
- Tooltip on collapsed nav items (via `title` attribute)
- Clear focus states maintained
- Semantic HTML structure preserved

## Component Changes

### `Sidebar.tsx`
```typescript
interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  onCollapseChange?: (isExpanded: boolean) => void;
  isExpanded?: boolean; // NEW: Support controlled state
}
```

### `NavItem.tsx`
- Removed horizontal slide animation
- Added left-side active indicator
- Icon scale animation on hover
- Conditional tooltip for collapsed state

### `App.tsx`
- Added `isSidebarExpanded` state management
- Floating expand button when sidebar is collapsed
- Positioned at top-left of page content with glassmorphic styling

## Visual Improvements

### Before
- Collapse button at top-left of sidebar
- Menu items aligned to top
- Horizontal slide animation on hover
- Wider sidebar (280px)
- Inset shadow for active state
- Chevron icons

### After
- Collapse button at top-right (hidden when collapsed)
- Floating expand button on page content when collapsed
- Menu items centered vertically
- Subtle scale animation on hover
- Narrower sidebar (240px)
- Left accent bar for active state
- Lucide panel icons (PanelLeftClose/PanelLeftOpen)
- App branded as "Moleui"
- More refined, Apple-like appearance

## Design Tokens Used

```css
/* Spacing */
--space-2: 8px;   /* Nav item spacing */
--space-3: 12px;  /* Sidebar padding (collapsed) */
--space-4: 16px;  /* Sidebar padding (expanded) */

/* Border Radius */
--radius-lg: 12px;  /* Nav items */
--radius-xl: 20px;  /* Sidebar container */

/* Animation */
--duration-fast: 150ms;    /* Button interactions */
--duration-normal: 250ms;  /* Nav item transitions */
--duration-slow: 400ms;    /* Sidebar expand/collapse */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
```

## Browser Compatibility

- All modern browsers (Chrome, Firefox, Safari, Edge)
- CSS transitions and transforms fully supported
- Backdrop-filter for glassmorphic effects
- Flexbox for layout

## Future Enhancements

- [ ] Add keyboard shortcuts for sidebar toggle (Cmd+B)
- [ ] Persist sidebar state to localStorage
- [ ] Add animation for floating button appearance
- [ ] Consider adding sidebar resize handle
- [ ] Add tooltips with delay for collapsed nav items

## Testing Checklist

- [x] Sidebar expands/collapses smoothly
- [x] Floating button appears when collapsed
- [x] Menu items remain centered vertically
- [x] Active state indicator displays correctly
- [x] Hover animations work on all interactive elements
- [x] Keyboard navigation works properly
- [x] Screen reader announces state changes
- [x] No TypeScript errors
- [ ] Visual regression testing
- [ ] Cross-browser testing

## References

Design principles adapted from:
- macOS Big Sur+ sidebar patterns
- Apple Music/Finder sidebar layouts
- iOS/iPadOS navigation patterns

Content rephrased for compliance with licensing restrictions.
