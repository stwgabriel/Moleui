import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("moleDesktop", {
  getRuntimeInfo: () => ipcRenderer.invoke("mole:runtime"),
  runStatus: () => ipcRenderer.invoke("mole:status"),
  
  // Clean command
  clean: {
    execute: (options) => ipcRenderer.invoke("mole:clean:execute", options),
    onStdout: (callback) => {
      ipcRenderer.on("mole:clean:stdout", (_, data) => callback(data));
    },
    onStderr: (callback) => {
      ipcRenderer.on("mole:clean:stderr", (_, data) => callback(data));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:clean:stdout");
      ipcRenderer.removeAllListeners("mole:clean:stderr");
    }
  },
  
  // Optimize command
  optimize: {
    execute: (options) => ipcRenderer.invoke("mole:optimize:execute", options),
    onStdout: (callback) => {
      ipcRenderer.on("mole:optimize:stdout", (_, data) => callback(data));
    },
    onStderr: (callback) => {
      ipcRenderer.on("mole:optimize:stderr", (_, data) => callback(data));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:optimize:stdout");
      ipcRenderer.removeAllListeners("mole:optimize:stderr");
    }
  },
  
  // Analyze command
  analyze: {
    execute: (path) => ipcRenderer.invoke("mole:analyze:execute", path),
    onStdout: (callback) => {
      ipcRenderer.on("mole:analyze:stdout", (_, data) => callback(data));
    },
    onStderr: (callback) => {
      ipcRenderer.on("mole:analyze:stderr", (_, data) => callback(data));
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:analyze:stdout");
      ipcRenderer.removeAllListeners("mole:analyze:stderr");
    }
  },
  
  // Uninstall command
  uninstall: {
    list: () => ipcRenderer.invoke("mole:uninstall:list"),
    dryRun: (appNames) => ipcRenderer.invoke("mole:uninstall:dry-run", appNames),
    execute: (appNames) => ipcRenderer.invoke("mole:uninstall:execute", appNames),
    
    // Stream listeners
    onListStdout: (callback) => {
      ipcRenderer.on("mole:uninstall:list:stdout", (_, data) => callback(data));
    },
    onListStderr: (callback) => {
      ipcRenderer.on("mole:uninstall:list:stderr", (_, data) => callback(data));
    },
    onDryRunStdout: (callback) => {
      ipcRenderer.on("mole:uninstall:dry-run:stdout", (_, data) => callback(data));
    },
    onDryRunStderr: (callback) => {
      ipcRenderer.on("mole:uninstall:dry-run:stderr", (_, data) => callback(data));
    },
    onExecuteStdout: (callback) => {
      ipcRenderer.on("mole:uninstall:execute:stdout", (_, data) => callback(data));
    },
    onExecuteStderr: (callback) => {
      ipcRenderer.on("mole:uninstall:execute:stderr", (_, data) => callback(data));
    },
    
    // Cleanup listeners
    removeListeners: () => {
      ipcRenderer.removeAllListeners("mole:uninstall:list:stdout");
      ipcRenderer.removeAllListeners("mole:uninstall:list:stderr");
      ipcRenderer.removeAllListeners("mole:uninstall:dry-run:stdout");
      ipcRenderer.removeAllListeners("mole:uninstall:dry-run:stderr");
      ipcRenderer.removeAllListeners("mole:uninstall:execute:stdout");
      ipcRenderer.removeAllListeners("mole:uninstall:execute:stderr");
    }
  },
});
