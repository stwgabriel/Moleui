# Component Showcase

Visual guide to all available components in the Moleui Desktop app.

## UI Components

### Button

Versatile button component with multiple variants and sizes.

**Variants:**
- `primary` - Main action button (blue)
- `secondary` - Secondary actions (white/glass)
- `danger` - Destructive actions (red)
- `ghost` - Minimal style

**Sizes:**
- `sm` - Small (px-3 py-1.5)
- `md` - Medium (px-6 py-3) - default
- `lg` - Large (px-8 py-4)

**Usage:**
```tsx
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';

// Primary button
<Button variant="primary" size="lg">
  Start Cleaning
</Button>

// With icon (left)
<Button variant="primary" icon={Trash2}>
  Delete
</Button>

// With icon (right)
<Button variant="secondary" icon={ArrowRight} iconPosition="right">
  Continue
</Button>

// Danger button
<Button variant="danger" onClick={handleDelete}>
  Remove All
</Button>

// Ghost button
<Button variant="ghost" size="sm">
  Cancel
</Button>
```

**Features:**
- Hover effects (lift + shadow)
- Active states
- Disabled states
- Icon support
- Keyboard accessible
- Focus indicators

---

### Card

Container component with glassmorphism effects.

**Variants:**
- `default` - Standard card with shadow
- `elevated` - Higher elevation with more blur
- `glass` - Glassmorphism effect

**Props:**
- `hover` - Enable hover lift effect

**Sub-components:**
- `CardHeader` - Header section
- `CardTitle` - Title text
- `CardDescription` - Description text
- `CardContent` - Main content
- `CardFooter` - Footer section

**Usage:**
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

// Basic card
<Card>
  <CardHeader>
    <CardTitle>System Caches</CardTitle>
    <CardDescription>1.5 GB • 450 items</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>

// Glass card with hover
<Card variant="glass" hover>
  <div className="p-6">
    Hoverable glass card
  </div>
</Card>

// Elevated card
<Card variant="elevated" className="p-8">
  High elevation card
</Card>
```

**Features:**
- Glassmorphism effects
- Hover animations
- Flexible composition
- Responsive padding
- Shadow variations

---

### Spinner

Loading indicator with multiple sizes.

**Sizes:**
- `sm` - Small (w-4 h-4)
- `md` - Medium (w-8 h-8) - default
- `lg` - Large (w-12 h-12)

**Usage:**
```tsx
import { Spinner } from '@/components/ui/Spinner';

// Default spinner
<Spinner />

// Large spinner
<Spinner size="lg" />

// With custom color
<Spinner className="border-t-accent-success" />

// In a loading state
{isLoading && (
  <div className="flex justify-center">
    <Spinner size="lg" />
  </div>
)}
```

**Features:**
- Smooth rotation
- Customizable colors
- Multiple sizes
- Accessible

---

## Layout Components

### Sidebar

Collapsible navigation sidebar with glassmorphism.

**Props:**
- `currentPage` - Active page ID
- `onPageChange` - Page change handler

**Usage:**
```tsx
import { Sidebar } from '@/components/layout/Sidebar';

<Sidebar 
  currentPage={currentPage} 
  onPageChange={setCurrentPage} 
/>
```

**Features:**
- Collapsible (280px ↔ 76px)
- Glassmorphism effect
- Active page indicator
- Icon-only collapsed state
- Smooth transitions
- Keyboard accessible

**Pages:**
- Smart Care
- Clean
- Uninstall
- Optimize
- Analyze
- Status

---

### NavItem

Individual navigation item within sidebar.

**Props:**
- `page` - Page identifier
- `icon` - Lucide icon name
- `label` - Display text
- `isActive` - Active state
- `isExpanded` - Sidebar expanded state
- `onClick` - Click handler

**Usage:**
```tsx
import { NavItem } from '@/components/layout/NavItem';

<NavItem
  page="clean"
  icon="trash-2"
  label="Clean"
  isActive={currentPage === 'clean'}
  isExpanded={isSidebarExpanded}
  onClick={() => setCurrentPage('clean')}
/>
```

**Features:**
- Active state styling
- Hover effects
- Icon + label
- Smooth transitions
- Keyboard accessible

---

## Common Components

### StartScreen

Reusable start screen for all pages.

**Props:**
- `config` - Page configuration object
- `onStart` - Start button handler

**Config Structure:**
```typescript
interface PageConfig {
  title: string;
  description: string;
  icon: string;
  buttonText: string;
  items: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
}
```

**Usage:**
```tsx
import { StartScreen } from '@/components/common/StartScreen';

