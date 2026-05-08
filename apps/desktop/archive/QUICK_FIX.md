# Quick Fix Guide

## Blank Screen? Try These (In Order)

### 1. Run Diagnostic
```bash
bun run diagnose
```
This will check if all files are in place.

### 2. Install Dependencies
```bash
bun install
```

### 3. Enable DevTools
Edit `main.js`, uncomment line ~27:
```javascript
window.webContents.openDevTools();
```

### 4. Start Dev Server
```bash
bun run dev
```

### 5. Check Console
Look in DevTools Console for errors.

## Common Quick Fixes

### Fix 1: Clean Restart
```bash
rm -rf node_modules dist
bun install
bun run dev
```

### Fix 2: Kill Port
```bash
lsof -ti:5173 | xargs kill -9
bun run dev
```

### Fix 3: Use Test App
```bash
cp src/App.test.tsx src/App.tsx
bun run dev
```

### Fix 4: Check Types
```bash
bun run type-check
```

### Fix 5: Prepare Runtime
```bash
bun run prepare:runtime
bun run dev
```

## Error → Solution

| Error | Solution |
|-------|----------|
| Cannot find module '@/...' | Restart TS server in IDE |
| Failed to resolve import | `bun install` |
| Icon errors | Check icon names are PascalCase |
| White screen | Enable DevTools, check console |
| Styles not working | Check `index.css` imported |
| Port in use | `lsof -ti:5173 \| xargs kill -9` |

## Check If Working

You should see:
- ✅ Vite server on port 5173
- ✅ Electron window opens
- ✅ Sidebar visible
- ✅ No console errors
- ✅ Content loads

## Still Broken?

1. Read `TROUBLESHOOTING.md`
2. Check `TEST_SETUP.md`
3. Run `bun run diagnose`
4. Open DevTools and check Console
5. Share error messages

## One-Liner Fixes

```bash
# Nuclear option
rm -rf node_modules dist && bun install && bun run dev

# Quick restart
lsof -ti:5173 | xargs kill -9 && bun run dev

# Test mode
cp src/App.test.tsx src/App.tsx && bun run dev

# Check everything
bun run diagnose && bun run type-check && bun run dev
```

## Success Checklist

- [ ] `bun run diagnose` passes
- [ ] `bun run type-check` passes
- [ ] Vite starts on port 5173
- [ ] Electron window opens
- [ ] DevTools shows no errors
- [ ] UI is visible

If all checked, you're good! 🎉

## Need More Help?

See full guides:
- `TROUBLESHOOTING.md` - Detailed troubleshooting
- `TEST_SETUP.md` - Testing the setup
- `README.md` - Complete documentation
