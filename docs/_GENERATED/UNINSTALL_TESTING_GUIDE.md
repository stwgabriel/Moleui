# Uninstall UI Testing Guide

## Prerequisites

1. **Build the desktop app:**
   ```bash
   bun run desktop:build
   ```

2. **Start the development server:**
   ```bash
   bun run desktop:dev
   ```

3. **Have some test apps installed** (preferably non-critical apps for testing)

## Test Scenarios

### 1. Initial Load Test

**Steps:**
1. Open the desktop app
2. Navigate to the Uninstall page
3. Click "Scan Applications"

**Expected Results:**
- ✅ Loading spinner appears
- ✅ "Scanning applications..." message shows
- ✅ Progress updates (e.g., "0/50", "25/50")
- ✅ Scan completes within reasonable time
- ✅ App list appears with all installed apps

**What to Check:**
- No console errors
- Smooth transitions
- Accurate app count
- All apps have names, sizes, and sources

---

### 2. App Selection Test

**Steps:**
1. After scan completes, select 2-3 apps
2. Try "Select All" button
3. Try "Deselect All" button
4. Select specific apps again

**Expected Results:**
- ✅ Checkboxes toggle correctly
- ✅ Selected count updates (e.g., "2 of 50 selected")
- ✅ "Continue" button enables when apps selected
- ✅ "Continue" button disables when none selected

**What to Check:**
- Checkbox states persist
- Count is accurate
- Button states are correct

---

### 3. Dry Run Test (Critical)

**Steps:**
1. Select 1-2 apps
2. Click "Continue"
3. Watch the confirmation screen

**Expected Results:**
- ✅ Selected apps list appears at top
- ✅ "Analyzing files..." header shows
- ✅ Loading spinner appears
- ✅ **App cards appear in real-time** as CLI outputs
- ✅ Each app card shows:
  - App icon (📦)
  - App name
  - Total size
  - Status icon (⏱️ → ✅)
- ✅ **File items appear nested under each app**:
  - File type icons (📦 🗄️ ⚙️ 📄 📁)
  - File paths (truncated with ~)
  - System files marked with 🛡️ and "System" badge
- ✅ Summary card appears at end:
  - "Dry Run Complete"
  - "Would remove X apps, Y MB"

**What to Check:**
- Cards appear progressively (not all at once)
- Files are nested under correct app
- System files have warning badges
- No duplicate files
- Auto-scroll works
- Icons render correctly
- Summary is accurate

**CLI Output to Watch For:**
```
Files to be removed:

✓ AppName, 123 MB
  ✓ /Applications/AppName.app
  ✓ ~/Library/Caches/...
  ⚠ System: /Library/...
  
Would remove X apps, Y MB
```

---

### 4. Confirmation Test

**Steps:**
1. After dry run completes, review the file list
2. Click "Cancel" button
3. Repeat dry run
4. Click "Uninstall X Apps" button

**Expected Results:**
- ✅ Cancel returns to selection screen
- ✅ Uninstall button shows correct count
- ✅ Confirmation prompt appears (if interactive)

**What to Check:**
- Cancel works correctly
- State is preserved
- Button labels are accurate

---

### 5. Execution Test (Critical)

**Steps:**
1. Confirm uninstallation
2. Watch the execution screen

**Expected Results:**
- ✅ "Uninstalling Applications" header shows
- ✅ "Do not close this window" warning appears
- ✅ **Operation card shows:**
  - Progress bar (e.g., 50% filled)
  - Progress text (e.g., "2 of 4")
  - Current operation (e.g., "Uninstalling Chrome...")
  - Spinner animation
- ✅ **Removed app cards appear in real-time:**
  - Success icon (✅)
  - App name
  - Progress indicator (e.g., "1 of 4")
  - Nested file list with checkmarks
- ✅ **Files show as they're deleted:**
  - File icon
  - File path
  - Checkmark (✓)
- ✅ **Completion summary appears:**
  - "Uninstall Complete"
  - "Removed X apps, freed Y MB"

**What to Check:**
- Progress bar advances smoothly
- Current operation updates
- Cards appear as apps are removed
- Files appear as they're deleted
- No duplicate entries
- Auto-scroll works
- Final summary is accurate

**CLI Output to Watch For:**
```
[1/2] Uninstalling AppName...
✓ [1/2] AppName
  ✓ /Applications/AppName.app
  ✓ ~/Library/Caches/...
  
[2/2] Uninstalling OtherApp...
✓ [2/2] OtherApp
  
Removed 2 apps, freed 579 MB
```

---

### 6. Error Handling Test

**Steps:**
1. Try to uninstall a protected app (if possible)
2. Try to uninstall an app that's running
3. Try to uninstall without admin permissions

**Expected Results:**
- ✅ Warning cards appear for errors
- ✅ Error messages are clear
- ✅ Process continues for other apps
- ✅ Failed apps are listed in summary

**What to Check:**
- Errors don't crash the UI
- Warning cards are visible
- Error messages are helpful
- Partial success is handled

