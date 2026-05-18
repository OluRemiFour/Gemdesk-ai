import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '..', 'dist-electron');

async function killProcesses() {
  const { exec } = await import('node:child_process');
  const util = await import('node:util');
  const execPromise = util.promisify(exec);
  
  const processes = ['GemDesk.exe', 'GemDesk Setup*.exe'];
  
  console.log('Checking for running GemDesk processes...');
  for (const proc of processes) {
    try {
      if (process.platform === 'win32') {
        await execPromise(`taskkill /F /IM "${proc}" /T`);
        console.log(`Killed ${proc} successfully.`);
      }
    } catch (err) {
      // Ignore errors (process not running)
    }
  }
}

async function cleanWithRetry(maxRetries = 3, delay = 1000) {
  await killProcesses();
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(distPath)) {
        console.log(`Attempting to remove ${distPath}...`);
        fs.rmSync(distPath, { recursive: true, force: true });
        console.log('Successfully removed dist-electron directory');
        return;
      } else {
        console.log('dist-electron directory does not exist, nothing to clean');
        return;
      }
    } catch (err) {
      if ((err.code === 'EPERM' || err.code === 'EBUSY') && i < maxRetries - 1) {
        console.log(`File locked or permission denied. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
}

cleanWithRetry().catch(err => {
  console.error('Failed to clean dist-electron:', err);
  process.exit(1);
});
