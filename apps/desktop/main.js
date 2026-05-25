import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, nativeTheme, shell } from "electron";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const appIconPath = path.join(__dirname, "public", "assets", "base", "molui-purple.png");
const MY_MAC_METRICS_FILE = "my-mac-metrics.json";
const BATTERY_SAMPLE_INTERVAL_MS = 6 * 60 * 1000;
const MAX_BATTERY_HISTORY = 24 * 60;

app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.setName("Moleui Desktop");
nativeTheme.themeSource = "light";

// Store active processes for cancellation
const activeProcesses = new Map();
const appIconCache = new Map();
let batterySamplerInterval = null;
let batterySampleInFlight = false;

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

async function getAppIconData(appPath) {
  if (!appPath || typeof appPath !== "string") {
    return { ok: false, icon: "", message: "Invalid app path" };
  }

  if (appIconCache.has(appPath)) {
    return appIconCache.get(appPath);
  }

  const thumbnailIcon = await getAppThumbnailIconData(appPath);
  if (thumbnailIcon.ok) {
    appIconCache.set(appPath, thumbnailIcon);
    return thumbnailIcon;
  }

  const bundleIcon = getMacAppBundleIconData(appPath);
  if (bundleIcon.ok) {
    appIconCache.set(appPath, bundleIcon);
    return bundleIcon;
  }

  try {
    const fileIcon = await withTimeout(
      app.getFileIcon(appPath, { size: "normal" }),
      1500,
      "Icon lookup timed out",
    );
    const result = fileIcon.isEmpty()
      ? { ok: false, icon: "", message: "No icon found" }
      : { ok: true, icon: fileIcon.toDataURL() };
    appIconCache.set(appPath, result);
    return result;
  } catch (error) {
    const result = { ok: false, icon: "", message: error.message };
    appIconCache.set(appPath, result);
    return result;
  }
}

async function getAppThumbnailIconData(appPath) {
  if (typeof nativeImage.createThumbnailFromPath !== "function") {
    return { ok: false, icon: "", message: "Thumbnail API not available" };
  }

  try {
    const thumbnail = await withTimeout(
      nativeImage.createThumbnailFromPath(appPath, { width: 128, height: 128 }),
      1500,
      "Thumbnail lookup timed out",
    );

    return thumbnail.isEmpty()
      ? { ok: false, icon: "", message: "No thumbnail found" }
      : { ok: true, icon: thumbnail.toDataURL() };
  } catch (error) {
    return { ok: false, icon: "", message: error.message };
  }
}

function getMacAppBundleIconData(appPath) {
  if (process.platform !== "darwin" || path.extname(appPath) !== ".app") {
    return { ok: false, icon: "", message: "Not a macOS app bundle" };
  }

  try {
    const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
    const resourcesPath = path.join(appPath, "Contents", "Resources");
    const infoPlist = fs.readFileSync(infoPlistPath, "utf8");
    const iconFileMatch = infoPlist.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/);

    if (!iconFileMatch) {
      return { ok: false, icon: "", message: "Bundle icon key not found" };
    }

    const rawIconName = iconFileMatch[1].trim();
    const iconNames = path.extname(rawIconName)
      ? [rawIconName]
      : [`${rawIconName}.icns`, rawIconName];

    for (const iconName of iconNames) {
      const iconPath = path.join(resourcesPath, iconName);
      if (!fs.existsSync(iconPath)) continue;

      const image = nativeImage.createFromPath(iconPath);
      if (!image.isEmpty()) {
        return { ok: true, icon: image.resize({ width: 128, height: 128 }).toDataURL() };
      }
    }

    return { ok: false, icon: "", message: "Bundle icon file not found" };
  } catch (error) {
    return { ok: false, icon: "", message: error.message };
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }));

  return results;
}

function runtimeDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "mole-runtime")
    : path.join(__dirname, ".mole-runtime");
}

function moleExecutable() {
  return path.join(runtimeDir(), "mole");
}

