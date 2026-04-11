const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  getScreenSourceId: () => ipcRenderer.invoke('get-screen-source-id'),
  captureScreenshot: () => ipcRenderer.invoke('screenshot-capture'),
  executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
  
  // New Control Methods
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  executeAction: (action) => ipcRenderer.invoke('execute-action', action),
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  sendInput: (type, data) => ipcRenderer.send('send-input', { type, data }),
  focusWindow: () => ipcRenderer.invoke('window:focus'),
  openOverlay: () => ipcRenderer.invoke('open-overlay'),
  closeOverlay: () => ipcRenderer.invoke('close-overlay'),
  switchToDesktop: () => ipcRenderer.invoke('switch-to-desktop'),
  resizeOverlay: (width, height) => ipcRenderer.invoke('resize-overlay', width, height),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('overlay:set-ignore-mouse-events', ignore, options),
  
  // MongoDB Methods
  createChat: (title) => ipcRenderer.invoke('db:create-chat', title),
  getChats: () => ipcRenderer.invoke('db:get-chats'),
  getMessages: (chatId) => ipcRenderer.invoke('db:get-messages', chatId),
  saveMessage: (message) => ipcRenderer.invoke('db:save-message', message),
  updateChatTitle: (chatId, title) => ipcRenderer.invoke('db:update-chat-title', { chatId, title }),
  deleteChat: (chatId) => ipcRenderer.invoke('db:delete-chat', chatId),

  // File System Methods
  listDir: (path) => ipcRenderer.invoke('fs:list-dir', path),
  readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:write-file', path, content),
  moveFile: (oldPath, newPath) => ipcRenderer.invoke('fs:move-file', { oldPath, newPath }),
  deleteFile: (path) => ipcRenderer.invoke('fs:delete-file', path),
  getRecycleBin: () => ipcRenderer.invoke('fs:get-recycle-bin'),
  cleanRecycleBin: (days) => ipcRenderer.invoke('fs:clean-recycle-bin', days),

  // Skills Methods
  listSkills: () => ipcRenderer.invoke('skills:list'),
  saveSkill: (skill) => ipcRenderer.invoke('skills:save', skill),
  deleteSkill: (skillId) => ipcRenderer.invoke('skills:delete', skillId),

  // Browser Sandbox Methods
  createBrowser: (options) => ipcRenderer.invoke('browser:create', options),
  navigateBrowser: (id, url) => ipcRenderer.invoke('browser:navigate', { id, url }),
  captureBrowser: (id) => ipcRenderer.invoke('browser:capture', id),
  closeBrowser: (id) => ipcRenderer.invoke('browser:close', id),
  evalBrowser: (id, code) => ipcRenderer.invoke('browser:eval', { id, code }),

  // Events
  onScreenUpdate: (callback) => ipcRenderer.on('session-event', (event, type, data) => {
    if (type === 'screen-update') callback(data);
  }),
  onSessionEvent: (callback) => ipcRenderer.on('session-event', (event, ...args) => callback(...args)),
  onGlobalHotkey: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('global-hotkey-triggered', listener);
    return () => ipcRenderer.removeListener('global-hotkey-triggered', listener);
  },

  // Window close confirmation
  confirmClose: () => ipcRenderer.invoke('confirm-close'),
  onWindowCloseRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('window-close-requested', listener);
    return () => ipcRenderer.removeListener('window-close-requested', listener);
  },
});
