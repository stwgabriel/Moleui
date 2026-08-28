const { contextBridge, ipcRenderer } = require("electron");

console.log('[Preload] Script is loading...');

// ─── CLI Logger ──────────────────────────────────────────────────────────────
// Logs every CLI invocation and its result to the browser (renderer) console.

function logCLI(command, args = []) {
  const label = args.length ? `mole ${command} ${args.join(" ")}` : `mole ${command}`;
  console.group(`%c[CLI] ${label}`, "color: #60a5fa; font-weight: 600;");
  console.log("command:", label);
  console.log("timestamp:", new Date().toISOString());
  console.groupEnd();
}

function logCLIResult(command, result) {
  const ok = result?.ok;
  if (command === "status --json" && ok) return;

  const style = ok
    ? "color: #34d399; font-weight: 600;"
    : "color: #f87171; font-weight: 600;";
  const status = ok ? "✓ success" : "✗ failed";
  console.group(`%c[CLI] ${command} → ${status}`, style);
  console.log("exit code:", result?.exitCode ?? "n/a");
  if (result?.stdout) console.log("stdout:", result.stdout);
  if (result?.stderr) console.warn("stderr:", result.stderr);
  if (result?.killed) console.warn("process was killed");
  console.groupEnd();
}

function logCLIStream(channel, data) {
  console.log(`%c[CLI stream] ${channel}`, "color: #a78bfa;", data.trimEnd());
}

// Wraps an IPC invoke call with before/after console logging.
function invokeWithLog(channel, label, ...args) {
  logCLI(label, args.filter(Boolean));
  return ipcRenderer.invoke(channel, ...args).then((result) => {
    logCLIResult(label, result);
    return result;
  });
}

// Wraps an IPC stream listener with console logging.
function onStreamWithLog(channel, callback) {
  ipcRenderer.on(channel, (_, data) => {
    logCLIStream(channel, data);
    callback(data);
  });
}

// ─── Exposed API ─────────────────────────────────────────────────────────────

// Window mode is passed via a launch argument so it survives in-window
// navigations (e.g. Clerk's post-sign-in redirect that drops the URL query).
const WINDOW_MODE_PREFIX = "--mole-window-mode=";
const windowModeArg = process.argv.find((arg) => arg.startsWith(WINDOW_MODE_PREFIX));
const windowMode = windowModeArg ? windowModeArg.slice(WINDOW_MODE_PREFIX.length) : "";

