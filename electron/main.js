import dotenv from 'dotenv';
import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, screen } from 'electron';
// Load environment variables as early as possible
dotenv.config();

import { exec } from 'node:child_process';
import util from 'node:util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = util.promisify(exec);

import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import os from 'os';
import { BrowserSandbox } from './services/BrowserSandbox.js';
import { ComputerControl } from './services/ComputerControl.js';
import { FileSystemService } from './services/FileSystemService.js';
import MongoDBService from './services/MongoDBService.js';
import { ScreenMonitor } from './services/ScreenMonitor.js';
import { SkillManager } from './services/SkillManager.js';

// Environment variable check
console.log('[Main] MONGODB_URI loaded:', process.env.MONGODB_URI ? 'Yes' : 'No');

let mainWindow = null;
let overlayWindow = null;
let computerControl = null;
let screenMonitor = null;
let fileSystem = null;
let skillManager = null;
let browserSandbox = null;

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV === 'true';
  
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0B0B0B',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools(); // Optional
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });
  
  mainWindow = win;
  


  // Initialize services with window reference
  computerControl = new ComputerControl();
  screenMonitor = new ScreenMonitor(mainWindow);
  fileSystem = new FileSystemService();
  skillManager = new SkillManager();
  browserSandbox = new BrowserSandbox();
}

function createOverlayWindow() {
  if (overlayWindow) return;

  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV === 'true';
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    skipTaskbar: true
  });

  // Start by ignoring all mouse events (click-through)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173#/overlay');
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'overlay' });
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });


}





ipcMain.handle('open-overlay', () => {
  if (mainWindow) mainWindow.hide();
  createOverlayWindow();
});

ipcMain.handle('close-overlay', () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
  if (mainWindow) mainWindow.show();
});

// Desktop mode: close overlay and show main window
ipcMain.handle('switch-to-desktop', () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    if (process.platform === 'win32') {
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setAlwaysOnTop(false);
    }
  } else {
    createWindow();
  }
});

ipcMain.handle('resize-overlay', (event, width, height) => {
  // Since overlay is now full-screen, resizing the window is no longer needed.
  // We keep the IPC handler to avoid breaking the renderer, but it's a no-op.
});

ipcMain.on('overlay:set-ignore-mouse-events', (event, ignore, options) => {
    if (overlayWindow) {
        overlayWindow.setIgnoreMouseEvents(ignore, options);
    }
});

// Handle screen share sources
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 1920, height: 1080 } });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }));
});

// IPC for high-quality screenshot capture specifically for AI
ipcMain.handle('screenshot-capture', async () => {
  const sources = await desktopCapturer.getSources({ 
    types: ['screen'], 
    thumbnailSize: { width: 1920, height: 1080 } 
  });
  return sources[0].thumbnail.toDataURL();
});

// IPC for executing shell commands safely
ipcMain.handle('execute-command', async (event, command) => {
  try {
    const { stdout, stderr } = await execPromise(command);
    return { stdout, stderr };
  } catch (error) {
    return { 
      stdout: error.stdout || '', 
      stderr: error.stderr || error.message || 'Unknown error occurred'
    };
  }
});

// IPC for getting device information
ipcMain.handle('get-device-info', async () => {
  return {
    hostname: os.hostname(),
    username: os.userInfo().username,
    platform: os.platform()
  };
});

// --- COMPUTER CONTROL IPC HANDLERS ---

ipcMain.handle('start-monitoring', async () => {
  if (screenMonitor) {
    await screenMonitor.start();
    return { success: true };
  }
  return { success: false, error: 'Monitor service not initialized' };
});

ipcMain.handle('stop-monitoring', async () => {
  if (screenMonitor) {
    screenMonitor.stop();
    return { success: true };
  }
  return { success: false, error: 'Monitor service not initialized' };
});

