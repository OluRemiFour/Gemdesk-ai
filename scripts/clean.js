import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '..', 'dist-electron');

async function cleanWithRetry(maxRetries = 3, delay = 1000) {
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
      if (err.code === 'EPERM' && i < maxRetries - 1) {
        console.log(`Permission denied. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
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