contextBridge.exposeInMainWorld("moleDesktop", {
  windowMode,
  getRuntimeInfo: () => invokeWithLog("mole:runtime", "runtime"),
  auth: {
    // The renderer drives the single primary window: enterApp grows it to full
    // size once Clerk confirms a session, enterLogin keeps it compact when signed
    // out, and signOut wipes the local session and returns to the login form.
    enterApp: () => ipcRenderer.invoke("mole:auth:enter-app"),
    enterLogin: () => ipcRenderer.invoke("mole:auth:enter-login"),
    signOut: () => ipcRenderer.invoke("mole:auth:sign-out"),
  },
  permissions: {
    status: () => ipcRenderer.invoke("mole:permissions:status"),
    getPrefs: () => ipcRenderer.invoke("mole:permissions:get-prefs"),
    setPrefs: (prefs) => ipcRenderer.invoke("mole:permissions:set-prefs", prefs),
    openSettings: (pane) => ipcRenderer.invoke("mole:permissions:open-settings", pane),
    requestFiles: () => ipcRenderer.invoke("mole:permissions:request-files"),
  },
  billing: {
    detectCountry: () => ipcRenderer.invoke("mole:billing:country"),
    openCheckout: (url) => ipcRenderer.invoke("mole:billing:open-checkout", url),
    openPortal: (url) => ipcRenderer.invoke("mole:billing:open-portal", url),
    onClosed: (callback) => {
      ipcRenderer.on("mole:billing:closed", callback);
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:billing:closed");
    },
  },
  theme: {
    get: () => ipcRenderer.invoke("mole:theme:get"),
    set: (theme) => ipcRenderer.invoke("mole:theme:set", theme),
  },
  appIcon: {
    list: () => ipcRenderer.invoke("mole:appIcon:list"),
    get: () => ipcRenderer.invoke("mole:appIcon:get"),
    set: (icon) => ipcRenderer.invoke("mole:appIcon:set", icon),
  },
  updates: {
    getState: () => ipcRenderer.invoke("mole:updates:state"),
    check: () => ipcRenderer.invoke("mole:updates:check"),
    install: () => ipcRenderer.invoke("mole:updates:install"),
    onState: (callback) => {
      ipcRenderer.on("mole:updates:state", (_, state) => callback(state));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:updates:state");
    },
  },
  openSettingsWindow: () => ipcRenderer.invoke("mole:settings:open"),
  openDeveloperWindow: () => ipcRenderer.invoke("mole:developer:open"),
  getSettingsProfile: () => ipcRenderer.invoke("mole:settings:profile"),
  getBackgroundSystems: () => ipcRenderer.invoke("mole:background-systems:list"),
  developer: {
    getCliEvents: () => ipcRenderer.invoke("mole:developer:cli-events"),
    clearCliEvents: () => ipcRenderer.invoke("mole:developer:clear-cli-events"),
    onCliEvent: (callback) => {
      ipcRenderer.on("mole:developer:event", (_, event) => callback(event));
    },
    onUnlockApp: (callback) => {
      ipcRenderer.on("mole:developer:unlock-app", () => callback());
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:developer:event");
      ipcRenderer.removeAllListeners("mole:developer:unlock-app");
    },
  },
  myMacCache: {
    get: () => ipcRenderer.invoke("mole:my-mac-cache:get"),
    set: (cache) => ipcRenderer.invoke("mole:my-mac-cache:set", cache),
  },

  // Versioned local operations interface. It keeps CLI flags, process
  // ownership, and output compatibility inside the trusted main process.
  operations: {
    status: () => ipcRenderer.invoke("mole:operations:status"),
    plan: (operation) => ipcRenderer.invoke("mole:operations:plan", operation),
    execute: (operation, request) => ipcRenderer.invoke("mole:operations:execute", operation, request),
    cancel: (operation) => ipcRenderer.invoke("mole:operations:cancel", operation),
    onEvent: (callback) => {
      ipcRenderer.on("mole:operations:event", (_, event) => callback(event));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:operations:event");
    },
  },

  // Touch ID configuration
  touchid: {
    status: () => invokeWithLog("mole:touchid:status", "touchid status"),
    enable: () => invokeWithLog("mole:touchid:enable", "touchid enable"),
    disable: () => invokeWithLog("mole:touchid:disable", "touchid disable"),
  },
  runStatus: (options) => {
    const processLimit = options?.processLimit;
    const label = Number.isFinite(processLimit)
      ? `status --json --process-limit ${processLimit}`
      : "status --json";
    return invokeWithLog("mole:status", label, options);
  },
  openExternal: (url) => ipcRenderer.invoke("mole:open-external", url),
  copyText: (text) => ipcRenderer.invoke("mole:copy-text", text),
  revealPath: (commandPath) => ipcRenderer.invoke("mole:reveal-path", commandPath),
  openPathInFinder: (path) => ipcRenderer.invoke("mole:open-path-in-finder", path),
  deletePath: (path) => ipcRenderer.invoke("mole:delete-path", path),
  openActivityMonitor: () => ipcRenderer.invoke("mole:open-activity-monitor"),
  signalProcess: (pid, signal) => ipcRenderer.invoke("mole:signal-process", pid, signal),
  getProcessIcons: (processes) => ipcRenderer.invoke("mole:process:icons", processes),

  // Clean command
  clean: {
    execute: (options) => invokeWithLog("mole:clean:execute", "clean", options),
    kill: () => invokeWithLog("mole:clean:kill", "clean:kill"),
    onStdout: (callback) => {
      onStreamWithLog("mole:clean:stdout", callback);
    },
    onStderr: (callback) => {
      onStreamWithLog("mole:clean:stderr", callback);
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:clean:stdout");
      ipcRenderer.removeAllListeners("mole:clean:stderr");
    },
  },

  // Automations
  automations: {
    list: () => ipcRenderer.invoke("mole:automations:list"),
    saveRecipe: (recipe) => ipcRenderer.invoke("mole:automations:save-recipe", recipe),
    deleteRecipe: (recipeId) => ipcRenderer.invoke("mole:automations:delete-recipe", recipeId),
    setEnabled: (recipeId, enabled) => ipcRenderer.invoke("mole:automations:set-enabled", recipeId, enabled),
    setPaused: (paused) => ipcRenderer.invoke("mole:automations:set-paused", paused),
    dryRun: (recipeId) => invokeWithLog("mole:automations:dry-run", "automation dry-run", recipeId),
    runNow: (recipeId) => invokeWithLog("mole:automations:run-now", "automation run", recipeId),
    cancel: () => invokeWithLog("mole:automations:cancel", "automation cancel"),
    onChanged: (callback) => {
      ipcRenderer.on("mole:automations:changed", () => callback());
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:automations:changed");
    },
  },

  // Optimize command
  optimize: {
    execute: (options) => invokeWithLog("mole:optimize:execute", "optimize", options),
    kill: () => invokeWithLog("mole:optimize:kill", "optimize:kill"),
    onStdout: (callback) => {
      onStreamWithLog("mole:optimize:stdout", callback);
    },
    onStderr: (callback) => {
      onStreamWithLog("mole:optimize:stderr", callback);
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:optimize:stdout");
      ipcRenderer.removeAllListeners("mole:optimize:stderr");
    },
  },

  // Analyze command
  analyze: {
    execute: (path, options) => invokeWithLog("mole:analyze:execute", `analyze --json ${options?.fresh ? '--fresh ' : ''}${path}`, path, options),
    kill: () => invokeWithLog("mole:analyze:kill", "analyze:kill"),
    volumes: () => invokeWithLog("mole:analyze:volumes", "analyze --volumes"),
    onStdout: (callback) => {
      onStreamWithLog("mole:analyze:stdout", callback);
    },
    onStderr: (callback) => {
      onStreamWithLog("mole:analyze:stderr", callback);
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:analyze:stdout");
      ipcRenderer.removeAllListeners("mole:analyze:stderr");
    },
  },

  // Repos command
  repos: {
    // Read-only inventory. `verify` contacts each remote, which is slow but is
    // the only way to know a branch really is on the server.
    scan: (options) => invokeWithLog("mole:repos:scan", `repos --json${options?.verify ? " --verify" : ""}`, options),
    killScan: () => invokeWithLog("mole:repos:scan:kill", "repos:scan:kill"),
    // Re-checks one repository against every archive precondition.
    gate: (repoPath, waivers) => invokeWithLog("mole:repos:gate", `repos --gate ${repoPath}`, repoPath, waivers),
    push: (paths, options) =>
      invokeWithLog("mole:repos:push", `repos push${options?.dryRun ? " --dry-run" : ""}`, paths, options),
    killPush: () => invokeWithLog("mole:repos:push:kill", "repos:push:kill"),
    sync: (paths, options) =>
      invokeWithLog("mole:repos:sync", `repos sync${options?.dryRun ? " --dry-run" : ""}`, paths, options),
    killSync: () => invokeWithLog("mole:repos:sync:kill", "repos:sync:kill"),
    archive: (paths, options) =>
      invokeWithLog("mole:repos:archive", `repos archive${options?.dryRun ? " --dry-run" : ""}`, paths, options),
    killArchive: () => invokeWithLog("mole:repos:archive:kill", "repos:archive:kill"),
    getRoots: () => ipcRenderer.invoke("mole:repos:get-roots"),
    getProfiles: () => ipcRenderer.invoke("mole:repos:profiles"),
    setSyncPreferences: (preferences) => ipcRenderer.invoke("mole:repos:sync-preferences", preferences),
    setRoots: (roots) => ipcRenderer.invoke("mole:repos:set-roots", roots),
    chooseRoot: () => ipcRenderer.invoke("mole:repos:choose-root"),

    onScanStdout: (callback) => {
      onStreamWithLog("mole:repos:scan:stdout", callback);
    },
    onPushStdout: (callback) => {
      onStreamWithLog("mole:repos:push:stdout", callback);
    },
    onPushStderr: (callback) => {
      onStreamWithLog("mole:repos:push:stderr", callback);
    },
    onArchiveStdout: (callback) => {
      onStreamWithLog("mole:repos:archive:stdout", callback);
    },
    onArchiveStderr: (callback) => {
      onStreamWithLog("mole:repos:archive:stderr", callback);
    },
    onSyncStdout: (callback) => {
      onStreamWithLog("mole:repos:sync:stdout", callback);
    },
    onSyncStderr: (callback) => {
      onStreamWithLog("mole:repos:sync:stderr", callback);
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:repos:scan:stdout");
      ipcRenderer.removeAllListeners("mole:repos:push:stdout");
      ipcRenderer.removeAllListeners("mole:repos:push:stderr");
      ipcRenderer.removeAllListeners("mole:repos:archive:stdout");
      ipcRenderer.removeAllListeners("mole:repos:archive:stderr");
      ipcRenderer.removeAllListeners("mole:repos:sync:stdout");
      ipcRenderer.removeAllListeners("mole:repos:sync:stderr");
    },
  },

  // Uninstall command
  uninstall: {
    list: () => invokeWithLog("mole:uninstall:list", "uninstall --list"),
    killList: () => invokeWithLog("mole:uninstall:list:kill", "uninstall:list:kill"),
    getAppIcon: (appPath) => ipcRenderer.invoke("mole:uninstall:app-icon", appPath),
    getAppIcons: (appPaths) => ipcRenderer.invoke("mole:uninstall:app-icons", appPaths),
    dryRun: (appNames) => invokeWithLog("mole:uninstall:dry-run", "uninstall --dry-run", appNames),
    execute: (appNames) => invokeWithLog("mole:uninstall:execute", "uninstall --yes", appNames),

    // Stream listeners
    onListStdout: (callback) => {
      onStreamWithLog("mole:uninstall:list:stdout", callback);
    },
    onListStderr: (callback) => {
      onStreamWithLog("mole:uninstall:list:stderr", callback);
    },
    onDryRunStdout: (callback) => {
      onStreamWithLog("mole:uninstall:dry-run:stdout", callback);
    },
    onDryRunStderr: (callback) => {
      onStreamWithLog("mole:uninstall:dry-run:stderr", callback);
    },
    onExecuteStdout: (callback) => {
      onStreamWithLog("mole:uninstall:execute:stdout", callback);
    },
    onExecuteStderr: (callback) => {
      onStreamWithLog("mole:uninstall:execute:stderr", callback);
    },

    // Cleanup listeners
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:uninstall:list:stdout");
      ipcRenderer.removeAllListeners("mole:uninstall:list:stderr");
      ipcRenderer.removeAllListeners("mole:uninstall:dry-run:stdout");
      ipcRenderer.removeAllListeners("mole:uninstall:dry-run:stderr");
      ipcRenderer.removeAllListeners("mole:uninstall:execute:stdout");
      ipcRenderer.removeAllListeners("mole:uninstall:execute:stderr");
    },
  },
});

console.log('[Preload] moleDesktop API exposed successfully');
