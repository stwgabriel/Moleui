import { app, BrowserWindow, clipboard, ipcMain, nativeImage, nativeTheme, shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const appIconPath = path.join(__dirname, "public", "assets", "base", "molui-light.png");

app.setName("Moleui Desktop");

// Store active processes for cancellation
const activeProcesses = new Map();
const appIconCache = new Map();

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

let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const logoFile = nativeTheme.shouldUseDarkColors ? "molui-dark.png" : "molui-light.png";
  const logoPath = isDev
    ? path.join(__dirname, "public", "assets", "base", logoFile)
    : path.join(__dirname, "dist", "assets", "base", logoFile);
  const splashPath = isDev ? "splash.html" : path.join(__dirname, "dist", "splash.html");

  splashWindow.loadFile(splashPath, {
    query: {
      logo: pathToFileURL(logoPath).href,
    },
  });

  return splashWindow;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 920,
    minWidth: 1280,
    minHeight: 840,
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

  window.once("ready-to-show", () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    window.show();
  });
  
  return window;
}

let mainWindow;

ipcMain.handle("mole:status", async () => runMole(["status", "--json", "--process-limit", "0"]));

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
  const args = ["clean"];
  if (options.dryRun) args.push("--dry-run");
  if (Array.isArray(options.sections)) {
    for (const section of options.sections) {
      const cleanSection = String(section || "").trim();
      if (cleanSection) args.push("--section", cleanSection);
    }
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
ipcMain.handle("mole:analyze:execute", async (event, path = "/") => {
  const scanPath = normalizeAnalyzePath(path);
  const args = ["analyze", "--json", scanPath];
  
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
  if (process.platform === "darwin") {
    const appIcon = nativeImage.createFromPath(appIconPath);

    if (!appIcon.isEmpty()) {
      app.dock.setIcon(appIcon);
    }
  }

  createSplashWindow();
  mainWindow = createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