const config: PageConfig = {
  title: 'Clean',
  description: 'Remove unnecessary files and caches',
  icon: 'Trash2',
  buttonText: 'Start Cleaning',
  items: [
    {
      icon: 'HardDrive',
      title: 'System Caches',
      description: 'Remove temporary files',
    },
    // ... more items
  ],
};

<StartScreen config={config} onStart={handleStart} />
```

**Features:**
- Two-column layout
- Feature list with icons
- Large visual icon
- Call-to-action button
- Responsive design

---

## Utility Classes

### Glassmorphism

```tsx
// Glass surface
<div className="glass-surface">
  Content with glass effect
</div>

// Elevated glass
<div className="glass-elevated">
  Higher elevation glass
</div>
```

### Animations

```tsx
// Spinner
<div className="spinner" />

// Small spinner
<div className="small-spinner" />

// Pulse glow
<div className="pulse-glow">
  Pulsing element
</div>

// Slide animations
<div className="slide-in-up">Slide in from bottom</div>
<div className="slide-out-up">Slide out to top</div>
<div className="slide-in-down">Slide in from top</div>
<div className="slide-out-down">Slide out to bottom</div>
```

### Scrollbar

```tsx
// Custom scrollbar
<div className="overflow-y-auto custom-scrollbar">
  Scrollable content
</div>
```

---

## Design Tokens

### Colors

```tsx
// Backgrounds
bg-bg-primary
bg-bg-secondary
bg-bg-glass

// Surfaces
bg-surface
bg-surface-elevated
bg-surface-hover

// Text
text-text-primary
text-text-secondary
text-text-tertiary

// Accents
bg-accent-primary
bg-accent-secondary
bg-accent-success
bg-accent-warning
bg-accent-danger

// Semantic
bg-clean
bg-optimize
bg-analyze
bg-status
```

### Spacing

```tsx
// Padding/Margin
p-1  // 4px
p-2  // 8px
p-3  // 12px
p-4  // 16px
p-5  // 20px
p-6  // 24px
p-8  // 32px
p-10 // 40px
p-12 // 48px

// Gap
gap-1 gap-2 gap-3 gap-4 gap-6 gap-8
```

### Border Radius

```tsx
rounded-sm   // 8px
rounded-md   // 12px
rounded-lg   // 16px
rounded-xl   // 20px
rounded-2xl  // 24px
rounded-3xl  // 28px
rounded-full // 9999px
```

### Shadows

```tsx
shadow-sm     // Subtle
shadow-md     // Default
shadow-lg     // Elevated
shadow-xl     // High
shadow-2xl    // Maximum
shadow-accent // Colored (blue)
```

### Transitions

```tsx
// Duration
transition-instant // 100ms
transition-fast    // 150ms
transition-normal  // 250ms
transition-slow    // 400ms
transition-slower  // 600ms

// Easing
ease-smooth  // cubic-bezier(0.4, 0, 0.2, 1)
ease-in      // cubic-bezier(0.4, 0, 1, 1)
ease-out     // cubic-bezier(0, 0, 0.2, 1)
ease-bounce  // cubic-bezier(0.68, -0.55, 0.265, 1.55)
ease-spring  // cubic-bezier(0.175, 0.885, 0.32, 1.275)
```

---

## Common Patterns

### Loading State

```tsx
{isLoading ? (
  <div className="flex items-center justify-center h-full">
    <Spinner size="lg" />
  </div>
) : (
  <Content />
)}
```

### Error State

```tsx
{error && (
  <div className="p-4 rounded-lg bg-accent-danger/10 text-accent-danger">
    <p>{error}</p>
  </div>
)}
```

### Empty State

```tsx
{items.length === 0 && (
  <div className="text-center py-12">
    <p className="text-text-secondary">No items found</p>
  </div>
)}
```

### List with Cards

```tsx
<div className="space-y-3">
  {items.map((item, index) => (
    <Card key={index} variant="glass" hover>
      <div className="p-4">
        <h3 className="font-semibold">{item.name}</h3>
        <p className="text-sm text-text-secondary">{item.description}</p>
      </div>
    </Card>
  ))}
</div>
```

### Grid Layout

```tsx
<div className="grid grid-cols-2 gap-4">
  <Card className="p-6">Column 1</Card>
  <Card className="p-6">Column 2</Card>
</div>
```

### Flex Layout

```tsx
<div className="flex items-center gap-4">
  <div className="flex-shrink-0">Icon</div>
  <div className="flex-1">Content</div>
  <div className="flex-shrink-0">Action</div>
