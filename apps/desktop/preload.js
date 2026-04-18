const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("moleDesktop", {
  getRuntimeInfo: () => ipcRenderer.invoke("mole:runtime"),
  runStatus: () => ipcRenderer.invoke("mole:status"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  getWindowState: () => ipcRenderer.invoke("window:state"),
  onWindowStateChange: (listener) => {
    const wrappedListener = (_event, value) => listener(value);
    ipcRenderer.on("window:state-changed", wrappedListener);
    return () => ipcRenderer.removeListener("window:state-changed", wrappedListener);
  },
});
