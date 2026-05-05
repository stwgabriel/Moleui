import { app, BrowserWindow, ipcMain } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    });

    let stdout = "";
    let stderr = "";

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
    minWidth: 1280,
    minHeight: 820,
    titleBarStyle: "hidden",
    trafficLightPosition: {
      x: 18,
      y: 20,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load from Vite dev server
  // In production, load from built files
  const isDev = !app.isPackaged;
  
  if (isDev) {
    window.loadURL('http://localhost:5173');
    // Uncomment to open DevTools automatically
    // window.webContents.openDevTools();
  } else {
    window.loadFile(path.join(__dirname, "dist", "index.html"));
  }
  
  return window;
}

let mainWindow;

ipcMain.handle("mole:status", async () => runMole(["status", "--json"]));

ipcMain.handle("mole:uninstall:list", async (event) => {
  return runMole(["uninstall", "--list"], {
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

ipcMain.handle("mole:uninstall:dry-run", async (event, appNames) => {
  const args = ["uninstall", "--dry-run", ...appNames];
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
  const args = ["uninstall", ...appNames];
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
    onStdout: (text) => {
      event.sender.send("mole:clean:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:clean:stderr", text);
    }
  });
});

// Optimize command handlers
ipcMain.handle("mole:optimize:execute", async (event, options = {}) => {
  const args = ["optimize"];
  if (options.dryRun) args.push("--dry-run");
  
  return runMole(args, {
    onStdout: (text) => {
      event.sender.send("mole:optimize:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:optimize:stderr", text);
    }
  });
});

// Analyze command handlers
ipcMain.handle("mole:analyze:execute", async (event, path = "/") => {
  const args = ["analyze", path, "--json"];
  
  return runMole(args, {
    onStdout: (text) => {
      event.sender.send("mole:analyze:stdout", text);
    },
    onStderr: (text) => {
      event.sender.send("mole:analyze:stderr", text);
    }
  });
});

ipcMain.handle("mole:runtime", async () => ({
  packaged: app.isPackaged,
  runtimeDir: runtimeDir(),
  executable: moleExecutable(),
}));

app.whenReady().then(() => {
  mainWindow = createWindow();

  app.on("activate", () => {
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