function ensureRuntime() {
  const executable = moleExecutable();

  if (!fs.existsSync(executable)) {
    throw new Error(
      `Moleui runtime is missing at ${executable}. Run \`bun run desktop:build\` or \`bun run desktop:dev\` first.`,
    );
  }

  return executable;
}

function runMole(args, options = {}) {
  return new Promise((resolve) => {
    let executable;

    try {
      executable = ensureRuntime();
    } catch (error) {
      resolve({
        ok: false,
        command: `mole ${args.join(" ")}`,
        exitCode: null,
        stdout: "",
        stderr: error.message,
      });
      return;
    }

    const child = spawn(executable, args, {
      cwd: runtimeDir(),
      env: { ...process.env },
      detached: process.platform !== "win32",
    });

    // Store process for cancellation if processId provided
    if (options.processId) {
      activeProcesses.set(options.processId, child);
    }

    let stdout = "";
    let stderr = "";
    let killed = false;
    let settled = false;

    const killChild = () => {
      if (child.killed) return;
      try {
        if (process.platform !== "win32" && child.pid) {
          process.kill(-child.pid, "SIGTERM");
        } else {
          child.kill("SIGTERM");
        }
      } catch {
        try {
          child.kill("SIGTERM");
        } catch {
          // Process may already be gone.
        }
      }
    };

    const timeout = options.timeoutMs
      ? setTimeout(() => {
        killed = true;
        stderr += `\nProcess timed out after ${options.timeoutMs}ms`;
        killChild();
      }, options.timeoutMs)
      : null;

    child.__killMoleProcess = killChild;

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;

      // Stream output if callback provided
      if (options.onStdout) {
        options.onStdout(text);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;

      // Stream error output if callback provided
      if (options.onStderr) {
        options.onStderr(text);
      }
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (options.processId) {
        activeProcesses.delete(options.processId);
      }
      resolve({
        ok: false,
        command: `mole ${args.join(" ")}`,
        exitCode: null,
        stdout,
        stderr: `${stderr}${error.message}`,
        killed,
      });
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (options.processId) {
        activeProcesses.delete(options.processId);
      }
      resolve({
        ok: exitCode === 0 && !killed,
        command: `mole ${args.join(" ")}`,
        exitCode,
        stdout,
        stderr: killed ? `${stderr}\nProcess was cancelled by user` : stderr,
        killed,
      });
    });

    // Handle kill signal
    child.on("exit", (code, signal) => {
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        killed = true;
      }
    });
  });
}

function myMacMetricsPath() {
  return path.join(app.getPath("userData"), MY_MAC_METRICS_FILE);
}

function readMyMacMetricsCache() {
  try {
    const filePath = myMacMetricsPath();
    if (!fs.existsSync(filePath)) return null;

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.metrics !== "string" || typeof parsed.timestamp !== "number") return null;

    return {
      metrics: parsed.metrics,
      history: typeof parsed.history === "string" ? parsed.history : undefined,
      batteryHistory: typeof parsed.batteryHistory === "string" ? parsed.batteryHistory : undefined,
      timestamp: parsed.timestamp,
    };
  } catch (error) {
    console.error("Failed to read My Mac metrics cache:", error);
    return null;
  }
}

function writeMyMacMetricsCache(cache) {
  try {
    const filePath = myMacMetricsPath();
    const nextCache = {
      metrics: String(cache.metrics || ""),
      history: typeof cache.history === "string" ? cache.history : undefined,
      batteryHistory: typeof cache.batteryHistory === "string" ? cache.batteryHistory : undefined,
      timestamp: typeof cache.timestamp === "number" ? cache.timestamp : Date.now(),
    };

    if (!nextCache.metrics) {
      return { ok: false, message: "Metrics payload is required" };
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(nextCache), "utf8");
    return { ok: true };
  } catch (error) {
    console.error("Failed to write My Mac metrics cache:", error);
    return { ok: false, message: error.message };
  }
}

function getBatteryPercent(metrics) {
  const percent = metrics?.batteries?.[0]?.percent;
  if (typeof percent === "number" && Number.isFinite(percent)) {
    return Math.max(0, Math.min(percent, 100));
  }
  return null;
}