// Action Execution
ipcMain.handle('execute-action', async (event, action) => {
  console.log('[Main] Executing approved action:', action);
  
  if (!computerControl) return { success: false, error: 'Control service not initialized' };
  
  const { type, target, text, key, app, url, background } = action;
  
  switch (type) {
    case 'click':
    case 'doubleclick':
    case 'rightclick':
      if (typeof target === 'object' && target !== null && 'x' in target && 'y' in target) {
        return await computerControl.click(target.x, target.y, type);
      }
      return { success: false, error: 'Invalid target for click' };
      
    case 'type':
      return await computerControl.type(text || '');
      
    case 'keypress':
      return await computerControl.keyPress(key || '', action.modifiers || []);
      
    case 'launch':
    case 'open-path':
    case 'open-url': {
      const targetPath = action.path || action.target || action.app || action.url;
      if (!targetPath) return { success: false, error: 'No path or app specified' };
      
      // Special handling for common folder names and shortcuts
      let finalPath = targetPath;
      if (!path.isAbsolute(finalPath) && !finalPath.startsWith('http') && !finalPath.includes('://')) {
        const parts = finalPath.split(/[\\/]/);
        const firstPart = parts[0].toLowerCase();
        const home = os.homedir();
        
        if (firstPart === 'desktop') {
          finalPath = path.join(home, 'Desktop', ...parts.slice(1));
        } else if (firstPart === 'documents') {
          finalPath = path.join(home, 'Documents', ...parts.slice(1));
        } else if (firstPart === 'downloads') {
          finalPath = path.join(home, 'Downloads', ...parts.slice(1));
        }
      }

      console.log(`[Main] Executing ${type} with resolved path:`, finalPath);

      if (type === 'open-url' || finalPath.startsWith('http') || finalPath.includes('://')) {
        return await computerControl.openUrl(finalPath, { background });
      }
      return await computerControl.launchApp(finalPath, null, { background });
    }

    case 'register-app':
      return computerControl.registerApp(action.name || action.app, action.path || action.target);

    // --- FILE SYSTEM ACTIONS ---
    case 'list-dir':
      return await fileSystem.listDirectory(action.path || target);
    
    case 'read-file':
      return await fileSystem.readFile(action.path || target);
      
    case 'write-file':
      return await fileSystem.writeFile(action.path || target, action.content || '');

    case 'move-file':
      return await fileSystem.moveFile(action.oldPath, action.newPath);
      
    case 'delete-file':
      return await fileSystem.deleteFile(action.path || target);

    case 'rename-file':
      return await fileSystem.moveFile(action.oldPath, action.newPath);

    // Create folder (mkdir) with proper permissions
    case 'create-folder': {
      const folderPath = action.path || target;
      try {
        await fs.promises.mkdir(folderPath, { recursive: true });
        return { success: true, message: `Folder created: ${folderPath}` };
      } catch (err) {
        // Fallback: try via PowerShell (handles permission issues)
        try {
          await execPromise(`powershell -Command "New-Item -ItemType Directory -Force -Path '${folderPath}'"`)
          return { success: true, message: `Folder created via PowerShell: ${folderPath}` };
        } catch (psErr) {
          return { success: false, error: psErr.message };
        }
      }
    }
      
    case 'get-recycle-bin':
      return await fileSystem.getRecycleBinItems();
      
    case 'clean-recycle-bin':
      return await fileSystem.cleanRecycleBin(action.days || 30);
      
    case 'save-document': {
      const { content, filename } = action;
      const docPath = path.join(os.homedir(), 'Documents', filename || 'gemdesk_doc.txt');
      const result = await fileSystem.writeFile(docPath, content);
      if (result.success) {
        await computerControl.openUrl(docPath);
      }
      return result;
    }

    case 'create-doc': {
      return await computerControl.createDoc(action.filename, action.content);
    }

    case 'save-skill': {
        return await skillManager.saveSkill({
            name: action.name,
            description: action.description,
            actions: action.actions,
            category: action.category || 'general'
        });
    }

    // --- WHATSAPP NAVIGATION ---
    // Navigate to a specific WhatsApp chat by name/phone
    case 'whatsapp-chat':
    case 'whatsapp-call': {
      const isCall = action.action === 'whatsapp-call' || action.type === 'whatsapp-call';
      let contact = action.contact || action.name || action.target;
      const message = action.message || '';
      
      // Safety check for .replace() error
      if (!contact) return { success: false, error: 'No contact specified' };
      if (typeof contact !== 'string') contact = String(contact);

      // If it looks like a phone number, use the wa.me protocol
      const phonePattern = /^\+?[\d\s\-().]+$/;
      if (phonePattern.test(contact.replace(/\s/g, ''))) {
        const phone = contact.replace(/[\s\-().]/g, '');
        const waUrl = message
          ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
          : `https://wa.me/${phone}`;
        return await computerControl.openUrl(waUrl);
      }

      // Otherwise launch WhatsApp desktop and search for the contact name
      const launchResult = await computerControl.launchApp('whatsapp', null, { background: false });
      if (!launchResult.success) return launchResult;

      try {
        // Force focus using PowerShell first (internal to AppLauncher now, but we'll trigger it here)
        console.log(`[WhatsApp] Ensuring window is focused...`);
        
        // If it was just opened, give it plenty of time to load UI
        const isFreshLaunch = launchResult.message?.includes('Search Menu search');
        const initialDelay = isFreshLaunch ? 10000 : 3000;
        await new Promise(r => setTimeout(r, initialDelay));

        const focusResult = await computerControl.launcher.focusWindowByTitle('WhatsApp');
        if (!focusResult.success) {
          console.warn('[WhatsApp] Window focus attempt 1 failed:', focusResult.error);
        }
        
        // Second attempt with click fallback if needed, but we prefer window handle focus
        await new Promise(r => setTimeout(r, 1000));
        
        // Ensure we are in a clean state (Escape multiple times)
        console.log('[WhatsApp] Resetting state...');
        await computerControl.keyPress('escape');
        await new Promise(r => setTimeout(r, 800));
        await computerControl.keyPress('escape');
        await new Promise(r => setTimeout(r, 1200));

        // Focus Search bar (Ctrl+F)
        console.log('[WhatsApp] Triggering search...');
        await computerControl.keyPress('f', ['ctrl']);
        await new Promise(r => setTimeout(r, 2500));
        
        // Robust Clear: Ctrl+A and Backspace
        await computerControl.keyPress('a', ['ctrl']);
        await new Promise(r => setTimeout(r, 800));
        await computerControl.keyPress('backspace');
        await new Promise(r => setTimeout(r, 1200));

        // Type contact name
        console.log(`[WhatsApp] Typing contact: ${contact}`);
        await computerControl.type(contact);
        await new Promise(r => setTimeout(r, 7000)); // Wait for search results
        
        // Select the top contact - Enter
        await computerControl.keyPress('enter');
        await new Promise(r => setTimeout(r, 5000)); // Wait for chat to load
        
        // Final Enter to ensure focus is in the message box
        await computerControl.keyPress('enter');
        await new Promise(r => setTimeout(r, 2000));

        if (message && !isCall) {
          console.log(`[WhatsApp] Sending message...`);
          await computerControl.type(message);
          await new Promise(r => setTimeout(r, 2500));
          await computerControl.keyPress('enter');
          await new Promise(r => setTimeout(r, 1500));
        }

        if (isCall) {
          console.log(`[WhatsApp] Contact located. Capturing screenshot for call icon identification...`);
          // Re-focus WhatsApp before screenshot to ensure the call bar is visible
          await computerControl.launcher.focusWindowByTitle('WhatsApp');
          await new Promise(r => setTimeout(r, 1000));
          
          // Capture a fresh screenshot so the AI can see the call/video icon
          const { nativeImage } = await import('electron');
          const screenshot = await mainWindow.webContents.capturePage();
          const base64Screenshot = screenshot.toJPEG(85).toString('base64');
          
          return { 
            success: true, 
            message: `Successfully opened chat with ${contact}. Screenshot captured. Now look at the top-right of the chat for the phone or video icon. Click the phone icon if visible. If only video icon is visible, click it to get the voice/video choice modal, then click "Voice call".`,
            screenshot: `data:image/jpeg;base64,${base64Screenshot}`
          };
        }

        return { success: true, message: `Successfully located contact and processed request.` };
      } catch (error) {
        console.error('[WhatsApp] Automation error:', error);
        return { success: false, error: error.message };
      }
    }

    case 'create-browser':
        return await browserSandbox.createBrowser(action.id || 'default', action);
    
    case 'navigate-browser':
        return await browserSandbox.navigate(action.id || 'default', action.url);
        
    case 'capture-browser':
        return await browserSandbox.capturePage(action.id || 'default');
        
    case 'close-browser':
        return await browserSandbox.closeBrowser(action.id || 'default');
        
    case 'eval-browser':
        return await browserSandbox.executeJS(action.id || 'default', action.code);
      
    default:
      if (type === 'create-project') {
        if (!process.projectScaffolder) {
            const { ProjectScaffoldService } = await import('./services/ProjectScaffoldService.js');
            process.projectScaffolder = new ProjectScaffoldService();
        }
        
        let targetDir = action.path || action.target;
        // If the user mentions desktop or the AI thinks it should be on desktop
        if (!targetDir && (action.reasoning?.toLowerCase().includes('desktop') || action.description?.toLowerCase().includes('desktop'))) {
            targetDir = path.join(os.homedir(), 'Desktop');
        }

        const result = process.projectScaffolder.createProject(
            action.name, 
            action.projectType || 'generic', 
            action.description,
            targetDir
        );
        if (result.success) {
            await computerControl.launchApp(`code "${result.projectPath}"`);
        }
        return result;
      }
      return { success: false, error: `Unknown action type: ${type}` };
  }

});

