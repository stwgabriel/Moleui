import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, powerMonitor, screen, session, shell } from "electron";
import electronUpdater from "electron-updater";
import { execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
// Dev renderer URL is configurable so the app can run on a free port when the
// default Vite port (30736) is taken by another project. Defaults to 30736.
const DEV_SERVER_URL = process.env.MOLE_DEV_URL || "http://localhost:30736";
const appIconPath = path.join(__dirname, "public", "assets", "base", "molui-purple.png");
const { autoUpdater } = electronUpdater;

// Packaged builds serve the renderer over a loopback HTTP origin
// (http://localhost:<port>) instead of file:// or a custom app:// scheme.
// Clerk persists its session in cookies on the renderer's own origin, and
// Chromium only stores cookies on "cookieable" schemes — http(s)/ws(s). Both
// file:// AND custom standard+secure schemes (app://) are NON-cookieable in
// Electron: cookie writes are silently dropped (EXCLUDE_NONCOOKIEABLE_SCHEME),
// so a packaged app served from them signs in once (session in memory) but can
// never restore it in the separately-created main window or after a restart —
// which bounced the user straight back to the login screen. An in-process
// loopback HTTP server is a real cookieable origin where the session persists
// to disk and is shared across the login and main BrowserWindows (they share
// session.defaultSession). `base: './'` in vite keeps asset URLs relative to
// whatever origin serves index.html.
const RENDERER_HOST = "127.0.0.1"; // bind loopback only (not reachable off-box)
const RENDERER_URL_HOST = "localhost"; // navigate via localhost (Clerk dev trusts it)
const RENDERER_PORT_FILE = "renderer-port.json";
// Resolved once the loopback server is listening, e.g. "http://localhost:51763".
let rendererOrigin = "";

const RENDERER_MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};

function rendererPortFilePath() {
  return path.join(app.getPath("userData"), RENDERER_PORT_FILE);
}

// Reuse the same port across launches so the renderer's origin stays stable.
// Cookies survive a port change (they key on host, not port), but localStorage
// IS origin/port-scoped and Clerk's dev-browser cache lives there — a drifting
// port would keep the session cookie yet force an occasional re-handshake.
function readSavedRendererPort() {
  try {
    const port = JSON.parse(fs.readFileSync(rendererPortFilePath(), "utf8"))?.port;
    return Number.isInteger(port) && port > 1024 && port < 65536 ? port : 0;
  } catch {
    return 0;
  }
}

function saveRendererPort(port) {
  try {
    fs.mkdirSync(path.dirname(rendererPortFilePath()), { recursive: true });
    fs.writeFileSync(rendererPortFilePath(), JSON.stringify({ port }), "utf8");
  } catch (error) {
    console.error("Failed to persist renderer port:", error);
  }
}

