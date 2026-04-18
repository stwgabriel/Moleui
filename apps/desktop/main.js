const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

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
      `Mole runtime is missing at ${executable}. Run \`bun run desktop:build\` or \`bun run desktop:dev\` first.`,
    );
  }

  return executable;
}

function runMole(args) {
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
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        command: `mole ${args.join(" ")}`,
        exitCode: null,
        stdout,
        stderr: `${stderr}${error.message}`,
      });
    });

    child.on("close", (exitCode) => {
      resolve({
        ok: exitCode === 0,
        command: `mole ${args.join(" ")}`,
        exitCode,
        stdout,
        stderr,
      });
    });
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 960,
    height: 720,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, "index.html"));

  const sendWindowState = () => {
    window.webContents.send("window:state-changed", {
      isMaximized: window.isMaximized(),
    });
  };

  window.on("maximize", sendWindowState);
  window.on("unmaximize", sendWindowState);
  window.on("enter-full-screen", sendWindowState);
  window.on("leave-full-screen", sendWindowState);
  window.webContents.once("did-finish-load", sendWindowState);
}

ipcMain.handle("mole:status", async () => runMole(["status", "--json"]));
ipcMain.handle("mole:runtime", async () => ({
  packaged: app.isPackaged,
  runtimeDir: runtimeDir(),
  executable: moleExecutable(),
}));
ipcMain.handle("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.handle("window:maximize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return { isMaximized: false };
  }

  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }

  return { isMaximized: window.isMaximized() };
});
ipcMain.handle("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});
ipcMain.handle("window:state", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return { isMaximized: window?.isMaximized() ?? false };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
