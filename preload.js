const { contextBridge, ipcRenderer } = require('electron')

// Expose a small, safe API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  saveImage: (payload) => ipcRenderer.invoke('save-image', payload),
  deleteImage: (payload) => ipcRenderer.invoke('delete-image', payload)
  ,
  // show a file in OS file manager. Accepts an absolute file path.
  showItem: (filePath) => ipcRenderer.invoke('show-item', filePath),
  // show a relative path (project-relative) in file manager
  showRelative: (relPath) => ipcRenderer.invoke('show-relative', relPath)
})

// A simple flag so renderer can quickly detect it's running inside Electron
contextBridge.exposeInMainWorld('isElectron', true)