</div>
```

### Modal/Overlay

```tsx
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
  <Card variant="elevated" className="max-w-md w-full p-8">
    <h2 className="text-2xl font-bold mb-4">Modal Title</h2>
    <p className="text-text-secondary mb-6">Modal content</p>
    <div className="flex gap-4">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={onConfirm}>Confirm</Button>
    </div>
  </Card>
</div>
```

### Progress Bar

```tsx
<div className="w-full h-2 bg-surface rounded-full overflow-hidden">
  <div 
    className="h-full bg-accent-primary rounded-full transition-all duration-300"
    style={{ width: `${progress}%` }}
  />
</div>
```

### Stats Card

```tsx
<Card variant="glass" className="p-6">
  <div className="flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-accent-primary/12 flex items-center justify-center">
      <Sparkles className="w-6 h-6 text-accent-primary" />
    </div>
    <div>
      <div className="text-2xl font-bold text-text-primary">1.5 GB</div>
      <div className="text-sm text-text-secondary">Space Recovered</div>
    </div>
  </div>
</Card>
```

---

## Icons

Using **Lucide React** for icons.

**Common Icons:**
```tsx
import {
  Sparkles,      // Smart Care
  Trash2,        // Clean
  PackageX,      // Uninstall
  Zap,           // Optimize
  PieChart,      // Analyze
  Activity,      // Status
  Search,        // Search
  Check,         // Success
  X,             // Close
  AlertCircle,   // Error
  Info,          // Info
  ArrowRight,    // Next
  ArrowLeft,     // Back
  Loader,        // Loading
  HardDrive,     // Disk
  Cpu,           // CPU
  Memory,        // Memory
  Battery,       // Battery
  Globe,         // Browser
  Code,          // Developer
  Shield,        // Security
  Clock,         // Time
  TrendingUp,    // Performance
} from 'lucide-react';

// Usage
<Sparkles className="w-5 h-5 text-accent-primary" />
```

Browse all icons: [lucide.dev](https://lucide.dev)

---

## Responsive Design

### Breakpoints

```tsx
// Mobile first approach
<div className="
  p-4           // Mobile
  md:p-6        // Tablet
  lg:p-8        // Desktop
">
  Content
</div>

// Grid responsive
<div className="
  grid 
  grid-cols-1   // Mobile: 1 column
  md:grid-cols-2 // Tablet: 2 columns
  lg:grid-cols-3 // Desktop: 3 columns
  gap-4
">
  {items.map(item => <Card key={item.id}>{item.name}</Card>)}
</div>
```

### Tailwind Breakpoints
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

---

## Accessibility

### Focus States

All interactive elements have focus indicators:

```tsx
<button className="
  focus-visible:outline-none 
  focus-visible:ring-2 
  focus-visible:ring-accent-primary 
  focus-visible:ring-offset-2
">
  Button
</button>
```

### ARIA Labels

```tsx
<button aria-label="Close dialog">
  <X className="w-5 h-5" />
</button>

<nav aria-label="Main navigation">
  {/* Navigation items */}
</nav>
```

### Keyboard Navigation

All components support keyboard navigation:
- `Tab` - Focus next element
- `Shift+Tab` - Focus previous element
- `Enter/Space` - Activate button
- `Escape` - Close modal/dialog

---

## Best Practices

### 1. Use Components

```tsx
// ❌ Don't
<button className="bg-accent-primary text-white px-6 py-3 rounded-md">
  Click me
</button>

// ✅ Do
<Button variant="primary">
  Click me
</Button>
```

### 2. Consistent Spacing

```tsx
// ❌ Don't
<div className="p-5 gap-7">

// ✅ Do (use design tokens)
<div className="p-6 gap-8">
```

### 3. Semantic HTML

```tsx
// ❌ Don't
<div onClick={handleClick}>Click me</div>

// ✅ Do
<button onClick={handleClick}>Click me</button>
```

### 4. Accessibility

```tsx
// ❌ Don't
<div className="cursor-pointer" onClick={handleClick}>
  Action
</div>

// ✅ Do
<button onClick={handleClick} aria-label="Perform action">
  Action
</button>
```

### 5. Type Safety

```tsx
// ❌ Don't
const handleClick = (data) => {
  console.log(data.name);
};

// ✅ Do
const handleClick = (data: { name: string }) => {
  console.log(data.name);
};
```

---

## Resources

- **Components**: `src/components/`
- **Tailwind Docs**: [tailwindcss.com](https://tailwindcss.com)
- **Lucide Icons**: [lucide.dev](https://lucide.dev)
- **React Docs**: [react.dev](https://react.dev)
- **TypeScript**: [typescriptlang.org](https://www.typescriptlang.org)

---

**Last Updated**: May 3, 2026  
**Version**: 0.2.0
