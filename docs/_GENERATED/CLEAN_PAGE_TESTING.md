# Clean Page - Testing Guide

## Quick Start

### Running the Desktop App

```bash
# From the root of the project
cd apps/desktop

# Install dependencies (if not already done)
npm install

# Run in development mode
npm run dev
```

The app will launch and you can navigate to the Clean page from the sidebar.

## Manual Testing Checklist

### 1. Category Selection Stage

#### Visual Tests
- [ ] Page loads with "Select Categories to Clean" header
- [ ] All 6 categories are displayed in a grid
- [ ] Each category shows icon, name, and description
- [ ] Icons have correct colors (blue, purple, cyan, green, amber, red)
- [ ] "Scan Selected" button is disabled initially
- [ ] "Select All" button is visible

#### Interaction Tests
- [ ] Click a category - it becomes selected (blue border, checkmark)
- [ ] Click again - it becomes unselected
- [ ] "Scan Selected" button shows count: "(1)", "(2)", etc.
- [ ] "Scan Selected" button enables when at least one selected
- [ ] Click "Select All" - all categories become selected
- [ ] Click "Select All" again - all categories become unselected
- [ ] Hover over category - shows lift animation and shadow
- [ ] Hover over buttons - shows lift animation

#### Keyboard Tests
- [ ] Tab through categories and buttons
- [ ] Focus indicators are visible (blue outline)
- [ ] Enter/Space activates focused element
- [ ] Keyboard navigation works smoothly

### 2. Scanning Stage

#### Visual Tests
- [ ] Clicking "Scan Selected" transitions to scanning stage
- [ ] Large spinning icon with search symbol appears
- [ ] "Scanning System..." title is displayed
- [ ] Subtitle shows "Analyzing selected categories..."
- [ ] Progress bar is visible and animating
- [ ] Spinner rotates smoothly (360° per second)

#### Backend Tests
- [ ] Check browser console for IPC calls
- [ ] Verify `mole clean --dry-run` is executed
- [ ] Stdout messages appear in console
- [ ] Progress updates are received
- [ ] Scan completes and transitions to results

#### Error Handling
- [ ] If scan fails, error message is shown
- [ ] Can return to selection stage after error
- [ ] Error details are logged to console

### 3. Results Stage

#### Visual Tests
- [ ] "Scan Results" header is displayed
- [ ] Subtitle shows total cleanable size
- [ ] Two summary cards appear:
  - [ ] "Total Cleanable" with size
  - [ ] "Total Items" with count
- [ ] Results list shows each selected category
- [ ] Each result item shows:
  - [ ] Category icon with color
  - [ ] Category name
  - [ ] File count and size
  - [ ] Large size number on right
- [ ] "Clean Now" button is visible
- [ ] "Back" button is visible

#### Interaction Tests
- [ ] Hover over summary cards - lift animation
- [ ] Hover over result items - slide right animation
- [ ] Click "Clean Now" - transitions to cleaning stage
- [ ] Click "Back" - returns to selection stage
- [ ] Scroll through results list (if many items)
- [ ] Custom scrollbar appears when scrolling

#### Data Validation
- [ ] Sizes are formatted correctly (B, KB, MB, GB, TB)
- [ ] File counts are reasonable numbers
- [ ] Total size matches sum of categories
- [ ] No negative numbers or NaN values

### 4. Cleaning Stage

#### Visual Tests
- [ ] "Cleaning..." title is displayed
- [ ] Spinning icon with trash symbol appears
- [ ] Current operation text is shown
- [ ] Progress bar shows completion percentage
- [ ] Size cleaned vs total size is displayed
- [ ] Progress bar fills from left to right

#### Backend Tests
- [ ] Check console for `mole clean` execution (no dry-run)
- [ ] Stdout messages update current operation
- [ ] Progress bar updates as cleaning progresses
- [ ] Size cleaned increases over time
- [ ] Cleaning completes and transitions to complete stage

#### Progress Tests
- [ ] Progress bar starts at 0%
- [ ] Progress bar increases smoothly
- [ ] Progress bar reaches 100% at completion
- [ ] Current operation text updates in real-time
- [ ] Size cleaned never exceeds total size

### 5. Complete Stage

