
// Wrapper for @nut-tree-fork/nut-js to handle computer control safely
import { mouse, keyboard, Point, Button, Key } from '@nut-tree-fork/nut-js';
import { screen } from 'electron';

// Configure nut.js
mouse.config.autoDelayMs = 0;
keyboard.config.autoDelayMs = 0;

import { AppLauncher } from './AppLauncher.js';

export class ComputerControl {
  constructor() {
    this.isProcessing = false;
    this.launcher = new AppLauncher();
    
    // Cache screen dimensions to avoid expensive IPC calls on every mouse move
    this.cachedScreen = {
      width: 0,
      height: 0,
      lastUpdate: 0
    };
    this.updateScreenCache();
    
    // Tracking current mouse move to prevent concurrent execution overlap
    this.isMouseMoveInProgress = false;
  }

  updateScreenCache() {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.bounds;
      this.cachedScreen = {
        width,
        height,
        lastUpdate: Date.now()
      };
    } catch (err) {
      console.error('[ComputerControl] Failed to update screen cache:', err);
    }
  }

  getScreenDimensions() {
    // Refresh cache every 10 seconds in case displays changed
    if (Date.now() - this.cachedScreen.lastUpdate > 10000) {
      this.updateScreenCache();
    }
    return this.cachedScreen;
  }

  registerApp(name, path) {
    return this.launcher.registerApp(name, path);
  }

  async focusWindow(titlePattern) {
    return await this.launcher.focusWindowByTitle(titlePattern);
  }

  async moveMouse(x, y) {
    try {
      await mouse.setPosition(new Point(x, y));
      return { success: true, message: `Moved mouse to ${x}, ${y}` };
    } catch (error) {
      console.error('Mouse move error:', error);
      return { success: false, error: error.message };
    }
  }

  async click(x, y, button = 'left') {
    try {
      if (x !== undefined && y !== undefined) {
        await mouse.setPosition(new Point(x, y));
      }
      
      const btn = button === 'right' ? Button.RIGHT : Button.LEFT;
      await mouse.click(btn);
      
      return { success: true, message: `Clicked ${button} button at ${x}, ${y}` };
    } catch (error) {
      console.error('Click error:', error);
      return { success: false, error: error.message };
    }
  }

  async doubleClick(x, y) {
    try {
      if (x !== undefined && y !== undefined) {
        await mouse.setPosition(new Point(x, y));
      }
      
      await mouse.doubleClick(Button.LEFT);
      
      return { success: true, message: `Double clicked at ${x}, ${y}` };
    } catch (error) {
      console.error('Double click error:', error);
      return { success: false, error: error.message };
    }
  }

  async type(text) {
    try {
      await keyboard.type(text);
      return { success: true, message: `Typed: "${text}"` };
    } catch (error) {
      console.error('Type error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async keyPress(keyName, modifiers = []) {
    // Map of common key names to nut.js Key constants
    const keyMap = {
      'enter': Key.Enter,
      'escape': Key.Escape,
      'backspace': Key.Backspace,
      'tab': Key.Tab,
      'space': Key.Space,
      'up': Key.Up,
      'down': Key.Down,
      'left': Key.Left,
      'right': Key.Right,
      'home': Key.Home,
      'end': Key.End,
      'pageup': Key.PageUp,
      'pagedown': Key.PageDown,
      'delete': Key.Delete,
      'insert': Key.Insert,
      'f1': Key.F1, 'f2': Key.F2, 'f3': Key.F3, 'f4': Key.F4, 'f5': Key.F5,
      'f6': Key.F6, 'f7': Key.F7, 'f8': Key.F8, 'f9': Key.F9, 'f10': Key.F10,
      'f11': Key.F11, 'f12': Key.F12,
      'cmd': Key.LeftSuper, 'command': Key.LeftSuper, 'win': Key.LeftSuper, 'meta': Key.LeftSuper,
      'alt': Key.LeftAlt,
      'ctrl': Key.LeftControl, 'control': Key.LeftControl,
      'shift': Key.LeftShift,
      // Alphanumeric keys
      'a': Key.A, 'b': Key.B, 'c': Key.C, 'd': Key.D, 'e': Key.E, 'f': Key.F, 'g': Key.G, 'h': Key.H, 'i': Key.I, 'j': Key.J, 'k': Key.K, 'l': Key.L, 'm': Key.M, 'n': Key.N, 'o': Key.O, 'p': Key.P, 'q': Key.Q, 'r': Key.R, 's': Key.S, 't': Key.T, 'u': Key.U, 'v': Key.V, 'w': Key.W, 'x': Key.X, 'y': Key.Y, 'z': Key.Z,
      '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3, '4': Key.Num4, '5': Key.Num5, '6': Key.Num6, '7': Key.Num7, '8': Key.Num8, '9': Key.Num9
    };

    try {
      const lowerKeyName = keyName.toLowerCase();
      let key = keyMap[lowerKeyName];
      
      if (key === undefined) {
        // Try single character fallback (if not in map yet)
        if (keyName.length === 1) {
          // If no modifiers, just type it
          if (modifiers.length === 0) {
            await keyboard.type(keyName);
            return { success: true, message: `Typed key: ${keyName}` };
          }
          // If there are modifiers, we still don't have a mapping for this char in Nut-js enum.
          // This case should be rare for common keys now.
          throw new Error(`Unknown key for combination: ${keyName}`);
        }
        throw new Error(`Unknown key: ${keyName}`);
      }

      // Handle modifiers
      const activeModifiers = [];
      for (const mod of modifiers) {
        const modKey = keyMap[mod.toLowerCase()];
        if (modKey !== undefined) {
          await keyboard.pressKey(modKey);
          activeModifiers.push(modKey);
        }
      }

      await keyboard.pressKey(key);
      await keyboard.releaseKey(key);

      // Release modifiers in reverse order (copy and reverse)
      const modifiersToRelease = [...activeModifiers].reverse();
      for (const modKey of modifiersToRelease) {
        await keyboard.releaseKey(modKey);
      }

      return { success: true, message: `Pressed key: ${modifiers.join('+')} ${keyName}` };
    } catch (error) {
      console.error('Key press error:', error);
      return { success: false, error: error.message };
    }
  }

  async startAndSearch(appName) {
    try {
      // 1. Press Windows Key
      await keyboard.pressKey(Key.LeftSuper);
      await keyboard.releaseKey(Key.LeftSuper);
      
      // 2. Wait for Start Menu to open (brief delay) - tuned for speed
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // 3. Type the application name
      await keyboard.type(appName);
      
      // 4. Wait for search results - tuned for speed
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // 5. Press Enter to launch
      await keyboard.pressKey(Key.Enter);
      await keyboard.releaseKey(Key.Enter);

      // [NEW] Delay for specific apps to initialize UI
      const isWhatsApp = appName.toLowerCase().includes('whatsapp');
      if (isWhatsApp) {
        await new Promise(resolve => setTimeout(resolve, 7000));
      }
      
      return { success: true, message: `Attempted to launch ${appName} via Start Menu search.` };
    } catch (error) {
      console.error('Start and Search error:', error);
      return { success: false, error: error.message };
    }
  }

  async launchApp(appName, url = null, options = {}) {
    if (!appName) return { success: false, error: 'App name is required' };
    
    // Check if it's a URL first
    if (appName.startsWith('http://') || appName.startsWith('https://')) {
        return await this.openUrl(appName, options);
    }

    // If appName contains a space, try to intelligently split app name and arguments
    let finalApp = appName;
    let finalArgs = [];
    const parts = appName.split(/\s+/);
    
    if (parts.length > 1) {
        const firstPart = parts[0].toLowerCase();
        // Common CLI apps that often take paths/args
        const cliApps = ['code', 'vscode', 'visual studio code', 'notepad', 'explorer', 'chrome', 'edge'];
        
        if (cliApps.includes(firstPart)) {
            finalApp = firstPart;
            finalArgs = parts.slice(1);
        } else {
            const lastPart = parts[parts.length - 1];
            // If it looks like a URL or a file path (with slash)
            if (lastPart.includes('.') && (lastPart.startsWith('http') || lastPart.includes('\\') || lastPart.includes('/'))) {
                finalApp = parts.slice(0, -1).join(' ');
                finalArgs = [lastPart];
            }
        }
    }

    if (url) {
        finalArgs.push(url);
    }

    const os = await import('node:os');
    const fs = await import('node:fs');
    const pathMod = await import('node:path');
    const home = os.homedir();

    // [NEW] Resolve relative paths for finalApp to absolute paths (Desktop/Documents)
    if (finalApp && !pathMod.isAbsolute(finalApp) && !finalApp.startsWith('http')) {
        // Try resolving as a file/folder on Desktop or Documents
        const desktopPath = pathMod.join(home, 'Desktop', finalApp);
        const docsPath = pathMod.join(home, 'Documents', finalApp);
        
        try {
            await fs.promises.access(desktopPath);
            finalApp = desktopPath;
        } catch {
            try {
                await fs.promises.access(docsPath);
                finalApp = docsPath;
            } catch {
                // Keep as is
            }
        }
    }

    // [NEW] Resolve relative paths in arguments to absolute paths (Desktop/Documents)
    if (finalArgs.length > 0) {
        finalArgs = await Promise.all(finalArgs.map(async (arg) => {
            if (typeof arg !== 'string' || pathMod.isAbsolute(arg) || arg.startsWith('http')) return arg;
            
            // Check if it's a common alias
            const lowerArg = arg.toLowerCase();
            let resolved = arg;
            
            if (lowerArg === 'desktop') resolved = pathMod.join(home, 'Desktop');
            else if (lowerArg === 'documents') resolved = pathMod.join(home, 'Documents');
            else {
                // Try resolving as a file/folder on Desktop or Documents
                const desktopPath = pathMod.join(home, 'Desktop', arg);
                const docsPath = pathMod.join(home, 'Documents', arg);
                
                try {
                    await fs.promises.access(desktopPath);
                    resolved = desktopPath;
                } catch {
                    try {
                        await fs.promises.access(docsPath);
                        resolved = docsPath;
                    } catch {
                        // Keep as is
                    }
                }
            }
            
            return resolved;
        }));
    }

    console.log(`[ComputerControl] Launching app: "${finalApp}" with args:`, finalArgs);
    // Standard app launch via launcher
    const launchResult = await this.launcher.launchApp(finalApp, finalArgs, options);
    
    // Fallback logic: If programmatic launch fails, try Start Menu Search (very reliable on Windows)
    if (!launchResult.success && os.platform() === 'win32' && !path.isAbsolute(finalApp)) {
        console.log(`[ComputerControl] Programmatic launch failed for "${finalApp}", trying Start Menu fallback...`);
        return await this.startAndSearch(finalApp);
    }

    return launchResult;
  }

  async openUrl(url, options = {}) {
    try {
      const { exec } = await import('node:child_process');
      const util = await import('node:util');
      const execPromise = util.promisify(exec);
      const background = options.background || false;
      
      // Ensure URL has protocol and is not just an app name
      let targetUrl = url.trim();
      const isDomain = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(targetUrl);
      const hasProtocol = targetUrl.includes('://');

      if (!hasProtocol) {
        const commonApps = ['chrome', 'google chrome', 'firefox', 'edge', 'msedge', 'microsoft edge', 'brave', 'opera', 'safari', 'whatsapp', 'vscode', 'notepad', 'word', 'excel', 'powerpoint', 'winword', 'excel.exe', 'code'];
        
        if (commonApps.includes(targetUrl.toLowerCase())) {
           console.log(`[ComputerControl] String "${targetUrl}" is a known app. Redirecting to launchApp...`);
           return await this.launchApp(targetUrl, null, options);
        }

        if (isDomain || targetUrl.includes('/') || targetUrl.includes('?')) {
          targetUrl = 'https://' + targetUrl;
        } else {
          // If it doesn't look like a URL and has no protocol, try launching it as an app instead
          console.log(`[ComputerControl] String "${targetUrl}" doesn't look like a URL. Trying as app launch...`);
          return await this.launchApp(targetUrl, null, options);
        }
      }
      
      // Use 'start' command on Windows to open in default browser
      // For Windows, we need to be careful with special characters in URLs
      const cmd = background ? `start /min "" "${targetUrl}"` : `start "" "${targetUrl}"`;
      await execPromise(cmd);
      
      return { success: true, message: `Opened URL: ${targetUrl}` };
    } catch (error) {
      console.error('Open URL error:', error);
      return { success: false, error: error.message };
    }
  }

  async createDoc(filename, content, options = {}) {
    try {
      const { exec } = await import('node:child_process');
      const util = await import('node:util');
      const execPromise = util.promisify(exec);
      const fs = await import('node:fs');
      const path = await import('node:path');
      const os = await import('node:os');

      const targetDir = options.directory || path.join(os.homedir(), 'Documents');
      const docPath = path.join(targetDir, filename || `doc_${Date.now()}.docx`);
      
      // Escape content for PowerShell - ensure it's a string
      const escapedContent = (content || '').replace(/"/g, '`"').replace(/\n/g, '`n');

      // PowerShell Script to create a Word document via COM
      const psScript = `
        try {
          $word = New-Object -ComObject Word.Application
          $word.Visible = $true
          $doc = $word.Documents.Add()
          $selection = $word.Selection
          $selection.TypeText("${escapedContent}")
          $doc.SaveAs("${docPath}")
          Write-Output "SUCCESS"
        } catch {
          Write-Error $_.Exception.Message
        }
      `;

      try {
        const { stdout, stderr } = await execPromise(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);
        if (stdout.includes('SUCCESS')) {
          return { success: true, message: `Word document created and opened: ${docPath}` };
        }
        throw new Error(stderr || 'PowerShell execution failed');
      } catch (psErr) {
        console.warn('[ComputerControl] Word COM failed, falling back to simple file:', psErr.message);
        // Fallback: Just write a text file if Word is not installed/fails
        await fs.promises.writeFile(docPath.replace('.docx', '.txt'), content, 'utf8');
        await this.launcher.launchApp(`notepad "${docPath.replace('.docx', '.txt')}"`);
        return { success: true, message: `Word not available. Created text file instead: ${docPath.replace('.docx', '.txt')}` };
      }
    } catch (error) {
      console.error('Create Doc error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles low-level input events from remote control
   * @param {string} type Event type (mouse-move, click, keydown, keyup)
   * @param {any} data Event data
   */
  async handleRawInput(type, data) {
    try {
      const { width, height } = this.getScreenDimensions();

      switch (type) {
        case 'mouse-move': {
          if (data.x !== undefined && data.y !== undefined) {
             const absX = Math.round(data.x * (width - 1));
             const absY = Math.round(data.y * (height - 1));
             
             // Prevent overlap of movement commands to keep the event loop snappy
             if (this.isMouseMoveInProgress) return;
             
             this.isMouseMoveInProgress = true;
             try {
               await mouse.setPosition(new Point(absX, absY));
             } finally {
               this.isMouseMoveInProgress = false;
             }
          }
          break;
        }
        case 'click': {
          if (data.x !== undefined && data.y !== undefined) {
             const absX = Math.round(data.x * (width - 1));
             const absY = Math.round(data.y * (height - 1));
             await mouse.setPosition(new Point(absX, absY));
          }
          const btn = data.button === 'right' ? Button.RIGHT : Button.LEFT;
          await mouse.click(btn);
          break;
        }
        case 'mouse-down': {
          if (data.x !== undefined && data.y !== undefined) {
             const absX = Math.round(data.x * (width - 1));
             const absY = Math.round(data.y * (height - 1));
             await mouse.setPosition(new Point(absX, absY));
          }
          const btn = data.button === 'right' ? Button.RIGHT : Button.LEFT;
          await mouse.pressButton(btn);
          break;
        }
        case 'mouse-up': {
          if (data.x !== undefined && data.y !== undefined) {
             const absX = Math.round(data.x * (width - 1));
             const absY = Math.round(data.y * (height - 1));
             await mouse.setPosition(new Point(absX, absY));
          }
          const btn = data.button === 'right' ? Button.RIGHT : Button.LEFT;
          await mouse.releaseButton(btn);
          break;
        }
        case 'mouse-wheel': {
          if (data.deltaY > 0) await mouse.scrollDown(Math.max(1, Math.ceil(Math.abs(data.deltaY) / 120)));
          else if (data.deltaY < 0) await mouse.scrollUp(Math.max(1, Math.ceil(Math.abs(data.deltaY) / 120)));
          
          if (data.deltaX > 0) await mouse.scrollRight(Math.max(1, Math.ceil(Math.abs(data.deltaX) / 120)));
          else if (data.deltaX < 0) await mouse.scrollLeft(Math.max(1, Math.ceil(Math.abs(data.deltaX) / 120)));
          break;
        }
        case 'keydown':
          await this.keyPress(data.key, data.modifiers || []);
          break;
        case 'keyup':
          break;
      }
    } catch (error) {
      console.error('[ComputerControl] Raw input error:', error);
    }
  }
}