---

### 7. Edge Cases Test

**Steps:**
1. Select 10+ apps
2. Select apps with very long names
3. Select apps with many files (100+)
4. Cancel during execution (if possible)

**Expected Results:**
- ✅ Many apps handled smoothly
- ✅ Long names truncate with ellipsis
- ✅ File lists scroll independently
- ✅ Cancel stops gracefully

**What to Check:**
- Performance remains good
- UI doesn't break
- Scrolling works
- Memory usage is reasonable

---

### 8. Visual Polish Test

**Steps:**
1. Hover over cards
2. Scroll through file lists
3. Watch animations
4. Check colors and spacing

**Expected Results:**
- ✅ Cards lift on hover
- ✅ Smooth scrolling
- ✅ Animations are fluid (not janky)
- ✅ Colors are consistent
- ✅ Spacing is even
- ✅ Icons are aligned

**What to Check:**
- Hover effects work
- Animations are smooth (60fps)
- No layout shifts
- Consistent design language

---

### 9. Cleanup Test

**Steps:**
1. Complete an uninstall
2. Click "Done"
3. Navigate to another page
4. Return to uninstall page

**Expected Results:**
- ✅ State resets correctly
- ✅ No memory leaks
- ✅ Fresh scan starts
- ✅ No leftover listeners

**What to Check:**
- Console for errors
- Memory usage in DevTools
- Event listeners are cleaned up

---

## Console Debugging

Open DevTools (Cmd+Option+I) and check:

### Expected Console Output
```
[Uninstall] Scanning applications...
[Uninstall] Found 50 applications
[Uninstall] Starting dry run for 2 apps
[Uninstall] Dry run complete
[Uninstall] Starting uninstall for 2 apps
[Uninstall] Uninstall complete
```

### Unexpected Console Output (Errors)
```
❌ TypeError: Cannot read property 'querySelector' of null
❌ ReferenceError: lucide is not defined
❌ Error: Failed to parse CLI output
❌ Warning: Duplicate file detected
```

---

## Performance Benchmarks

### Scan Performance
- **50 apps**: < 5 seconds
- **100 apps**: < 10 seconds
- **200 apps**: < 20 seconds

### Dry Run Performance
- **1 app**: < 2 seconds
- **5 apps**: < 5 seconds
- **10 apps**: < 10 seconds

### Execution Performance
- **1 app**: < 5 seconds
- **5 apps**: < 30 seconds
- **10 apps**: < 60 seconds

### UI Performance
- **Frame rate**: 60fps during animations
- **Memory**: < 200MB for typical usage
- **CPU**: < 20% during streaming

---

## Known Issues to Watch For

### Potential Issues
1. **ANSI codes not stripped** - Colors/formatting in text
2. **Duplicate files** - Same file appears multiple times
3. **Missing icons** - Lucide icons not rendering
4. **Layout shifts** - Content jumps during updates
5. **Scroll issues** - Auto-scroll not working
6. **Memory leaks** - Listeners not cleaned up

### How to Verify
1. Check file paths for escape codes
2. Count file items vs unique paths
3. Inspect elements for `<i data-lucide="...">` with SVG
4. Watch for content jumping
5. Test scroll position after updates
6. Monitor memory in DevTools

---

## Success Criteria

### Must Have ✅
- [x] Real-time streaming works
- [x] App cards appear progressively
- [x] Files are nested correctly
- [x] System files are marked
- [x] Progress bar updates
- [x] Summary is accurate
- [x] No console errors
- [x] Smooth animations

### Nice to Have 🎯
- [ ] Collapsible app cards
- [ ] Search/filter files
- [ ] Export file list
- [ ] Pause/resume
- [ ] Undo functionality

---

## Reporting Issues

When reporting issues, include:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Console errors** (screenshot)
5. **CLI output** (if visible)
6. **System info** (macOS version, app count)

Example:
```
Issue: Files not appearing in dry run

Steps:
1. Selected Safari
2. Clicked Continue
3. Dry run started

Expected: File list appears under Safari card
Actual: Only app card appears, no files

Console: TypeError: Cannot read property 'appendChild' of null

CLI Output: [paste CLI output here]

System: macOS 14.2, 50 apps installed
```

---

## Quick Test Checklist

Use this for rapid testing:

- [ ] Scan loads apps
- [ ] Selection works
- [ ] Dry run shows cards
- [ ] Files appear nested
- [ ] System files marked
- [ ] Summary appears
- [ ] Execution shows progress
- [ ] Apps removed in real-time
- [ ] Files show checkmarks
- [ ] Completion summary
- [ ] No console errors
- [ ] Smooth animations
- [ ] Cleanup works

---

## Next Steps After Testing

1. **Document any bugs found**
2. **Note performance issues**
3. **Suggest improvements**
4. **Test on different macOS versions**
5. **Test with various app counts**
6. **Verify accessibility**
7. **Check mobile responsiveness** (if applicable)
