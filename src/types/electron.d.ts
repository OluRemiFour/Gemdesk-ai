export interface ElectronInterface {
  getSources: () => Promise<any[]>;
  captureScreenshot: () => Promise<string>;
  getDeviceInfo: () => Promise<{ hostname?: string; username?: string; platform?: string }>;
  executeCommand: (command: string) => Promise<{ stdout: string; stderr: string }>;
  startMonitoring: () => Promise<{ success: boolean; error?: string }>;
  stopMonitoring: () => Promise<{ success: boolean; error?: string }>;
  executeAction: (action: any) => Promise<{ success: boolean; error?: string; [key: string]: any }>;
  sendInput: (type: string, data: any) => void;
  focusWindow: () => Promise<void>;
  onScreenUpdate: (callback: (data: any) => void) => void;
  onSessionEvent: (callback: (...args: any[]) => void) => void;
  onGlobalHotkey: (callback: () => void) => () => void;

  // Window close confirmation
  onWindowCloseRequested: (callback: () => void) => () => void;
  confirmClose: () => Promise<void>;

  // MongoDB Methods
  createChat: (title: string) => Promise<any>;
  getChats: () => Promise<any[]>;
  getMessages: (chatId: string) => Promise<any[]>;
  saveMessage: (message: any) => Promise<any>;
  updateChatTitle: (chatId: string, title: string) => Promise<{ success: boolean }>;
  deleteChat: (chatId: string) => Promise<{ success: boolean }>;
  
  // File System Methods
  listDir: (path: string) => Promise<{ success: boolean; files?: any[]; error?: string }>;
  readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  moveFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  deleteFile: (path: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  getRecycleBin: () => Promise<{ success: boolean; items?: any[]; error?: string }>;
  cleanRecycleBin: (days: number) => Promise<{ success: boolean; message?: string; error?: string }>;

  // Skills Methods
  listSkills: () => Promise<{ success: boolean; skills: any[] }>;
  saveSkill: (skill: any) => Promise<{ success: boolean; skill: any }>;
  deleteSkill: (skillId: string) => Promise<{ success: boolean; message: string }>;

  // Browser Methods
  createBrowser: (options: any) => Promise<{ success: boolean; id: string }>;
  navigateBrowser: (id: string, url: string) => Promise<{ success: boolean }>;
  captureBrowser: (id: string) => Promise<{ success: boolean; data: string }>;
  closeBrowser: (id: string) => Promise<{ success: boolean }>;
  evalBrowser: (id: string, code: string) => Promise<{ success: boolean; result: any }>;

  // Overlay & Window Management
  openOverlay: () => Promise<void>;
  closeOverlay: () => Promise<void>;
  resizeOverlay: (width: number, height: number) => Promise<void>;
  switchToDesktop: () => Promise<void>;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => Promise<void>;

  // Window Close Lifecycle
  onWindowCloseRequested: (callback: () => void) => () => void;
  confirmClose: () => void;
}

declare global {
  interface Window {
    electron: ElectronInterface;
  }
}
