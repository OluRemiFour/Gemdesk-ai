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
                    'code', // Try system PATH first
                    path.join(process.env.LOCALAPPDATA || '', 'Programs\\Microsoft VS Code\\Code.exe'),
                    'C:\\Program Files\\Microsoft VS Code\\Code.exe'
                ],
                'visual studio code': [
                    'code',
                    path.join(process.env.LOCALAPPDATA || '', 'Programs\\Microsoft VS Code\\Code.exe'),
                    'C:\\Program Files\\Microsoft VS Code\\Code.exe'
                ],
                'code': [
                    'code',
                    path.join(process.env.LOCALAPPDATA || '', 'Programs\\Microsoft VS Code\\Code.exe'),
                    'C:\\Program Files\\Microsoft VS Code\\Code.exe'
                ],
                'vsc': [
                    'code',
                    path.join(process.env.LOCALAPPDATA || '', 'Programs\\Microsoft VS Code\\Code.exe'),
                    'C:\\Program Files\\Microsoft VS Code\\Code.exe'
                ],
                'sublime': [
                    'C:\\Program Files\\Sublime Text 3\\sublime_text.exe'
                ],
                // Office
                'word': ['WINWORD.EXE', 'start winword', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE'],
                'microsoft word': ['WINWORD.EXE', 'start winword', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE'],
                'winword': ['WINWORD.EXE', 'start winword'],
                'excel': ['EXCEL.EXE', 'start excel', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE'],
                'microsoft excel': ['EXCEL.EXE', 'start excel', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE'],
                'excel.exe': ['EXCEL.EXE', 'start excel'],
                'powerpoint': ['POWERPNT.EXE', 'start powerpnt', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE'],
                'microsoft powerpoint': ['POWERPNT.EXE', 'start powerpnt', 'C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE'],
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
                ],
                // System Folders
                'documents': [path.join(os.homedir(), 'Documents'), 'shell:Personal'],
                'downloads': [path.join(os.homedir(), 'Downloads'), 'shell:Downloads'],
                'desktop': [path.join(os.homedir(), 'Desktop'), 'shell:Desktop'],
                'pictures': [path.join(os.homedir(), 'Pictures'), 'shell:My Pictures'],
                'videos': [path.join(os.homedir(), 'Videos'), 'shell:My Video'],
                'music': [path.join(os.homedir(), 'Music'), 'shell:My Music'],
                'recycle bin': ['shell:RecycleBinFolder']
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

    async focusWindowByTitle(titlePattern) {
        if (os.platform() !== 'win32') return { success: false, error: 'Only supported on Windows' };
        
        const tryFocus = async () => {
             try {
                // Try finding by process name OR window title
                const psCommand = `powershell "Get-Process | Where-Object {$_.ProcessName -like '*${titlePattern}*' -or $_.MainWindowTitle -like '*${titlePattern}*'} | Select-Object -ExpandProperty Id"`;
                const { stdout } = await execPromise(psCommand);
                const pids = stdout.trim().split(/\r?\n/).filter(Boolean);
                
                if (pids.length === 0) return { success: false };

                const pid = pids[0];
                // Enhanced Win32 focus script:
                // 9 = RESTORE, 5 = SHOW, 3 = MAXIMIZE. We use 9 to restore if minimized.
                const focusCommand = `powershell -Command "
                    $signature = '[DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\"user32.dll\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport(\\"user32.dll\\")] public static extern bool IsIconic(IntPtr hWnd);';
                    $type = Add-Type -MemberDefinition $signature -Name 'Win32' -Namespace 'Win32Functions' -PassThru;
                    $proc = Get-Process -Id ${pid};
                    $handle = $proc.MainWindowHandle;
                    if ($handle -ne [IntPtr]::Zero) {
                        if ($type::IsIconic($handle)) { $type::ShowWindow($handle, 9) } 
                        else { $type::ShowWindow($handle, 5) }
                        $type::SetForegroundWindow($handle)
                    }
                "`;
                await execPromise(focusCommand);
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        };

        console.log(`[AppLauncher] Attempting robust focus: ${titlePattern}`);
        for (let i = 0; i < 2; i++) { // Reduced retries from 4 to 2 for speed
            const result = await tryFocus();
            if (result.success) return { success: true, message: `Focused window: ${titlePattern}` };
            if (i < 1) await new Promise(r => setTimeout(r, 600)); // Reduced delay from 1500 to 600
        }
        
        return { success: false, error: `Window not found or could not be focused: ${titlePattern}` };
    }

    async launchApp(appName, args = [], options = {}) {
        if (!appName) return { success: false, error: 'App name is required' };
        
        const name = appName.trim();
        const background = options.background || false;
        
        // 0. Check if it's an absolute path to a file or folder
        if (path.isAbsolute(name) && fs.existsSync(name)) {
            try {
                if (os.platform() === 'win32') {
                    // Use start /min for background
                    const cmd = background ? `start /min "" "${name}"` : `start "" "${name}"`;
                    await execPromise(cmd);
                } else {
                    return this.execute(name, args, { background });
                }
                return { success: true, message: `Opened path: ${name}` };
            } catch (e) {
                console.error(`Failed to open path ${name}:`, e);
            }
        }

        const nameLower = name.toLowerCase();
        
        // 1. Check custom apps
        if (this.customApps.has(nameLower)) {
            return this.execute(this.customApps.get(nameLower), args, { background });
        }

        // 2. Check common apps map
        const candidates = this.commonApps[nameLower];
        if (candidates) {
            for (const candidate of candidates) {
                // Handle special commands or shell: paths
                if (candidate.startsWith('start ') || candidate.startsWith('shell:')) {
                     try {
                        let finalCmd = candidate;
                        if (background && candidate.startsWith('start ')) {
                            finalCmd = candidate.replace('start ', 'start /min ');
                        }
                        await this.execute(finalCmd, args, { background });
                        return { success: true, message: `Launched ${name}` };
                     } catch (e) {
                        console.log(`Failed to launch ${candidate}:`, e.message);
                        continue;
                     }
                }
                
                // Handle file paths
                if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
                    return this.execute(candidate, args, { background });
                } else if (!path.isAbsolute(candidate)) {
                    // Start relative/system commands
                     try {
                        await this.execute(candidate, args, { background });
                        return { success: true, message: `Launched ${name}` };
                     } catch (e) {
                         continue;
                     }
                }
            }
        }

        // 3. Try to execute directly (if it's in PATH)
        try {
            await this.execute(name, args, { background });
            return { success: true, message: `Launched ${name} from system PATH` };
        } catch (e) {
            // ignore
        }
        
        // 4. Fallback: 'start' command for windows (handles file associations and some registered apps)
        if (os.platform() === 'win32') {
             try {
                // use start command to let windows handle it
                const argsStr = args.length > 0 ? ` ${args.map(a => `"${a}"`).join(' ')}` : '';
                const baseCmd = background ? 'start /min' : 'start';
                await execPromise(`${baseCmd} "" "${name}"${argsStr}`);
                return { success: true, message: `Launched ${name} via 'start' command` };
            } catch (e) {
                return { success: false, error: `Could not launch '${name}'. App not found.` };
            }
        }

        return { success: false, error: `App '${name}' not found.` };
    }

    async execute(commandPath, args = [], options = {}) {
        const background = options.background || false;

        // Handle shell:AppsFolder or start commands
        if (commandPath.startsWith('shell:') || commandPath.startsWith('start ')) {
             const argsStr = args.length > 0 ? ` ${args.map(a => `"${a}"`).join(' ')}` : '';
             let finalCmd;
             if (commandPath.startsWith('start ')) {
                 finalCmd = commandPath;
             } else {
                 finalCmd = `start "" "${commandPath}"`;
             }
             
             if (background && finalCmd.startsWith('start ') && !finalCmd.includes('/min')) {
                 finalCmd = finalCmd.replace('start ', 'start /min ');
             }

             await execPromise(finalCmd + argsStr);
             return { success: true, message: `Executed ${commandPath}` };
        }
        
        // Handle executables
        return new Promise((resolve, reject) => {
             const subprocess = spawn(commandPath, args, {
                 detached: true,
                 stdio: 'ignore',
                 // Windows specific: use shell to support .cmd/.bat scripts and hide window if needed
                 shell: os.platform() === 'win32',
                 windowsHide: background 
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
