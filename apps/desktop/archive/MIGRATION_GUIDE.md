# Migration Guide: Vanilla JS → React + TypeScript + Tailwind

This document outlines the complete migration from the original vanilla JavaScript implementation to a modern React + TypeScript + Tailwind CSS architecture.

## Overview

### Before (Vanilla JS)
- Plain HTML with inline scripts
- Manual DOM manipulation
- Global state management
- Inline styles and CSS files
- No type safety
- Manual event listener management

### After (React + TypeScript + Tailwind)
- Component-based architecture
- Declarative UI with React
- Type-safe with TypeScript
- Utility-first styling with Tailwind
- Proper state management with hooks
- Automatic cleanup

## Architecture Changes

### File Structure

**Before:**
```
apps/desktop/
├── index.html
├── renderer.js
├── status-page.js
├── uninstall-page.js
├── clean-page.js
├── optimize-page.js
├── analyze-page.js
└── styles.css
```

**After:**
```
apps/desktop/
├── src/
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   └── ui/
│   ├── pages/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── main.js
├── preload.js
└── index.html
```

## Component Migration

### 1. Page Components

**Before (clean-page.js):**
```javascript
window.cleanPage = (() => {
  let container = null;
  let state = { stage: 'idle', ... };
  
  function render() {
    container.innerHTML = `<div>...</div>`;
  }
  
  return { init, destroy };
})();
```

**After (CleanPage.tsx):**
```tsx
export function CleanPage() {
  const [stage, setStage] = useState<Stage>('idle');
  
  return (
    <div>...</div>
  );
}
```

### 2. UI Components

**Before (inline HTML):**
```javascript
const html = `
  <button class="action-button" id="start-btn">
    Start
  </button>
`;
container.innerHTML = html;
document.getElementById('start-btn').addEventListener('click', handleStart);
```

**After (React Component):**
```tsx
<Button onClick={handleStart}>
  Start
</Button>
```

### 3. Styling

**Before (CSS classes):**
```css
.action-button {
  background: var(--accent-primary);
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-md);
  /* ... */
}
```

**After (Tailwind utilities):**
```tsx
<button className="bg-accent-primary px-8 py-4 rounded-md">
  Start
</button>
```

Or use the Button component:
```tsx
<Button variant="primary" size="lg">
  Start
</Button>
```

## State Management

### Before (Module Pattern)
```javascript
let state = {
  stage: 'idle',
  data: []
};

function updateState(newState) {
  state = { ...state, ...newState };
  render();
}
```

### After (React Hooks)
```tsx
const [stage, setStage] = useState<Stage>('idle');
const [data, setData] = useState<Data[]>([]);

// State updates trigger automatic re-renders
setStage('loading');
```

## Event Handling

### Before (Manual Listeners)
```javascript
function attachEventListeners() {
  const btn = container.querySelector('#start-btn');
  btn.addEventListener('click', handleStart);
}

function destroy() {
  // Manual cleanup
  const btn = container.querySelector('#start-btn');
  btn.removeEventListener('click', handleStart);
}
```

### After (React Events)
```tsx
<Button onClick={handleStart}>
  Start
</Button>

// Cleanup handled automatically by React
```

## IPC Communication

### Before
```javascript
window.moleDesktop.clean.onStdout((data) => {
  updateOutput(data);
});

// Manual cleanup
window.moleDesktop.clean.removeListeners();
```

### After (useEffect)
```tsx
useEffect(() => {
  window.moleDesktop.clean.onStdout((data) => {
    setOutput(data);
  });
  
  // Automatic cleanup
  return () => {
    window.moleDesktop.clean.removeListeners();
  };
}, []);
```

## Type Safety

### Before (No Types)
```javascript
function formatBytes(bytes) {
  // No type checking
  return bytes + ' B';
}
```

### After (TypeScript)
```typescript
function formatBytes(bytes: number): string {
  // Type-safe
  return bytes + ' B';
}
```

## Reusable Components

### UI Primitives

**Button Component:**
```tsx
<Button 
  variant="primary" 
  size="lg" 
  icon={Trash2}
  onClick={handleClick}
>
  Clean Now
</Button>
```

**Card Component:**
```tsx
<Card variant="glass" hover>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

**Spinner Component:**
```tsx
<Spinner size="lg" />
```

### Layout Components

**Sidebar:**
```tsx
<Sidebar 
  currentPage={currentPage} 
  onPageChange={setCurrentPage} 
/>
```

**StartScreen:**
```tsx
<StartScreen 
  config={pageConfig} 
  onStart={handleStart} 
/>
```

## Styling Migration

### CSS Variables → Tailwind Config

**Before (CSS):**
```css
:root {
  --accent-primary: #3b82f6;
  --space-4: 16px;
  --radius-md: 12px;
}
```

**After (Tailwind Config):**
```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      'accent-primary': 'var(--accent-primary)',
    },
    spacing: {
      '4': 'var(--space-4)',
    },
    borderRadius: {
      'md': 'var(--radius-md)',
    },
  },
}
```

**Usage:**
```tsx
<div className="bg-accent-primary p-4 rounded-md">
  Content
