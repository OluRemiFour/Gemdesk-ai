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
}
