
// Wrapper for @nut-tree-fork/nut-js to handle computer control safely
import { mouse, keyboard, Point, Button, Key } from '@nut-tree-fork/nut-js';

// Configure nut.js
mouse.config.autoDelayMs = 10;
keyboard.config.autoDelayMs = 10;

import { AppLauncher } from './AppLauncher.js';

export class ComputerControl {
  constructor() {
    this.isProcessing = false;
    this.launcher = new AppLauncher();
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
      
      // 2. Wait for Start Menu to open (brief delay)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 3. Type the application name
      await keyboard.type(appName);
      
      // 4. Wait for search results
      await new Promise(resolve => setTimeout(resolve, 1200));
      
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

    // If appName contains a space and the second part looks like a URL, split it
    let finalApp = appName;
    let finalArgs = [];
    const parts = appName.split(/\s+/);
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.') && (lastPart.startsWith('http') || !lastPart.includes(':'))) {
            finalApp = parts.slice(0, -1).join(' ');
            finalArgs = [lastPart];
        }
    }

    if (url) {
        finalArgs.push(url);
    }

    // Standard app launch via launcher
    const launchResult = await this.launcher.launchApp(finalApp, finalArgs, options);
    
    // Fallback logic: If programmatic launch fails, try Start Menu Search (very reliable on Windows)
    if (!launchResult.success && os.platform() === 'win32') {
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
      
      // Ensure URL has protocol
      let targetUrl = url;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.includes('://')) {
        targetUrl = 'https://' + targetUrl;
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

  async createDoc(filename, content) {
    try {
      const { exec } = await import('node:child_process');
      const util = await import('node:util');
      const execPromise = util.promisify(exec);
      const fs = await import('node:fs');
      const path = await import('node:path');
      const os = await import('node:os');

      const docPath = path.join(os.homedir(), 'Documents', filename || `doc_${Date.now()}.docx`);
      // Escape content for PowerShell - ensure it's a string

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
      const { screen } = await import('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.bounds;

      switch (type) {
        case 'mouse-move': {
          if (data.x !== undefined && data.y !== undefined) {
             const absX = Math.round(data.x * width);
             const absY = Math.round(data.y * height);
             await mouse.setPosition(new Point(absX, absY));
          }
          break;
        }
        case 'click': {
          if (data.x !== undefined && data.y !== undefined) {
             const absX = Math.round(data.x * width);
             const absY = Math.round(data.y * height);
             await mouse.setPosition(new Point(absX, absY));
          }
          const btn = data.button === 'right' ? Button.RIGHT : Button.LEFT;
          await mouse.click(btn);
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

