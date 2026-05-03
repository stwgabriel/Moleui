const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("moleDesktop", {
  getRuntimeInfo: () => ipcRenderer.invoke("mole:runtime"),
  runStatus: () => ipcRenderer.invoke("mole:status"),
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
