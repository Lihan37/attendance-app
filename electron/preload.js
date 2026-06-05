const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  connectDevice: (config) => ipcRenderer.invoke('device:connect', config),
  fetchUsers: () => ipcRenderer.invoke('device:users'),
  fetchAttendance: () => ipcRenderer.invoke('device:attendance'),
  syncUsers: ({ baseUrl, users }) => ipcRenderer.invoke('sync:users', { baseUrl, users }),
  syncAttendance: ({ baseUrl, logs }) => ipcRenderer.invoke('sync:attendance', { baseUrl, logs }),
})