function makeBatteryHistoryPoint(metrics, t) {
  const battery = metrics?.batteries?.[0];
  const percent = getBatteryPercent(metrics);
  if (!battery || percent == null) return null;

  return {
    t,
    battery: percent,
    status: battery.status || "Unknown",
    timeLeft: battery.time_left,
  };
}

function parseBatteryHistory(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const history = parsed.filter((point) => (
      point &&
      typeof point === "object" &&
      typeof point.t === "number" &&
      typeof point.battery === "number" &&
      typeof point.status === "string"
    ));

    return history.length > MAX_BATTERY_HISTORY
      ? history.slice(history.length - MAX_BATTERY_HISTORY)
      : history;
  } catch {
    return [];
  }
}

function appendBatteryHistory(history, metrics, t) {
  const point = makeBatteryHistoryPoint(metrics, t);
  if (!point) return history;

  const previous = history[history.length - 1];
  if (!previous) return [point];

  const percentChanged = point.battery !== previous.battery;
  const statusChanged = point.status !== previous.status;
  const sampleDue = t - previous.t >= BATTERY_SAMPLE_INTERVAL_MS;

  if (!percentChanged && !statusChanged && !sampleDue) return history;

  const nextHistory = [...history, point];
  return nextHistory.length > MAX_BATTERY_HISTORY
    ? nextHistory.slice(nextHistory.length - MAX_BATTERY_HISTORY)
    : nextHistory;
}

async function sampleBatteryMetrics() {
  if (batterySampleInFlight) return;
  batterySampleInFlight = true;

  try {
    const result = await runMole(["status", "--json", "--process-limit", "0"]);
    if (!result.ok) {
      console.warn("Background battery sample failed:", result.stderr || result.exitCode);
      return;
    }

    const metrics = JSON.parse(result.stdout);
    const cache = readMyMacMetricsCache();
    const batteryHistory = appendBatteryHistory(parseBatteryHistory(cache?.batteryHistory), metrics, Date.now());

    writeMyMacMetricsCache({
      metrics: result.stdout,
      history: cache?.history,
      batteryHistory: JSON.stringify(batteryHistory),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Background battery sample failed:", error);
  } finally {
    batterySampleInFlight = false;
  }
}

function startBatterySampler() {
  if (batterySamplerInterval) return;

  void sampleBatteryMetrics();
  batterySamplerInterval = setInterval(() => {
    void sampleBatteryMetrics();
  }, BATTERY_SAMPLE_INTERVAL_MS);
}

function configureMacStartupService() {
  if (process.platform !== "darwin" || !app.isPackaged) return;

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
  });
}

function wasOpenedAsHiddenLoginItem() {
  if (process.platform !== "darwin") return false;

  try {
    return Boolean(app.getLoginItemSettings().wasOpenedAsHidden);
  } catch {
    return false;
  }
}

function normalizeAnalyzePath(input = "/") {
  const rawPath = String(input || "/").trim() || "/";
  const homePath = app.getPath("home");

  if (rawPath === "~") {
    return homePath;
  }

  if (rawPath.startsWith("~/") || rawPath.startsWith("~\\")) {
    return path.join(homePath, rawPath.slice(2));
  }

  return rawPath;
}

function existingProcessPath(commandPath) {
  const rawPath = String(commandPath || "").trim();
  if (!rawPath.startsWith("/")) {
    return "";
  }
  if (fs.existsSync(rawPath)) {
    return rawPath;
  }
  const firstToken = rawPath.split(/\s+/)[0];
  if (firstToken && fs.existsSync(firstToken)) {
    return firstToken;
  }
  return "";
}

function existingFileActionPath(inputPath) {
  const filePath = normalizeAnalyzePath(inputPath);
  if (!filePath.startsWith("/") || !fs.existsSync(filePath)) {
    return "";
  }
  return filePath;
}

function runAppleScript(script) {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", script], (error) => {
      resolve(error ? { ok: false, message: error.message } : { ok: true });
    });
  });
}

