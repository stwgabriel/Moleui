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

contextBridge.exposeInMainWorld("moleDesktop", {
  getRuntimeInfo: () => invokeWithLog("mole:runtime", "runtime"),
  runStatus: () => invokeWithLog("mole:status", "status --json"),

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
    execute: (path) => invokeWithLog("mole:analyze:execute", `analyze ${path} --json`, path),
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
