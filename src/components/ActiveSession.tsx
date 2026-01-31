import { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2, Settings, Activity, MonitorOff, MousePointer, Keyboard, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface ActiveSessionProps {
  onEnd: () => void;
  isHost: boolean;
}

function ActiveSession({ onEnd, isHost }: ActiveSessionProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState([75]);
  const [controlEnabled, setControlEnabled] = useState(true);
  const [fps, setFps] = useState(30);
  const [latency, setLatency] = useState(45);
  const [bandwidth, setBandwidth] = useState(2.4);

  useEffect(() => {
    // Simulate changing stats
    const interval = setInterval(() => {
      setFps(Math.floor(28 + Math.random() * 4));
      setLatency(Math.floor(40 + Math.random() * 20));
      setBandwidth(2.0 + Math.random() * 1.0);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleEndSession = () => {
    if (confirm('Are you sure you want to end this session?')) {
      onEnd();
    }
  };

  return (
    <div className="w-screen h-screen bg-black flex flex-col">
      {/* Top Bar */}
      <div className="bg-background/95 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {isHost ? 'Sharing Your Desktop' : 'Connected to Remote Desktop'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground border-l border-border pl-4">
            Session ID: <span className="font-mono">ABC12345</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mr-4">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              <span>{fps} FPS</span>
            </div>
            <div className="border-l border-border pl-4">{latency}ms</div>
            <div className="border-l border-border pl-4">{bandwidth.toFixed(1)} MB/s</div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleEndSession}
            className="text-destructive hover:text-destructive gap-2"
          >
            <X className="w-4 h-4" />
            End
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex relative">
        {/* Remote Desktop View */}
        <div className="flex-1 flex items-center justify-center bg-black">
          <div className="w-full h-full bg-gradient-to-br from-muted/10 to-background/20 flex items-center justify-center border border-border/20">
            <div className="text-center">
              <MonitorOff className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Remote desktop stream would appear here</p>
              <p className="text-xs text-muted-foreground/60 mt-2">Resolution: 1920x1080 • 16:9</p>
            </div>
          </div>
        </div>

        {/* Settings Sidebar */}
        {showSettings && (
          <div className="w-80 bg-background border-l border-border flex flex-col animate-in slide-in-from-right duration-200">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold text-sm">Session Settings</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Quality Settings */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
                  Stream Quality
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Quality</span>
                    <span className="text-muted-foreground">{quality[0]}%</span>
                  </div>
                  <Slider
                    value={quality}
                    onValueChange={setQuality}
                    min={25}
                    max={100}
                    step={25}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                    <span>Ultra</span>
                  </div>
                </div>
              </div>

              {/* Control Settings */}
              {!isHost && (
                <div className="pt-4 border-t border-border">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
                    Remote Control
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MousePointer className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Mouse Control</span>
                      </div>
                      <Switch checked={controlEnabled} onCheckedChange={setControlEnabled} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Keyboard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Keyboard Control</span>
                      </div>
                      <Switch checked={controlEnabled} onCheckedChange={setControlEnabled} />
                    </div>
                  </div>
                </div>
              )}

              {isHost && (
                <div className="pt-4 border-t border-border">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
                    Permissions
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">View Only Mode</span>
                      </div>
                      <Switch checked={!controlEnabled} onCheckedChange={(v) => setControlEnabled(!v)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Connection Info */}
              <div className="pt-4 border-t border-border">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
                  Connection Info
                </label>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Protocol</span>
                    <span className="font-mono">WebRTC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Encryption</span>
                    <span className="font-mono">AES-256</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Codec</span>
                    <span className="font-mono">H.264</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolution</span>
                    <span className="font-mono">1920x1080</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="bg-background/95 backdrop-blur border-t border-border px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>Duration: 00:04:32</span>
          <span>•</span>
          <span>Data Transferred: 156.8 MB</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-muted-foreground">Connection Stable</span>
        </div>
      </div>
    </div>
  );
}

export default ActiveSession;