// --- FILE SYSTEM IPC HANDLERS ---

ipcMain.handle('fs:list-dir', async (event, dirPath) => {
  return await fileSystem.listDirectory(dirPath);
});

ipcMain.handle('fs:read-file', async (event, filePath) => {
  return await fileSystem.readFile(filePath);
});

ipcMain.handle('fs:write-file', async (event, filePath, content) => {
  return await fileSystem.writeFile(filePath, content);
});

ipcMain.handle('fs:move-file', async (event, { oldPath, newPath }) => {
  return await fileSystem.moveFile(oldPath, newPath);
});

ipcMain.handle('fs:delete-file', async (event, filePath) => {
  return await fileSystem.deleteFile(filePath);
});

ipcMain.handle('fs:get-recycle-bin', async () => {
  return await fileSystem.getRecycleBinItems();
});

ipcMain.handle('fs:clean-recycle-bin', async (event, days) => {
  return await fileSystem.cleanRecycleBin(days);
});

ipcMain.handle('skills:list', async () => {
  return await skillManager.listSkills();
});

ipcMain.handle('skills:save', async (event, skill) => {
  return await skillManager.saveSkill(skill);
});

ipcMain.handle('skills:delete', async (event, skillId) => {
  return await skillManager.deleteSkill(skillId);
});

