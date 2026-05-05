# Quick Start Guide

Get the Moleui Desktop app running in 5 minutes.

## Prerequisites

- **Bun** or **Node.js 18+**
- **macOS** (for Mole CLI)

## Installation

```bash
# Navigate to desktop app
cd apps/desktop

# Install dependencies
bun install
```

## Development

```bash
# Start development server
bun run dev
```

This will:
1. Prepare the Mole runtime (`.mole-runtime/`)
2. Start Vite dev server on `http://localhost:5173`
3. Launch Electron app with hot reload

## Project Structure

```
src/
├── components/
│   ├── ui/              # Button, Card, Spinner
│   ├── layout/          # Sidebar, NavItem
│   └── common/          # StartScreen
├── pages/               # SmartCare, Clean, Uninstall, etc.
├── utils/               # Utilities (cn, format)
├── types/               # TypeScript types
├── App.tsx              # Main app
└── main.tsx             # Entry point
```

## Creating a New Component

### 1. UI Component

```tsx
// src/components/ui/MyComponent.tsx
import { cn } from '@/utils/cn';

interface MyComponentProps {
  title: string;
  className?: string;
}

export function MyComponent({ title, className }: MyComponentProps) {
  return (
    <div className={cn('p-4 rounded-lg bg-surface', className)}>
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
  );
}
```

### 2. Page Component

```tsx
// src/pages/MyPage.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function MyPage() {
  const [count, setCount] = useState(0);
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">My Page</h1>
      <p>Count: {count}</p>
      <Button onClick={() => setCount(count + 1)}>
        Increment
      </Button>
    </div>
  );
}
```

### 3. Add to App

```tsx
// src/App.tsx
import { MyPage } from '@/pages/MyPage';

// In renderPage():
case 'mypage':
  return <MyPage />;
```

## Styling with Tailwind

### Common Patterns

```tsx
// Layout
<div className="flex items-center gap-4">
  <div className="flex-1">Content</div>
</div>

// Card with glass effect
<div className="glass-surface p-6 rounded-xl">
  Card content
</div>

// Button styles
<button className="bg-accent-primary text-white px-6 py-3 rounded-md hover:bg-accent-primary-hover transition-all">
  Click me
</button>

// Grid layout
<div className="grid grid-cols-2 gap-4">
  <div>Column 1</div>
  <div>Column 2</div>
</div>
```

### Design Tokens

Use design tokens from the config:

```tsx
// Colors
bg-accent-primary
text-text-secondary
border-surface

// Spacing
p-4 gap-6 m-8

// Radius
rounded-md rounded-xl rounded-3xl

// Shadows
shadow-md shadow-lg shadow-xl
```

## Using Electron IPC

### Call Mole CLI

```tsx
// Run status command
const result = await window.moleDesktop.runStatus();
console.log(result.stdout);

// Clean with streaming
window.moleDesktop.clean.onStdout((data) => {
  console.log('Output:', data);
});

const result = await window.moleDesktop.clean.execute({ dryRun: true });

// Cleanup
window.moleDesktop.clean.removeListeners();
```

### With React Hooks

```tsx
useEffect(() => {
  // Setup listener
  window.moleDesktop.clean.onStdout((data) => {
    setOutput(data);
  });
  
  // Cleanup on unmount
  return () => {
    window.moleDesktop.clean.removeListeners();
  };
}, []);
```

## Common Tasks

### Add a new icon

```tsx
import { Sparkles, Trash2, Activity } from 'lucide-react';

<Sparkles className="w-5 h-5 text-accent-primary" />
```

Browse icons: [lucide.dev](https://lucide.dev)

### Format bytes

```tsx
import { formatBytes } from '@/utils/format';

const size = formatBytes(1024000); // "1 MB"
```

### Merge class names

```tsx
import { cn } from '@/utils/cn';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  className
)}>
  Content
</div>
```

### Show loading state

```tsx
import { Spinner } from '@/components/ui/Spinner';

{isLoading && <Spinner size="lg" />}
```

## TypeScript Tips

### Define component props

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick: () => void;
  children: React.ReactNode;
}
```

### Type state

```tsx
type Stage = 'idle' | 'loading' | 'complete';
const [stage, setStage] = useState<Stage>('idle');
```

### Type API responses

```tsx
interface MoleResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}
```

## Building for Production

```bash
# Build React app
bun run build

# Create distributable
bun run dist
```

Output: `dist-electron/Moleui Desktop-{version}-{arch}.dmg`

## Debugging

### React DevTools

Automatically available in development mode.

### Electron DevTools

Opens automatically in development. Or:

```javascript
// In main.js
window.webContents.openDevTools();
```

### TypeScript Errors

```bash
# Check types
bun run type-check
```

### Console Logs

```tsx
console.log('Debug:', data);
console.error('Error:', error);
```

## Hot Tips

1. **Use path aliases**: `@/components` instead of `../../components`
2. **Extract components**: If you use it twice, make it a component
3. **Type everything**: Let TypeScript catch bugs early
4. **Use Tailwind**: Avoid custom CSS when possible
5. **Clean up effects**: Always return cleanup function in useEffect
6. **Memoize expensive ops**: Use `useMemo` for heavy calculations
7. **Follow the pattern**: Look at CleanPage for reference

## Common Issues

### Port already in use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Mole runtime missing

```bash
# Prepare runtime manually
bun run prepare:runtime
```

### TypeScript errors

```bash
# Restart TypeScript server in VS Code
Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Tailwind not working

```bash
# Rebuild
rm -rf node_modules dist
bun install
bun run dev
```

## Next Steps

1. ✅ Run the app: `bun run dev`
2. ✅ Explore the code: Start with `src/App.tsx`
3. ✅ Check CleanPage: Fully implemented example
4. ✅ Read the docs: `README.md` and `MIGRATION_GUIDE.md`
5. ✅ Build something: Create a new component or page

## Resources

- **React**: [react.dev](https://react.dev)
- **TypeScript**: [typescriptlang.org](https://www.typescriptlang.org)
- **Tailwind**: [tailwindcss.com](https://tailwindcss.com)
- **Lucide Icons**: [lucide.dev](https://lucide.dev)
- **Electron**: [electronjs.org](https://www.electronjs.org)

## Need Help?

1. Check the README
2. Review MIGRATION_GUIDE.md
3. Look at CleanPage implementation
4. Check TypeScript errors
5. Review Tailwind docs

Happy coding! 🚀
