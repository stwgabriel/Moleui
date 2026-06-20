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
    complete: () => ipcRenderer.invoke("mole:auth:complete"),
    showLogin: () => ipcRenderer.invoke("mole:auth:show-login"),
    signOut: () => ipcRenderer.invoke("mole:auth:sign-out"),
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