</div>
```

### Glassmorphism

**Before (CSS class):**
```css
.glass-surface {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: ...;
}
```

**After (Tailwind utility):**
```tsx
<div className="glass-surface">
  Content
</div>
```

Or use the Card component:
```tsx
<Card variant="glass">
  Content
</Card>
```

## Animation Migration

### Before (CSS Animations)
```css
@keyframes slide-in-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.slide-in-up {
  animation: slide-in-up 400ms ease;
}
```

**After (Same, but in Tailwind):**
```tsx
<div className="slide-in-up">
  Content
</div>
```

Animations are defined in `index.css` and available as utilities.

## Utility Functions

### Before (Inline)
```javascript
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  // ...
}
```

### After (Centralized)
```typescript
// src/utils/format.ts
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  // ...
}

// Usage
import { formatBytes } from '@/utils/format';
```

## Path Aliases

Use TypeScript path aliases for cleaner imports:

```tsx
// Before
import { Button } from '../../components/ui/Button';

// After
import { Button } from '@/components/ui/Button';
```

## Development Workflow

### Before
1. Edit HTML/JS files
2. Reload Electron app
3. Check console for errors

### After
1. Edit React/TypeScript files
2. Vite hot-reloads automatically
3. TypeScript catches errors at compile time
4. ESLint/Prettier for code quality

## Testing Strategy

### Component Testing
```tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

test('renders button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

### Type Testing
```typescript
// TypeScript ensures type safety at compile time
const result: MoleResult = await window.moleDesktop.runStatus();
// result.ok is guaranteed to be boolean
// result.stdout is guaranteed to be string
```

## Migration Checklist

### Completed ✅
- [x] Project setup (Vite, React, TypeScript, Tailwind)
- [x] Type definitions
- [x] UI components (Button, Card, Spinner)
- [x] Layout components (Sidebar, NavItem)
- [x] Common components (StartScreen)
- [x] Utility functions (cn, format)
- [x] CleanPage (fully functional)
- [x] Page structure for all pages
- [x] Styling system with Tailwind
- [x] Dark mode support
- [x] Accessibility features

### In Progress 🚧
- [ ] UninstallPage implementation
- [ ] StatusPage implementation
- [ ] OptimizePage implementation
- [ ] AnalyzePage implementation

### Future Enhancements 🔮
- [ ] Unit tests with Vitest
- [ ] E2E tests with Playwright
- [ ] Storybook for component documentation
- [ ] Performance monitoring
- [ ] Error boundaries
- [ ] Loading states
- [ ] Toast notifications
- [ ] Settings page
- [ ] Keyboard shortcuts

## Best Practices

### 1. Component Structure
```tsx
// Imports
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

// Types
interface Props {
  title: string;
}

// Component
export function MyComponent({ title }: Props) {
  // Hooks
  const [state, setState] = useState();
  
  // Event handlers
  const handleClick = () => {};
  
  // Render
  return <div>...</div>;
}
```

### 2. State Management
- Use `useState` for local state
- Use `useEffect` for side effects
- Clean up in useEffect return
- Avoid prop drilling (use context if needed)

### 3. Styling
- Use Tailwind utilities first
- Create components for repeated patterns
- Use design tokens from config
- Maintain consistent spacing

### 4. Type Safety
- Define interfaces for all props
- Type all function parameters
- Use TypeScript strict mode
- Avoid `any` type

### 5. Performance
- Memoize expensive calculations
- Use React.memo for pure components
- Lazy load pages if needed
- Optimize re-renders

## Common Patterns

### Loading State
```tsx
const [isLoading, setIsLoading] = useState(false);

if (isLoading) {
  return <Spinner size="lg" />;
}
```

### Error Handling
```tsx
const [error, setError] = useState<string | null>(null);

try {
  // operation
} catch (err) {
  setError(err.message);
}
```

### Conditional Rendering
```tsx
{stage === 'idle' && <StartScreen />}
{stage === 'loading' && <LoadingView />}
{stage === 'results' && <ResultsView />}
```

### List Rendering
```tsx
{items.map((item, index) => (
  <Card key={index}>
    {item.name}
  </Card>
))}
```

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)
- [Electron Documentation](https://www.electronjs.org/docs)

## Support

For questions or issues with the migration:
1. Check this guide
2. Review the README.md
3. Look at the CleanPage implementation as a reference
4. Check TypeScript errors in your IDE
5. Review Tailwind documentation for styling

## Conclusion

This migration brings:
- ✅ Better developer experience
- ✅ Type safety
- ✅ Component reusability
- ✅ Easier maintenance
- ✅ Better performance
- ✅ Modern tooling
- ✅ Scalable architecture

The foundation is solid, and new features can be added quickly using the established patterns.
