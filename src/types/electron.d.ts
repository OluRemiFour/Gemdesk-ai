export interface ElectronInterface {
  getSources: () => Promise<any[]>;
  captureScreenshot: () => Promise<string>;
  getDeviceInfo: () => Promise<{ hostname?: string; username?: string; platform?: string }>;
  executeCommand: (command: string) => Promise<{ stdout: string; stderr: string }>;
  startMonitoring: () => Promise<{ success: boolean; error?: string }>;
  stopMonitoring: () => Promise<{ success: boolean; error?: string }>;
  executeAction: (action: any) => Promise<{ success: boolean; error?: string }>;
  sendInput: (type: string, data: any) => void;
  onScreenUpdate: (callback: (data: any) => void) => void;
  onSessionEvent: (callback: (...args: any[]) => void) => void;

  // MongoDB Methods
  createChat: (title: string) => Promise<any>;
  getChats: () => Promise<any[]>;
  getMessages: (chatId: string) => Promise<any[]>;
  saveMessage: (message: any) => Promise<any>;
  updateChatTitle: (chatId: string, title: string) => Promise<{ success: boolean }>;
  deleteChat: (chatId: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electron: ElectronInterface;
  }
}
