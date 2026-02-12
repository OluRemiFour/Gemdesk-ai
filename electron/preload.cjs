const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  captureScreenshot: () => ipcRenderer.invoke('screenshot-capture'),
  executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
  
  // New Control Methods
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  executeAction: (action) => ipcRenderer.invoke('execute-action', action),
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  sendInput: (type, data) => ipcRenderer.send('send-input', { type, data }),
  
  // MongoDB Methods
  createChat: (title) => ipcRenderer.invoke('db:create-chat', title),
  getChats: () => ipcRenderer.invoke('db:get-chats'),
  getMessages: (chatId) => ipcRenderer.invoke('db:get-messages', chatId),
  saveMessage: (message) => ipcRenderer.invoke('db:save-message', message),
  updateChatTitle: (chatId, title) => ipcRenderer.invoke('db:update-chat-title', { chatId, title }),
  deleteChat: (chatId) => ipcRenderer.invoke('db:delete-chat', chatId),

  // Events
  onScreenUpdate: (callback) => ipcRenderer.on('session-event', (event, type, data) => {
    if (type === 'screen-update') callback(data);
  }),
  onSessionEvent: (callback) => ipcRenderer.on('session-event', (event, ...args) => callback(...args)),
});
