import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  captureScreenshot: () => ipcRenderer.invoke('screenshot-capture'),
  executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
  
  // New Control Methods
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  executeAction: (action) => ipcRenderer.invoke('execute-action', action),
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  
  // Events
  onScreenUpdate: (callback) => ipcRenderer.on('session-event', (event, type, data) => {
    if (type === 'screen-update') callback(data);
  }),
});
