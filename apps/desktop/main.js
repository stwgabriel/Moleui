import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, nativeTheme, screen, shell } from "electron";
import { execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const appIconPath = path.join(__dirname, "public", "assets", "base", isDev ? "molui-dark.png" : "molui-purple.png");
const MY_MAC_METRICS_FILE = "my-mac-metrics.json";
const BACKGROUND_SYSTEMS_FILE = "background-systems.json";
const BATTERY_SAMPLE_INTERVAL_MS = 6 * 60 * 1000;
const MAX_BATTERY_HISTORY = 24 * 60;
const MAX_CLI_MONITOR_EVENTS = 1200;
const MAX_CLI_EVENT_TEXT = 24000;
const MAIN_WINDOW_SIZE = { width: 1280, height: 860, minWidth: 1180, minHeight: 760 };
const LOGIN_WINDOW_SIZE = { width: 880, height: 640, minWidth: 760, minHeight: 560 };

app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.setName("Moleui Desktop");
nativeTheme.themeSource = "light";

// Store active processes for cancellation
const activeProcesses = new Map();
const appIconCache = new Map();
const cliMonitorEvents = [];
let nextCliRunId = 1;
let applicationSearchIndex = null;
let systemApplicationIndex = null;
const applicationNameLookupCache = new Map();
let batterySamplerInterval = null;
let batterySampleInFlight = false;
let openedAsHiddenLoginItem = false;

function trimCliEventText(text) {
  const value = String(text || "");
  if (value.length <= MAX_CLI_EVENT_TEXT) return value;
  return `${value.slice(0, MAX_CLI_EVENT_TEXT)}\n...[truncated ${value.length - MAX_CLI_EVENT_TEXT} chars]`;
}

function emitCliEvent(event) {
  const nextEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: new Date().toISOString(),
    ...event,
  };

  if (typeof nextEvent.text === "string") {
    nextEvent.text = trimCliEventText(nextEvent.text);
  }

  cliMonitorEvents.push(nextEvent);
  if (cliMonitorEvents.length > MAX_CLI_MONITOR_EVENTS) {
    cliMonitorEvents.splice(0, cliMonitorEvents.length - MAX_CLI_MONITOR_EVENTS);
  }

  if (cliMonitorWindow && !cliMonitorWindow.isDestroyed()) {
    cliMonitorWindow.webContents.send("mole:developer:event", nextEvent);
  }

  return nextEvent;
}

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

function parsePlistString(plist, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = plist.match(new RegExp(`<key>${escapedKey}<\\/key>\\s*<string>([^<]+)<\\/string>`));
  return match?.[1]?.trim() || "";
}

function readApplicationMetadata(appPath) {
  const appName = path.basename(appPath).replace(/\.app$/i, "");
  const metadata = {
    path: appPath,
    bundleIdentifier: "",
    executableName: "",
    names: new Set([appName]),
    lookupNames: new Set(),
  };

  try {
    const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
    const infoPlist = fs.readFileSync(infoPlistPath, "utf8");
    const displayName = parsePlistString(infoPlist, "CFBundleDisplayName");
    const bundleName = parsePlistString(infoPlist, "CFBundleName");
    const executableName = parsePlistString(infoPlist, "CFBundleExecutable");

    metadata.bundleIdentifier = parsePlistString(infoPlist, "CFBundleIdentifier");
    metadata.executableName = executableName;
    [displayName, bundleName, executableName].filter(Boolean).forEach((name) => metadata.names.add(name));
  } catch {
    // Some bundles are not readable from the sandbox/user context. The path name still works as a lookup key.
  }

  metadata.names.forEach((name) => {
    const lookupName = normalizeAppLookupName(name);
    if (lookupName) metadata.lookupNames.add(lookupName);
  });

  return metadata;
}

function addMapListValue(map, key, value) {
  if (!key) return;
  const current = map.get(key);
  if (current) {
    if (!current.includes(value)) current.push(value);
  } else {
    map.set(key, [value]);
  }
}

