import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveDbBackup: (arrayBuffer: ArrayBuffer) => ipcRenderer.invoke('save-db-backup', arrayBuffer),
  loadDbBackup: () => ipcRenderer.invoke('load-db-backup'),
  exportDbManual: (arrayBuffer: ArrayBuffer) => ipcRenderer.invoke('export-db-manual', arrayBuffer),
});

require('./rt/electron-rt');
