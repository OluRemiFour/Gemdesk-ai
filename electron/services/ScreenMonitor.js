import { desktopCapturer } from 'electron';

export class ScreenMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.intervalMs = 3000; 
    this.lastScreenshot = null;
  }

  setWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  async start(interval = 3000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.intervalMs = interval;
    
    console.log('[ScreenMonitor] Started monitoring');
    
    // Immediate first capture
    await this.captureAndSend();
    
    this.monitorInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.captureAndSend();
      }
    }, this.intervalMs);
  }

  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    console.log('[ScreenMonitor] Stopped monitoring');
  }

  async captureAndSend() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        this.stop();
        return;
      }

      const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { width: 1920, height: 1080 } 
      });

      if (sources.length > 0) {
        const screenshot = sources[0].thumbnail.toDataURL();
        this.lastScreenshot = screenshot; // Cache for other services
        
        // Send to renderer
        this.mainWindow.webContents.send('session-event', 'screen-update', {
          screenshot,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('[ScreenMonitor] Capture error:', error);
    }
  }

  getLastScreenshot() {
    return this.lastScreenshot;
  }
}