function processIconSlug(value) {
  return String(value || "")
    .replace(/\.app$/i, "")
    .replace(/\b(helper|renderer|gpu|plugin|extension|service|daemon)\b.*$/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function processIconSlugCandidates(processInfo) {
  const command = String(processInfo?.command || "");
  const commandParts = command.split("/").filter(Boolean);
  const appNames = commandParts
    .filter((part) => part.endsWith(".app"))
    .map((part) => part.replace(/\.app$/i, ""));
  const executable = commandParts[commandParts.length - 1] || "";
  const rawNames = [processInfo?.name, executable, ...appNames];

  return [...new Set(rawNames.map(processIconSlug).filter(Boolean))];
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function genericProcessIconData(processInfo) {
  const label = (String(processInfo?.name || "System").trim().charAt(0).toUpperCase() || "S")
    .replace(/[&<>"]/g, "");
  const hue = hashString(String(processInfo?.name || processInfo?.pid || "system")) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="20" y1="12" x2="108" y2="116" gradientUnits="userSpaceOnUse"><stop stop-color="hsl(${hue} 70% 62%)"/><stop offset="1" stop-color="hsl(${(hue + 42) % 360} 78% 48%)"/></linearGradient></defs><rect width="128" height="128" rx="30" fill="url(#g)"/><path d="M34 42h60M34 64h60M34 86h60" stroke="white" stroke-width="10" stroke-linecap="round" opacity=".42"/><text x="64" y="76" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" fill="white">${label}</text></svg>`;
  return { ok: true, icon: svgDataUrl(svg), source: "generic" };
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
    const runId = nextCliRunId++;
    const command = `mole ${args.join(" ")}`;
    const startedAt = Date.now();

    try {
      executable = ensureRuntime();
    } catch (error) {
      emitCliEvent({
        runId,
        type: "error",
        command,
        text: error.message,
        durationMs: Date.now() - startedAt,
      });
      resolve({
        ok: false,
        command,
        exitCode: null,
        stdout: "",
        stderr: error.message,
      });
      return;
    }

    emitCliEvent({
      runId,
      type: "start",
      command,
      args,
      processId: options.processId || null,
    });

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
      emitCliEvent({ runId, type: "stdout", command, text });

      // Stream output if callback provided
      if (options.onStdout) {
        options.onStdout(text);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      emitCliEvent({ runId, type: "stderr", command, text });

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
      emitCliEvent({
        runId,
        type: "error",
        command,
        text: error.message,
        durationMs: Date.now() - startedAt,
      });
      resolve({
        ok: false,
        command,
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
      emitCliEvent({
        runId,
        type: killed ? "cancel" : "close",
        command,
        exitCode,
        ok: exitCode === 0 && !killed,
        durationMs: Date.now() - startedAt,
      });
      resolve({
        ok: exitCode === 0 && !killed,
        command,
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

function backgroundSystemsPath() {
  return path.join(app.getPath("userData"), BACKGROUND_SYSTEMS_FILE);
}

function readBackgroundSystemRuns() {
  try {
    const filePath = backgroundSystemsPath();
    if (!fs.existsSync(filePath)) return {};

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") return {};

    const runsBySystem = {};
    for (const [systemId, runs] of Object.entries(parsed)) {
      if (!Array.isArray(runs)) continue;

      runsBySystem[systemId] = runs.filter((run) => (
        run &&
        typeof run === "object" &&
        typeof run.startedAt === "string" &&
        typeof run.finishedAt === "string" &&
        typeof run.ok === "boolean"
      )).slice(0, 3);
    }

    return runsBySystem;
  } catch (error) {
    console.error("Failed to read background system runs:", error);
    return {};
  }
}

function writeBackgroundSystemRuns(runsBySystem) {
  try {
    const filePath = backgroundSystemsPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(runsBySystem), "utf8");
  } catch (error) {
    console.error("Failed to write background system runs:", error);
  }
}

function makeBackgroundRun(startedAt, ok, message) {
  const finishedAt = Date.now();
  return {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    ok,
    durationMs: finishedAt - startedAt,
    message,
  };
}

function recordBackgroundSystemRun(systemId, run) {
  const runsBySystem = readBackgroundSystemRuns();
  const currentRuns = Array.isArray(runsBySystem[systemId]) ? runsBySystem[systemId] : [];
  runsBySystem[systemId] = [run, ...currentRuns].slice(0, 3);
  writeBackgroundSystemRuns(runsBySystem);
}

function isLoginItemEnabled() {
  if (process.platform !== "darwin") return false;

  try {
    return Boolean(app.getLoginItemSettings().openAtLogin);
  } catch {
    return false;
  }
}

function getBackgroundSystems() {
  const runsBySystem = readBackgroundSystemRuns();
  const batteryRuns = runsBySystem["battery-sampler"] || [];
  const loginRuns = runsBySystem["login-item"] || [];

  return [
    {
      id: "battery-sampler",
      name: "Battery metrics sampler",
      description: "Refreshes cached system and battery metrics while Moleui is open.",
      enabled: Boolean(batterySamplerInterval),
      active: batterySampleInFlight,
      schedule: "Every 6 minutes",
      lastRun: batteryRuns[0] || null,
      recentRuns: batteryRuns.slice(0, 3),
    },
    {
      id: "login-item",
      name: "Launch at login helper",
      description: "Starts Moleui hidden after macOS login so background metrics stay warm.",
      enabled: isLoginItemEnabled(),
      active: openedAsHiddenLoginItem,
      schedule: "On macOS login",
      lastRun: loginRuns[0] || null,
      recentRuns: loginRuns.slice(0, 3),
    },
  ];
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
  const startedAt = Date.now();

  try {
    const result = await runMole(["status", "--json", "--process-limit", "0"]);
    if (!result.ok) {
      console.warn("Background battery sample failed:", result.stderr || result.exitCode);
      recordBackgroundSystemRun(
        "battery-sampler",
        makeBackgroundRun(startedAt, false, result.stderr || `Exited with code ${result.exitCode}`),
      );
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
    recordBackgroundSystemRun("battery-sampler", makeBackgroundRun(startedAt, true, "Updated battery metrics cache"));
  } catch (error) {
    console.error("Background battery sample failed:", error);
    recordBackgroundSystemRun("battery-sampler", makeBackgroundRun(startedAt, false, error.message));
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

function addUniquePath(paths, filePath) {
  if (filePath && !paths.includes(filePath)) paths.push(filePath);
}

function appBundlePath(filePath) {
  const appBundleMatch = String(filePath || "").match(/^(.+?\.app)(?:\/|$)/);
  return appBundleMatch?.[1] ?? "";
}

function normalizeAppLookupName(value) {
  return String(value || "")
    .replace(/\.app$/i, "")
    .replace(/\b(helper|renderer|gpu|plugin|extension)\b.*$/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function getApplicationSearchIndex() {
  if (applicationSearchIndex) return applicationSearchIndex;

  const roots = [
    "/Applications",
    path.join(os.homedir(), "Applications"),
    "/Applications/Utilities",
    "/System/Applications",
    "/System/Applications/Utilities",
    "/System/Library/CoreServices",
    "/System/Library/CoreServices/Applications",
  ];
  const appPaths = [];
  const visited = new Set();

  function scanDirectory(directory, depth) {
    if (depth < 0 || visited.has(directory)) return;
    visited.add(directory);

    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const entryPath = path.join(directory, entry.name);

      if (entry.name.endsWith(".app")) {
        addUniquePath(appPaths, entryPath);
        continue;
      }

      if (!entry.name.startsWith(".")) {
        scanDirectory(entryPath, depth - 1);
      }
    }
  }

  roots.forEach((root) => scanDirectory(root, 3));
  applicationSearchIndex = appPaths;
  return appPaths;
}

function getSystemApplicationIndex() {
  if (systemApplicationIndex) return systemApplicationIndex;

  const entries = getApplicationSearchIndex().map(readApplicationMetadata);
  const byPath = new Map();
  const byLookupName = new Map();
  const byBundleIdentifier = new Map();

  for (const entry of entries) {
    byPath.set(entry.path, entry);
    addMapListValue(byBundleIdentifier, entry.bundleIdentifier, entry.path);
    entry.lookupNames.forEach((lookupName) => addMapListValue(byLookupName, lookupName, entry.path));
  }

  systemApplicationIndex = { entries, byPath, byLookupName, byBundleIdentifier };
  return systemApplicationIndex;
}

function findSpotlightApplicationPaths(processName) {
  if (process.platform !== "darwin") return [];

  const lookupName = String(processName || "")
    .replace(/\.app$/i, "")
    .replace(/\b(helper|renderer|gpu|plugin|extension)\b.*$/i, "")
    .trim();
  if (!lookupName) return [];
  const queryName = lookupName.replace(/["\\]/g, "");

  try {
    const output = execFileSync("/usr/bin/mdfind", [
      `kMDItemContentType == "com.apple.application-bundle" && kMDItemFSName == "${queryName}.app"`,
    ], { encoding: "utf8", timeout: 900, maxBuffer: 128 * 1024 });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.endsWith(".app") && fs.existsSync(line));
  } catch {
    return [];
  }
}

function appLookupNamesMatch(appName, lookupName) {
  if (!appName || !lookupName) return false;
  if (appName === lookupName) return true;

  const shorter = appName.length < lookupName.length ? appName : lookupName;
  const longer = appName.length < lookupName.length ? lookupName : appName;

  // Avoid false positives like Code -> Codex while still allowing longer bundle
  // names to match related helper processes.
  return shorter.length >= 6 && longer.startsWith(shorter);
}

function findNamedApplicationPaths(processName) {
  const lookupName = normalizeAppLookupName(processName);
  if (!lookupName) return [];
  if (applicationNameLookupCache.has(lookupName)) return applicationNameLookupCache.get(lookupName);

  const matches = [];
  const { entries, byLookupName } = getSystemApplicationIndex();

  (byLookupName.get(lookupName) || []).forEach((appPath) => addUniquePath(matches, appPath));

  for (const entry of entries) {
    if ([...entry.lookupNames].some((appName) => appLookupNamesMatch(appName, lookupName))) {
      addUniquePath(matches, entry.path);
    }
  }

  findSpotlightApplicationPaths(processName).forEach((appPath) => addUniquePath(matches, appPath));

  applicationNameLookupCache.set(lookupName, matches);
  return matches;
}

function systemApplicationIconPaths(appInfo = {}) {
  const paths = [];
  const appObject = appInfo && typeof appInfo === "object" ? appInfo : {};
  const directPath = typeof appInfo === "string" ? appInfo : appObject.path;
  const bundleId = appObject.bundle_id || appObject.bundleIdentifier || "";
  const names = typeof appInfo === "string"
    ? [path.basename(appInfo)]
    : [appObject.name, appObject.uninstall_name, appObject.uninstallName, appObject.executableName].filter(Boolean);
  const { byBundleIdentifier } = getSystemApplicationIndex();

  if (directPath) {
    const existingPath = existingProcessPath(directPath) || (fs.existsSync(directPath) ? directPath : "");
    addUniquePath(paths, appBundlePath(existingPath) || existingPath);
  }

  (byBundleIdentifier.get(bundleId) || []).forEach((appPath) => addUniquePath(paths, appPath));
  names.forEach((name) => findNamedApplicationPaths(name).forEach((appPath) => addUniquePath(paths, appPath)));

  return paths;
}

async function getSystemApplicationIconData(appInfo = {}) {
  const iconPaths = systemApplicationIconPaths(appInfo);

  for (const iconPath of iconPaths) {
    const result = await getAppIconData(iconPath);
    if (result.ok && result.icon) return result;
  }

  return { ok: false, icon: "", message: "No system app icon found" };
}

function execFileOutput(file, args, timeoutMs) {
  return withTimeout(new Promise((resolve) => {
    execFile(file, args, (error, stdout) => {
      resolve(error ? "" : String(stdout || "").trim());
    });
  }), timeoutMs, `${file} timed out`).catch(() => "");
}

async function getProcessAppBundlePath(pid) {
  if (process.platform !== "darwin" || !Number.isFinite(pid)) return "";

  const script = `
tell application "System Events"
  set matchingProcesses to (every process whose unix id is ${Number(pid)})
  if (count of matchingProcesses) is 0 then return ""
  try
    return POSIX path of (application file of item 1 of matchingProcesses as alias)
  on error
    return ""
  end try
end tell
`;

  const bundlePath = await execFileOutput("osascript", ["-e", script], 1200);
  return bundlePath.endsWith(".app/") ? bundlePath.slice(0, -1) : bundlePath;
}

async function getProcessAppBundlePathsByPid(pids) {
  const uniquePids = [...new Set(pids.map(Number).filter(Number.isFinite))];
  const bundlePaths = new Map();

  if (process.platform !== "darwin" || uniquePids.length === 0) return bundlePaths;

  const script = `
set targetPids to {${uniquePids.join(",")}}
set outputLines to {}
tell application "System Events"
  repeat with targetPid in targetPids
    set pidNumber to targetPid as integer
    set bundlePath to ""
    set matchingProcesses to (every process whose unix id is pidNumber)
    if (count of matchingProcesses) is greater than 0 then
      try
        set bundlePath to POSIX path of (application file of item 1 of matchingProcesses as alias)
      on error
        set bundlePath to ""
      end try
    end if
    set end of outputLines to ((pidNumber as text) & tab & bundlePath)
  end repeat
end tell
set AppleScript's text item delimiters to linefeed
return outputLines as text
`;

  const output = await execFileOutput("osascript", ["-e", script], Math.min(5000, 1000 + uniquePids.length * 80));
  for (const line of output.split(/\r?\n/)) {
    const [pidText, rawBundlePath = ""] = line.split("\t");
    const pid = Number(pidText);
    const bundlePath = rawBundlePath.endsWith(".app/") ? rawBundlePath.slice(0, -1) : rawBundlePath;
    if (Number.isFinite(pid) && bundlePath) {
      bundlePaths.set(pid, bundlePath);
    }
  }

  return bundlePaths;
}

function processIconPaths(processInfo, bundlePath = "") {
  const paths = [];
  const processPath = existingProcessPath(processInfo?.command);
  const processBundlePath = appBundlePath(processPath);
  const processExecutableName = processPath ? path.basename(processPath) : "";

  addUniquePath(paths, bundlePath);
  addUniquePath(paths, processBundlePath);
  addUniquePath(paths, processPath);
  findNamedApplicationPaths(processInfo?.name).forEach((appPath) => addUniquePath(paths, appPath));
  findNamedApplicationPaths(processExecutableName).forEach((appPath) => addUniquePath(paths, appPath));
  findNamedApplicationPaths(path.basename(processBundlePath)).forEach((appPath) => addUniquePath(paths, appPath));
  processIconSlugCandidates(processInfo).forEach((name) => {
    findNamedApplicationPaths(name).forEach((appPath) => addUniquePath(paths, appPath));
  });

  return paths;
}

function processIconPath(commandPath) {
  const processPath = existingProcessPath(commandPath);
  if (!processPath) return "";

  return appBundlePath(processPath) || processPath;
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

  template.push({
    label: "Developer",
    submenu: [
      {
        label: "CLI Monitor",
        accelerator: "CmdOrCtrl+Shift+M",
        click: () => createCliMonitorWindow(BrowserWindow.getFocusedWindow() ?? mainWindow),
      },
      ...(isDev
        ? [
          { type: "separator" },
          { role: "reload" },
          { role: "forceReload" },
          { type: "separator" },
          { role: "toggleDevTools" },
        ]
        : []),
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function centeredWindowBounds({ width, height, minWidth, minHeight }) {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const availableWidth = Math.max(360, workArea.width - 48);
  const availableHeight = Math.max(360, workArea.height - 48);
  const finalWidth = Math.min(width, availableWidth);
  const finalHeight = Math.min(height, availableHeight);

  return {
    x: Math.round(workArea.x + (workArea.width - finalWidth) / 2),
    y: Math.round(workArea.y + (workArea.height - finalHeight) / 2),
    width: Math.round(finalWidth),
    height: Math.round(finalHeight),
    minWidth: Math.min(minWidth, Math.round(finalWidth)),
    minHeight: Math.min(minHeight, Math.round(finalHeight)),
  };
}

function createWindow(options = {}) {
  const shouldShow = options.show !== false;
  const bounds = centeredWindowBounds(MAIN_WINDOW_SIZE);
  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: bounds.minWidth,
    minHeight: bounds.minHeight,
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

  loadAppWindow(window);

  if (shouldShow) {
    window.once("ready-to-show", () => {
      const nextBounds = centeredWindowBounds(MAIN_WINDOW_SIZE);
      window.setBounds({ x: nextBounds.x, y: nextBounds.y, width: nextBounds.width, height: nextBounds.height }, false);
      window.show();
      window.focus();
    });
  }

  return window;
}

let mainWindow;
let loginWindow;
let settingsWindow;
let cliMonitorWindow;
let billingWindow;

function loadAppWindow(window, query = "") {
  if (isDev) {
    window.loadURL(`http://localhost:5173${query}`);
  } else {
    window.loadFile(path.join(__dirname, "dist", "index.html"), query ? { search: query.slice(1) } : undefined);
  }
}

function createLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    if (loginWindow.isVisible()) {
      loginWindow.focus();
    }
    return loginWindow;
  }

  const bounds = centeredWindowBounds(LOGIN_WINDOW_SIZE);
  loginWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: bounds.minWidth,
    minHeight: bounds.minHeight,
    show: false,
    title: "Sign in to Moleui",
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

  loadAppWindow(loginWindow, "?window=login");

  loginWindow.on("closed", () => {
    loginWindow = null;
  });

  return loginWindow;
}

function showLoginWindow() {
  if (!loginWindow || loginWindow.isDestroyed()) {
    return { ok: false, message: "Login window is not available" };
  }

  const nextBounds = centeredWindowBounds(LOGIN_WINDOW_SIZE);
  loginWindow.setBounds({ x: nextBounds.x, y: nextBounds.y, width: nextBounds.width, height: nextBounds.height }, false);
  loginWindow.show();
  loginWindow.focus();
  return { ok: true };
}

function openMainWindowAfterAuth() {
  if (process.platform === "darwin") {
    app.dock.show();
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
  }

  return mainWindow;
}

function closeAppWindowsForSignOut() {
  for (const window of [mainWindow, settingsWindow, cliMonitorWindow]) {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }
  mainWindow = null;
  settingsWindow = null;
  cliMonitorWindow = null;
}

function isAllowedBillingUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (
      parsed.hostname === "checkout.stripe.com" ||
      parsed.hostname === "billing.stripe.com"
    );
  } catch {
    return false;
  }
}

function isBillingReturnUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "billing.moleui.local";
  } catch {
    return false;
  }
}

function openBillingWindow(parentWindow, url, title) {
  if (!isAllowedBillingUrl(url)) {
    return { ok: false, message: "Billing URL is not allowed" };
  }

  if (billingWindow && !billingWindow.isDestroyed()) {
    billingWindow.close();
  }

  billingWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    show: false,
    title,
    titleBarStyle: "hidden",
    trafficLightPosition: {
      x: 18,
      y: 6,
    },
    parent: parentWindow,
    icon: appIconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  billingWindow.webContents.on("will-navigate", (event, nextUrl) => {
    if (isBillingReturnUrl(nextUrl)) {
      event.preventDefault();
      billingWindow?.close();
    }
  });

  billingWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    if (isAllowedBillingUrl(nextUrl)) return { action: "allow" };
    if (isBillingReturnUrl(nextUrl)) {
      billingWindow?.close();
    }
    return { action: "deny" };
  });

  billingWindow.loadURL(url);
  billingWindow.once("ready-to-show", () => billingWindow?.show());
  billingWindow.on("closed", () => {
    billingWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("mole:billing:closed");
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send("mole:billing:closed");
    }
  });

  return { ok: true };
}

async function detectBillingCountry() {
  try {
    const response = await fetch("https://ipapi.co/country_code/", { signal: AbortSignal.timeout(3000) });
    const country = (await response.text()).trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(country)) return country;
  } catch (error) {
    console.warn("Failed to detect country from network:", error.message);
  }

  const locale = app.getLocaleCountryCode?.() || app.getLocale()?.split("-")[1] || "";
  return /^[A-Z]{2}$/i.test(locale) ? locale.toUpperCase() : "US";
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

function createCliMonitorWindow(parentWindow) {
  if (cliMonitorWindow && !cliMonitorWindow.isDestroyed()) {
    cliMonitorWindow.focus();
    return cliMonitorWindow;
  }

  cliMonitorWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 820,
    minHeight: 560,
    show: false,
    title: "CLI Monitor",
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

  loadAppWindow(cliMonitorWindow, "?window=developer");

  cliMonitorWindow.once("ready-to-show", () => {
    cliMonitorWindow.show();
  });

  cliMonitorWindow.on("closed", () => {
    cliMonitorWindow = null;
  });

  return cliMonitorWindow;
}

ipcMain.handle("mole:status", async () => runMole(["status", "--json", "--process-limit", "0"]));

ipcMain.handle("mole:process:icons", async (_event, processes) => {
  if (!Array.isArray(processes)) {
    return { ok: false, icons: {}, message: "Invalid processes" };
  }

  const bundlePathsByPid = await getProcessAppBundlePathsByPid(processes.map((proc) => proc?.pid));
  const resolvedProcessIconEntries = await mapWithConcurrency(processes, 8, async (proc) => ({
    pid: proc?.pid,
    processInfo: proc,
    iconPaths: processIconPaths(proc, bundlePathsByPid.get(Number(proc?.pid))),
  }));
  const processIconEntries = resolvedProcessIconEntries.filter(({ pid, iconPaths }) => Number.isFinite(pid) && iconPaths.length > 0);

  const uniqueIconPaths = [...new Set(processIconEntries.flatMap(({ iconPaths }) => iconPaths))];
  const iconResults = await mapWithConcurrency(uniqueIconPaths, 8, async (iconPath) => {
    const result = await getAppIconData(iconPath);
    return [iconPath, result];
  });
  const iconsByPath = new Map(iconResults.filter(([, result]) => result.ok && result.icon));
  const icons = {};
  const missing = [];
  const fallbackEntries = [];

  for (const { pid, processInfo, iconPaths } of processIconEntries) {
    const result = iconPaths.map((iconPath) => iconsByPath.get(iconPath)).find((iconResult) => iconResult?.icon);
    if (result?.icon) {
      icons[pid] = result.icon;
    } else {
      fallbackEntries.push({ pid, processInfo });
    }
  }

  for (const { pid, processInfo, iconPaths } of resolvedProcessIconEntries) {
    if (!Number.isFinite(pid) || iconPaths.length > 0 || icons[pid]) continue;
    fallbackEntries.push({ pid, processInfo });
  }

  const fallbackIcons = await mapWithConcurrency(fallbackEntries, 6, async ({ pid, processInfo }) => {
    return [pid, genericProcessIconData(processInfo).icon];
  });
  for (const [pid, icon] of fallbackIcons) {
    icons[pid] = icon;
  }

  return { ok: true, icons, missing };
});

ipcMain.handle("mole:settings:open", async (event) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  createSettingsWindow(parentWindow);
  return { ok: true };
});

ipcMain.handle("mole:developer:open", async (event) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  createCliMonitorWindow(parentWindow);
  return { ok: true };
});

ipcMain.handle("mole:developer:cli-events", async () => cliMonitorEvents);

ipcMain.handle("mole:developer:clear-cli-events", async () => {
  cliMonitorEvents.length = 0;
  emitCliEvent({ type: "clear", command: "developer monitor", text: "CLI monitor cleared" });
  return { ok: true };
});

ipcMain.handle("mole:auth:complete", async () => {
  openMainWindowAfterAuth();
  return { ok: true };
});

ipcMain.handle("mole:auth:show-login", async (event) => {
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);

  if (sourceWindow !== loginWindow) {
    return { ok: true };
  }

  return showLoginWindow();
});

ipcMain.handle("mole:auth:sign-out", async () => {
  closeAppWindowsForSignOut();
  createLoginWindow();
  return { ok: true };
});

ipcMain.handle("mole:billing:country", async () => ({ country: await detectBillingCountry() }));

ipcMain.handle("mole:billing:open-checkout", async (event, url) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  return openBillingWindow(parentWindow, String(url || ""), "Subscribe to Moleui");
});

ipcMain.handle("mole:billing:open-portal", async (event, url) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  return openBillingWindow(parentWindow, String(url || ""), "Manage Moleui Billing");
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

ipcMain.handle("mole:background-systems:list", async () => getBackgroundSystems());

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
  return getSystemApplicationIconData({ path: appPath });
});

ipcMain.handle("mole:uninstall:app-icons", async (_event, appItems) => {
  if (!Array.isArray(appItems)) {
    return { ok: false, icons: {}, message: "Invalid app paths" };
  }

  const appRequestsByKey = new Map();
  for (const item of appItems) {
    const appInfo = typeof item === "string" ? { path: item } : item;
    const key = appInfo?.path;
    if (typeof key === "string" && key) appRequestsByKey.set(key, appInfo);
  }

  const iconResults = await mapWithConcurrency([...appRequestsByKey.entries()], 8, async ([appPath, appInfo]) => {
    const result = await getSystemApplicationIconData(appInfo);
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
  openedAsHiddenLoginItem = openedAsHidden;

  if (openedAsHidden) {
    recordBackgroundSystemRun(
      "login-item",
      makeBackgroundRun(Date.now(), true, "Started hidden after macOS login"),
    );
  }

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
    createLoginWindow();
  }

  app.on("activate", () => {
    if (process.platform === "darwin") {
      app.dock.show();
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