ipcMain.handle('browser:create', async (event, options) => {
  return await browserSandbox.createBrowser(options.id || 'default', options);
});

ipcMain.handle('browser:navigate', async (event, { id, url }) => {
  return await browserSandbox.navigate(id, url);
});

ipcMain.handle('browser:capture', async (event, id) => {
  return await browserSandbox.capturePage(id);
});

ipcMain.handle('browser:close', async (event, id) => {
  return await browserSandbox.closeBrowser(id);
});

ipcMain.handle('browser:eval', async (event, { id, code }) => {
  return await browserSandbox.executeJS(id, code);
});

// --- MONGODB IPC HANDLERS ---

ipcMain.handle('db:create-chat', async (event, title) => {
  try {
    const db = MongoDBService.getDb();
    if (!db) throw new Error('Database not connected');
    
    const result = await db.collection('chats').insertOne({
      title: title || 'New Chat',
      created_at: new Date(),
      updated_at: new Date()
    });
    
    return {
      _id: result.insertedId.toString(),
      title: title || 'New Chat',
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Main] db:create-chat error:', error);
    throw error;
  }
});

ipcMain.handle('db:get-chats', async () => {
  try {
    const db = MongoDBService.getDb();
    if (!db) throw new Error('Database not connected');
    
    const chats = await db.collection('chats').find().sort({ created_at: -1 }).toArray();
    return chats.map(c => ({ ...c, _id: c._id.toString() }));
  } catch (error) {
    console.error('[Main] db:get-chats error:', error);
    throw error;
  }
});