async function openNewFinderWindow(filePath) {
  if (process.platform !== "darwin") {
    shell.showItemInFolder(filePath);
    return { ok: true };
  }

  const isDirectory = fs.statSync(filePath).isDirectory();
  const folderPath = isDirectory ? filePath : path.dirname(filePath);
  const escapedFolderPath = JSON.stringify(folderPath);
  const escapedFilePath = JSON.stringify(filePath);
  const script = `
tell application "Finder"
  activate
  set newWindow to make new Finder window to (POSIX file ${escapedFolderPath} as alias)
  ${isDirectory ? "" : `select (POSIX file ${escapedFilePath} as alias)`}
end tell
`;

  return runAppleScript(script);
}

function configureApplicationMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [{
        label: app.name,
        submenu: [
          { role: "about" },
          {
            label: "Settings...",
            accelerator: "CmdOrCtrl+,",
            click: () => createSettingsWindow(BrowserWindow.getFocusedWindow() ?? mainWindow),
          },
          { type: "separator" },
          { role: "hide" },
          { type: "separator" },
          { role: "quit" },
        ],
      }]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close" },
      ],
    },
  ];

  if (isDev) {
    template.push({
      label: "Developer",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(options = {}) {
  const shouldShow = options.show !== false;
  const window = new BrowserWindow({
    width: 1280,
    height: 920,
    minWidth: 1280,
    minHeight: 840,
    show: false,
    titleBarStyle: "hidden",
    trafficLightPosition: {
      x: 18,
      y: 6,
    },
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    window.loadURL('http://localhost:5173');
  } else {
    window.loadFile(path.join(__dirname, "dist", "index.html"));
  }

  if (shouldShow) {
    window.once("ready-to-show", () => {
      window.show();
    });
  }

  return window;
}

let mainWindow;
let settingsWindow;

function loadAppWindow(window, query = "") {
  if (isDev) {
    window.loadURL(`http://localhost:5173${query}`);
  } else {
    window.loadFile(path.join(__dirname, "dist", "index.html"), query ? { search: query.slice(1) } : undefined);
  }
}

function createSettingsWindow(parentWindow) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 540,
    height: 640,
    minWidth: 480,
    minHeight: 560,
    show: false,
    title: "Settings",
    titleBarStyle: "hidden",
    trafficLightPosition: {
      x: 18,
      y: 6,
    },
    parent: parentWindow,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadAppWindow(settingsWindow, "?window=settings");

  settingsWindow.once("ready-to-show", () => {
    settingsWindow.show();
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

ipcMain.handle("mole:status", async () => runMole(["status", "--json", "--process-limit", "0"]));

ipcMain.handle("mole:settings:open", async (event) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  createSettingsWindow(parentWindow);
  return { ok: true };
});

ipcMain.handle("mole:settings:profile", async () => {
  const deviceName = os.hostname() || "This Mac";

  return {
    deviceName,
    user: {
      name: deviceName,
      email: deviceName,
    },
  };
});

ipcMain.handle("mole:uninstall:list", async (event) => {
  return runMole(["uninstall", "--list"], {
    processId: "uninstall:list",
    timeoutMs: 60000,
    onStdout: (text) => {
      // Stream stdout to renderer
      event.sender.send("mole:uninstall:list:stdout", text);
    },
    onStderr: (text) => {
      // Stream stderr to renderer
      event.sender.send("mole:uninstall:list:stderr", text);
    }
  });
});

ipcMain.handle("mole:uninstall:list:kill", async () => {
  const process = activeProcesses.get("uninstall:list");
  if (process && !process.killed) {
    if (process.__killMoleProcess) {
      process.__killMoleProcess();
    } else {
      process.kill("SIGTERM");
    }
    return { ok: true, message: "Uninstall scan terminated" };
  }
  return { ok: false, message: "No active uninstall scan" };
});

ipcMain.handle("mole:uninstall:app-icon", async (_event, appPath) => {
  return getAppIconData(appPath);
});

ipcMain.handle("mole:uninstall:app-icons", async (_event, appPaths) => {
  if (!Array.isArray(appPaths)) {
    return { ok: false, icons: {}, message: "Invalid app paths" };
  }

  const uniquePaths = [...new Set(appPaths.filter((appPath) => typeof appPath === "string" && appPath))];
  const iconResults = await mapWithConcurrency(uniquePaths, 8, async (appPath) => {
    const result = await getAppIconData(appPath);
    return [appPath, result];
  });
  const icons = {};

  for (const [appPath, result] of iconResults) {
    if (result.ok && result.icon) {
      icons[appPath] = result.icon;
    } else {
      console.log(`Failed to get icon for ${appPath}: ${result.message}`);
    }
  }

  console.log(`Sending back ${Object.keys(icons).length} icons`);
  return { ok: true, icons };
});

ipcMain.handle("mole:uninstall:dry-run", async (event, appNames) => {
  const args = ["uninstall", "--dry-run", "--yes", ...appNames];
  return runMole(args, {
    onStdout: (text) => {
      event.sender.send("mole:uninstall:dry-run:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:uninstall:dry-run:stderr", text);
    }
  });
});

ipcMain.handle("mole:uninstall:execute", async (event, appNames) => {
  const args = ["uninstall", "--yes", ...appNames];
  return runMole(args, {
    onStdout: (text) => {
      event.sender.send("mole:uninstall:execute:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:uninstall:execute:stderr", text);
    }
  });
});

// Clean command handlers
ipcMain.handle("mole:clean:execute", async (event, options = {}) => {
  const command = String(options.command || "clean");
  const args = [command];

  if (!["clean", "purge", "installer"].includes(command)) {
    return {
      ok: false,
      command: `mole ${command}`,
      exitCode: null,
      stdout: "",
      stderr: `Unsupported clean command: ${command}`,
    };
  }

  if (options.dryRun) args.push("--dry-run");

  if (command === "clean" && Array.isArray(options.sections)) {
    for (const section of options.sections) {
      const cleanSection = String(section || "").trim();
      if (cleanSection) args.push("--section", cleanSection);
    }
  }

  if (command === "installer" && options.all) {
    args.push("--all", "--yes");
  }

  return runMole(args, {
    processId: "clean",
    onStdout: (text) => {
      event.sender.send("mole:clean:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:clean:stderr", text);
    }
  });
});

ipcMain.handle("mole:clean:kill", async () => {
  const process = activeProcesses.get("clean");
  if (process && !process.killed) {
    if (process.__killMoleProcess) {
      process.__killMoleProcess();
    } else {
      process.kill("SIGTERM");
    }
    return { ok: true, message: "Clean process terminated" };
  }
  return { ok: false, message: "No active clean process" };
});

// Optimize command handlers
ipcMain.handle("mole:optimize:execute", async (event, options = {}) => {
  const args = ["optimize"];
  if (options.dryRun) args.push("--dry-run");
  if (Array.isArray(options.taskNames)) {
    for (const taskName of options.taskNames) {
      if (typeof taskName === "string" && taskName.trim()) {
        args.push("--task", taskName.trim());
      }
    }
  }

  return runMole(args, {
    processId: "optimize",
    onStdout: (text) => {
      event.sender.send("mole:optimize:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:optimize:stderr", text);
    }
  });
});

ipcMain.handle("mole:optimize:kill", async () => {
  const process = activeProcesses.get("optimize");
  if (process && !process.killed) {
    if (process.__killMoleProcess) {
      process.__killMoleProcess();
    } else {
      process.kill("SIGTERM");
    }
    return { ok: true, message: "Optimize process terminated" };
  }
  return { ok: false, message: "No active optimize process" };
});

// Analyze command handlers
ipcMain.handle("mole:analyze:execute", async (event, path = "/", options = {}) => {
  const scanPath = normalizeAnalyzePath(path);
  const args = ["analyze", "--json", scanPath];
  if (options.fresh) args.splice(2, 0, "--fresh");

  return runMole(args, {
    processId: "analyze",
    onStdout: (text) => {
      event.sender.send("mole:analyze:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:analyze:stderr", text);
    }
  });
});

ipcMain.handle("mole:analyze:kill", async () => {
  const process = activeProcesses.get("analyze");
  if (process && !process.killed) {
    if (process.__killMoleProcess) {
      process.__killMoleProcess();
    } else {
      process.kill("SIGTERM");
    }
    return { ok: true, message: "Analyze process terminated" };
  }
  return { ok: false, message: "No active analyze process" };
});

ipcMain.handle("mole:runtime", async () => ({
  packaged: app.isPackaged,
  runtimeDir: runtimeDir(),
  executable: moleExecutable(),
}));

ipcMain.handle("mole:my-mac-cache:get", async () => readMyMacMetricsCache());

ipcMain.handle("mole:my-mac-cache:set", async (_event, cache = {}) => writeMyMacMetricsCache({
  metrics: cache.metrics,
  history: cache.history,
  batteryHistory: cache.batteryHistory,
  timestamp: Date.now(),
}));

ipcMain.handle("mole:open-external", async (_event, url) => {
  const allowedUrls = new Set([
    "https://github.com/stwgabriel/moleui",
    "https://github.com/sponsors/stwgabriel",
  ]);

  if (!allowedUrls.has(url)) {
    return { ok: false, message: "URL is not allowed" };
  }

  await shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle("mole:copy-text", async (_event, text) => {
  clipboard.writeText(String(text ?? ""));
  return { ok: true };
});

ipcMain.handle("mole:reveal-path", async (_event, commandPath) => {
  const processPath = existingProcessPath(commandPath);
  if (!processPath) {
    return { ok: false, message: "Process path is not available" };
  }
  shell.showItemInFolder(processPath);
  return { ok: true };
});

ipcMain.handle("mole:open-path-in-finder", async (_event, inputPath) => {
  const filePath = existingFileActionPath(inputPath);
  if (!filePath) {
    return { ok: false, message: "Path is not available" };
  }
  return openNewFinderWindow(filePath);
});

ipcMain.handle("mole:delete-path", async (_event, inputPath) => {
  const filePath = existingFileActionPath(inputPath);
  if (!filePath) {
    return { ok: false, message: "Path is not available" };
  }

  const protectedPaths = new Set(["/", app.getPath("home")]);
  if (protectedPaths.has(filePath)) {
    return { ok: false, message: "This location cannot be deleted" };
  }

  try {
    await shell.trashItem(filePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

ipcMain.handle("mole:touchid:status", async () => {
  return runMole(["touchid", "status"]);
});

ipcMain.handle("mole:touchid:enable", async () => {
  return runMole(["touchid", "enable"]);
});

ipcMain.handle("mole:touchid:disable", async () => {
  return runMole(["touchid", "disable"]);
});

ipcMain.handle("mole:open-activity-monitor", async () => {
  const paths = [
    "/System/Applications/Utilities/Activity Monitor.app",
    "/Applications/Utilities/Activity Monitor.app",
  ];
  const activityMonitorPath = paths.find((candidate) => fs.existsSync(candidate));
  if (!activityMonitorPath) {
    return { ok: false, message: "Activity Monitor was not found" };
  }
  const message = await shell.openPath(activityMonitorPath);
  return message ? { ok: false, message } : { ok: true };
});

ipcMain.handle("mole:signal-process", async (_event, pid, signal) => {
  const processId = Number(pid);
  if (!Number.isInteger(processId) || processId <= 0) {
    return { ok: false, message: "Invalid process ID" };
  }
  if (signal !== "SIGTERM" && signal !== "SIGKILL") {
    return { ok: false, message: "Invalid signal" };
  }
  try {
    process.kill(processId, signal);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

app.whenReady().then(() => {
  configureApplicationMenu();
  configureMacStartupService();
  startBatterySampler();

  const openedAsHidden = wasOpenedAsHiddenLoginItem();

  if (process.platform === "darwin") {
    const appIcon = nativeImage.createFromPath(appIconPath);

    if (!appIcon.isEmpty()) {
      app.dock.setIcon(appIcon);
    }

    if (openedAsHidden) {
      app.dock.hide();
    }
  }

  if (!openedAsHidden) {
    mainWindow = createWindow();
  }

  app.on("activate", () => {
    if (process.platform === "darwin") {
      app.dock.show();
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