#### Visual Tests
- [ ] Large success icon (checkmark) appears
- [ ] Icon has scale-in animation (bouncy)
- [ ] "Cleaning Complete!" title is displayed
- [ ] Subtitle shows total space freed
- [ ] Two statistics cards appear:
  - [ ] "Space Recovered" with size
  - [ ] "Items Removed" with count
- [ ] "Done" button is visible

#### Interaction Tests
- [ ] Hover over stat cards - lift animation
- [ ] Click "Done" - returns to selection stage
- [ ] State is reset (no categories selected)
- [ ] Can start a new cleaning cycle

#### Animation Tests
- [ ] Success icon scales in with bounce
- [ ] Animation completes in ~400ms
- [ ] No animation jank or stuttering
- [ ] Respects prefers-reduced-motion

## Automated Testing

### Unit Tests (Future)

```javascript
// Example test structure
describe('Clean Page', () => {
  describe('Category Selection', () => {
    it('should select category on click', () => {
      // Test implementation
    });
    
    it('should enable scan button when category selected', () => {
      // Test implementation
    });
  });
  
  describe('Scanning', () => {
    it('should execute dry-run command', () => {
      // Test implementation
    });
    
    it('should parse scan results', () => {
      // Test implementation
    });
  });
  
  // More tests...
});
```

### Integration Tests (Future)

```javascript
// Example integration test
describe('Clean Workflow', () => {
  it('should complete full cleaning cycle', async () => {
    // 1. Select categories
    // 2. Click scan
    // 3. Wait for results
    // 4. Click clean
    // 5. Wait for completion
    // 6. Verify success
  });
});
```

## Performance Testing

### Metrics to Monitor

1. **Initial Load Time**
   - Target: < 100ms
   - Measure: Time from navigation to first paint

2. **Category Selection Response**
   - Target: < 50ms
   - Measure: Time from click to visual update

3. **Stage Transition Time**
   - Target: 400ms (animation duration)
   - Measure: Time from button click to new stage render

4. **Animation Frame Rate**
   - Target: 60fps
   - Measure: Use browser DevTools Performance tab

5. **Memory Usage**
   - Target: < 50MB for clean page
   - Measure: Use browser DevTools Memory profiler

### Performance Testing Steps

1. Open Chrome DevTools
2. Go to Performance tab
3. Start recording
4. Navigate to Clean page
5. Perform full workflow
6. Stop recording
7. Analyze results:
   - Check for long tasks (> 50ms)
   - Verify 60fps during animations
   - Look for memory leaks
   - Check for unnecessary re-renders

## Accessibility Testing

### Screen Reader Testing

1. **macOS VoiceOver:**
   ```bash
   # Enable VoiceOver
   Cmd + F5
   ```
   - [ ] Navigate through page with VO keys
   - [ ] All interactive elements are announced
   - [ ] Button states are announced
   - [ ] Progress updates are announced

2. **NVDA (Windows):**
   - [ ] Similar tests as VoiceOver

### Keyboard Navigation Testing

1. **Tab Order:**
   - [ ] Tab through all interactive elements
   - [ ] Order follows visual hierarchy
   - [ ] No keyboard traps

2. **Focus Indicators:**
   - [ ] All focused elements have visible outline
   - [ ] Outline is 2px solid blue
   - [ ] Outline has 2px offset

3. **Keyboard Shortcuts:**
   - [ ] Enter activates buttons
   - [ ] Space toggles categories
   - [ ] Escape cancels (if applicable)

### Color Contrast Testing

1. **Use WebAIM Contrast Checker:**
   - [ ] Text on backgrounds: 4.5:1 minimum
   - [ ] Large text: 3:1 minimum
   - [ ] Icons: 3:1 minimum

2. **Test in Dark Mode:**
   - [ ] All text is readable
   - [ ] Contrast ratios maintained
   - [ ] Colors are adjusted properly

### Reduced Motion Testing

1. **Enable Reduced Motion:**
   ```css
   /* macOS System Preferences */
   System Preferences > Accessibility > Display > Reduce motion
   ```

2. **Verify:**
   - [ ] Animations are disabled or minimal
   - [ ] Page is still functional
   - [ ] No jarring transitions

## Browser Compatibility

### Electron (Primary Target)
- [ ] All features work
- [ ] Animations are smooth
- [ ] IPC communication works
- [ ] No console errors

### Chrome (Testing)
- [ ] Visual appearance matches
- [ ] Animations work (without IPC)
- [ ] Responsive layout works

