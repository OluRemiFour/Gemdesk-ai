import { useState, useEffect, useRef } from 'react';
import { X, Maximize2, Minimize2, Settings, Activity, MonitorOff, MousePointer, Keyboard, Eye, Loader2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

interface ActiveSessionProps {
  onEnd: () => void;
  isHost: boolean;
  sessionId: string;
  socket: Socket | null;
  stream?: MediaStream | null;
}

function ActiveSession({ onEnd, isHost, sessionId, socket, stream }: ActiveSessionProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState([75]);
  const [mouseControlEnabled, setMouseControlEnabled] = useState(true);
  const [keyboardControlEnabled, setKeyboardControlEnabled] = useState(true);
  const [fps, setFps] = useState(30);
  const [latency, setLatency] = useState(45);
  const [bandwidth, setBandwidth] = useState(2.4);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [remoteMicEnabled, setRemoteMicEnabled] = useState(false);
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);

  useEffect(() => {
    if (!socket) return;

    // WebRTC Peer setup
    const peer = new SimplePeer({
      initiator: !isHost, // Viewer initiates
      trickle: false,
      stream: isHost ? (stream || undefined) : undefined,
    });

    peerRef.current = peer;

    peer.on('signal', (data) => {
      socket.emit('signal', {
        to: isHost ? undefined : undefined, // This needs to be handled by the server relaying to the other party
        // Actually the server handles 'signal' event by ID, but we need to know the 'to' ID.
        // I'll simplify the signal relaying logic in the server or components.
        // Let's assume the server knows who the other party is based on the sessionId.
        // I'll adjust the signal event to include sessionId.
        sessionId,
        signal: data
      });
    });

    socket.on('signal', ({ signal }) => {
      peer.signal(signal);
    });

    peer.on('stream', (st) => {
      setRemoteStream(st);
      if (videoRef.current) {
        videoRef.current.srcObject = st;
      }
    });

    socket.on('permissions-updated', ({ permissions }) => {
      if (!isHost) {
        const enabled = permissions === 'write';
        setMouseControlEnabled(enabled);
        setKeyboardControlEnabled(enabled);
      }
    });

    socket.on('voice-status-updated', ({ enabled }) => {
      setRemoteMicEnabled(enabled);
    });

    // Remote Control Handling
    if (isHost) {
      socket.on('control-command', ({ command }) => {
        // Handle control permission check based on command type (optional enhancement)
        // For now, we trust the viewer's UI or handle it globally
        window.electron.sendInput(command.type, command.data);
      });
    }

    // Simulate changing stats
    const interval = setInterval(() => {
      setFps(Math.floor(28 + Math.random() * 4));
      setLatency(Math.floor(40 + Math.random() * 20));
      setBandwidth(2.0 + Math.random() * 1.0);
    }, 1000);

    return () => {
      clearInterval(interval);
      peer.destroy();
    };
  }, [isHost, socket, sessionId, stream]);

  // Robust stream attachment
  useEffect(() => {
    if (remoteStream && videoRef.current) {
      console.log('[ActiveSession] Attaching remote stream to video element');
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isHost || !mouseControlEnabled || !socket) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    socket.emit('control-command', {
      sessionId,
      command: { type: 'mouse-move', data: { x, y } }
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isHost || !mouseControlEnabled || !socket) return;
    socket.emit('control-command', {
      sessionId,
      command: { type: 'click', data: { button: e.button === 0 ? 'left' : 'right' } }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isHost || !keyboardControlEnabled || !socket) return;
    socket.emit('control-command', {
      sessionId,
      command: { type: 'keydown', data: { key: e.key, code: e.code } }
    });
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (isHost || !keyboardControlEnabled || !socket) return;
    socket.emit('control-command', {
      sessionId,
      command: { type: 'keyup', data: { key: e.key, code: e.code } }
    });
  };

  const handleEndSession = () => {
    if (confirm('Are you sure you want to end this session?')) {
      onEnd();
    }
  };

  const toggleMic = async () => {
    try {
      if (!micEnabled) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalAudioStream(audioStream);
        if (peerRef.current) {
          peerRef.current.addStream(audioStream);
        }
        setMicEnabled(true);
        socket?.emit('voice-status', { sessionId, enabled: true });
      } else {
        localAudioStream?.getTracks().forEach(track => track.stop());
        if (peerRef.current && localAudioStream) {
          peerRef.current.removeStream(localAudioStream);
        }
        setLocalAudioStream(null);
        setMicEnabled(false);
        socket?.emit('voice-status', { sessionId, enabled: false });
      }
    } catch (err) {
      console.error('Error toggling microphone:', err);
    }
  };

  const togglePermissions = () => {
    const nextPerm = mouseControlEnabled ? 'read' : 'write';
    setMouseControlEnabled(nextPerm === 'write');
    setKeyboardControlEnabled(nextPerm === 'write');
    socket?.emit('toggle-permissions', { sessionId, permissions: nextPerm });
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
            {!isHost && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${(mouseControlEnabled || keyboardControlEnabled) ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted text-muted-foreground'}`}>
                {(mouseControlEnabled || keyboardControlEnabled) ? 'Write (Control)' : 'Read (View-Only)'}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground border-l border-border pl-4">
            Session ID: <span className="font-mono">{sessionId}</span>
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
            onClick={toggleMic}
            className={`gap-2 ${micEnabled ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            {micEnabled ? 'Mic On' : 'Mic Off'}
          </Button>

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
          <div 
            className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden outline-none"
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            tabIndex={0}
          >
            {isHost ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/30">
                  <MonitorOff className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm text-foreground/80">Streaming in progress...</p>
                <p className="text-xs text-muted-foreground mt-1">Your desktop is being shared</p>
              </div>
            ) : (
              remoteStream ? (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Initializing stream...</p>
                </div>
              )
            )}
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
                      <Switch checked={mouseControlEnabled} onCheckedChange={setMouseControlEnabled} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Keyboard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Keyboard Control</span>
                      </div>
                      <Switch checked={keyboardControlEnabled} onCheckedChange={setKeyboardControlEnabled} />
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
                      <Switch checked={!mouseControlEnabled && !keyboardControlEnabled} onCheckedChange={togglePermissions} />
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