// Static file handler for the built renderer (apps/desktop/dist). Every request
// is contained inside dist/ so a crafted URL can't read arbitrary files; unknown
// paths fall back to the SPA shell (so Clerk path routes like /sso-callback
// resolve); files are read with fs (asar-aware in packaged builds) so it works
// whether or not dist/ is inside app.asar.
function createRendererRequestHandler() {
  const distDir = path.join(__dirname, "dist");
  return async (req, res) => {
    let pathname = "/";
    try {
      ({ pathname } = new URL(req.url, rendererOrigin || `http://${RENDERER_URL_HOST}`));
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }
    let relativePath = decodeURIComponent(pathname);
    if (!relativePath || relativePath === "/") relativePath = "/index.html";
    const resolved = path.normalize(path.join(distDir, relativePath));
    if (resolved !== distDir && !resolved.startsWith(distDir + path.sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    let filePath = resolved;
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        filePath = path.join(distDir, "index.html");
      }
    } catch {
      filePath = path.join(distDir, "index.html");
    }

    try {
      const data = await fs.promises.readFile(filePath);
      const type = RENDERER_MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  };
}

// Starts the loopback renderer server and resolves rendererOrigin before any
// window loads. Tries the saved port first; on EADDRINUSE falls back to an
// OS-assigned free port and persists the new one.
function startRendererServer() {
  const server = http.createServer(createRendererRequestHandler());

  const listenOn = (port) =>
    new Promise((resolve, reject) => {
      const onError = (error) => {
        server.removeListener("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.removeListener("error", onError);
        resolve(server.address().port);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, RENDERER_HOST);
    });

  return (async () => {
    let port;
    try {
      port = await listenOn(readSavedRendererPort());
    } catch (error) {
      if (error?.code !== "EADDRINUSE") throw error;
      port = await listenOn(0);
    }
    saveRendererPort(port);
    rendererOrigin = `http://${RENDERER_URL_HOST}:${port}`;
    return rendererOrigin;
  })();
}
const MY_MAC_METRICS_FILE = "my-mac-metrics.json";
const THEME_PREFS_FILE = "theme-prefs.json";
const BACKGROUND_SYSTEMS_FILE = "background-systems.json";
const AUTOMATIONS_FILE = "automations.json";
const BATTERY_SAMPLE_INTERVAL_MS = 6 * 60 * 1000;
const MAX_BATTERY_HISTORY = 24 * 60;
const MAX_CLI_MONITOR_EVENTS = 1200;
const MAX_CLI_EVENT_TEXT = 24000;
const MAIN_WINDOW_SIZE = { width: 1400, height: 900, minWidth: 1240, minHeight: 800 };
const LOGIN_WINDOW_SIZE = { width: 880, height: 640, minWidth: 760, minHeight: 560 };
const BILLING_WINDOW_SHOW_TIMEOUT_MS = 900;

const disableGpuFallback = process.argv.includes("--disable-gpu");
if (disableGpuFallback) {
  // `--disable-gpu` is the explicit recovery path for the macOS Electron GPU
  // worker SIGTRAP. Do not counteract it with the normal acceleration switches.
  app.disableHardwareAcceleration();
} else {
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("enable-zero-copy");
}
app.setName("Moleui Desktop");

// Theme preference ("system" | "light" | "dark"). The renderer owns the UI and
// pushes changes over IPC; the main process persists the choice so nativeTheme
// (window vibrancy, prefers-color-scheme) is correct from the first frame of
// the next launch, before any renderer has booted.
const VALID_THEME_SOURCES = new Set(["system", "light", "dark"]);

function themePrefsPath() {
  return path.join(app.getPath("userData"), THEME_PREFS_FILE);
}

function readThemePreference() {
  try {
    const theme = JSON.parse(fs.readFileSync(themePrefsPath(), "utf8"))?.theme;
    return VALID_THEME_SOURCES.has(theme) ? theme : "system";
  } catch {
    return "system";
  }
}

function writeThemePreference(theme) {
  try {
    fs.writeFileSync(themePrefsPath(), JSON.stringify({ theme }), "utf8");
  } catch (error) {
    console.error("Failed to write theme preference:", error);
  }
}

nativeTheme.themeSource = readThemePreference();

// User-selectable app icon. Every variant is a layered Icon Composer bundle
// (build/*.icon) compiled into the packaged app's Assets.car, so whichever
// icon the user picks keeps macOS 26's dark / clear / tinted appearances;
// per-variant .icns fallbacks cover older macOS. Keep this registry in sync
// with the build/*.icon bundles and scripts/embed-appicon.cjs.
const APP_ICONS = [
  { id: "classic", label: "Classic Purple", asset: "AppIcon", file: "molui-purple.png" },
  { id: "midnight", label: "Midnight", asset: "AppIcon-Midnight", file: "molui-midnight.png" },
  { id: "cream", label: "Cream", asset: "AppIcon-Cream", file: "molui-light.png" },
  { id: "porcelain", label: "Porcelain", asset: "AppIcon-Porcelain", file: "molui-white.png" },
];
const DEFAULT_APP_ICON_ID = "classic";
const APP_ICON_PREFS_FILE = "app-icon-prefs.json";

function appIconPrefsPath() {
  return path.join(app.getPath("userData"), APP_ICON_PREFS_FILE);
}

function readAppIconPreference() {
  try {
    const icon = JSON.parse(fs.readFileSync(appIconPrefsPath(), "utf8"))?.icon;
    return APP_ICONS.some((entry) => entry.id === icon) ? icon : DEFAULT_APP_ICON_ID;
  } catch {
    return DEFAULT_APP_ICON_ID;
  }
}

function writeAppIconPreference(icon) {
  try {
    fs.writeFileSync(appIconPrefsPath(), JSON.stringify({ icon }), "utf8");
  } catch (error) {
    console.error("Failed to write app icon preference:", error);
  }
}

let appIconPreferenceId = null;

function selectedAppIcon() {
  if (appIconPreferenceId === null) {
    appIconPreferenceId = readAppIconPreference();
  }
  return APP_ICONS.find((entry) => entry.id === appIconPreferenceId) ?? APP_ICONS[0];
}

function macAppBundlePath() {
  if (isDev || process.platform !== "darwin") return null;
  // app.getPath("exe") is <bundle>.app/Contents/MacOS/<binary>
  const bundle = path.resolve(app.getPath("exe"), "..", "..", "..");
  return bundle.endsWith(".app") ? bundle : null;
}

let developerIdSignatureCache = null;

// Squirrel.Mac only accepts updates signed by the same stable identity as the
// running application. An ad-hoc signature is enough to launch a local build,
// but it has no Developer ID authority and cannot establish that continuity.
function hasDeveloperIdSignature() {
  if (developerIdSignatureCache !== null) return developerIdSignatureCache;
  const bundle = macAppBundlePath();
  if (!bundle) {
    developerIdSignatureCache = false;
    return developerIdSignatureCache;
  }

  const result = spawnSync("codesign", ["--display", "--verbose=4", bundle], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const details = `${result.stdout || ""}\n${result.stderr || ""}`;
  developerIdSignatureCache = result.status === 0 && /Authority=Developer ID Application:/i.test(details);
  return developerIdSignatureCache;
}

// The icon asset the installed bundle currently advertises: CFBundleIconName
// (Assets.car, macOS 26 appearances) with CFBundleIconFile as the pre-Tahoe
// fallback. null when it cannot be determined (dev, or unreadable plist).
function readBundleIconAsset() {
  const bundle = macAppBundlePath();
  if (!bundle) return null;
  const infoPlist = path.join(bundle, "Contents", "Info.plist");
  for (const key of ["CFBundleIconName", "CFBundleIconFile"]) {
    try {
      const value = execFileSync("plutil", ["-extract", key, "raw", "-o", "-", infoPlist], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (value) return value.replace(/\.icns$/, "");
    } catch {
      // key missing; try the fallback key
    }
  }
  return null;
}

// Dock icon for the running session. In dev the classic icon follows the
// effective appearance (purple in light, slate in dark). Packaged builds skip
// app.dock.setIcon whenever the bundle already advertises the chosen icon:
// a runtime PNG would override the system's rendering of the bundled
// Assets.car and lose the Tahoe appearances, so it is only used as immediate
// feedback / fallback while the bundle still shows a different icon.
function applyDockIcon() {
  if (process.platform !== "darwin") return;
  const selected = selectedAppIcon();
  if (!isDev && readBundleIconAsset() === selected.asset) return;
  const file =
    isDev && selected.id === DEFAULT_APP_ICON_ID && nativeTheme.shouldUseDarkColors
      ? "molui-midnight.png"
      : selected.file;
  const icon = nativeImage.createFromPath(path.join(__dirname, "public", "assets", "base", file));
  if (!icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
}

// Rewriting CFBundleIconName/CFBundleIconFile breaks the bundle's signature
// seal, and re-signing rewrites the running main binary (the Info.plist hash
// lives in its code directory) — doing that while the app runs risks the
// kernel killing the process on a later page-in. So the bundle rewrite runs
// in a detached helper that waits for this process to exit; if the helper
// never runs (crash, reboot), startup detects the mismatch and re-arms it.
// The app ships ad-hoc signed (scripts/adhoc-sign.cjs), so an ad-hoc re-sign
// restores a valid signature without a developer identity.
let bundleIconHelper = null;

function armBundleIconSync() {
  if (isDev || process.platform !== "darwin") return false;
  // Re-signing a Developer ID build ad-hoc would sever the identity continuity
  // required by Squirrel.Mac. The selected icon still applies to the running
  // Dock tile on every launch; only the on-disk Finder icon stays unchanged.
  if (hasDeveloperIdSignature()) {
    disarmBundleIconSync();
    return false;
  }
  const selected = selectedAppIcon();
  const bundle = macAppBundlePath();
  if (!bundle) return false;
  if (readBundleIconAsset() === selected.asset) {
    disarmBundleIconSync();
    return false;
  }

  const contents = path.join(bundle, "Contents");
  const infoPlist = path.join(contents, "Info.plist");
  const resources = path.join(contents, "Resources");
  try {
    fs.accessSync(infoPlist, fs.constants.W_OK);
    fs.accessSync(bundle, fs.constants.W_OK);
  } catch {
    console.warn("App bundle is not writable; icon change stays session-only");
    return false;
  }

  const steps = [];
  if (fs.existsSync(path.join(resources, "Assets.car"))) {
    steps.push('/usr/bin/plutil -replace CFBundleIconName -string "$ICON_ASSET" "$INFO_PLIST"');
  }
  if (fs.existsSync(path.join(resources, `${selected.asset}.icns`))) {
    steps.push('/usr/bin/plutil -replace CFBundleIconFile -string "$ICON_ASSET.icns" "$INFO_PLIST"');
  }
  if (steps.length === 0) {
    console.warn(`No bundled resources for icon ${selected.asset}; icon change stays session-only`);
    return false;
  }
  steps.push('/usr/bin/codesign --force --sign - --timestamp=none "$APP_BUNDLE"');
  steps.push('/usr/bin/touch "$APP_BUNDLE"');

  disarmBundleIconSync();
  const script = [
    'while /bin/kill -0 "$TARGET_PID" 2>/dev/null; do /bin/sleep 1; done',
    ...steps,
  ].join("\n");
  const helper = spawn("/bin/sh", ["-c", script], {
    detached: true,
    stdio: "ignore",
    env: {
      TARGET_PID: String(process.pid),
      ICON_ASSET: selected.asset,
      INFO_PLIST: infoPlist,
      APP_BUNDLE: bundle,
    },
  });
  helper.unref();
  bundleIconHelper = helper;
  return true;
}

function disarmBundleIconSync() {
  if (bundleIconHelper) {
    try {
      bundleIconHelper.kill();
    } catch {
      // already gone
    }
    bundleIconHelper = null;
  }
}

// ─── Application updates ────────────────────────────────────────────────────

const UPDATE_CHECK_DELAY_MS = 20_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let appUpdateCheck = null;
let appUpdaterConfigured = false;
let appUpdateState = {
  status: "disabled",
  currentVersion: app.getVersion(),
  availableVersion: null,
  progress: null,
  message: "Updates are available in installed release builds.",
  lastCheckedAt: null,
};

function appUpdatePayload() {
  return { ...appUpdateState };
}

function broadcastAppUpdateState() {
  const payload = appUpdatePayload();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("mole:updates:state", payload);
  }
}

function setAppUpdateState(patch) {
  appUpdateState = { ...appUpdateState, ...patch };
  broadcastAppUpdateState();
}

function updaterUnavailableMessage() {
  if (isDev) return "Updates are available in installed release builds.";
  if (process.platform !== "darwin") return "Automatic updates are currently available on macOS.";
  if (!hasDeveloperIdSignature()) {
    return "This build cannot update automatically because it does not have a Developer ID signature.";
  }
  return null;
}

function updateErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || "Update failed");
  return message.split("\n", 1)[0].trim() || "Update failed";
}

function configureAppUpdater() {
  if (appUpdaterConfigured) return;
  appUpdaterConfigured = true;

  const unavailable = updaterUnavailableMessage();
  if (unavailable) {
    setAppUpdateState({ status: "disabled", message: unavailable });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  // Release builds publish one channel manifest per architecture so parallel CI
  // jobs cannot overwrite each other's latest-mac.yml.
  autoUpdater.channel = process.arch;
  autoUpdater.logger = {
    info: (...args) => console.log("[updater]", ...args),
    warn: (...args) => console.warn("[updater]", ...args),
    error: (...args) => console.error("[updater]", ...args),
    debug: (...args) => console.debug("[updater]", ...args),
  };

  autoUpdater.on("checking-for-update", () => {
    setAppUpdateState({ status: "checking", progress: null, message: "Checking for updates…" });
  });
  autoUpdater.on("update-available", (info) => {
    setAppUpdateState({
      status: "available",
      availableVersion: info.version,
      progress: 0,
      message: `Downloading Moleui ${info.version}…`,
      lastCheckedAt: new Date().toISOString(),
    });
  });
  autoUpdater.on("update-not-available", () => {
    setAppUpdateState({
      status: "up-to-date",
      availableVersion: null,
      progress: null,
      message: "Moleui is up to date.",
      lastCheckedAt: new Date().toISOString(),
    });
  });
  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
    setAppUpdateState({
      status: "downloading",
      progress: Math.round(percent * 10) / 10,
      message: `Downloading update… ${Math.round(percent)}%`,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    setAppUpdateState({
      status: "downloaded",
      availableVersion: info.version,
      progress: 100,
      message: `Moleui ${info.version} is ready. Restart to finish updating.`,
    });
  });
  autoUpdater.on("error", (error) => {
    setAppUpdateState({ status: "error", progress: null, message: updateErrorMessage(error) });
  });

  setAppUpdateState({ status: "idle", message: "Moleui checks for updates automatically." });
  const firstCheck = setTimeout(() => void checkForAppUpdate(), UPDATE_CHECK_DELAY_MS);
  firstCheck.unref();
  const periodicCheck = setInterval(() => void checkForAppUpdate(), UPDATE_CHECK_INTERVAL_MS);
  periodicCheck.unref();
}

async function checkForAppUpdate() {
  const unavailable = updaterUnavailableMessage();
  if (unavailable) {
    setAppUpdateState({ status: "disabled", message: unavailable });
    return appUpdatePayload();
  }
  if (appUpdateCheck) return appUpdateCheck;

  appUpdateCheck = (async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      setAppUpdateState({ status: "error", progress: null, message: updateErrorMessage(error) });
    } finally {
      appUpdateCheck = null;
    }
    return appUpdatePayload();
  })();
  return appUpdateCheck;
}

function installAppUpdate() {
  if (appUpdateState.status !== "downloaded") {
    return { ok: false, message: "No downloaded update is ready to install." };
  }
  setImmediate(() => autoUpdater.quitAndInstall());
  return { ok: true };
}

// Store active processes for cancellation
const activeProcesses = new Map();
const appIconCache = new Map();
const cliMonitorEvents = [];
let nextCliRunId = 1;
let applicationSearchIndex = null;
let applicationSearchIndexPromise = null;
let systemApplicationIndex = null;
let systemApplicationIndexPromise = null;
const BATTERY_SAMPLER_START_DELAY_MS = 15_000;
const APPLICATION_INDEX_METADATA_BATCH_SIZE = 24;
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

  const isMacAppBundle = process.platform === "darwin" && path.extname(appPath) === ".app";
  // Electron 35's asynchronous thumbnail/file-icon bridge can crash inside
  // NSImage on macOS 27 when My Mac resolves many .app icons concurrently.
  // App bundles already carry an icns resource, so read that directly and keep
  // the unstable ThreadPool path for ordinary files only.
  if (!isMacAppBundle) {
    const thumbnailIcon = await getAppThumbnailIconData(appPath);
    if (thumbnailIcon.ok) {
      appIconCache.set(appPath, thumbnailIcon);
      return thumbnailIcon;
    }
  }

  const bundleIcon = getMacAppBundleIconData(appPath);
  if (bundleIcon.ok) {
    appIconCache.set(appPath, bundleIcon);
    return bundleIcon;
  }

  if (isMacAppBundle) {
    const result = { ok: false, icon: "", message: "Bundle icon file not found" };
    appIconCache.set(appPath, result);
    return result;
  }

  try {
    const fileIcon = await withTimeout(
      app.getFileIcon(appPath, { size: "large" }),
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

// The Go analyzer ships as a standalone binary inside the runtime. Calling it
// directly avoids sourcing the 1100-line `mole` shell entrypoint on every scan,
// which measured ~200ms of pure startup overhead per folder navigation.
function analyzeBinaryPath() {
  return path.join(runtimeDir(), "bin", "analyze-go");
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
    const command = options.commandLabel || `mole ${args.join(" ")}`;
    const startedAt = Date.now();

    try {
      // Allow callers to exec a specific bundled binary directly (e.g. the Go
      // analyzer) to skip the ~200ms shell-wrapper startup tax per invocation.
      executable = options.executable || ensureRuntime();
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
      env: { ...process.env, MOLE_DESKTOP: "1" },
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

// The renderer talks to one local operations module instead of learning every
// CLI flag and stdout format. The Electron main process remains the authority
// for validation, process ownership, cancellation, and runtime compatibility.
const DESKTOP_OPERATION_DEFINITIONS = Object.freeze([
  { id: "status", label: "System status", capabilities: ["status"] },
  { id: "clean", label: "Cleanup", capabilities: ["execute", "cancel", "stream"] },
  { id: "optimize", label: "Performance", capabilities: ["plan", "execute", "cancel", "stream"] },
  { id: "analyze", label: "Storage analysis", capabilities: ["execute", "cancel", "stream"] },
  { id: "uninstall", label: "Uninstall", capabilities: ["plan", "execute", "cancel", "stream"] },
  { id: "repos", label: "Repositories", capabilities: ["status", "plan", "execute", "cancel", "stream"] },
]);

function desktopOperationsStatus() {
  return {
    version: 1,
    runtime: {
      packaged: app.isPackaged,
      path: runtimeDir(),
    },
    operations: DESKTOP_OPERATION_DEFINITIONS.map((definition) => ({
      ...definition,
      state: activeProcesses.has(definition.id) ? "running" : "idle",
    })),
  };
}

function operationResultError(operation, result, fallback) {
  return {
    ok: false,
    operation,
    error: (result?.stderr || result?.stdout || fallback).trim(),
  };
}

async function loadOptimizePlan() {
  const result = await runMole(["optimize", "--plan-json"], {
    commandLabel: "mole optimize --plan-json",
  });
  if (!result.ok) return operationResultError("optimize", result, "Unable to build optimization plan");

  try {
    const plan = JSON.parse(result.stdout);
    if (
      plan?.version !== 1 ||
      plan?.operation !== "optimize" ||
      !Array.isArray(plan?.tasks)
    ) {
      throw new Error("Unsupported optimization plan schema");
    }
    return { ok: true, operation: "optimize", plan };
  } catch (error) {
    return {
      ok: false,
      operation: "optimize",
      error: error instanceof Error ? error.message : "Invalid optimization plan",
    };
  }
}

function emitOperationEvent(sender, event) {
  if (!sender.isDestroyed()) {
    sender.send("mole:operations:event", {
      at: new Date().toISOString(),
      ...event,
    });
  }
}

async function executeOptimizeOperation(event, request = {}) {
  const planResult = await loadOptimizePlan();
  if (!planResult.ok) {
    return {
      ok: false,
      command: "mole optimize",
      exitCode: null,
      stdout: "",
      stderr: planResult.error,
    };
  }

  const availableIds = new Set(planResult.plan.tasks.map((task) => task.id));
  const requestedIds = Array.isArray(request.taskIds)
    ? [...new Set(request.taskIds.map((taskId) => String(taskId || "").trim()).filter(Boolean))]
    : [];
  const invalidIds = requestedIds.filter((taskId) => !availableIds.has(taskId));
  if (invalidIds.length > 0) {
    return {
      ok: false,
      command: "mole optimize",
      exitCode: null,
      stdout: "",
      stderr: `Unknown optimization task IDs: ${invalidIds.join(", ")}`,
    };
  }

  const args = ["optimize"];
  for (const taskId of requestedIds) args.push("--task-id", taskId);

  emitOperationEvent(event.sender, { operation: "optimize", type: "start", taskIds: requestedIds });
  const result = await runMole(args, {
    processId: "optimize",
    onStdout: (text) => {
      emitOperationEvent(event.sender, { operation: "optimize", type: "stdout", text });
    },
    onStderr: (text) => {
      emitOperationEvent(event.sender, { operation: "optimize", type: "stderr", text });
    },
  });
  emitOperationEvent(event.sender, {
    operation: "optimize",
    type: result.killed ? "cancelled" : "complete",
    ok: result.ok,
    exitCode: result.exitCode,
  });
  return result;
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
  const automationRuns = runsBySystem["automation-scheduler"] || [];

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
    {
      id: "automation-scheduler",
      name: "Automation scheduler",
      description: "Runs enabled automation recipes while Moleui is open, on AC power and idle.",
      enabled: Boolean(automationSchedulerInterval),
      active: automationRunInFlight,
      schedule: "Checks every minute",
      lastRun: automationRuns[0] || null,
      recentRuns: automationRuns.slice(0, 3),
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

  setTimeout(() => {
    void sampleBatteryMetrics();
  }, BATTERY_SAMPLER_START_DELAY_MS);

  batterySamplerInterval = setInterval(() => {
    void sampleBatteryMetrics();
  }, BATTERY_SAMPLE_INTERVAL_MS);
}

// ─── Automations ─────────────────────────────────────────────────────────────
// Recipes are pure data. A recipe names an action kind and, for `clean`, a set
// of section labels drawn from a fixed allowlist below. No user-supplied path,
// glob, or script ever reaches this execution path: every run is the same
// `mole clean --section ...` / `mole installer` invocation the Cleanup page
// already drives, so Trash routing, path protection, and operation logging stay
// exactly where they are in the shell.
//
// `purge` is deliberately NOT automatable. It presents an interactive TTY menu
// and has no --yes flag, so an unattended run would either hang forever or act
// on a selection the user never made. Only `clean` and `installer` are here.
//
// The excluded clean sections are excluded on purpose: System / User essentials
// / Developer tools / App leftovers need sudo (silent no-ops or auth prompts in
// a background run), Time Machine and Device backups & firmware touch backup
// data, and Large files / System Data clues / Project artifacts are report-only
// hints that reclaim nothing.
const AUTOMATION_ALLOWED_CLEAN_SECTIONS = Object.freeze([
  "App caches",
  "Browsers",
  "Cloud & Office",
  "Applications",
  "Application Support",
  "Virtualization",
  "Apple Silicon",
]);
const AUTOMATION_ALLOWED_CLEAN_SECTION_SET = new Set(AUTOMATION_ALLOWED_CLEAN_SECTIONS);
const AUTOMATION_ALLOWED_ACTION_KINDS = Object.freeze(["clean", "installer"]);
const AUTOMATION_ALLOWED_ACTION_KIND_SET = new Set(AUTOMATION_ALLOWED_ACTION_KINDS);
const AUTOMATION_FREQUENCIES = new Set(["daily", "weekly"]);

const AUTOMATIONS_VERSION = 1;
const AUTOMATION_MAX_RECIPES = 24;
const AUTOMATION_MAX_RUNS = 100;
const AUTOMATION_TICK_INTERVAL_MS = 60 * 1000;
const AUTOMATION_SCHEDULER_START_DELAY_MS = 45_000;
// A run more than this far past its slot is skipped, not caught up: a Mac that
// was asleep for two days should not wake into a burst of stale cleanups.
const AUTOMATION_CATCH_UP_WINDOW_MS = 6 * 60 * 60 * 1000;
const AUTOMATION_MIN_RUN_GAP_MS = 6 * 60 * 60 * 1000;
const AUTOMATION_MAX_JITTER_MS = 120_000;
const AUTOMATION_IDLE_THRESHOLD_SECONDS = 120;
const AUTOMATION_RUN_TIMEOUT_MS = 30 * 60 * 1000;
const AUTOMATION_PROCESS_ID = "automation";

let automationSchedulerInterval = null;
let automationRunInFlight = false;
let automationTickInFlight = false;
// Advancing `lastRunAt` / `nextRunAt` only sticks if the state file write lands.
// A failed write would otherwise leave the slot due and let the scheduler re-run
// the same recipe on the next tick, forever. The last real run is therefore also
// held in memory and consulted by the due check alongside the persisted value.
const automationLastRunMs = new Map();

function automationsPath() {
  return path.join(app.getPath("userData"), AUTOMATIONS_FILE);
}

function defaultAutomationsState() {
  return { version: AUTOMATIONS_VERSION, paused: false, recipes: [], runs: [] };
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

// Normalizes an action to the allowlisted shape, or returns null when nothing
// safe can be recovered. An empty clean section list is treated as unrecoverable
// because bare `mole clean` would run every section, including the excluded ones.
function normalizeAutomationAction(raw) {
  if (!raw || typeof raw !== "object") return null;

  const kind = String(raw.kind || "");
  if (!AUTOMATION_ALLOWED_ACTION_KIND_SET.has(kind)) return null;

  if (kind === "installer") return { kind: "installer", sections: [] };

  const requested = Array.isArray(raw.sections) ? raw.sections : [];
  const sections = [];
  for (const entry of requested) {
    const section = String(entry || "").trim();
    if (!AUTOMATION_ALLOWED_CLEAN_SECTION_SET.has(section)) continue;
    if (!sections.includes(section)) sections.push(section);
  }

  if (sections.length === 0) return null;
  return { kind: "clean", sections };
}

// Identifies what the user actually dry-ran. Editing the action changes the
// fingerprint, which invalidates the stored dry-run pass and re-arms the gate.
function automationActionFingerprint(action) {
  if (!action) return "";
  if (action.kind === "installer") return "installer";
  return `clean:${[...action.sections].sort().join("|")}`;
}

function normalizeAutomationSchedule(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const frequency = AUTOMATION_FREQUENCIES.has(source.frequency) ? source.frequency : "weekly";

  return {
    frequency,
    hour: clampInt(source.hour, 0, 23, 3),
    minute: clampInt(source.minute, 0, 59, 0),
    weekday: clampInt(source.weekday, 0, 6, 0),
  };
}

function computeAutomationNextRunAt(schedule, fromMs) {
  const next = new Date(fromMs);
  next.setHours(schedule.hour, schedule.minute, 0, 0);

  if (schedule.frequency === "weekly") {
    const dayDelta = (schedule.weekday - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + dayDelta);
    if (next.getTime() <= fromMs) next.setDate(next.getDate() + 7);
    return next.getTime();
  }

  if (next.getTime() <= fromMs) next.setDate(next.getDate() + 1);
  return next.getTime();
}

// Stable per-recipe, per-slot offset so several recipes due at 03:00 do not all
// start in the same second. Deterministic so it survives ticks and restarts.
function automationJitterMs(recipeId, nextRunAt) {
  const key = `${recipeId}:${nextRunAt}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash % AUTOMATION_MAX_JITTER_MS;
}

// The pending slot has to be persisted, not recomputed from "now" on each read:
// recomputing would always return a strictly future time, so a slot could never
// be observed as due. A slot missed by more than the catch-up window rolls
// forward instead, so a Mac that slept through Sunday does not run on Tuesday.
function resolveAutomationNextRunAt(raw, schedule, enabled, nowMs) {
  if (!enabled) return null;

  const stored = typeof raw.nextRunAt === "string" ? Date.parse(raw.nextRunAt) : NaN;
  if (Number.isFinite(stored) && nowMs - stored <= AUTOMATION_CATCH_UP_WINDOW_MS) {
    return new Date(stored).toISOString();
  }

  return new Date(computeAutomationNextRunAt(schedule, nowMs)).toISOString();
}

function normalizeAutomationRecipe(raw, nowMs) {
  if (!raw || typeof raw !== "object") return null;

  const id = String(raw.id || "").trim();
  if (!id) return null;

  const action = normalizeAutomationAction(raw.action);
  const schedule = normalizeAutomationSchedule(raw.schedule);
  const requestedAction = raw.action && typeof raw.action === "object" ? raw.action : {};
  const requestedSections = Array.isArray(requestedAction.sections) ? requestedAction.sections.length : 0;
  // Data we could not fully recover: keep the row visible so the user can fix or
  // delete it, but it can never be enabled and can never be executed.
  const invalid = !action ||
    (action.kind === "clean" && action.sections.length !== requestedSections);

  const fingerprint = automationActionFingerprint(action);
  const storedFingerprint = typeof raw.dryRunFingerprint === "string" ? raw.dryRunFingerprint : "";
  const dryRunPassedAt = typeof raw.dryRunPassedAt === "string" && storedFingerprint === fingerprint && !invalid
    ? raw.dryRunPassedAt
    : null;

  const lastRunAt = typeof raw.lastRunAt === "string" ? raw.lastRunAt : null;
  const enabled = raw.enabled === true && !invalid && Boolean(dryRunPassedAt);

  return {
    id,
    catalogId: typeof raw.catalogId === "string" ? raw.catalogId : "custom",
    name: String(raw.name || "Automation").slice(0, 80),
    enabled,
    invalid,
    action: action || { kind: "clean", sections: [] },
    schedule,
    dryRunPassedAt,
    dryRunFingerprint: dryRunPassedAt ? fingerprint : "",
    lastRunAt,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date(nowMs).toISOString(),
    nextRunAt: resolveAutomationNextRunAt(raw, schedule, enabled, nowMs),
  };
}

function normalizeAutomationRun(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.startedAt !== "string" || typeof raw.ok !== "boolean") return null;

  return {
    id: String(raw.id || `${raw.startedAt}-${raw.recipeId || ""}`),
    recipeId: String(raw.recipeId || ""),
    recipeName: String(raw.recipeName || ""),
    startedAt: raw.startedAt,
    finishedAt: typeof raw.finishedAt === "string" ? raw.finishedAt : raw.startedAt,
    ok: raw.ok,
    durationMs: clampInt(raw.durationMs, 0, Number.MAX_SAFE_INTEGER, 0),
    dryRun: raw.dryRun === true,
    trigger: raw.trigger === "manual" ? "manual" : "scheduled",
    message: String(raw.message || "").slice(0, 400),
  };
}

// Unparsable state is moved aside rather than left in place to be overwritten by
// the next write: the file is the only record of what the user scheduled, so a
// stray syntax error should cost them a rename, not the recipes themselves.
function quarantineAutomationsFile(filePath) {
  const backupPath = `${filePath}.bak`;
  try {
    fs.renameSync(filePath, backupPath);
    console.error(`Quarantined unreadable automations state to ${backupPath}`);
  } catch (error) {
    console.error("Failed to quarantine automations state:", error);
  }
}

// Any unreadable or unparsable file yields the empty default: zero recipes means
// the scheduler has nothing to run. Corrupt state must never fall through to a
// run with unknown parameters.
function readAutomationsState() {
  const nowMs = Date.now();

  try {
    const filePath = automationsPath();
    if (!fs.existsSync(filePath)) return defaultAutomationsState();

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (parseError) {
      console.error("Failed to parse automations state:", parseError);
      quarantineAutomationsFile(filePath);
      return defaultAutomationsState();
    }

    if (!parsed || typeof parsed !== "object") {
      quarantineAutomationsFile(filePath);
      return defaultAutomationsState();
    }

    const recipes = (Array.isArray(parsed.recipes) ? parsed.recipes : [])
      .map((recipe) => normalizeAutomationRecipe(recipe, nowMs))
      .filter(Boolean)
      .slice(0, AUTOMATION_MAX_RECIPES);

    const runs = (Array.isArray(parsed.runs) ? parsed.runs : [])
      .map(normalizeAutomationRun)
      .filter(Boolean)
      .slice(0, AUTOMATION_MAX_RUNS);

    return {
      version: AUTOMATIONS_VERSION,
      paused: parsed.paused === true,
      recipes,
      runs,
    };
  } catch (error) {
    console.error("Failed to read automations state:", error);
    return defaultAutomationsState();
  }
}

// Temp file plus rename: a crash or a full disk mid-write leaves the previous
// state intact instead of a truncated file that the next read would quarantine.
function writeAutomationsState(state) {
  try {
    const filePath = automationsPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const tempPath = `${filePath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf8");
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Nothing to clean up when the temp file was never created.
      }
      throw error;
    }
  } catch (error) {
    console.error("Failed to write automations state:", error);
  }
  return state;
}

// Read, mutate, re-normalize, write. Normalizing on the way out means a mutation
// can never persist a state the read path would have rejected.
function updateAutomationsState(mutate) {
  const state = readAutomationsState();
  mutate(state);

  const nowMs = Date.now();
  const normalized = {
    version: AUTOMATIONS_VERSION,
    paused: state.paused === true,
    recipes: (Array.isArray(state.recipes) ? state.recipes : [])
      .map((recipe) => normalizeAutomationRecipe(recipe, nowMs))
      .filter(Boolean)
      .slice(0, AUTOMATION_MAX_RECIPES),
    runs: (Array.isArray(state.runs) ? state.runs : [])
      .map(normalizeAutomationRun)
      .filter(Boolean)
      .slice(0, AUTOMATION_MAX_RUNS),
  };

  return writeAutomationsState(normalized);
}

function automationsPayload() {
  const state = readAutomationsState();

  return {
    ...state,
    allowlist: {
      cleanSections: [...AUTOMATION_ALLOWED_CLEAN_SECTIONS],
      actionKinds: [...AUTOMATION_ALLOWED_ACTION_KINDS],
    },
    scheduler: {
      running: Boolean(automationSchedulerInterval),
      active: automationRunInFlight,
    },
  };
}

// The single choke point between a stored recipe and a spawned process. Every
// argument is either a literal or a string that passed set membership against
// AUTOMATION_ALLOWED_CLEAN_SECTIONS. Returns null when nothing may be run.
function buildAutomationArgs(action, dryRun) {
  if (!action || !AUTOMATION_ALLOWED_ACTION_KIND_SET.has(action.kind)) return null;

  // `--all --yes` is required even for a dry run: without --all the installer
  // command falls through to its interactive TTY selector, which blocks forever
  // on a piped stdin. --dry-run still makes the run non-destructive.
  if (action.kind === "installer") {
    const args = ["installer"];
    if (dryRun) args.push("--dry-run");
    args.push("--all", "--yes");
    return args;
  }

  const sections = Array.isArray(action.sections) ? action.sections : [];
  if (sections.length === 0) return null;
  if (!sections.every((section) => AUTOMATION_ALLOWED_CLEAN_SECTION_SET.has(section))) return null;

  const args = ["clean"];
  if (dryRun) args.push("--dry-run");
  for (const section of sections) args.push("--section", section);
  return args;
}

function recordAutomationRun(recipe, { startedAt, ok, dryRun, trigger, message }) {
  const finishedAt = Date.now();

  return updateAutomationsState((state) => {
    state.runs = [
      {
        id: `${finishedAt}-${Math.random().toString(36).slice(2)}`,
        recipeId: recipe.id,
        recipeName: recipe.name,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        ok,
        durationMs: finishedAt - startedAt,
        dryRun,
        trigger,
        message,
      },
      ...state.runs,
    ].slice(0, AUTOMATION_MAX_RUNS);

    if (!dryRun) {
      const target = state.recipes.find((entry) => entry.id === recipe.id);
      if (target) {
        target.lastRunAt = new Date(finishedAt).toISOString();
        // Advance past the slot we just consumed so the next tick does not
        // observe it as still due.
        target.nextRunAt = new Date(computeAutomationNextRunAt(target.schedule, finishedAt)).toISOString();
      }
    }
  });
}

// Scheduled runs happen with no renderer involvement, so tell any open window to
// refresh rather than leaving stale next-run times on screen.
function broadcastAutomationsChanged() {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("mole:automations:changed");
  }
}

async function executeAutomationRecipe(recipe, { dryRun, trigger }) {
  const args = buildAutomationArgs(recipe.action, dryRun);
  if (!args) {
    return { ok: false, stdout: "", stderr: "Recipe action is not automatable", exitCode: null };
  }

  if (automationRunInFlight) {
    return { ok: false, stdout: "", stderr: "Another automation is already running", exitCode: null };
  }

  automationRunInFlight = true;
  const startedAt = Date.now();
  // Claim the slot in memory before the process starts. If persisting the run
  // fails later, this is what keeps the next tick from seeing the recipe as
  // still due and running it again a minute from now.
  if (!dryRun) automationLastRunMs.set(recipe.id, startedAt);
  // Announce the run at the start, not only at the end, so an open window can
  // show it as active and offer Stop while the process is still alive.
  broadcastAutomationsChanged();

  try {
    const result = await runMole(args, {
      processId: AUTOMATION_PROCESS_ID,
      timeoutMs: AUTOMATION_RUN_TIMEOUT_MS,
      commandLabel: `automation ${recipe.name}: mole ${args.join(" ")}`,
    });

    const message = result.ok
      ? `${dryRun ? "Dry run" : "Run"} completed for ${recipe.name}`
      : (result.stderr || `Exited with code ${result.exitCode}`).trim().slice(0, 400);

    recordAutomationRun(recipe, { startedAt, ok: result.ok, dryRun, trigger, message });
    recordBackgroundSystemRun(
      "automation-scheduler",
      makeBackgroundRun(startedAt, result.ok, `${recipe.name}: ${message}`),
    );

    return result;
  } catch (error) {
    recordAutomationRun(recipe, { startedAt, ok: false, dryRun, trigger, message: error.message });
    recordBackgroundSystemRun(
      "automation-scheduler",
      makeBackgroundRun(startedAt, false, `${recipe.name}: ${error.message}`),
    );
    return { ok: false, stdout: "", stderr: error.message, exitCode: null };
  } finally {
    if (!dryRun) automationLastRunMs.set(recipe.id, Date.now());
    automationRunInFlight = false;
    broadcastAutomationsChanged();
  }
}

// Environment guards, evaluated per tick. Returns null when it is safe to run,
// or a short reason string that the caller logs and the UI can surface.
function automationBlockReason() {
  if (automationRunInFlight) return "another automation is running";
  if (activeProcesses.has("clean")) return "a cleanup is already running";

  try {
    if (powerMonitor.isOnBatteryPower()) return "on battery power";
  } catch {
    // powerMonitor is unavailable on some platforms; treat as not blocking.
  }

  try {
    if (powerMonitor.getSystemIdleTime() < AUTOMATION_IDLE_THRESHOLD_SECONDS) return "Mac is in use";
  } catch {
    // Same as above: absence of idle information should not block forever.
  }

  if (detectFullDiskAccess() === "denied") return "Full Disk Access is denied";
  return null;
}

// The persisted timestamp and the in-memory one can disagree in exactly one
// direction: a run happened but the write that recorded it failed. Taking the
// later of the two makes the minimum gap hold either way.
function automationLastRunAtMs(recipe) {
  const persisted = recipe.lastRunAt ? Date.parse(recipe.lastRunAt) : NaN;
  const remembered = automationLastRunMs.get(recipe.id);

  const known = [persisted, remembered].filter((value) => Number.isFinite(value));
  return known.length > 0 ? Math.max(...known) : null;
}

function isAutomationRecipeDue(recipe, nowMs) {
  if (!recipe.enabled || recipe.invalid) return false;
  if (!recipe.nextRunAt) return false;

  const slot = Date.parse(recipe.nextRunAt);
  if (!Number.isFinite(slot)) return false;

  const dueAt = slot + automationJitterMs(recipe.id, slot);
  if (nowMs < dueAt) return false;
  // Missed by more than the catch-up window: let it roll to the next slot.
  if (nowMs - dueAt > AUTOMATION_CATCH_UP_WINDOW_MS) return false;

  const lastRun = automationLastRunAtMs(recipe);
  if (lastRun !== null && nowMs - lastRun < AUTOMATION_MIN_RUN_GAP_MS) return false;

  return true;
}

async function tickAutomationScheduler() {
  if (automationTickInFlight) return;
  automationTickInFlight = true;

  try {
    const state = readAutomationsState();
    if (state.paused) return;

    const nowMs = Date.now();
    // Serial by design: one automation per tick, never a parallel burst.
    const dueRecipe = state.recipes.find((recipe) => isAutomationRecipeDue(recipe, nowMs));
    if (!dueRecipe) return;

    const blockReason = automationBlockReason();
    if (blockReason) {
      console.log(`Automation "${dueRecipe.name}" deferred: ${blockReason}`);
      return;
    }

    // executeAutomationRecipe broadcasts on both edges of the run, so an open
    // window already sees the start, the finish, and the new next-run time.
    await executeAutomationRecipe(dueRecipe, { dryRun: false, trigger: "scheduled" });
  } catch (error) {
    console.error("Automation scheduler tick failed:", error);
  } finally {
    automationTickInFlight = false;
  }
}

function startAutomationScheduler() {
  if (automationSchedulerInterval) return;

  setTimeout(() => {
    void tickAutomationScheduler();
  }, AUTOMATION_SCHEDULER_START_DELAY_MS);

  automationSchedulerInterval = setInterval(() => {
    void tickAutomationScheduler();
  }, AUTOMATION_TICK_INTERVAL_MS);
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

function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function scanApplicationDirectory(directory, depth, appPaths, visited) {
  if (depth < 0 || visited.has(directory)) return;
  visited.add(directory);

  let entries = [];
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
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
      await scanApplicationDirectory(entryPath, depth - 1, appPaths, visited);
    }
  }
}

async function buildApplicationSearchIndex() {
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

  for (const root of roots) {
    await scanApplicationDirectory(root, 3, appPaths, visited);
    await yieldToEventLoop();
  }

  return appPaths;
}

function warmApplicationSearchIndex() {
  if (applicationSearchIndex) return Promise.resolve(applicationSearchIndex);
  if (applicationSearchIndexPromise) return applicationSearchIndexPromise;

  applicationSearchIndexPromise = buildApplicationSearchIndex()
    .then((appPaths) => {
      applicationSearchIndex = appPaths;
      return appPaths;
    })
    .catch((error) => {
      applicationSearchIndexPromise = null;
      throw error;
    });

  return applicationSearchIndexPromise;
}

async function getApplicationSearchIndex() {
  if (applicationSearchIndex) return applicationSearchIndex;
  return warmApplicationSearchIndex();
}

async function buildSystemApplicationIndex(appPaths) {
  const entries = [];

  for (let index = 0; index < appPaths.length; index += APPLICATION_INDEX_METADATA_BATCH_SIZE) {
    const batch = appPaths.slice(index, index + APPLICATION_INDEX_METADATA_BATCH_SIZE);
    entries.push(...batch.map(readApplicationMetadata));
    await yieldToEventLoop();
  }

  const byPath = new Map();
  const byLookupName = new Map();
  const byBundleIdentifier = new Map();

  for (const entry of entries) {
    byPath.set(entry.path, entry);
    addMapListValue(byBundleIdentifier, entry.bundleIdentifier, entry.path);
    entry.lookupNames.forEach((lookupName) => addMapListValue(byLookupName, lookupName, entry.path));
  }

  return { entries, byPath, byLookupName, byBundleIdentifier };
}

async function getSystemApplicationIndex() {
  if (systemApplicationIndex) return systemApplicationIndex;
  if (systemApplicationIndexPromise) return systemApplicationIndexPromise;

  systemApplicationIndexPromise = getApplicationSearchIndex()
    .then((appPaths) => buildSystemApplicationIndex(appPaths))
    .then((index) => {
      systemApplicationIndex = index;
      return index;
    })
    .catch((error) => {
      systemApplicationIndexPromise = null;
      throw error;
    });

  return systemApplicationIndexPromise;
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

// Index-only name resolution. Touches only the in-memory application index, so
// it is safe to call once per process during icon resolution. Crucially it does
// NOT reach findSpotlightApplicationPaths, whose synchronous mdfind would block
// the main process per unmatched name when fanned out across the process list.
async function findIndexedApplicationPaths(processName) {
  const lookupName = normalizeAppLookupName(processName);
  if (!lookupName) return [];

  const matches = [];
  const { entries, byLookupName } = await getSystemApplicationIndex();

  (byLookupName.get(lookupName) || []).forEach((appPath) => addUniquePath(matches, appPath));

  for (const entry of entries) {
    if ([...entry.lookupNames].some((appName) => appLookupNamesMatch(appName, lookupName))) {
      addUniquePath(matches, entry.path);
    }
  }

  return matches;
}

async function findNamedApplicationPaths(processName) {
  const lookupName = normalizeAppLookupName(processName);
  if (!lookupName) return [];
  if (applicationNameLookupCache.has(lookupName)) return applicationNameLookupCache.get(lookupName);

  const matches = await findIndexedApplicationPaths(processName);
  findSpotlightApplicationPaths(processName).forEach((appPath) => addUniquePath(matches, appPath));

  applicationNameLookupCache.set(lookupName, matches);
  return matches;
}

async function systemApplicationIconPaths(appInfo = {}) {
  const paths = [];
  const appObject = appInfo && typeof appInfo === "object" ? appInfo : {};
  const directPath = typeof appInfo === "string" ? appInfo : appObject.path;
  const bundleId = appObject.bundle_id || appObject.bundleIdentifier || "";
  const names = typeof appInfo === "string"
    ? [path.basename(appInfo)]
    : [appObject.name, appObject.uninstall_name, appObject.uninstallName, appObject.executableName].filter(Boolean);
  const { byBundleIdentifier } = await getSystemApplicationIndex();

  if (directPath) {
    const existingPath = existingProcessPath(directPath) || (fs.existsSync(directPath) ? directPath : "");
    addUniquePath(paths, appBundlePath(existingPath) || existingPath);
  }

  (byBundleIdentifier.get(bundleId) || []).forEach((appPath) => addUniquePath(paths, appPath));
  for (const name of names) {
    const namedPaths = await findNamedApplicationPaths(name);
    namedPaths.forEach((appPath) => addUniquePath(paths, appPath));
  }

  return paths;
}

async function getSystemApplicationIconData(appInfo = {}) {
  const iconPaths = await systemApplicationIconPaths(appInfo);

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

// Maps each PID to the full path of its running executable via `ps`. The Go
// status command feeds ProcessInfo.command from `ps -c comm=`, where `-c` emits
// the bare accounting name (no path), so the renderer never sees a .app path.
// Without `-c`, `comm=` prints the full executable path; the leading
// `/Applications/Foo.app` portion appears long before ps' ~120-char column clip,
// so appBundlePath still extracts the bundle. Unlike the System Events bridge
// this needs no Automation permission and resolves bundled helpers/daemons too.
async function getProcessExecutablePathsByPid(pids) {
  const wantedPids = new Set(pids.map(Number).filter(Number.isFinite));
  const executablePaths = new Map();

  if (process.platform !== "darwin" || wantedPids.size === 0) return executablePaths;

  const output = await execFileOutput("ps", ["-axww", "-o", "pid=,comm="], 2500);
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(.+?)\s*$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const executablePath = match[2];
    if (wantedPids.has(pid) && executablePath.startsWith("/")) {
      executablePaths.set(pid, executablePath);
    }
  }

  return executablePaths;
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

async function processIconPaths(processInfo, bundlePath = "") {
  const processPath = existingProcessPath(processInfo?.command);
  const processBundlePath = appBundlePath(processPath);
  const processExecutableName = processPath ? path.basename(processPath) : "";

  // A real .app bundle from the command path (or System Events) is the
  // authoritative icon source. When we already have one, there is no need to
  // widen the search by name.
  const appBundleCandidates = [];
  addUniquePath(appBundleCandidates, bundlePath);
  addUniquePath(appBundleCandidates, processBundlePath);

  if (appBundleCandidates.length > 0) {
    const paths = [...appBundleCandidates];
    addUniquePath(paths, processPath);
    return paths;
  }

  // No .app in the command path: this is a bare executable, daemon, or helper.
  // getAppIconData would return a generic exec icon for the binary, so try to
  // map the process to an installed app by name first. Use the index-only
  // resolver to keep the synchronous Spotlight lookup out of the per-process
  // fan-out, and keep the bare executable as a last-resort candidate so a
  // matched .app icon always wins over the generic exec icon.
  const paths = [];
  const lookupNames = [
    processInfo?.name,
    processExecutableName,
    ...processIconSlugCandidates(processInfo),
  ].filter(Boolean);

  for (const name of lookupNames) {
    const namedPaths = await findIndexedApplicationPaths(name);
    namedPaths.forEach((appPath) => addUniquePath(paths, appPath));
  }

  addUniquePath(paths, processPath);
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
  const unlockAppForDevelopment = () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("mole:developer:unlock-app");
    }
  };

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
          {
            label: "Unlock App Without Paying",
            click: unlockAppForDevelopment,
          },
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

function mainWindowBounds() {
  const workArea = screen.getPrimaryDisplay().workArea;
  // Fill most of the screen so the app is comfortably large after login and
  // adapts to the display, rather than capping at a fixed width.
  const width = Math.min(2000, Math.max(MAIN_WINDOW_SIZE.minWidth, Math.round(workArea.width * 0.92)));
  const height = Math.min(1320, Math.max(MAIN_WINDOW_SIZE.minHeight, Math.round(workArea.height * 0.92)));
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
    minWidth: Math.min(MAIN_WINDOW_SIZE.minWidth, width),
    minHeight: Math.min(MAIN_WINDOW_SIZE.minHeight, height),
  };
}

function applyMainWindowBounds(window) {
  if (!window || window.isDestroyed()) return;

  const nextBounds = mainWindowBounds();
  window.setMinimumSize(nextBounds.minWidth, nextBounds.minHeight);
  window.setBounds({ x: nextBounds.x, y: nextBounds.y, width: nextBounds.width, height: nextBounds.height }, false);
}

// The settings and CLI monitor windows never legitimately open child windows;
// external links route through the allowlisted mole:open-external IPC. Deny any
// window.open / target=_blank so a compromised renderer cannot spawn an
// uncontrolled BrowserWindow. The primary window's handler is auth-state
// dependent: allowAuthPopupsOnly while signed out (Clerk's popups), then this
// deny-all once signed in (see the mole:auth:enter-app handler).
function denyChildWindows(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

// The signed-out primary window must allow Clerk's social sign-in popup (an
// external https window.open). Permit https while still denying any attempt to
// spawn a new in-app window. After sign-in the enter-app handler swaps this for
// denyChildWindows, so the app surface is as locked down as the other windows.
function allowAuthPopupsOnly(window) {
  window.webContents.setWindowOpenHandler(({ url }) => (isHttpsUrl(url) ? { action: "allow" } : { action: "deny" }));
}

// One primary window serves both the sign-in form and the app. It is sized
// compact while signed out and full-size once signed in; the renderer drives the
// transition (enterApp / enterLogin) once Clerk resolves the session.
let mainWindow;
let primaryWindowFallbackShow = null;
let settingsWindow;
let cliMonitorWindow;
let billingWindow;

function loadAppWindow(window, query = "") {
  if (isDev) {
    window.loadURL(`${DEV_SERVER_URL}${query}`);
  } else {
    window.loadURL(`${rendererOrigin}/index.html${query}`);
  }
}

function applyLoginWindowBounds(window) {
  if (!window || window.isDestroyed()) return;

  const bounds = centeredWindowBounds(LOGIN_WINDOW_SIZE);
  window.setMinimumSize(bounds.minWidth, bounds.minHeight);
  window.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, false);
}

// Reveal the primary window at the size for the current auth state. The renderer
// calls this (via enterApp / enterLogin) the moment Clerk resolves the session,
// so a signed-in user opens straight into the full-size app and a signed-out user
// into the compact login window — no second window, no resize flash.
function showPrimaryWindow(mode) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (primaryWindowFallbackShow) {
    clearTimeout(primaryWindowFallbackShow);
    primaryWindowFallbackShow = null;
  }

  if (mode === "app") {
    applyMainWindowBounds(mainWindow);
  } else {
    applyLoginWindowBounds(mainWindow);
  }

  // The renderer re-sends enter-app/enter-login after every reload (including
  // dev HMR full reloads), so only grab focus when the window isn't already on
  // screen; otherwise each reload would yank focus from whatever the user is
  // doing. When the mode flips while visible (login -> app) the window already
  // has focus, so skipping the re-focus loses nothing.
  if (mainWindow.isVisible()) return;

  if (process.platform === "darwin") {
    app.dock.show();
  }

  mainWindow.show();
  mainWindow.focus();
}

function createPrimaryWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (process.platform === "darwin") {
      app.dock.show();
    }
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  // Start compact (login size). The renderer grows it via enterApp once Clerk
  // confirms a signed-in session.
  const bounds = centeredWindowBounds(LOGIN_WINDOW_SIZE);
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: bounds.minWidth,
    minHeight: bounds.minHeight,
    show: false,
    title: "Moleui",
    titleBarStyle: "hidden",
    trafficLightPosition: {
      x: 18,
      y: 6,
    },
    icon: appIconPath,
    ...(process.platform === "darwin"
      ? { vibrancy: "under-window", visualEffectState: "active" }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Disable DevTools in packaged builds so the renderer state (including the
      // developer-unlock flag) cannot be edited to bypass the paywall.
      devTools: isDev,
    },
  });

  allowAuthPopupsOnly(mainWindow);
  loadAppWindow(mainWindow);

  // Recovery net: if the initial load fails outright (loopback server not ready,
  // crash, missing dist), `ready-to-show` may never fire, so the renderer can
  // never send enterApp/enterLogin and the window — created with show:false —
  // would stay invisible forever. Reveal it compact on a real main-frame load
  // failure, mirroring the billing window's did-fail-load handling. -3 is
  // ERR_ABORTED (e.g. an in-flight navigation superseded by a redirect), not a
  // real failure, so ignore it.
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _desc, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    showPrimaryWindow("login");
  });

  // The renderer reveals the window at the correct size once Clerk settles. If
  // Clerk never loads (offline, misconfig), fall back to showing the compact
  // login window so the app is never stuck invisible.
  mainWindow.once("ready-to-show", () => {
    if (primaryWindowFallbackShow) clearTimeout(primaryWindowFallbackShow);
    primaryWindowFallbackShow = setTimeout(() => {
      primaryWindowFallbackShow = null;
      showPrimaryWindow("login");
    }, 2500);
  });

  mainWindow.on("closed", () => {
    if (primaryWindowFallbackShow) {
      clearTimeout(primaryWindowFallbackShow);
      primaryWindowFallbackShow = null;
    }
    mainWindow = null;
  });

  return mainWindow;
}