ipcMain.handle('db:get-messages', async (event, chatId) => {
  try {
    const db = MongoDBService.getDb();
    if (!db) throw new Error('Database not connected');
    
    const messages = await db.collection('messages').find({ chat_id: chatId }).sort({ created_at: 1 }).toArray();
    return messages.map(m => ({ ...m, _id: m._id.toString() }));
  } catch (error) {
    console.error('[Main] db:get-messages error:', error);
    throw error;
  }
});

ipcMain.handle('db:save-message', async (event, message) => {
  try {
    const db = MongoDBService.getDb();
    if (!db) throw new Error('Database not connected');
    
    const msg = { ...message, created_at: new Date() };
    const result = await db.collection('messages').insertOne(msg);
    return { _id: result.insertedId.toString(), ...msg };
  } catch (error) {
    console.error('[Main] db:save-message error:', error);
    throw error;
  }
});

ipcMain.handle('db:update-chat-title', async (event, { chatId, title }) => {
  try {
    const db = MongoDBService.getDb();
    if (!db) throw new Error('Database not connected');
    
    await db.collection('chats').updateOne(
      { _id: new ObjectId(chatId) },
      { $set: { title: title, updated_at: new Date() } }
    );
    return { success: true };
  } catch (error) {
    console.error('[Main] db:update-chat-title error:', error);
    throw error;
  }
});

ipcMain.handle('db:delete-chat', async (event, chatId) => {
  try {
    const db = MongoDBService.getDb();
    if (!db) throw new Error('Database not connected');
    
    await db.collection('messages').deleteMany({ chat_id: chatId });
    await db.collection('chats').deleteOne({ _id: new ObjectId(chatId) });
    return { success: true };
  } catch (error) {
    console.error('[Main] db:delete-chat error:', error);
    throw error;
  }
});

// Direct Input Injection (For Remote Control)
ipcMain.on('send-input', async (event, { type, data }) => {
  if (computerControl) {
    await computerControl.handleRawInput(type, data);
  }
});

app.whenReady().then(async () => {
  ipcMain.handle('window:focus', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  console.log('[Main] Connecting to MongoDB...');
  const connected = await MongoDBService.connect();
  
  if (!connected) {
    console.error('[Main] Failed to connect to MongoDB. The app will start but database features will be unavailable.');
  } else {
    console.log('[Main] MongoDB connected successfully');
  }
  
  createWindow();

  // Register global hotkey
  const registered = globalShortcut.register('CommandOrControl+G', () => {
    console.log('[Main] Global hotkey Ctrl+G triggered');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      
      if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true);
        mainWindow.setAlwaysOnTop(false);
      }
      
      mainWindow.webContents.send('global-hotkey-triggered');
    }
  });

  console.log('[Main] Hotkey Ctrl+G registered:', registered);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (screenMonitor) screenMonitor.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
