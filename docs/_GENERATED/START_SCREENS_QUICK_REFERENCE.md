# Start Screens Quick Reference

## Summary

All start screens (Clean, Optimize, Uninstall) now feature:
- ✅ **Vertically centered content**
- ✅ **Fully rounded buttons** (pill shape)
- ✅ **Consistent layout** across all pages
- ✅ **Modern, professional design**

## CSS Key Properties

### Vertical Centering
```css
.page-idle {
  justify-content: center;
}

.page-idle .page-grid {
  align-items: center;
}
```

### Rounded Buttons
```css
.page-idle .action-button {
  border-radius: var(--radius-full); /* 9999px */
}
```

## Page Configurations

| Page | Icon | Color | Button Text |
|------|------|-------|-------------|
| Clean | ✨ Sparkles | Cyan (#06b6d4) | Start Cleaning |
| Optimize | 📊 Gauge | Purple (#8b5cf6) | Start Optimization |
| Uninstall | 📦❌ Package-X | Red (#ef4444) | Scan Applications |

## Layout Structure

```
┌─────────────────────────────────────┐
│         [Vertical Center]           │
│  ┌──────────────┬─────────────┐    │
│  │ Left (60%)   │ Right (40%) │    │
│  │              │             │    │
│  │ Title        │   Icon      │    │
│  │ Description  │             │    │
│  │ • Feature 1  │             │    │
│  │ • Feature 2  │             │    │
│  │ • Feature 3  │             │    │
│  └──────────────┴─────────────┘    │
│                                     │
│    ╭─────────────────────╮          │
│    │  [Rounded Button]   │          │
│    ╰─────────────────────╯          │
└─────────────────────────────────────┘
```

## Files Modified

- `apps/desktop/clean-page.js` - Added start screen
- `apps/desktop/optimize-page.js` - Added start screen
- `apps/desktop/styles.css` - Added centering & button rounding

## Testing

Run the desktop app:
```bash
bun run desktop:dev
```

Navigate to each page to see the start screens.

## Design Tokens

```css
--radius-full: 9999px;      /* Fully rounded */
--space-4: 16px;            /* Button padding vertical */
--space-8: 32px;            /* Button padding horizontal */
--clean-color: #06b6d4;     /* Cyan */
--optimize-color: #8b5cf6;  /* Purple */
--accent-primary: #3b82f6;  /* Blue */
```

## State Management

Each page uses `hasStarted` flag:
- `false` → Show start screen
- `true` → Show selection screen

## User Flow

```
Start Screen → Click Button → Selection → Process → Complete → Start Screen
```

## Key Benefits

1. **Professional** - Polished, modern appearance
2. **Consistent** - Same pattern across all pages
3. **Balanced** - Better use of vertical space
4. **Friendly** - Rounded buttons are more approachable
5. **Accessible** - Maintains all accessibility features
