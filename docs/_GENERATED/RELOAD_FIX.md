# Reload Fix - Blank Screen Issue

## Problem

When reloading the Electron app on any screen other than Smart Care (e.g., Status, Clean, Optimize, Analyze, Uninstall), the page would become blank and not render properly.

## Root Cause

The issue was caused by a **race condition** during app initialization:

1. When the app loads, the URL hash is preserved (e.g., `#status`)
2. The `renderer.js` script starts executing immediately
3. The page-specific modules (`status-page.js`, `clean-page.js`, etc.) are loaded with the `defer` attribute
4. `renderPage()` was called before these modules were fully loaded
5. The code tried to initialize page modules that didn't exist yet (`window.statusPage` was `undefined`)
6. This resulted in a blank screen because the page content was never properly initialized

**Why Smart Care worked:** Smart Care is the default page with static content that doesn't require a separate JavaScript module, so it rendered successfully even during the race condition.

## Solution

Implemented a **module readiness check** before initializing the app:

### 1. Created `initializeApp()` Function

```javascript
function initializeApp() {
  // Ensure all page modules are loaded
  const checkModulesLoaded = () => {
    const modulesReady = 
      window.statusPage && 
      window.uninstallPage && 
      window.cleanPage && 
      window.optimizePage && 
      window.analyzePage;
    
    if (modulesReady) {
      renderPage();
      window.addEventListener("hashchange", renderPage);
    } else {
      // Retry after a short delay
      setTimeout(checkModulesLoaded, 50);
    }
  };
  
  checkModulesLoaded();
}
```

This function:
- Checks if all page modules are loaded
- Waits (with retry) until they're ready
- Only then calls `renderPage()` and sets up the hashchange listener

### 2. Extracted `initializePageModule()` Helper

Created a reusable function to initialize page-specific modules:

```javascript
function initializePageModule(pageId, wrapper) {
  // Initialize pages based on route
  if (pageId === 'uninstall') {
    const uninstallContainer = wrapper.querySelector('#uninstall-container');
    if (uninstallContainer && window.uninstallPage) {
      window.uninstallPage.init(uninstallContainer);
    }
  }
  
  if (pageId === 'status') {
    const statusContainer = wrapper.querySelector('#status-container');
    if (statusContainer && window.statusPage) {
      window.statusPage.init(statusContainer);
    }
  }
  
  // ... similar for clean, optimize, analyze
}
```

This function:
- Centralizes page module initialization logic
- Used in both first render and page transitions
- Reduces code duplication

### 3. Updated First Render Logic

Modified the first render path to use the new helper:

```javascript
// If this is the first render, just set the content
if (!pageContent.querySelector('.page-content-wrapper')) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-content-wrapper initial-load';
  wrapper.innerHTML = buildPageHTML(newPageData);
  pageContent.appendChild(wrapper);
  
  // Reinitialize lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
  
  // Initialize page-specific modules
  initializePageModule(newPageId, wrapper);  // ← NEW
  
  currentPageId = newPageId;
  return;
}
```

### 4. Updated Initialization Sequence

Changed from immediate execution to DOM-ready check:

```javascript
// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
```

## Benefits

1. **Eliminates race condition** - Ensures all modules are loaded before rendering
2. **Reliable reloads** - Works on any page, not just Smart Care
3. **Better code organization** - Centralized initialization logic
4. **Graceful degradation** - Retries if modules aren't ready yet
5. **No breaking changes** - Maintains existing functionality

## Testing

To verify the fix:

1. Start the desktop app: `bun run desktop:dev`
2. Navigate to Status page
3. Reload the app (Cmd+R or Ctrl+R)
4. **Expected:** Status page renders correctly
5. Repeat for Clean, Optimize, Analyze, and Uninstall pages

All pages should now render properly on reload, not just Smart Care.

## Files Modified

- `apps/desktop/renderer.js` - Main renderer logic with initialization fixes

## Related Issues

This fix resolves the blank screen issue when reloading on non-default pages while maintaining smooth page transitions and proper module lifecycle management.
