import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron';
import dotenv from 'dotenv';
// Load environment variables as early as possible
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { exec } from 'node:child_process';
import util from 'node:util';
const execPromise = util.promisify(exec);

import { ActionParser } from './services/ActionParser.js';
import { ComputerControl } from './services/ComputerControl.js';
import { ScreenMonitor } from './services/ScreenMonitor.js';
import MongoDBService from './services/MongoDBService.js';
import { ObjectId } from 'mongodb';
import os from 'os';
// Environment variable check
console.log('[Main] MONGODB_URI loaded:', process.env.MONGODB_URI ? 'Yes' : 'No');

let mainWindow = null;
let computerControl = null;
let screenMonitor = null;

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
    win.webContents.openDevTools();
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
}

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
  // Return the first screen's thumbnail as a base64 string
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

// --- NEW IPC HANDLERS FOR COMPUTER CONTROL ---

// Monitoring
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

// Action Execution (Approved actions only)
ipcMain.handle('execute-action', async (event, action) => {
  console.log('[Main] Executing approved action:', action);
  
  if (!computerControl) return { success: false, error: 'Control service not initialized' };
  
  const { target, text, key, app, url } = action;
  const type = action.type || action.action;
  
  switch (type) {
    case 'click':
      return await computerControl.click(target?.x, target?.y, 'left');
    
    case 'doubleclick':
      return await computerControl.doubleClick(target?.x, target?.y);
      
    case 'rightclick':
      return await computerControl.click(target?.x, target?.y, 'right');
      
    case 'type':
      return await computerControl.type(text);
      
    case 'keypress':
      return await computerControl.keyPress(key, action.modifiers || []);
      
    case 'launch':
      return await computerControl.launchApp(app || target || url);

    case 'register-app':
      return computerControl.registerApp(action.name || action.app, action.path || action.target);

    case 'open-url':
      return await computerControl.openUrl(url || target || app);
      
    default:
      return { success: false, error: `Unknown action type: ${type}` };
  }

});

// --- NEW IPC HANDLERS FOR MONGODB ---

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
  // Connect to MongoDB before creating window
  console.log('[Main] Connecting to MongoDB...');
  const connected = await MongoDBService.connect();
  
  if (!connected) {
    console.error('[Main] Failed to connect to MongoDB. The app will start but database features will be unavailable.');
    // You could show a dialog here or handle the error differently
  } else {
    console.log('[Main] MongoDB connected successfully');
  }
  
  createWindow();
});

app.on('window-all-closed', () => {
  // Stop monitoring if active
  if (screenMonitor) screenMonitor.stop();
  
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
