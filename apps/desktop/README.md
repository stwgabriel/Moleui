# Moleui Desktop App

Modern desktop application for Moleui built with **React**, **TypeScript**, **Tailwind CSS**, and **Electron**.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tool
- **Electron** - Desktop app framework
- **Lucide React** - Icon library

## Project Structure

```
apps/desktop/
├── src/
│   ├── components/
│   │   ├── common/          # Shared components
│   │   │   └── StartScreen.tsx
│   │   ├── layout/          # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   └── NavItem.tsx
│   │   └── ui/              # UI primitives
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Spinner.tsx
│   ├── pages/               # Page components
│   │   ├── SmartCarePage.tsx
│   │   ├── CleanPage.tsx
│   │   ├── UninstallPage.tsx
│   │   ├── OptimizePage.tsx
│   │   ├── AnalyzePage.tsx
│   │   └── MyMacPage.tsx
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   │   ├── cn.ts           # Class name merger
│   │   └── format.ts       # Formatting utilities
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles + Tailwind
├── main.js                  # Electron main process
├── preload.js               # Electron preload script
├── index.html               # HTML entry point
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
└── package.json
```

## Development

### Prerequisites

- Node.js 18+ or Bun
- Mole runtime (automatically prepared)

### Install Dependencies

```bash
bun install
```

### Run Development Server

```bash
bun run dev
```

This will:
1. Prepare the Mole runtime
2. Start Vite dev server (port 5173)
3. Launch Electron app

### Build for Production

```bash
# Build React app
bun run build

# Create distributable
bun run dist
```

## Component Architecture

### UI Components (`src/components/ui/`)

Reusable, styled components following the design system:

- **Button** - Primary, secondary, danger, ghost variants
- **Card** - Glass, elevated, default variants with hover effects
- **Spinner** - Loading indicators in multiple sizes

### Layout Components (`src/components/layout/`)

- **Sidebar** - Collapsible navigation with glassmorphism
- **NavItem** - Individual navigation items with active states

### Common Components (`src/components/common/`)

- **StartScreen** - Reusable start screen for all pages

### Pages (`src/pages/`)

Each page is a self-contained component:

- **SmartCarePage** - Automated maintenance
- **CleanPage** - System cleaning (fully implemented)
- **UninstallPage** - App uninstaller
- **OptimizePage** - System optimization
- **AnalyzePage** - Disk analysis
- **MyMacPage** - System monitoring with grouped app/process activity

## Styling with Tailwind

### Design Tokens

All design tokens from the original CSS are mapped to Tailwind:

```tsx
// Colors
className="bg-accent-primary text-white"

// Spacing
className="p-6 gap-4"

// Border Radius
className="rounded-xl"

// Shadows
className="shadow-lg"

// Transitions
className="transition-all duration-fast ease-smooth"
```

### Glassmorphism

Use utility classes for glass effects:

```tsx
<div className="glass-surface">...</div>
<div className="glass-elevated">...</div>
```

### Custom Utilities

```tsx
// Custom scrollbar
className="custom-scrollbar"

// Animations
className="spinner"
className="pulse-glow"
className="slide-in-up"
```

## TypeScript Types

All types are defined in `src/types/index.ts`:

- **MoleDesktopAPI** - Electron IPC interface
- **Application** - App metadata
- **SystemMetrics** - System monitoring data
- **CleanCategory** - Cleaning categories
- **PageConfig** - Page configuration

## Electron IPC

Access Mole CLI through the `window.moleDesktop` API:

```tsx
// Run status command
const result = await window.moleDesktop.runStatus();

// Clean with streaming output
window.moleDesktop.clean.onStdout((data) => {
  console.log(data);
});

const result = await window.moleDesktop.clean.execute({ dryRun: true });

// Cleanup listeners
window.moleDesktop.clean.removeListeners();
```

## Adding New Features

### 1. Create a new page component

```tsx
// src/pages/NewPage.tsx
import { StartScreen } from '@/components/common/StartScreen';

export function NewPage() {
  return <StartScreen config={config} onStart={handleStart} />;
}
```

### 2. Add route to App.tsx

```tsx
import { NewPage } from '@/pages/NewPage';

// In renderPage():
case 'newpage':
  return <NewPage />;
```

### 3. Add navigation item

Update `Sidebar.tsx` to include the new page.

## Design System

The app follows the Mole design system with:

- **Glassmorphism** - Frosted glass surfaces with backdrop blur
- **Smooth animations** - 150-400ms transitions
- **Micro-interactions** - Hover effects, button states
- **Dark mode** - Automatic via `prefers-color-scheme`
- **Accessibility** - WCAG AA compliant, reduced motion support

## Performance

- **Code splitting** - Pages loaded on demand
- **Optimized builds** - Vite's fast bundling
- **Minimal re-renders** - React best practices
- **Efficient animations** - CSS transforms and opacity

## Testing

```bash
# Type checking
bun run type-check

# Build check
bun run build
```

## Migration Notes

This is a complete rewrite from vanilla JavaScript to React + TypeScript + Tailwind:

- ✅ **CleanPage** - Fully migrated with all functionality
- 🚧 **UninstallPage** - Structure ready, needs implementation
- 🚧 **OptimizePage** - Structure ready, needs implementation
- 🚧 **AnalyzePage** - Structure ready, needs implementation
- ✅ **MyMacPage** - System monitoring with grouped app/process activity

## Contributing

1. Follow the existing component structure
2. Use TypeScript for type safety
3. Use Tailwind for styling (no inline styles)
4. Follow the design system tokens
5. Add proper TypeScript types
6. Clean up listeners in useEffect cleanup

## License

See root LICENSE file.
