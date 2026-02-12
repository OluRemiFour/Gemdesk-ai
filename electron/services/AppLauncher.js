import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import util from 'util';

const execPromise = util.promisify(exec);

export class AppLauncher {
    constructor() {
        this.customApps = new Map();
        this.commonApps = this.getPlatformApps();
    }

    getPlatformApps() {
        const platform = os.platform();
        if (platform === 'win32') {
            return {
                // Browsers
                'chrome': [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
                ],
                'google chrome': [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
                ],
                'firefox': [
                    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
                    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
                ],
                'edge': [
                    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
                ],
                'microsoft edge': [
                    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
                ],
                'brave': [
                    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
                ],
                // Text Editors
                'notepad': ['notepad.exe'], // System path
                'vscode': [
                    path.join(process.env.LOCALAPPDATA || '', 'Programs\\Microsoft VS Code\\Code.exe'),
                    'C:\\Program Files\\Microsoft VS Code\\Code.exe'
                ],
                'sublime': [
                    'C:\\Program Files\\Sublime Text 3\\sublime_text.exe'
                ],
                // Office
                'word': ['WINWORD.EXE', 'start winword'], 
                'excel': ['EXCEL.EXE', 'start excel'],
                'powerpoint': ['POWERPNT.EXE', 'start powerpnt'],
                // Utilities
                'calculator': ['calc.exe'],
                'calc': ['calc.exe'],
                'paint': ['mspaint.exe'],
                'taskmanager': ['taskmgr.exe'],
                'explorer': ['explorer.exe'],
                'whatsapp': [
                    path.join(process.env.LOCALAPPDATA || '', 'WhatsApp\\WhatsApp.exe'),
                    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'WindowsApps\\WhatsApp*\\WhatsApp.exe'),
                    'shell:AppsFolder\\5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App' 
                ],
                'postman': [
                    path.join(process.env.LOCALAPPDATA || '', 'Postman\\Postman.exe'),
                    path.join(process.env.LOCALAPPDATA || '', 'Postman\\app-11.81.4\\Postman.exe')
                ]
            };
        }
        return {};
    }

    registerApp(name, path) {
        this.customApps.set(name.toLowerCase(), path);
    }

    getAvailableApps() {
        return Object.keys(this.commonApps).concat(Array.from(this.customApps.keys()));
    }

    async launchApp(appName) {
        if (!appName) return { success: false, error: 'App name is required' };
        
        const name = appName.toLowerCase().trim();
        
        // 1. Check custom apps
        if (this.customApps.has(name)) {
            return this.execute(this.customApps.get(name));
        }

        // 2. Check common apps map
        const candidates = this.commonApps[name];
        if (candidates) {
            for (const candidate of candidates) {
                // Handle special commands or shell: paths
                if (candidate.startsWith('start ') || candidate.startsWith('shell:')) {
                     try {
                        await this.execute(candidate);
                        return { success: true, message: `Launched ${name}` };
                     } catch (e) {
                         console.log(`Failed to launch ${candidate}:`, e.message);
                         continue;
                     }
                }
                
                // Handle file paths
                if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
                    return this.execute(candidate);
                } else if (!path.isAbsolute(candidate)) {
                    // Start relative/system commands
                     try {
                        await this.execute(candidate);
                        return { success: true, message: `Launched ${name}` };
                     } catch (e) {
                         continue;
                     }
                }
            }
        }

        // 3. Try to execute directly (if it's in PATH)
        try {
            await this.execute(name);
            return { success: true, message: `Launched ${name} from system PATH` };
        } catch (e) {
            // ignore
        }
        
        // 4. Fallback: 'start' command for windows (handles file associations and some registered apps)
        if (os.platform() === 'win32') {
             try {
                // use start command to let windows handle it
                await execPromise(`start "" "${name}"`);
                return { success: true, message: `Launched ${name} via 'start' command` };
            } catch (e) {
                return { success: false, error: `Could not launch '${name}'. App not found.` };
            }
        }

        return { success: false, error: `App '${name}' not found.` };
    }

    async execute(commandPath) {
        // Handle shell:AppsFolder or start commands
        if (commandPath.startsWith('shell:') || commandPath.startsWith('start ')) {
             const cmd = commandPath.startsWith('start ') ? commandPath : `start ${commandPath}`;
             await execPromise(cmd);
             return { success: true, message: `Executed ${commandPath}` };
        }
        
        // Handle executables
        return new Promise((resolve, reject) => {
             const subprocess = spawn(commandPath, [], {
                 detached: true,
                 stdio: 'ignore'
             });
             
             subprocess.on('error', (err) => {
                 reject(err);
             });

             subprocess.unref(); 
             
             if (subprocess.pid) {
                 resolve({ success: true, message: `Launched ${commandPath}` });
             } else {
                 reject(new Error("Failed to spawn process"));
             }
        });
    }
}
