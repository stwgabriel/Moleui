# Testing the Uninstall Feature

## Quick Start

1. **Build the desktop app**:
   ```bash
   bun run desktop:build
   ```

2. **Run the app**:
   ```bash
   bun run desktop:dev
   ```

3. **Navigate to Uninstall page**:
   - Click "Uninstall" in the sidebar
   - Or navigate to `#uninstall` in the URL

## Testing Checklist

### Stage 1: Idle → Loading → Selection

- [ ] Click "Scan Applications" button
- [ ] Verify loading spinner appears
- [ ] Verify loading steps are displayed
- [ ] Wait for app list to load
- [ ] Verify apps are displayed in table format
- [ ] Check that app names, paths, sources, and sizes are shown

### Stage 2: Selection Interactions

- [ ] Click individual checkboxes to select apps
- [ ] Verify selected count updates correctly
- [ ] Click "Select All" button
- [ ] Verify all apps are selected
- [ ] Click "Deselect All" (button text should change)
- [ ] Verify all apps are deselected
- [ ] Select 2-3 apps manually
- [ ] Verify "Continue" button is enabled
- [ ] Deselect all apps
- [ ] Verify "Continue" button is disabled

### Stage 3: Confirmation (Dry Run)

- [ ] Select 1-2 small apps (avoid large apps for faster testing)
- [ ] Click "Continue"
- [ ] Verify confirmation screen appears
- [ ] Check warning icon and message are displayed
- [ ] Verify selected apps are listed with icons
- [ ] Wait for dry-run results to load
- [ ] Verify file list is displayed
- [ ] Check for color-coded output (success, warning, system)
- [ ] Scroll through file list if needed
- [ ] Click "Cancel"
- [ ] Verify return to selection stage
- [ ] Verify previous selection is maintained

### Stage 4: Execution (Dry Run Mode)

**Important**: Test with `--dry-run` first!

- [ ] Select a test app (something you can reinstall easily)
- [ ] Click "Continue"
- [ ] Click "Uninstall X Apps"
- [ ] Verify executing screen appears
- [ ] Check spinner is animating
- [ ] Verify "Do not close this window" warning
- [ ] Wait for completion
- [ ] Verify results screen appears

### Stage 5: Results

- [ ] Check success/error icon
- [ ] Verify summary message
- [ ] Review output details
- [ ] Scroll through output if needed
- [ ] Click "Done"
- [ ] Verify return to idle state

### Stage 6: Error Handling

Test error scenarios:

- [ ] Disconnect network (if using remote resources)
- [ ] Try to uninstall a protected app
- [ ] Cancel during execution (if possible)
- [ ] Verify error messages are clear
- [ ] Check "Try Again" button works

## Visual Testing

### Light Mode
- [ ] All text is readable
- [ ] Colors match design system
- [ ] Shadows are visible but subtle
- [ ] Glassmorphism effects work

### Dark Mode
- [ ] Switch system to dark mode
- [ ] Verify all colors adapt correctly
- [ ] Check text contrast is sufficient
- [ ] Verify glassmorphism works in dark mode

### Animations
- [ ] Hover effects on buttons
- [ ] Hover effects on table rows
- [ ] Page transitions are smooth
- [ ] Spinner rotates smoothly
- [ ] Pulse animations on loading steps

### Reduced Motion
- [ ] Enable "Reduce motion" in system preferences
- [ ] Verify animations are disabled/minimal
- [ ] Check functionality still works

## Browser DevTools Testing

### Console
- [ ] Open DevTools (Cmd+Option+I)
- [ ] Check for JavaScript errors
- [ ] Verify no warnings about missing resources

### Network
- [ ] Monitor IPC calls
- [ ] Verify commands are sent correctly
- [ ] Check response times

### Performance
- [ ] Record performance during scan
- [ ] Check for memory leaks
- [ ] Verify smooth scrolling in large lists

## Edge Cases

### Empty State
- [ ] Test with no applications installed (unlikely but possible)
- [ ] Verify appropriate message is shown