// Sign-out keeps the single primary window alive (it reloads back to the login
// form); only the auxiliary, auth-gated windows are torn down here.
function closeAuxWindowsForSignOut() {
  for (const window of [settingsWindow, cliMonitorWindow, billingWindow]) {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }
  settingsWindow = null;
  cliMonitorWindow = null;
  billingWindow = null;
}

// Wipe the shared session's auth artifacts (Clerk's session cookie plus the dev
// browser JWT / cached auth in localStorage) so a freshly opened login window can
// never restore the previous session and bounce the user straight back into the
// app. This is the authoritative local sign-out; the renderer's Clerk call only
// handles best-effort server-side revocation.
async function clearAuthSessionData() {
  try {
    await session.defaultSession.clearStorageData({
      storages: ["cookies", "localstorage"],
    });
  } catch (error) {
    console.error("Failed to clear auth session data on sign-out:", error);
  }
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

function isHttpsUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function billingWindowDataUrl({ title, message, detail }) {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fbf9ff; color: #111827; }
      main { width: min(420px, calc(100vw - 48px)); text-align: center; }
      .mark { width: 52px; height: 52px; margin: 0 auto 18px; border-radius: 18px; border: 4px solid #ddd6fe; border-top-color: #7c3aed; animation: spin 0.9s linear infinite; }
      h1 { margin: 0; font-size: 22px; line-height: 1.2; }
      p { margin: 10px 0 0; color: #64748b; font-size: 14px; line-height: 1.55; }
      code { display: block; margin-top: 14px; padding: 10px 12px; border-radius: 10px; background: #fff1f2; color: #be123c; white-space: pre-wrap; text-align: left; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true"></div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${detail ? `<code>${escapeHtml(detail)}</code>` : ""}
    </main>
  </body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
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
    backgroundColor: "#fbf9ff",
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
      devTools: isDev,
    },
  });

  const showBillingWindow = () => {
    if (billingWindow && !billingWindow.isDestroyed()) {
      billingWindow.show();
      billingWindow.focus();
    }
  };
  const showBillingError = (message, detail) => {
    if (!billingWindow || billingWindow.isDestroyed()) return;
    billingWindow.loadURL(billingWindowDataUrl({
      title: "Payment could not load",
      message,
      detail,
    })).catch((error) => {
      console.warn("Failed to render billing error:", error.message);
    });
    showBillingWindow();
  };
  const loadBillingUrl = (nextUrl) => {
    if (!billingWindow || billingWindow.isDestroyed()) return;
    billingWindow.loadURL(nextUrl).catch((error) => {
      showBillingError("Moleui could not open the Stripe payment screen in this window.", error.message);
    });
  };
  const closeIfBillingReturn = (nextUrl) => {
    if (!isBillingReturnUrl(nextUrl)) return false;
    billingWindow?.close();
    return true;
  };

  billingWindow.webContents.on("will-navigate", (event, nextUrl) => {
    if (closeIfBillingReturn(nextUrl)) {
      event.preventDefault();
    }
  });

  billingWindow.webContents.on("will-redirect", (event, nextUrl) => {
    if (closeIfBillingReturn(nextUrl)) {
      event.preventDefault();
    }
  });

  billingWindow.webContents.on("did-navigate", (_event, nextUrl) => {
    closeIfBillingReturn(nextUrl);
  });

  billingWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || closeIfBillingReturn(validatedUrl)) return;
    showBillingError("Stripe did not finish loading inside Moleui.", errorDescription);
  });

  billingWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    if (isBillingReturnUrl(nextUrl)) {
      billingWindow?.close();
      return { action: "deny" };
    }
    if (isAllowedBillingUrl(nextUrl)) {
      setImmediate(() => loadBillingUrl(nextUrl));
      return { action: "deny" };
    }
    if (isHttpsUrl(nextUrl)) {
      shell.openExternal(nextUrl).catch((error) => {
        console.warn("Failed to open billing link:", error.message);
      });
    }
    return { action: "deny" };
  });

  billingWindow.loadURL(billingWindowDataUrl({
    title: title === "Manage Moleui Billing" ? "Opening billing portal..." : "Opening checkout...",
    message: "Stripe is loading securely inside Moleui.",
  })).catch((error) => {
    console.warn("Failed to render billing loading screen:", error.message);
  });
  billingWindow.once("ready-to-show", showBillingWindow);
  setTimeout(showBillingWindow, BILLING_WINDOW_SHOW_TIMEOUT_MS);
  billingWindow.webContents.once("did-finish-load", () => loadBillingUrl(url));
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
    width: 900,
    height: 640,
    minWidth: 900,
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
    ...(process.platform === "darwin"
      ? { vibrancy: "under-window", visualEffectState: "active" }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Disable DevTools in packaged builds so the renderer state (including the
      // developer-unlock flag) cannot be edited to bypass the paywall.
      devTools: isDev,
    },
  });

  loadAppWindow(settingsWindow, "?window=settings");
  denyChildWindows(settingsWindow);

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
      // Disable DevTools in packaged builds so the renderer state (including the
      // developer-unlock flag) cannot be edited to bypass the paywall.
      devTools: isDev,
    },
  });

  loadAppWindow(cliMonitorWindow, "?window=developer");
  denyChildWindows(cliMonitorWindow);

  cliMonitorWindow.once("ready-to-show", () => {
    cliMonitorWindow.show();
  });

  cliMonitorWindow.on("closed", () => {
    cliMonitorWindow = null;
  });

  return cliMonitorWindow;
}

