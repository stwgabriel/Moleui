# Uninstall Feature - Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Build the Desktop App

```bash
# From project root
bun run desktop:build
```

This will:
- Copy the mole runtime to `.mole-runtime/`
- Copy all necessary scripts (`bin/uninstall.sh`, `bin/status.sh`)
- Copy all required libraries (`lib/core/`, `lib/ui/`, `lib/uninstall/`)
- Build Go binaries (`status-go`)
- Set up the Electron environment

**Important**: If you previously built the app before this update, you **must** rebuild to get the uninstall dependencies:
```bash
# Clean and rebuild
rm -rf apps/desktop/.mole-runtime
bun run desktop:build
```

### 2. Run the App

```bash
bun run desktop:dev
```

The app will open automatically.

### 3. Test the Uninstall Feature

1. Click **"Uninstall"** in the sidebar
2. Click **"Scan Applications"**
3. Wait for the app list to load
4. Select a few apps (use checkboxes)
5. Click **"Continue"**
6. Review the dry-run results
7. Click **"Cancel"** (don't actually uninstall yet!)

## 🎯 What You Should See

### Stage 1: Idle
```
┌─────────────────────────────────┐
│     📦                          │
│  Ready to Uninstall Apps        │
│  [Scan Applications]            │
└─────────────────────────────────┘
```

### Stage 2: Loading
```
┌─────────────────────────────────┐
│     ⟳ Spinner                   │
│  Scanning Applications...       │
│  ✓ Scanning directories         │
│  ✓ Collecting metadata          │
│  ✓ Building index               │
└─────────────────────────────────┘
```

### Stage 3: Selection
```
┌─────────────────────────────────┐
│ Select Apps to Uninstall        │
│ 3 of 45 selected                │
│                                 │
│ [Select All]  [Continue →]     │
│                                 │
│ ☑ Chrome      App      450 MB  │
│ ☐ Docker      Homebrew 1.2 GB  │
│ ☑ Slack       App      180 MB  │
└─────────────────────────────────┘
```

### Stage 4: Confirmation
```
┌─────────────────────────────────┐
│ ⚠️  Confirm Uninstallation      │
│                                 │
│ Files to be removed:            │
│ ✓ /Applications/Chrome.app      │
│ ✓ ~/Library/Caches/...          │
│ ⚠ System: /Library/...          │
│                                 │
│ [Cancel]  [Uninstall 3 Apps]   │
└─────────────────────────────────┘
```

## 🔍 Quick Checks

### ✅ Everything Working?

Run through this checklist:

- [ ] App opens without errors
- [ ] Sidebar navigation works
- [ ] Uninstall page loads
- [ ] Scan button works
- [ ] App list displays
- [ ] Checkboxes work
- [ ] Selection count updates
- [ ] Continue button enables/disables
- [ ] Dry-run shows file list
- [ ] Cancel returns to selection
- [ ] No console errors

### ❌ Something Wrong?

**App won't start?**
```bash
# Rebuild the runtime
bun run desktop:build

# Check if mole exists
ls -la apps/desktop/.mole-runtime/mole
```

**"Mole runtime is missing"?**
```bash
# Make sure you built first
bun run desktop:build

# Verify the runtime directory
ls -la apps/desktop/.mole-runtime/
```

**No apps showing up?**
```bash
# Test the CLI directly
./apps/desktop/.mole-runtime/mole uninstall --list

# Should output JSON array of apps
```

**Console errors?**
```bash
# Open DevTools
Cmd + Option + I

# Check Console tab for errors
# Check Network tab for failed requests
```

## 🎨 Visual Testing

### Light Mode (Default)
- Background: Soft blue-grey
- Text: Near black
- Accents: Blue, amber, red, green
- Shadows: Subtle and soft

### Dark Mode
```bash
# Switch macOS to dark mode
System Preferences → General → Appearance → Dark

# Reload the app
Cmd + R
```

- Background: Deep slate
- Text: Near white
- Accents: Lighter variants
- Shadows: Darker and stronger

### Animations
- Hover over buttons → Should lift slightly
- Hover over table rows → Should highlight
- Page transitions → Should slide smoothly
- Spinner → Should rotate continuously

## 🧪 Safe Testing

### Test with Dry-Run Only

**DO NOT** actually uninstall apps yet! Just test the UI:

1. Select apps
2. Click "Continue"
3. Review dry-run results
4. Click "Cancel"
5. Repeat

### Test Apps (Safe to Uninstall)

If you want to test actual uninstallation:

```bash
# Install a test app via Homebrew
brew install --cask rectangle

# Now uninstall it via the GUI
# It's easy to reinstall if needed
```

## 📊 Performance Expectations

| Operation | Expected Time |
|-----------|---------------|
| Scan 50 apps | 2-5 seconds |
| Dry-run 3 apps | 1-3 seconds |
| Page transition | < 400ms |
| Button hover | < 150ms |

If things are slower, check:
- CPU usage (Activity Monitor)
- Memory usage (should be < 300 MB)
- Console for errors

## 🐛 Common Issues

### Issue: Blank page after clicking Uninstall

**Solution**: Check console for errors
```javascript
// Should see in console:
// "UninstallPage initialized"
```

### Issue: Scan button does nothing

**Solution**: Check IPC communication
```javascript
// In DevTools console:
await window.moleDesktop.uninstall.list()
// Should return { ok: true, stdout: "[...]" }
```

### Issue: Styling looks broken

**Solution**: Verify CSS loaded
```javascript
// In DevTools console:
getComputedStyle(document.body).getPropertyValue('--accent-primary')
// Should return: "rgb(59, 130, 246)"
```

### Issue: Icons not showing

**Solution**: Check Lucide loaded
```javascript
// In DevTools console:
window.lucide
// Should be an object with createIcons function
```

## 📝 Development Tips

### Hot Reload

Changes to these files require restart:
- `main.js` (main process)
- `preload.js` (preload script)

Changes to these files auto-reload:
- `renderer.js` (renderer process)
- `uninstall-page.js` (page module)
- `styles.css` (styling)
- `index.html` (markup)

Just press `Cmd + R` to reload!

### Debug Mode

Enable verbose logging:
```bash
export MO_DEBUG=1
bun run desktop:dev
```

### DevTools Shortcuts

- `Cmd + Option + I` - Open DevTools
- `Cmd + R` - Reload app
- `Cmd + Shift + R` - Hard reload
- `Cmd + Option + J` - Open console directly

## 🎓 Next Steps

Once basic testing works:

1. **Read the docs**:
   - [Technical Documentation](../../docs/uninstall-desktop-integration.md)
   - [Visual Guide](../../docs/uninstall-ui-stages.md)
   - [Testing Guide](./UNINSTALL_TESTING.md)

2. **Test thoroughly**:
   - Follow the testing checklist
   - Try edge cases
   - Test accessibility

3. **Customize**:
   - Modify colors in `styles.css`
   - Add features to `uninstall-page.js`
   - Extend IPC handlers in `main.js`

## 🆘 Need Help?

### Check the Logs

**Main process** (terminal output):
```bash
# Look for errors in the terminal where you ran:
bun run desktop:dev
```

**Renderer process** (DevTools console):
```bash
# Open DevTools and check Console tab
Cmd + Option + I
```

**CLI output** (IPC responses):
```javascript
// In DevTools console:
const result = await window.moleDesktop.uninstall.list()
console.log(result.stdout)  // Success output
console.log(result.stderr)  // Error output
```

### Test the CLI Directly

```bash
# Navigate to runtime directory
cd apps/desktop/.mole-runtime

# Test list command
./mole uninstall --list

# Test dry-run
./mole uninstall --dry-run "AppName"
```

### Verify File Structure

```bash
# Check all files exist
ls -la apps/desktop/
# Should see:
# - main.js
# - preload.js
# - renderer.js
# - uninstall-page.js
# - index.html
# - styles.css
# - .mole-runtime/
```

## ✨ Success!

If you can:
- ✅ Open the app
- ✅ Navigate to Uninstall page
- ✅ Scan applications
- ✅ Select apps
- ✅ See dry-run results
- ✅ Cancel back to selection

**Congratulations!** The uninstall feature is working correctly. 🎉

Now you can:
- Test more thoroughly
- Customize the UI
- Add new features
- Report bugs
- Contribute improvements

---

**Happy Testing!** 🚀

For detailed information, see:
- [Full Documentation](../../docs/gui-uninstall-implementation.md)
- [Testing Guide](./UNINSTALL_TESTING.md)