### Large Lists
- [ ] Test with many apps (100+)
- [ ] Verify scrolling performance
- [ ] Check selection performance

### Long App Names
- [ ] Test with apps that have very long names
- [ ] Verify text truncation works
- [ ] Check tooltips if implemented

### Special Characters
- [ ] Test with apps containing special characters
- [ ] Verify proper escaping (no XSS)
- [ ] Check display is correct

## CLI Integration Testing

### Manual CLI Tests

1. **List command**:
   ```bash
   ./apps/desktop/.mole-runtime/mole uninstall --list
   ```
   - Verify JSON output
   - Check all fields are present

2. **Dry-run command**:
   ```bash
   ./apps/desktop/.mole-runtime/mole uninstall --dry-run "AppName"
   ```
   - Verify file list output
   - Check formatting

3. **Execute command** (careful!):
   ```bash
   ./apps/desktop/.mole-runtime/mole uninstall --dry-run "TestApp"
   ```
   - Use `--dry-run` for safety
   - Verify output format

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Verify focus indicators are visible
- [ ] Check Enter key works on buttons
- [ ] Test Space key on checkboxes

### Screen Reader
- [ ] Enable VoiceOver (Cmd+F5)
- [ ] Navigate through the page
- [ ] Verify all elements are announced
- [ ] Check ARIA labels are correct

### Color Contrast
- [ ] Use browser DevTools contrast checker
- [ ] Verify all text meets WCAG AA (4.5:1)
- [ ] Check large text meets WCAG AA (3:1)

## Performance Benchmarks

### Expected Times
- **Scan**: 2-5 seconds for 50 apps
- **Dry-run**: 1-3 seconds for 3 apps
- **Execute**: 5-30 seconds depending on app size
- **Page transitions**: < 400ms

### Memory Usage
- **Idle**: ~100-150 MB
- **With 100 apps loaded**: ~150-200 MB
- **During execution**: ~200-300 MB

## Known Limitations

1. **No real-time progress**: Execution shows spinner but no file-by-file progress
2. **No undo**: Once executed, apps are removed (use Trash mode in CLI)
3. **No app icons**: Uses generic package icon for all apps
4. **No search/filter**: Must scroll to find apps in large lists
5. **No sorting**: Apps are sorted by last used date (from CLI)

## Debugging Tips

### Enable Debug Mode
```bash
export MO_DEBUG=1
bun run desktop:dev
```

### Check Logs
- **Main process**: Terminal output
- **Renderer process**: DevTools console
- **CLI output**: Check stderr in IPC responses

### Common Issues

**"Mole runtime is missing"**
- Run `bun run desktop:build` first
- Check `.mole-runtime/` directory exists

**"No applications found"**
- Verify CLI command works manually
- Check permissions on `/Applications`

**"Failed to parse application list"**
- Check CLI output format
- Verify JSON is valid

**Styling issues**
- Clear browser cache
- Check CSS file is loaded
- Verify Lucide icons are loaded

## Reporting Issues

When reporting bugs, include:
1. **Stage** where issue occurred
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Console errors** (if any)
6. **Screenshots** (if visual issue)
7. **System info** (macOS version, Electron version)

## Test Apps

Safe apps to test with (easy to reinstall):
- **Homebrew casks**: `brew install --cask rectangle`
- **Small utilities**: TextEdit, Calculator (don't actually uninstall!)
- **Test apps**: Create dummy .app bundles for testing

## Automated Testing (Future)

Consider adding:
- [ ] Unit tests for `UninstallPage` class
- [ ] Integration tests for IPC communication
- [ ] E2E tests with Playwright/Spectron
- [ ] Visual regression tests
- [ ] Performance benchmarks

## Success Criteria

The uninstall feature is working correctly when:
- ✅ All stages transition smoothly
- ✅ No console errors
- ✅ UI is responsive and performant
- ✅ Dry-run shows accurate file list
- ✅ Execution completes successfully
- ✅ Error handling works gracefully
- ✅ Accessibility requirements met
- ✅ Works in both light and dark mode
- ✅ Animations are smooth (or disabled with reduced motion)
