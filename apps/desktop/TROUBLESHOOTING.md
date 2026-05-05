# Troubleshooting Guide

## Blank Screen Issues

If you're seeing a blank screen, follow these steps in order:

### Step 1: Verify Installation

```bash
cd apps/desktop
bun install
```

Make sure all dependencies install without errors.

### Step 2: Enable DevTools

Edit `main.js` and uncomment this line:

```javascript
// Around line 25
window.webContents.openDevTools();
```

This will show the browser console with any errors.

### Step 3: Check Console Errors

Start the app:

```bash
bun run dev
```

Look in the DevTools Console tab for errors. Common errors:

#### Error: "Cannot find module '@/components/...'"

**Cause**: Path aliases not working

**Fix**:
1. Restart TypeScript server in VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
2. Verify `tsconfig.json` and `vite.config.ts` have matching path aliases
3. Restart dev server

#### Error: "Failed to resolve import"

**Cause**: Missing dependency or wrong import path

**Fix**:
```bash
bun install
```

#### Error: Icon-related errors

**Cause**: Icon names don't match Lucide React exports

**Fix**: Icon names must be PascalCase:
- ✅ `Sparkles`, `Trash2`, `PackageX`
- ❌ `sparkles`, `trash-2`, `package-x`

### Step 4: Test Basic Setup

Replace `src/App.tsx` content temporarily with `src/App.test.tsx`:

```bash
cp src/App.test.tsx src/App.tsx
```

If you see the test screen, the basic setup works. The issue is in the components.

### Step 5: Check Vite Server

Open `http://localhost:5173` in Chrome/Safari. You should see the app.

If it works in the browser but not in Electron:
- Check `main.js` is loading the correct URL
- Verify preload script is working

### Step 6: Verify File Structure

Ensure these files exist:

```
src/
├── main.tsx          ✓ React entry
├── App.tsx           ✓ Main component
├── index.css         ✓ Tailwind imports
├── vite-env.d.ts     ✓ Vite types
├── components/       ✓ Components folder
├── pages/            ✓ Pages folder
├── utils/            ✓ Utils folder
└── types/            ✓ Types folder
```

### Step 7: Check TypeScript

```bash
bun run type-check
```

Fix any TypeScript errors before running the app.

### Step 8: Clear Cache

```bash
rm -rf node_modules dist .turbo
bun install
bun run dev
```

## Common Issues & Solutions

### Issue: White/Blank Screen

**Symptoms**: App window opens but shows nothing

**Solutions**:
1. Open DevTools (see Step 2)
2. Check console for errors
3. Verify Vite is running on port 5173
4. Check Network tab - files should load from localhost:5173

### Issue: Styles Not Applied

**Symptoms**: Content shows but no styling

**Solutions**:
1. Verify `index.css` is imported in `main.tsx`
2. Check `tailwind.config.js` content paths
3. Restart dev server
4. Clear browser cache in Electron

### Issue: Icons Not Showing

**Symptoms**: Boxes or missing icons

**Solutions**:
1. Check icon names are PascalCase
2. Verify `lucide-react` is installed
3. Check imports: `import { Sparkles } from 'lucide-react'`

### Issue: Hot Reload Not Working

**Symptoms**: Changes don't reflect without restart

**Solutions**:
1. Check Vite dev server is running
2. Verify file is saved
3. Check file is in `src/` directory
4. Restart dev server

### Issue: TypeScript Errors

**Symptoms**: Red squiggly lines, type errors

**Solutions**:
1. Run `bun run type-check`
2. Fix reported errors
3. Restart TypeScript server
4. Check `tsconfig.json` is correct

### Issue: Import Errors

**Symptoms**: "Cannot find module" errors

**Solutions**:
1. Check file path is correct
2. Verify file exists
3. Check import syntax
4. Use path aliases: `@/components/...`

### Issue: Electron Won't Start

**Symptoms**: `bun run dev` fails

**Solutions**:
1. Check port 5173 is not in use: `lsof -ti:5173 | xargs kill -9`
2. Verify Electron is installed: `bun list electron`
3. Check `main.js` has no syntax errors
4. Try: `bun run prepare:runtime`

### Issue: Build Fails

**Symptoms**: `bun run build` errors

**Solutions**:
1. Fix TypeScript errors first
2. Check all imports are correct
3. Verify all files exist
4. Clear dist: `rm -rf dist`

## Debug Checklist

- [ ] Dependencies installed (`bun install`)
- [ ] DevTools enabled in `main.js`
- [ ] Vite server running on port 5173
- [ ] No console errors in DevTools
- [ ] TypeScript check passes (`bun run type-check`)
- [ ] Files load in Network tab
- [ ] `index.css` imported in `main.tsx`
- [ ] Path aliases working
- [ ] Icon names are PascalCase
- [ ] All imports use correct paths

## Still Stuck?

### Get More Info

1. **Check Vite output**:
   ```bash
   bun run dev
   ```
   Should show: `VITE v6.x.x ready in xxx ms`

2. **Check Electron version**:
   ```bash
   bun list electron
   ```
   Should be: `electron@35.5.1` or similar

3. **Check Node/Bun version**:
   ```bash
   bun --version
   ```
   Should be: `1.3.7+`

4. **Check for port conflicts**:
   ```bash
   lsof -i :5173
   ```
   Should show Vite process or nothing

### Test Individual Components

Create a minimal test in `src/App.tsx`:

```tsx
function App() {
  return <div>Hello World</div>;
}
export default App;
```

If this works, add components one by one to find the issue.

### Check Browser Console

In DevTools Console, run:

```javascript
// Check if React is loaded
console.log(React);

// Check if window.moleDesktop exists
console.log(window.moleDesktop);

// Check current location
console.log(window.location.href);
```

### Verify Preload Script

In DevTools Console:

```javascript
// Should show the moleDesktop API
console.log(window.moleDesktop);
```

If undefined, preload script isn't working.

## Nuclear Options

### Option 1: Fresh Install

```bash
cd apps/desktop
rm -rf node_modules dist .turbo bun.lock
bun install
bun run dev
```

### Option 2: Use Test App

```bash
# Use the simple test version
cp src/App.test.tsx src/App.tsx
bun run dev
```

If test app works, the issue is in the full app components.

### Option 3: Check Git Status

```bash
git status
git diff
```

See what changed. Revert if needed.

## Getting Help

When asking for help, provide:

1. **Error messages** from DevTools Console
2. **Vite output** from terminal
3. **TypeScript errors** from `bun run type-check`
4. **Versions**:
   ```bash
   bun --version
   bun list electron
   bun list react
   ```
5. **What you tried** from this guide

## Quick Fixes

```bash
# Fix 1: Restart everything
rm -rf node_modules dist
bun install
bun run dev

# Fix 2: Kill port 5173
lsof -ti:5173 | xargs kill -9
bun run dev

# Fix 3: Use test app
cp src/App.test.tsx src/App.tsx
bun run dev

# Fix 4: Check types
bun run type-check

# Fix 5: Prepare runtime
bun run prepare:runtime
bun run dev
```

## Success Indicators

When everything works, you should see:

1. **Terminal**: Vite server running on port 5173
2. **Electron**: Window opens with content
3. **DevTools**: No errors in Console
4. **Network**: Files loading from localhost:5173
5. **UI**: Sidebar and page content visible

If you see all of these, the app is working correctly! 🎉