ipcMain.handle("mole:status", async (_event, options = {}) => {
  const args = ["status", "--json", "--process-limit"];
  if (options && Number.isFinite(options.processLimit)) {
    args.push(String(options.processLimit));
  } else {
    args.push("0");
  }
  return runMole(args);
});

ipcMain.handle("mole:process:icons", async (_event, processes) => {
  if (!Array.isArray(processes)) {
    return { ok: false, icons: {}, message: "Invalid processes" };
  }

  const pids = processes.map((proc) => proc?.pid);
  // `ps` gives the full executable path (and therefore the .app bundle) for
  // every PID without needing Automation permission. The System Events bridge
  // is kept only as a fallback for the few PIDs `ps` can't resolve, so the
  // whole-batch osascript timeout no longer gates the common case.
  const executablePathsByPid = await getProcessExecutablePathsByPid(pids);
  const unresolvedPids = pids.filter((pid) => !executablePathsByPid.get(Number(pid)));
  const bundlePathsByPid = await getProcessAppBundlePathsByPid(unresolvedPids);
  const resolvedProcessIconEntries = await mapWithConcurrency(processes, 8, async (proc) => {
    const executablePath = executablePathsByPid.get(Number(proc?.pid));
    // Enrich command with the real executable path so the existing .app
    // extraction, executable-name lookup, and binary-path fallback all work off
    // a real path instead of the bare accounting name the renderer received.
    const enrichedProc = executablePath ? { ...proc, command: executablePath } : proc;
    return {
      pid: proc?.pid,
      processInfo: proc,
      iconPaths: await processIconPaths(enrichedProc, bundlePathsByPid.get(Number(proc?.pid))),
    };
  });
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

ipcMain.handle("mole:appIcon:list", async () => ({
  icons: APP_ICONS.map(({ id, label, file }) => ({ id, label, preview: `assets/base/${file}` })),
}));

ipcMain.handle("mole:appIcon:get", async () => ({ icon: selectedAppIcon().id }));

ipcMain.handle("mole:appIcon:set", async (_event, iconId) => {
  const selected = APP_ICONS.find((entry) => entry.id === iconId);
  if (!selected) {
    return { ok: false, message: "Unknown app icon" };
  }
  appIconPreferenceId = selected.id;
  writeAppIconPreference(selected.id);
  applyDockIcon();
  // Packaged: rewrite the bundle's icon after quit so Finder, the pinned Dock
  // tile, and the macOS 26 appearances all follow the choice permanently.
  const appliesOnQuit = armBundleIconSync();
  const message = hasDeveloperIdSignature()
    ? "The Dock icon will follow this choice. The Finder icon stays unchanged so secure updates keep working."
    : undefined;
  return { ok: true, icon: selected.id, appliesOnQuit, message };
});

ipcMain.handle("mole:updates:state", async () => appUpdatePayload());

ipcMain.handle("mole:updates:check", async () => checkForAppUpdate());

ipcMain.handle("mole:updates:install", async () => installAppUpdate());

ipcMain.handle("mole:theme:get", async () => ({ theme: nativeTheme.themeSource }));

ipcMain.handle("mole:theme:set", async (_event, theme) => {
  const next = VALID_THEME_SOURCES.has(theme) ? theme : "system";
  if (nativeTheme.themeSource !== next) {
    nativeTheme.themeSource = next;
    writeThemePreference(next);
  }
  return { ok: true, theme: next };
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

// The renderer that just signed in IS the app — grow the primary window to full
// size and reveal it. No second window is created, so there is no fresh Clerk
// instance that has to rehydrate the session from storage (the source of the
// post-login bounce on the packaged build). The signed-in app never legitimately
// opens child windows (settings/billing/links all route through IPC), so lock the
// window-open handler back down to deny-all now that the auth popup phase is over.
ipcMain.handle("mole:auth:enter-app", async (event) => {
  if (BrowserWindow.fromWebContents(event.sender) === mainWindow) {
    showPrimaryWindow("app");
    denyChildWindows(mainWindow);
  }
  return { ok: true };
});

// Signed out (initial launch, or after sign-out): keep the primary window compact
// and re-allow https auth popups so Clerk's social sign-in can open its popup.
ipcMain.handle("mole:auth:enter-login", async (event) => {
  if (BrowserWindow.fromWebContents(event.sender) === mainWindow) {
    showPrimaryWindow("login");
    allowAuthPopupsOnly(mainWindow);
  }
  return { ok: true };
});

ipcMain.handle("mole:auth:sign-out", async () => {
  // Tear down the auth-gated auxiliary windows, wipe the local session so nothing
  // can restore it, then reload the primary window. Reloading re-inits Clerk
  // against the now-empty session, so it comes up signed-out and renders the login
  // form — deterministic, without relying on cross-window Clerk sync timing.
  closeAuxWindowsForSignOut();
  await clearAuthSessionData();

  if (mainWindow && !mainWindow.isDestroyed()) {
    showPrimaryWindow("login");
    mainWindow.webContents.reload();
  } else {
    createPrimaryWindow();
  }

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
async function executeCleanOperation(event, options = {}, useOperationsEvents = false) {
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

  // The other half of `automationBlockReason`: an automation defers to a UI
  // cleanup, so a UI cleanup must also refuse to start on top of an automation.
  // Scans are refused too, because their results would describe files the
  // automation is deleting underneath them.
  if (automationRunInFlight) {
    return {
      ok: false,
      command: `mole ${command}`,
      exitCode: null,
      stdout: "",
      stderr: "An automation run is in progress. Wait for it to finish, or stop it on the Automations page.",
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
      if (useOperationsEvents) emitOperationEvent(event.sender, { operation: "clean", type: "stdout", text });
      else event.sender.send("mole:clean:stdout", text);
    },
    onStderr: (text) => {
      if (useOperationsEvents) emitOperationEvent(event.sender, { operation: "clean", type: "stderr", text });
      else event.sender.send("mole:clean:stderr", text);
    }
  });
}

ipcMain.handle("mole:clean:execute", async (event, options = {}) => {
  return executeCleanOperation(event, options);
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

// ─── Automations IPC ─────────────────────────────────────────────────────────
// Every handler re-validates against the main-process allowlist. The renderer's
// copy of the catalog is a convenience for rendering only; nothing it sends is
// trusted here.

ipcMain.handle("mole:automations:list", async () => automationsPayload());

ipcMain.handle("mole:automations:save-recipe", async (_event, input = {}) => {
  const action = normalizeAutomationAction(input.action);
  if (!action) {
    return { ok: false, message: "Recipe action is not automatable", state: automationsPayload() };
  }

  const current = readAutomationsState();
  const existing = current.recipes.find((recipe) => recipe.id === input.id);
  if (!existing && current.recipes.length >= AUTOMATION_MAX_RECIPES) {
    return { ok: false, message: "Recipe limit reached", state: automationsPayload() };
  }

  const id = String(input.id || "").trim() || `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const schedule = normalizeAutomationSchedule(input.schedule);
  const fingerprint = automationActionFingerprint(action);
  // Editing the action invalidates the previous dry run, which re-arms the
  // enable gate. A recipe can never be enabled while the gate is armed.
  const keepDryRun = existing && existing.dryRunFingerprint === fingerprint ? existing.dryRunPassedAt : null;

  updateAutomationsState((draft) => {
    const next = {
      id,
      catalogId: String(input.catalogId || existing?.catalogId || "custom"),
      name: String(input.name || existing?.name || "Automation"),
      enabled: keepDryRun ? Boolean(existing?.enabled) : false,
      action,
      schedule,
      dryRunPassedAt: keepDryRun,
      dryRunFingerprint: keepDryRun ? fingerprint : "",
      lastRunAt: existing?.lastRunAt || null,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    const index = draft.recipes.findIndex((recipe) => recipe.id === id);
    if (index >= 0) draft.recipes[index] = next;
    else draft.recipes.push(next);
  });

  return { ok: true, id, state: automationsPayload() };
});

ipcMain.handle("mole:automations:delete-recipe", async (_event, recipeId) => {
  const id = String(recipeId || "");
  updateAutomationsState((draft) => {
    draft.recipes = draft.recipes.filter((recipe) => recipe.id !== id);
  });
  automationLastRunMs.delete(id);
  return { ok: true, state: automationsPayload() };
});

ipcMain.handle("mole:automations:set-enabled", async (_event, recipeId, enabled) => {
  const id = String(recipeId || "");
  const recipe = readAutomationsState().recipes.find((entry) => entry.id === id);

  if (!recipe) {
    return { ok: false, message: "Recipe not found", state: automationsPayload() };
  }

  if (enabled) {
    if (recipe.invalid || !buildAutomationArgs(recipe.action, true)) {
      return { ok: false, message: "Recipe action is not automatable", state: automationsPayload() };
    }
    // The dry-run gate. `dryRunPassedAt` only survives normalization when its
    // fingerprint still matches the current action, so this also rejects a
    // recipe whose sections changed since the last successful dry run.
    if (!recipe.dryRunPassedAt) {
      return {
        ok: false,
        message: "Run a dry run for this recipe before enabling it",
        state: automationsPayload(),
      };
    }
  }

  updateAutomationsState((draft) => {
    const target = draft.recipes.find((entry) => entry.id === id);
    if (target) target.enabled = enabled === true;
  });

  return { ok: true, state: automationsPayload() };
});

ipcMain.handle("mole:automations:set-paused", async (_event, paused) => {
  updateAutomationsState((draft) => {
    draft.paused = paused === true;
  });
  return { ok: true, state: automationsPayload() };
});

ipcMain.handle("mole:automations:dry-run", async (_event, recipeId) => {
  const id = String(recipeId || "");
  const recipe = readAutomationsState().recipes.find((entry) => entry.id === id);

  if (!recipe) {
    return { ok: false, message: "Recipe not found", state: automationsPayload() };
  }

  const result = await executeAutomationRecipe(recipe, { dryRun: true, trigger: "manual" });

  if (result.ok) {
    updateAutomationsState((draft) => {
      const target = draft.recipes.find((entry) => entry.id === id);
      if (!target) return;
      target.dryRunPassedAt = new Date().toISOString();
      target.dryRunFingerprint = automationActionFingerprint(target.action);
    });
  }

  return { ok: result.ok, message: result.ok ? "" : (result.stderr || "Dry run failed"), output: result.stdout, state: automationsPayload() };
});

ipcMain.handle("mole:automations:run-now", async (_event, recipeId) => {
  const id = String(recipeId || "");
  const recipe = readAutomationsState().recipes.find((entry) => entry.id === id);

  if (!recipe) {
    return { ok: false, message: "Recipe not found", state: automationsPayload() };
  }

  // A manual run is still a real deletion, so it clears the same gate as a
  // scheduled one: the user must have dry-run this exact action first.
  if (recipe.invalid || !recipe.dryRunPassedAt) {
    return {
      ok: false,
      message: "Run a dry run for this recipe first",
      state: automationsPayload(),
    };
  }

  if (activeProcesses.has("clean")) {
    return { ok: false, message: "A cleanup is already running", state: automationsPayload() };
  }

  const result = await executeAutomationRecipe(recipe, { dryRun: false, trigger: "manual" });
  return { ok: result.ok, message: result.ok ? "" : (result.stderr || "Run failed"), output: result.stdout, state: automationsPayload() };
});

ipcMain.handle("mole:automations:cancel", async () => {
  const child = activeProcesses.get(AUTOMATION_PROCESS_ID);
  if (child && !child.killed) {
    if (child.__killMoleProcess) child.__killMoleProcess();
    else child.kill("SIGTERM");
    return { ok: true, message: "Automation run terminated" };
  }
  return { ok: false, message: "No active automation run" };
});

// Versioned local operations interface. New desktop surfaces should use this
// seam; command-specific handlers below remain as compatibility adapters while
// the other pages migrate incrementally.
ipcMain.handle("mole:operations:status", async () => desktopOperationsStatus());

ipcMain.handle("mole:operations:plan", async (_event, operation) => {
  if (operation === "optimize") return loadOptimizePlan();
  return { ok: false, operation, error: `Planning is not available for ${String(operation || "unknown")}` };
});

ipcMain.handle("mole:operations:execute", async (event, operation, request = {}) => {
  if (operation === "optimize") return executeOptimizeOperation(event, request);
  if (operation === "clean") {
    emitOperationEvent(event.sender, { operation: "clean", type: "start" });
    const result = await executeCleanOperation(event, request, true);
    emitOperationEvent(event.sender, {
      operation: "clean",
      type: result.killed ? "cancelled" : "complete",
      ok: result.ok,
      exitCode: result.exitCode,
    });
    return result;
  }
  return {
    ok: false,
    command: `mole ${String(operation || "")}`.trim(),
    exitCode: null,
    stdout: "",
    stderr: `Execution is not available through the operations interface for ${String(operation || "unknown")}`,
  };
});

ipcMain.handle("mole:operations:cancel", async (_event, operation) => {
  const process = activeProcesses.get(String(operation || ""));
  if (process && !process.killed) {
    if (process.__killMoleProcess) process.__killMoleProcess();
    else process.kill("SIGTERM");
    return { ok: true, message: `${operation} process terminated` };
  }
  return { ok: false, message: `No active ${String(operation || "operation")} process` };
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

  // Prefer the bundled Go binary directly; fall back to the shell entrypoint if
  // it is missing (e.g. an incomplete runtime). The flag order keeps `--json`
  // and `--fresh` ahead of the path so Go's flag parser stops at the path arg.
  const binary = analyzeBinaryPath();
  const useBinary = fs.existsSync(binary);
  const jsonArgs = options.fresh ? ["--json", "--fresh", scanPath] : ["--json", scanPath];
  const args = useBinary ? jsonArgs : ["analyze", ...jsonArgs];

  return runMole(args, {
    processId: "analyze",
    executable: useBinary ? binary : undefined,
    commandLabel: `analyze ${jsonArgs.join(" ")}`,
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

// ─── Repos ───────────────────────────────────────────────────────────────────
// Repository inventory, pushing, and archiving. Scans exec the Go binary
// directly; mutations go through the shell entrypoint so removals keep running
// through Mole's audited Trash helpers.

const REPOS_PREFS_FILE = "repos-prefs.json";

function reposBinaryPath() {
  return path.join(runtimeDir(), "bin", "repos-go");
}

function reposPrefsPath() {
  return path.join(app.getPath("userData"), REPOS_PREFS_FILE);
}

function readReposPrefs() {
  try {
    const prefs = JSON.parse(fs.readFileSync(reposPrefsPath(), "utf8"));
    return prefs && typeof prefs === "object" ? prefs : {};
  } catch {
    return {};
  }
}

function writeReposPrefs(next) {
  try {
    fs.writeFileSync(reposPrefsPath(), JSON.stringify(next), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write repo preferences:", error);
    return false;
  }
}

function defaultRepoRoots() {
  const dev = path.join(os.homedir(), "Dev");
  try {
    if (fs.statSync(dev).isDirectory()) return [dev];
  } catch {
    // No ~/Dev on this machine; fall through to the home directory.
  }
  return [os.homedir()];
}

function readRepoRoots() {
  const roots = sanitizeRepoPaths(readReposPrefs().roots).filter((p) => {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });
  if (roots.length > 0) return roots;
  return defaultRepoRoots();
}

function writeRepoRoots(roots) {
  const clean = sanitizeRepoPaths(roots);
  return writeReposPrefs({ ...readReposPrefs(), roots: clean }) ? clean : readRepoRoots();
}

function githubProfiles() {
  try {
    const result = spawnSync("gh", ["auth", "status", "--hostname", "github.com", "--json", "hosts"], {
      encoding: "utf8",
      timeout: 5000,
    });
    const accounts = JSON.parse(result.stdout || "{}")?.hosts?.["github.com"];
    if (!Array.isArray(accounts)) return [];
    return accounts
      .filter((account) => typeof account?.login === "string" && account.state === "success")
      .map((account) => ({ login: account.login, active: Boolean(account.active) }));
  } catch {
    return [];
  }
}

function repoSyncPreferences() {
  const prefs = readReposPrefs();
  return {
    profile: typeof prefs.profile === "string" ? prefs.profile : "",
    askBeforeCreate: prefs.askBeforeCreate !== false,
  };
}

// sanitizeRepoPaths is the trust boundary between the renderer and a command
// line that can delete directories. Only absolute, single-line paths survive,
// so a value shaped like a flag ("--vault", "-n") or carrying a newline can
// never reach the shell as an option.
function sanitizeRepoPaths(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value || !value.startsWith("/")) continue;
    if (value.includes("\n") || value.includes("\r") || value.includes("\0")) continue;
    const normalized = path.normalize(value);
    if (normalized.startsWith("-") || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function repoScanArgs(options = {}) {
  const args = ["--json"];
  if (options.verify) args.push("--verify");

  const coldDays = Number(options.coldDays);
  if (Number.isInteger(coldDays) && coldDays >= 0 && coldDays <= 3650) {
    args.push("--cold-days", String(coldDays));
  }

  const roots = sanitizeRepoPaths(options.roots);
  args.push(...(roots.length > 0 ? roots : readRepoRoots()));
  return args;
}

function reposUnavailableResult(command) {
  return {
    ok: false,
    command,
    exitCode: null,
    stdout: "",
    stderr:
      "The repo scanner is missing from the Mole runtime. Run `bun run desktop:dev` " +
      "or reinstall the app to rebuild it.",
  };
}

ipcMain.handle("mole:repos:scan", async (event, options = {}) => {
  const binary = reposBinaryPath();
  if (!fs.existsSync(binary)) return reposUnavailableResult("repos --json");

  const args = repoScanArgs(options);
  return runMole(args, {
    processId: "repos:scan",
    executable: binary,
    commandLabel: `repos ${args.join(" ")}`,
    // Verification contacts every distinct remote. The ceiling is generous
    // because a large machine with slow remotes is normal, not a hang.
    timeoutMs: options.verify ? 15 * 60 * 1000 : 5 * 60 * 1000,
    onStdout: (text) => {
      event.sender.send("mole:repos:scan:stdout", text);
    },
  });
});

ipcMain.handle("mole:repos:scan:kill", async () => killTrackedProcess("repos:scan", "scan"));

ipcMain.handle("mole:repos:gate", async (_event, repoPath, waivers = []) => {
  const binary = reposBinaryPath();
  if (!fs.existsSync(binary)) return reposUnavailableResult("repos --gate");

  const [target] = sanitizeRepoPaths([repoPath]);
  if (!target) {
    return {
      ok: false,
      command: "repos --gate",
      exitCode: null,
      stdout: "",
      stderr: "A repository path must be absolute.",
    };
  }

  const args = ["--gate", target];
  // The binary itself refuses anything outside this set; filtering here keeps a
  // malformed request from even reaching it.
  const allowedWaivers = new Set(["no_local_only_files", "cold"]);
  if (Array.isArray(waivers)) {
    for (const waiver of waivers) {
      if (allowedWaivers.has(waiver)) args.push("--ignore-gate", waiver);
    }
  }

  return runMole(args, {
    executable: binary,
    commandLabel: `repos --gate ${target}`,
    timeoutMs: 3 * 60 * 1000,
  });
});

ipcMain.handle("mole:repos:push", async (event, paths, options = {}) => {
  const targets = sanitizeRepoPaths(paths);
  const args = ["repos", "push", "--yes"];
  if (options.dryRun) args.push("--dry-run");
  args.push(...targets);

  return runMole(args, {
    processId: "repos:push",
    commandLabel: `repos push${options.dryRun ? " --dry-run" : ""} (${targets.length || "all"})`,
    timeoutMs: 30 * 60 * 1000,
    onStdout: (text) => {
      event.sender.send("mole:repos:push:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:repos:push:stderr", text);
    },
  });
});

ipcMain.handle("mole:repos:push:kill", async () => killTrackedProcess("repos:push", "push"));

ipcMain.handle("mole:repos:sync", async (event, paths, options = {}) => {
  const targets = sanitizeRepoPaths(paths);
  const profiles = githubProfiles();
  const requestedProfile = typeof options.profile === "string" ? options.profile : "";
  const profile = profiles.find((candidate) => candidate.login === requestedProfile)?.login;
  if (!profile) {
    return {
      ok: false,
      command: "repos sync",
      exitCode: null,
      stdout: "",
      stderr: "Choose a signed-in GitHub profile before syncing.",
    };
  }

  // `gh auth switch` is intentionally only performed after the renderer named
  // one of the accounts reported by the local GitHub CLI. It never accepts an
  // arbitrary string as a command argument.
  const switched = spawnSync("gh", ["auth", "switch", "--hostname", "github.com", "--user", profile], {
    encoding: "utf8",
    timeout: 10000,
  });
  if (switched.status !== 0) {
    return {
      ok: false,
      command: "repos sync",
      exitCode: switched.status,
      stdout: switched.stdout || "",
      stderr: switched.stderr || `Could not switch to ${profile}.`,
    };
  }

  const args = ["repos", "sync", "--yes", "--profile", profile];
  if (options.dryRun) args.push("--dry-run");
  if (options.createMissing) args.push("--create-missing");
  args.push(...targets);

  return runMole(args, {
    processId: "repos:sync",
    commandLabel: `repos sync${options.dryRun ? " --dry-run" : ""} (${targets.length || "all"})`,
    timeoutMs: 30 * 60 * 1000,
    onStdout: (text) => event.sender.send("mole:repos:sync:stdout", text),
    onStderr: (text) => event.sender.send("mole:repos:sync:stderr", text),
  });
});

ipcMain.handle("mole:repos:sync:kill", async () => killTrackedProcess("repos:sync", "sync"));

ipcMain.handle("mole:repos:archive", async (event, paths, options = {}) => {
  const targets = sanitizeRepoPaths(paths);

  // Archiving is the one destructive action here, so it never runs against an
  // implicit "everything" set from the UI. The CLI still supports that for
  // deliberate terminal use.
  if (targets.length === 0) {
    return {
      ok: false,
      command: "repos archive",
      exitCode: null,
      stdout: "",
      stderr: "Select at least one repository to archive.",
    };
  }

  const args = ["repos", "archive", "--yes"];
  if (options.dryRun) args.push("--dry-run");
  if (options.vault) args.push("--vault");
  if (options.allowWarm) args.push("--allow-warm");
  args.push(...targets);

  return runMole(args, {
    processId: "repos:archive",
    commandLabel: `repos archive${options.dryRun ? " --dry-run" : ""} (${targets.length})`,
    timeoutMs: 30 * 60 * 1000,
    onStdout: (text) => {
      event.sender.send("mole:repos:archive:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:repos:archive:stderr", text);
    },
  });
});

ipcMain.handle("mole:repos:archive:kill", async () => killTrackedProcess("repos:archive", "archive"));

ipcMain.handle("mole:repos:get-roots", async () => ({ ok: true, roots: readRepoRoots() }));

ipcMain.handle("mole:repos:profiles", async () => {
  const profiles = githubProfiles();
  const preferences = repoSyncPreferences();
  return {
    ok: true,
    profiles,
    profile: profiles.some((candidate) => candidate.login === preferences.profile)
      ? preferences.profile
      : profiles.find((candidate) => candidate.active)?.login || "",
    askBeforeCreate: preferences.askBeforeCreate,
  };
});

ipcMain.handle("mole:repos:sync-preferences", async (_event, next = {}) => {
  const profiles = githubProfiles();
  const profile = typeof next.profile === "string" && profiles.some((candidate) => candidate.login === next.profile)
    ? next.profile
    : repoSyncPreferences().profile;
  const askBeforeCreate = typeof next.askBeforeCreate === "boolean"
    ? next.askBeforeCreate
    : repoSyncPreferences().askBeforeCreate;
  writeReposPrefs({ ...readReposPrefs(), profile, askBeforeCreate });
  return { ok: true, profile, askBeforeCreate };
});

ipcMain.handle("mole:repos:set-roots", async (_event, roots) => ({
  ok: true,
  roots: writeRepoRoots(roots),
}));

ipcMain.handle("mole:repos:choose-root", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose a folder to scan for repositories",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return { ok: false, roots: readRepoRoots() };

  const merged = sanitizeRepoPaths([...readRepoRoots(), ...result.filePaths]);
  return { ok: true, roots: writeRepoRoots(merged) };
});

// killTrackedProcess terminates one of the named long-running children.
function killTrackedProcess(processId, label) {
  const child = activeProcesses.get(processId);
  if (child && !child.killed) {
    if (child.__killMoleProcess) {
      child.__killMoleProcess();
    } else {
      child.kill("SIGTERM");
    }
    return { ok: true, message: `Repo ${label} terminated` };
  }
  return { ok: false, message: `No active repo ${label}` };
}

ipcMain.handle("mole:runtime", async () => ({
  packaged: app.isPackaged,
  runtimeDir: runtimeDir(),
  executable: moleExecutable(),
}));

// ─── Permissions ─────────────────────────────────────────────────────────────
// Read-only macOS permission detection plus a small persisted prefs file. We
// never grant TCC permissions ourselves (macOS does not allow that); we only
// detect status, deep-link to System Settings, or trigger the native
// Files-&-Folders prompt by touching a user folder.

const PERMISSIONS_PREFS_FILE = "permissions-prefs.json";
const DEFAULT_PERMISSIONS_PREFS = { onboarded: false, systemCleanupEnabled: true };

function permissionsPrefsPath() {
  return path.join(app.getPath("userData"), PERMISSIONS_PREFS_FILE);
}

function readPermissionsPrefs() {
  try {
    return { ...DEFAULT_PERMISSIONS_PREFS, ...JSON.parse(fs.readFileSync(permissionsPrefsPath(), "utf8")) };
  } catch {
    return { ...DEFAULT_PERMISSIONS_PREFS };
  }
}

function writePermissionsPrefs(next) {
  const merged = { ...readPermissionsPrefs(), ...next };
  try {
    fs.writeFileSync(permissionsPrefsPath(), JSON.stringify(merged, null, 2));
  } catch (error) {
    console.error("Failed to write permissions prefs:", error);
  }
  return merged;
}

// Probe a Full-Disk-Access-gated path. stat is allowed without FDA, but reading
// the directory/file is blocked with EPERM/EACCES unless FDA is granted.
function probeReadable(target) {
  try {
    if (!fs.existsSync(target)) return null;
    if (fs.statSync(target).isDirectory()) {
      fs.readdirSync(target);
    } else {
      fs.closeSync(fs.openSync(target, "r"));
    }
    return true;
  } catch (error) {
    if (error && (error.code === "EPERM" || error.code === "EACCES")) return false;
    return null;
  }
}

function detectFullDiskAccess() {
  const home = app.getPath("home");
  const gated = [
    path.join(home, "Library/Application Support/com.apple.TCC/TCC.db"),
    path.join(home, "Library/Mail"),
    path.join(home, "Library/Safari"),
    path.join(home, "Library/Messages/chat.db"),
  ];
  let sawDenied = false;
  for (const target of gated) {
    const ok = probeReadable(target);
    if (ok === true) return "granted";
    if (ok === false) sawDenied = true;
  }
  return sawDenied ? "denied" : "unknown";
}

const PERMISSION_SETTINGS_PANES = {
  fullDiskAccess: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
  filesAndFolders: "x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders",
  automation: "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation",
  privacy: "x-apple.systempreferences:com.apple.preference.security?Privacy",
};

ipcMain.handle("mole:permissions:status", async () => ({
  fullDiskAccess: detectFullDiskAccess(),
}));

ipcMain.handle("mole:permissions:get-prefs", async () => readPermissionsPrefs());

ipcMain.handle("mole:permissions:set-prefs", async (_event, next = {}) => writePermissionsPrefs(next));

ipcMain.handle("mole:permissions:open-settings", async (_event, pane = "privacy") => {
  await shell.openExternal(PERMISSION_SETTINGS_PANES[pane] || PERMISSION_SETTINGS_PANES.privacy);
  return { ok: true };
});

// Trigger the native Files-&-Folders prompt by listing protected user folders.
// Read-only; macOS shows the prompt on first access.
ipcMain.handle("mole:permissions:request-files", async () => {
  const home = app.getPath("home");
  for (const folder of ["Desktop", "Documents", "Downloads"]) {
    try {
      fs.readdirSync(path.join(home, folder));
    } catch {
      // Prompt shown or already decided; the result is read back via status.
    }
  }
  return { ok: true };
});

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

app.whenReady().then(async () => {
  if (!isDev) {
    // Resolve rendererOrigin before any window calls loadAppWindow().
    await startRendererServer();
  }
  configureApplicationMenu();
  configureMacStartupService();
  setImmediate(() => {
    void warmApplicationSearchIndex();
  });
  startBatterySampler();
  startAutomationScheduler();
  configureAppUpdater();

  const openedAsHidden = wasOpenedAsHiddenLoginItem();
  openedAsHiddenLoginItem = openedAsHidden;

  if (openedAsHidden) {
    recordBackgroundSystemRun(
      "login-item",
      makeBackgroundRun(Date.now(), true, "Started hidden after macOS login"),
    );
  }

  if (process.platform === "darwin") {
    applyDockIcon();
    nativeTheme.on("updated", applyDockIcon);
    // If a previous icon switch never reached the bundle (crash/reboot before
    // the on-quit helper ran), re-arm it so the choice eventually sticks.
    armBundleIconSync();

    if (openedAsHidden) {
      app.dock.hide();
    }
  }

  if (!openedAsHidden) {
    createPrimaryWindow();
  }

  app.on("activate", () => {
    if (process.platform === "darwin") {
      app.dock.show();
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      createPrimaryWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