### Safari (Testing)
- [ ] Backdrop-filter works
- [ ] Grid layout works
- [ ] Animations work

## Responsive Testing

### Desktop (1920x1080)
- [ ] Grid shows 3 columns
- [ ] All content fits without scrolling
- [ ] Sidebar is expanded by default

### Laptop (1440x900)
- [ ] Grid shows 2-3 columns
- [ ] Content is readable
- [ ] Sidebar can collapse

### Tablet (768x1024)
- [ ] Grid shows 2 columns
- [ ] Sidebar collapses
- [ ] Touch targets are large enough

### Mobile (375x667)
- [ ] Grid shows 1 column
- [ ] Sidebar is hidden
- [ ] All features accessible

## Edge Cases

### No Categories Selected
- [ ] Scan button is disabled
- [ ] Clicking disabled button does nothing
- [ ] Visual feedback shows disabled state

### All Categories Selected
- [ ] "Select All" button toggles to unselect
- [ ] All categories show checkmarks
- [ ] Scan button shows correct count

### Zero Results
- [ ] Results stage shows "0 B" cleanable
- [ ] Clean button is disabled or shows message
- [ ] Can return to selection

### Very Large Results
- [ ] Sizes > 1 TB are formatted correctly
- [ ] File counts > 1M are formatted correctly
- [ ] No number overflow or display issues

### Scan Failure
- [ ] Error message is shown
- [ ] Can retry or go back
- [ ] No broken state

### Clean Failure
- [ ] Partial results are shown
- [ ] Error details are available
- [ ] Can return to selection

### Interrupted Clean
- [ ] If process is killed, state is handled
- [ ] No hanging spinners
- [ ] Can restart

## Regression Testing

### After Code Changes
- [ ] Run through full workflow
- [ ] Check all animations
- [ ] Verify no console errors
- [ ] Test keyboard navigation
- [ ] Test in dark mode
- [ ] Test responsive layouts

### Before Release
- [ ] Complete full manual test checklist
- [ ] Run performance tests
- [ ] Run accessibility tests
- [ ] Test on multiple screen sizes
- [ ] Test with real backend (not mock data)

## Bug Reporting Template

```markdown
### Bug Description
[Clear description of the issue]

### Steps to Reproduce
1. Navigate to Clean page
2. Select System Caches
3. Click Scan Selected
4. [Issue occurs]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Environment
- OS: macOS 14.0
- Electron: 35.5.1
- Screen Size: 1920x1080
- Dark Mode: Yes/No

### Screenshots
[Attach screenshots if applicable]

### Console Errors
[Paste any console errors]

### Additional Context
[Any other relevant information]
```

## Test Data

### Mock Scan Results (for testing without backend)

```javascript
const mockResults = {
  'system-caches': {
    size: 2147483648,  // 2 GB
    fileCount: 8234
  },
  'user-caches': {
    size: 1073741824,  // 1 GB
    fileCount: 4521
  },
  'browser-data': {
    size: 1932735283,  // 1.8 GB
    fileCount: 3421
  },
  'logs': {
    size: 536870912,   // 512 MB
    fileCount: 2156
  },
  'downloads': {
    size: 268435456,   // 256 MB
    fileCount: 89
  },
  'trash': {
    size: 314572800,   // 300 MB
    fileCount: 1192
  }
};
```

## Continuous Testing

### Daily Checks
- [ ] App launches successfully
- [ ] Clean page loads
- [ ] Basic workflow works

### Weekly Checks
- [ ] Full manual test checklist
- [ ] Performance metrics
- [ ] Accessibility audit

### Before Release
- [ ] Complete regression testing
- [ ] All edge cases tested
- [ ] Documentation updated
- [ ] Known issues documented

## Success Criteria

The Clean page is considered fully tested and ready for release when:

✅ All manual test checklist items pass
✅ No critical bugs or errors
✅ Performance metrics meet targets
✅ Accessibility standards met (WCAG 2.1 AA)
✅ Works on all supported platforms
✅ Responsive on all screen sizes
✅ Dark mode works correctly
✅ Animations are smooth (60fps)
✅ Backend integration works
✅ Error handling is robust

## Conclusion

This testing guide provides comprehensive coverage of the Clean page functionality. Follow this checklist before each release to ensure quality and reliability. Report any issues using the bug template and track them until resolved.

Happy testing! 🧪✨
