# Testing the Setup

If you're seeing blank screens, follow these steps to debug:

## 1. Install Dependencies

```bash
cd apps/desktop
bun install
```

## 2. Check for Errors

Start the dev server and check the console:

```bash
bun run dev
```

Look for:
- TypeScript errors
- Import errors
- Console errors in Electron DevTools

## 3. Open DevTools

Uncomment this line in `main.js`:

```javascript
// window.webContents.openDevTools();
```

Then restart the app to see console errors.

## 4. Common Issues

### Issue: "Cannot find module '@/components/...'"

**Solution**: The path aliases might not be working. Check:
- `tsconfig.json` has the correct paths
- `vite.config.ts` has the correct aliases
- Restart the TypeScript server in your IDE

### Issue: Icons not showing

**Solution**: The icon names need to match exactly. Check:
- Icon names are PascalCase (e.g., `Sparkles`, not `sparkles`)
- Icons are imported from `lucide-react`

### Issue: Blank white screen

**Solution**: 
1. Open DevTools (see step 3)
2. Check Console tab for errors
3. Check Network tab to see if files are loading
4. Verify Vite dev server is running on port 5173

### Issue: "Failed to fetch dynamically imported module"

**Solution**: 
1. Clear the dist folder: `rm -rf dist`
2. Restart dev server: `bun run dev`

### Issue: Tailwind styles not applying

**Solution**:
1. Check `index.css` is imported in `main.tsx`
2. Verify `tailwind.config.js` content paths are correct
3. Restart dev server

## 5. Manual Test

Create a simple test to verify React is working:

```tsx
// src/App.tsx - Simplified version
function App() {
  return (
    <div className="min-h-screen bg-blue-500 text-white p-8">
      <h1 className="text-4xl font-bold">Hello Moleui!</h1>
      <p>If you see this, React + Tailwind is working!</p>
    </div>
  );
}

export default App;
```

If this shows up, the issue is with the components. If not, there's a fundamental setup issue.

## 6. Check Vite Server

Open `http://localhost:5173` in a regular browser (not Electron) to see if Vite is serving correctly.

## 7. Verify File Structure

Make sure these files exist:
- `src/main.tsx` - React entry point
- `src/App.tsx` - Main app component
- `src/index.css` - Tailwind imports
- `index.html` - HTML entry point
- `vite.config.ts` - Vite configuration

## 8. Check Console Output

When running `bun run dev`, you should see:

```
VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

If you don't see this, Vite isn't starting properly.

## 9. Nuclear Option

If nothing works, try a clean reinstall:

```bash
# Remove everything
rm -rf node_modules dist .turbo

# Reinstall
bun install

# Try again
bun run dev
```

## 10. Get Help

If still stuck, check:
1. Node/Bun version: `bun --version` (should be 1.3.7+)
2. TypeScript errors: `bun run type-check`
3. Console errors in DevTools
4. Network tab in DevTools

Share the error messages for specific help!
