import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';

export class BrowserSandbox {
    constructor() {
        this.windows = new Map();
    }

    async createBrowser(id = 'default', options = {}) {
        const win = new BrowserWindow({
            width: 1280,
            height: 800,
            show: options.visible || false,
            webPreferences: {
                offscreen: !options.visible,
                contextIsolation: true,
                nodeIntegration: false,
            }
        });

        this.windows.set(id, win);

        return new Promise((resolve) => {
            win.webContents.once('did-finish-load', () => {
                resolve({ success: true, id });
            });
            
            if (options.url) {
                win.loadURL(options.url);
            } else {
                resolve({ success: true, id });
            }
        });
    }

    async navigate(id, url) {
        const win = this.windows.get(id);
        if (!win) return { success: false, error: 'Browser not found' };

        return new Promise((resolve) => {
            win.webContents.once('did-finish-load', () => {
                resolve({ success: true });
            });
            win.loadURL(url);
        });
    }

    async capturePage(id) {
        const win = this.windows.get(id);
        if (!win) return { success: false, error: 'Browser not found' };

        try {
            const image = await win.webContents.capturePage();
            return { success: true, data: image.toDataURL() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async closeBrowser(id) {
        const win = this.windows.get(id);
        if (win) {
            win.close();
            this.windows.delete(id);
        }
        return { success: true };
    }

    async executeJS(id, code) {
        const win = this.windows.get(id);
        if (!win) return { success: false, error: 'Browser not found' };

        try {
            const result = await win.webContents.executeJavaScript(code);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
