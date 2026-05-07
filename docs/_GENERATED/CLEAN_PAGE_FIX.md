# CleanPage Runtime Fix

## Problem

The CleanPage was failing with the error:
```
/Users/.../mole/apps/desktop/.mole-runtime/mole: line 921: 
/Users/.../mole/apps/desktop/.mole-runtime/bin/clean.sh: No such file or directory
```

## Root Cause

The `prepare-runtime.mjs` script was incomplete and wasn't copying all necessary files to the `.mole-runtime` directory. Specifically, it was missing:

1. `bin/clean.sh` - The clean command script
2. `lib/clean/` - The clean module directory with all cleanup logic

The script only copied `status.sh` and `uninstall.sh`, but the desktop app's CleanPage needed `clean.sh` to function.

## Solution

Updated `apps/desktop/scripts/prepare-runtime.mjs` to include:

### 1. Copy clean.sh to bin directory
```javascript
// Copy bin scripts
await copyRuntimeFile("bin/clean.sh");
await copyRuntimeFile("bin/status.sh");
await copyRuntimeFile("bin/uninstall.sh");
```

### 2. Copy lib/clean directory
```javascript
// Copy lib directories
await copyRuntimeFile("lib/core");
await copyRuntimeFile("lib/clean");  // Added
await copyRuntimeFile("lib/ui");
await copyRuntimeFile("lib/uninstall");
```

### 3. Set executable permissions for clean.sh
```javascript
// Set executable permissions
await chmod(path.join(runtimeDir, "mole"), 0o755);
await chmod(path.join(runtimeDir, "bin", "clean.sh"), 0o755);  // Added
await chmod(path.join(runtimeDir, "bin", "status.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "uninstall.sh"), 0o755);
await chmod(path.join(runtimeDir, "bin", "status-go"), 0o755);
```

## Verification

After running `bun run prepare:runtime`, the following files are now present:

```
.mole-runtime/
├── bin/
│   ├── clean.sh ✓
│   ├── status.sh ✓
│   ├── status-go ✓
│   └── uninstall.sh ✓
└── lib/
    ├── clean/ ✓
    │   ├── app_caches.sh
    │   ├── apps.sh
    │   ├── brew.sh
    │   ├── caches.sh
    │   ├── dev.sh
    │   ├── hints.sh
    │   ├── maven.sh
    │   ├── project.sh
    │   ├── purge_shared.sh
    │   ├── system.sh
    │   └── user.sh
    ├── core/ ✓
    ├── ui/ ✓
    └── uninstall/ ✓
```

## Testing

To test the fix:

1. Run `bun run prepare:runtime` in `apps/desktop/`
2. Start the dev server: `bun run dev`
3. Navigate to the Clean page
4. Click "Start Deep Clean"
5. The clean operation should now execute without errors

## Related Files

- `apps/desktop/scripts/prepare-runtime.mjs` - Runtime preparation script (fixed)
- `apps/desktop/src/pages/CleanPage.tsx` - Clean page component
- `bin/clean.sh` - Clean command implementation
- `lib/clean/*.sh` - Clean module implementations

## Notes

- The `prepare:runtime` script runs automatically during `bun run dev` and `bun run dist`
- If you add new commands to the desktop app, remember to update `prepare-runtime.mjs`
- All shell scripts in `bin/` need to be copied and made executable
- All required `lib/` directories must be copied for scripts to function
