import { app, BrowserWindow, ipcMain, nativeImage, nativeTheme, shell } from "electron";
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
    width: 960,
    height: 720,
    minWidth: 1280,
    minHeight: 820,
    titleBarStyle: "hidden",
    trafficLightPosition: {
      x: 18,
      y: 20,
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

ipcMain.handle("mole:status", async () => runMole(["status", "--json"]));

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
  if (!appPath || typeof appPath !== "string") {
    return { ok: false, icon: "", message: "Invalid app path" };
  }

  try {
    const fileIcon = await Promise.race([
      app.getFileIcon(appPath, { size: "normal" }),
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error("Icon lookup timed out")), 1500);
      }),
    ]);
    if (fileIcon.isEmpty()) {
      return { ok: false, icon: "", message: "No icon found" };
    }
    return { ok: true, icon: fileIcon.toDataURL() };
  } catch (error) {
    return { ok: false, icon: "", message: error.message };
  }
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
    process.kill("SIGTERM");
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
    process.kill("SIGTERM");
    return { ok: true, message: "Optimize process terminated" };
  }
  return { ok: false, message: "No active optimize process" };
});

// Analyze command handlers
ipcMain.handle("mole:analyze:execute", async (event, path = "/") => {
  const args = ["analyze", path, "--json"];
  
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
    process.kill("SIGTERM");
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
