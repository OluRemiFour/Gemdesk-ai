import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export class FileSystemService {
    /**
     * List files in a directory
     */
    async listDirectory(dirPath) {
        try {
            const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
            return {
                success: true,
                files: files.map(file => ({
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    path: path.join(dirPath, file.name)
                }))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Write file content
     */
    async writeFile(filePath, content) {
        try {
            await fs.promises.writeFile(filePath, content, 'utf8');
            return { success: true, message: `Saved to ${filePath}` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Read file content (text only)
     */
    async readFile(filePath) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Rename or move a file
     */
    async moveFile(oldPath, newPath) {
        try {
            // Normalize paths to fix potential slash issues
            const src = path.resolve(oldPath);
            const dst = path.resolve(newPath);

            if (!fs.existsSync(src)) {
                return { success: false, error: `Source path does not exist: ${oldPath}` };
            }

            // Ensure destination directory exists
            const destDir = path.dirname(dst);
            if (!fs.existsSync(destDir)) {
                await fs.promises.mkdir(destDir, { recursive: true });
            }

            await fs.promises.rename(src, dst);
            return { success: true, message: `Moved/Renamed ${oldPath} to ${newPath}` };
        } catch (error) {
            console.error('File move error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a file permanently (Use with caution)
     */
    async deleteFile(filePath) {
        try {
            await fs.promises.unlink(filePath);
            return { success: true, message: `Deleted ${filePath}` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get Recycle Bin items (Windows specific)
     */
    async getRecycleBinItems() {
        if (process.platform !== 'win32') {
            return { success: false, error: 'Recycle Bin operations only supported on Windows' };
        }

        try {
            // Using PowerShell to get recycle bin items
            const command = `powershell -Command "Get-ChildItem -Path 'shell:RecycleBinFolder' | Select-Object Name, LastWriteTime, Length, FullName | ConvertTo-Json"`;
            const { stdout } = await execPromise(command);
            
            if (!stdout || stdout.trim() === '') return { success: true, items: [] };

            const items = JSON.parse(stdout);
            const normalizedItems = Array.isArray(items) ? items : [items];

            return {
                success: true,
                items: normalizedItems.map(item => ({
                    name: item.Name,
                    deletedDate: item.LastWriteTime,
                    size: item.Length,
                    originalPath: item.FullName
                }))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Clean Recycle Bin by date (Windows specific)
     */
    async cleanRecycleBin(daysOlderThan) {
        if (process.platform !== 'win32') {
            return { success: false, error: 'Recycle Bin operations only supported on Windows' };
        }

        try {
            const command = `powershell -Command "$limit = (Get-Date).AddDays(-${daysOlderThan}); Get-ChildItem -Path 'shell:RecycleBinFolder' | Where-Object { $_.LastWriteTime -lt $limit } | Remove-Item -Recurse -Force"`;
            await execPromise(command);
            return { success: true, message: `Cleaned items older than ${daysOlderThan} days from Recycle Bin` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a folder with intelligent path resolution
     */
    async createFolder(folderPath) {
        if (!folderPath) return { success: false, error: 'Folder path is required' };

        let absolutePath = folderPath;
        const os = await import('os');
        const home = os.homedir();

        // 1. Resolve relative paths
        if (!path.isAbsolute(folderPath)) {
            const lowerPath = folderPath.toLowerCase();
            if (lowerPath === 'desktop' || lowerPath.startsWith('desktop')) {
                const subPath = folderPath.length > 7 ? folderPath.substring(7).replace(/^[\\/]+/, '') : '';
                // If only "Desktop" was provided, or no subfolder name, default to "New Folder"
                const folderName = subPath || 'New Folder';
                absolutePath = path.join(home, 'Desktop', folderName);
            } else if (lowerPath === 'documents' || lowerPath.startsWith('documents')) {
                const subPath = folderPath.length > 9 ? folderPath.substring(9).replace(/^[\\/]+/, '') : '';
                const folderName = subPath || 'New Folder';
                absolutePath = path.join(home, 'Documents', folderName);
            } else {
                // Default to Desktop with the provided name
                absolutePath = path.join(home, 'Desktop', folderPath);
            }
        }

        // 2. Handle collisions (e.g., "New Folder (1)")
        let finalPath = absolutePath;
        let counter = 1;
        while (fs.existsSync(finalPath)) {
            // If it's the exact path requested and it's NOT a default "New Folder", maybe they just wanted to ensure it exists?
            // But usually for "create-folder" we want a NEW one.
            const ext = path.extname(absolutePath);
            const base = absolutePath.substring(0, absolutePath.length - ext.length);
            finalPath = `${base} (${counter})${ext}`;
            counter++;
            if (counter > 100) break; // Safety
        }

        console.log(`[FileSystemService] Creating folder at: ${finalPath}`);

        try {
            await fs.promises.mkdir(finalPath, { recursive: true });
            return { success: true, message: `Folder created: ${finalPath}`, path: finalPath };
        } catch (err) {
            if (process.platform === 'win32') {
                try {
                    await execPromise(`powershell -Command "New-Item -ItemType Directory -Force -Path '${finalPath}'"`);
                    return { success: true, message: `Folder created via PowerShell: ${finalPath}`, path: finalPath };
                } catch (psErr) {
                    return { success: false, error: psErr.message };
                }
            }
            return { success: false, error: err.message };
        }
    }
}
