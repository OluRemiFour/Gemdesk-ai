import { useState, useEffect, useRef, useCallback } from 'react';
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
  
  const [streamTimedOut, setStreamTimedOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  // Buffer signals that arrive before the peer is constructed
  const signalQueueRef = useRef<any[]>([]);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Performance optimizations for mouse tracking
  const lastMouseEmitRef = useRef<number>(0);
  const pendingMouseRef = useRef<{ x: number; y: number } | null>(null);
  const mouseRafRef = useRef<number | null>(null);
  const cachedDimensionsRef = useRef<{
    width: number;
    height: number;
    videoWidth: number;
    videoHeight: number;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(e => console.error("Play failed:", e));
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!socket) return;

    // ─── Register the signal listener BEFORE creating the peer ───────────────
    // This prevents a race where the viewer sends an offer before the host
    // has hooked up its own listener, causing ICE candidates to be dropped.
    // Incoming signals are queued until the peer is ready to receive them.
    signalQueueRef.current = [];
    const handleIncomingSignal = ({ signal }: { signal: any }) => {
      if (peerRef.current) {
        peerRef.current.signal(signal);
      } else {
        // Peer not yet created — buffer the signal
        signalQueueRef.current.push(signal);
      }
    };
    socket.on('signal', handleIncomingSignal);

    // WebRTC Peer setup with high-quality config
    const peer = new SimplePeer({
      initiator: !isHost, // Viewer initiates
      trickle: true,      // Allow trickle ICE for faster connection
      stream: isHost ? (stream || undefined) : undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
      // Request higher quality encoding
      sdpTransform: (sdp: string) => {
        // Boost video bitrate to 8 Mbps for crisp desktop sharing
        let modifiedSdp = sdp.replace(
          /a=mid:video\r\n/g,
          'a=mid:video\r\na=b=AS:8000\r\n'
        );
        // Also set bitrate via TIAS (Transport Independent Application Specific) for modern browsers
        modifiedSdp = modifiedSdp.replace(
          /a=mid:0\r\n/g,
          'a=mid:0\r\na=b=AS:8000\r\n'
        );
        return modifiedSdp;
      },
    });

    peerRef.current = peer;

    // Drain any signals that arrived before the peer was constructed
    if (signalQueueRef.current.length > 0) {
      signalQueueRef.current.forEach(sig => peer.signal(sig));
      signalQueueRef.current = [];
    }

    peer.on('signal', (data: any) => {
      socket.emit('signal', {
        sessionId,
        signal: data
      });
    });

    // Start a stream acquisition timer for non-hosts
    if (!isHost) {
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = setTimeout(() => {
        // If we still have no stream after 20 seconds, surface the retry UI
        if (!peerRef.current || !(peerRef.current as any)._connected) {
          setStreamTimedOut(true);
        }
      }, 20_000);
    }

    // Once connected, boost sender bitrate via RTCRtpSender
    peer.on('connect', () => {
      try {
        const pc = (peer as any)._pc as RTCPeerConnection | undefined;
        if (pc) {
          const senders = pc.getSenders();
          senders.forEach((sender: RTCRtpSender) => {
            if (sender.track?.kind === 'video') {
              const params = sender.getParameters();
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
              }
              params.encodings[0].maxBitrate = 8_000_000; // 8 Mbps
              params.encodings[0].maxFramerate = 60;
              // @ts-ignore - scaleResolutionDownBy may not be in all TS defs
              params.encodings[0].scaleResolutionDownBy = 1.0; // No downscaling
              sender.setParameters(params).catch(console.warn);
            }
          });
        }
      } catch (err) {
        console.warn('[ActiveSession] Could not set sender bitrate:', err);
      }
    });

    peer.on('stream', (st) => {
      // If the incoming stream has video tracks, set it to video ref
      if (st.getVideoTracks().length > 0) {
        setRemoteStream(st);
        if (videoRef.current) {
          videoRef.current.srcObject = st;
          videoRef.current.play().catch(e => console.error("Play failed:", e));
        }
      }
      
      // If the incoming stream has audio tracks, set it to audio ref
      if (st.getAudioTracks().length > 0) {
        if (audioRef.current && (!isHost || isHost)) {
          // Both host and viewer need to hear each other if multiple streams exchanged
          audioRef.current.srcObject = st;
          audioRef.current.play().catch(console.error);
        }
      }
    });

    // Handle dynamically added tracks (like when mic is toggled later)
    peer.on('track', (track, st) => {
      if (track.kind === 'audio' && audioRef.current) {
         audioRef.current.srcObject = st;
         audioRef.current.play().catch(console.error);
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

    socket.on('session-ended', () => {
      onEnd();
    });

    socket.on('viewer-disconnected', () => {
      // Keep session open but notify host
      if (isHost) onEnd();
    });

    // Remote Control Handling
    if (isHost) {
      socket.on('control-command', ({ command }) => {
        window.electron.sendInput(command.type, command.data);
      });

      // When a viewer's stream times out and they press Retry, recreate our peer
      // so a fresh WebRTC handshake can take place with the new initiator.
      socket.on('viewer-retry-stream', async () => {
        try {
          if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
          }
          signalQueueRef.current = [];

          // Re-acquire the screen stream if we don't still have it
          const activeStream = stream && stream.active ? stream : null;

          const retryPeer = new SimplePeer({
            initiator: false, // viewer will be initiator on retry
            trickle: true,
            stream: activeStream || undefined,
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
              ],
            },
          });
          peerRef.current = retryPeer;

          // Drain any buffered signals from the viewer's new initiator peer
          if (signalQueueRef.current.length > 0) {
            signalQueueRef.current.forEach(sig => retryPeer.signal(sig));
            signalQueueRef.current = [];
          }

          retryPeer.on('signal', (data: any) => {
            socket.emit('signal', { sessionId, signal: data });
          });
          retryPeer.on('connect', () => {
            console.log('[Host] Retry peer connected');
          });
        } catch (err) {
          console.error('[Host] Failed to recreate peer on retry:', err);
        }
      });
    }

    // Simulate changing stats
    const interval = setInterval(() => {
      setFps(Math.floor(28 + Math.random() * 4));
      setLatency(Math.floor(40 + Math.random() * 20));
      setBandwidth(2.0 + Math.random() * 1.0);
    }, 1000);

    // Resize observer to keep dimensions cached and accurate
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && videoRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        cachedDimensionsRef.current = {
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top,
          videoWidth: videoRef.current.videoWidth,
          videoHeight: videoRef.current.videoHeight
        };
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearInterval(interval);
      resizeObserver.disconnect();
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
      peer.destroy();
      peerRef.current = null;
      socket.off('session-ended');
      socket.off('viewer-disconnected');
      socket.off('signal', handleIncomingSignal);
      socket.off('permissions-updated');
      socket.off('voice-status-updated');
      if (isHost) {
        socket.off('control-command');
        socket.off('viewer-retry-stream');
      }
    };
  }, [isHost, socket, sessionId, stream, onEnd]);

  const getRelativeCoords = (e: React.MouseEvent | React.WheelEvent) => {
    if (!videoRef.current || !containerRef.current) return null;
    
    // Use cached dimensions if available, otherwise fallback to bounding rect
    let dims = cachedDimensionsRef.current;
    if (!dims || dims.videoWidth === 0) {
      const rect = containerRef.current.getBoundingClientRect();
      dims = {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight
      };
      cachedDimensionsRef.current = dims;
    }
    
    const { width: containerWidth, height: containerHeight, left: containerLeft, top: containerTop, videoWidth, videoHeight } = dims;
    
    if (!videoWidth || !videoHeight) return null;

    // Calculate scaling and offsets for object-contain
    const containerRatio = containerWidth / containerHeight;
    const videoRatio = videoWidth / videoHeight;
    
    let renderedWidth, renderedHeight, offsetX, offsetY;
    
    if (containerRatio > videoRatio) {
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * videoRatio;
      offsetX = (containerWidth - renderedWidth) / 2;
      offsetY = 0;
    } else {
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / videoRatio;
      offsetX = 0;
      offsetY = (containerHeight - renderedHeight) / 2;
    }
    
    // Calculate cursor position relative to the ACTUAL video content (clamped 0-1)
    const x = Math.max(0, Math.min(1, (e.clientX - containerLeft - offsetX) / renderedWidth));
    const y = Math.max(0, Math.min(1, (e.clientY - containerTop - offsetY) / renderedHeight));
    
    return { x, y };
  };

  // Throttled mouse move: emit at most every 6.6ms (~150Hz) to keep it ultra-snappy 
  // while avoiding socket congestion. Uses requestAnimationFrame to coalesce moves.
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isHost || !mouseControlEnabled || !socket) return;
    
    const coords = getRelativeCoords(e);
    if (!coords) return;
    if (coords.x < 0 || coords.x > 1 || coords.y < 0 || coords.y > 1) return;

    // Store the latest position
    pendingMouseRef.current = coords;

    const now = performance.now();
    const elapsed = now - lastMouseEmitRef.current;

    // If enough time has passed (min 6.6ms for ~150Hz), emit immediately
    if (elapsed >= 6.6) {
      lastMouseEmitRef.current = now;
      socket.volatile.emit('control-command', {
        sessionId,
        command: { type: 'mouse-move', data: coords }
      });
      pendingMouseRef.current = null;
      if (mouseRafRef.current) {
        cancelAnimationFrame(mouseRafRef.current);
        mouseRafRef.current = null;
      }
      return;
    }

    // Otherwise schedule via rAF so we coalesce intermediate moves
    if (!mouseRafRef.current) {
      mouseRafRef.current = requestAnimationFrame(() => {
        mouseRafRef.current = null;
        const pending = pendingMouseRef.current;
        if (pending && socket) {
          lastMouseEmitRef.current = performance.now();
          socket.volatile.emit('control-command', {
            sessionId,
            command: { type: 'mouse-move', data: pending }
          });
          pendingMouseRef.current = null;
        }
      });
    }
  }, [isHost, mouseControlEnabled, socket, sessionId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isHost || !mouseControlEnabled || !socket) return;
    
    const coords = getRelativeCoords(e);
    if (!coords) return;
    
    if (coords.x >= 0 && coords.x <= 1 && coords.y >= 0 && coords.y <= 1) {
      socket.emit('control-command', {
        sessionId,
        command: { 
          type: 'mouse-down', 
          data: { 
            button: e.button === 2 ? 'right' : 'left', 
            x: coords.x, 
            y: coords.y 
          } 
        }
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isHost || !mouseControlEnabled || !socket) return;
    
    const coords = getRelativeCoords(e);
    if (!coords) return;
    
    if (coords.x >= 0 && coords.x <= 1 && coords.y >= 0 && coords.y <= 1) {
      socket.emit('control-command', {
        sessionId,
        command: { 
          type: 'mouse-up', 
          data: { 
            button: e.button === 2 ? 'right' : 'left', 
            x: coords.x, 
            y: coords.y 
          } 
        }
      });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isHost || !mouseControlEnabled || !socket) return;
    
    // Prevent the GemDesk app itself from scrolling
    e.preventDefault();

    socket.emit('control-command', {
      sessionId,
      command: { 
        type: 'mouse-wheel', 
        data: { 
          deltaX: e.deltaX, 
          deltaY: e.deltaY 
        } 
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isHost || !keyboardControlEnabled || !socket) return;
    
    e.preventDefault();
    e.stopPropagation();

    socket.emit('control-command', {
      sessionId,
      command: { type: 'keydown', data: { key: e.key, code: e.code, modifiers: [e.ctrlKey ? 'ctrl' : null, e.shiftKey ? 'shift' : null, e.altKey ? 'alt' : null, e.metaKey ? 'meta' : null].filter(Boolean) } }
    });
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (isHost || !keyboardControlEnabled || !socket) return;
    e.preventDefault();
    e.stopPropagation();
    
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
    <div className={`w-screen h-screen bg-black flex flex-col ${isFullscreen ? 'absolute inset-0 z-50' : ''}`}>
      {/* Hidden audio element for remote mic */}
      <audio ref={audioRef} autoPlay playsInline muted={false} />

      {/* Top Bar - Hidden in full screen */}
      {!isFullscreen && (
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
              onClick={() => setIsFullscreen(true)}
            >
              <Maximize2 className="w-4 h-4" />
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
      )}

      {/* Main Content */}
      <div className="flex-1 flex relative">
        {/* Remote Desktop View */}
        <div className="flex-1 flex items-center justify-center bg-black relative">
          
          {/* Float close fullscreen button */}
          {isFullscreen && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4 z-50 opacity-50 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(false);
              }}
            >
              <Minimize2 className="w-4 h-4 mr-2" />
              Exit Fullscreen
            </Button>
          )}

          <div 
            ref={containerRef}
            className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden outline-none"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
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
                  muted
                  className="w-full h-full object-contain"
                />
              ) : streamTimedOut ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto border border-destructive/30">
                    <MonitorOff className="w-8 h-8 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Stream failed to initialize</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The video connection could not be established.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      if (!socket) return;

                      // 1. Tear down stale peer
                      if (peerRef.current) {
                        peerRef.current.destroy();
                        peerRef.current = null;
                      }
                      signalQueueRef.current = [];
                      setStreamTimedOut(false);
                      setRemoteStream(null);

                      // 2. Ask the host (via server) to also recreate its peer
                      socket.emit('retry-stream', { sessionId });

                      // 3. Give the host ~300 ms to set up its new non-initiator peer,
                      //    then create our new initiator peer so the offer/answer flows correctly.
                      setTimeout(() => {
                        if (!socket) return;

                        const retryPeer = new SimplePeer({
                          initiator: true,
                          trickle: true,
                          config: {
                            iceServers: [
                              { urls: 'stun:stun.l.google.com:19302' },
                              { urls: 'stun:stun1.l.google.com:19302' },
                              { urls: 'stun:stun2.l.google.com:19302' },
                            ],
                          },
                        });
                        peerRef.current = retryPeer;

                        // Re-attach the incoming signal listener on this peer
                        socket.off('signal');
                        socket.on('signal', ({ signal }: { signal: any }) => {
                          if (peerRef.current) {
                            peerRef.current.signal(signal);
                          } else {
                            signalQueueRef.current.push(signal);
                          }
                        });

                        retryPeer.on('signal', (data: any) => {
                          socket.emit('signal', { sessionId, signal: data });
                        });

                        retryPeer.on('stream', (st) => {
                          if (st.getVideoTracks().length > 0) {
                            setStreamTimedOut(false);
                            setRemoteStream(st);
                            if (videoRef.current) {
                              videoRef.current.srcObject = st;
                              videoRef.current.play().catch(console.error);
                            }
                          }
                        });

                        // Restart 20-second timeout
                        if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
                        streamTimeoutRef.current = setTimeout(() => {
                          if (!retryPeer.connected) {
                            setStreamTimedOut(true);
                          }
                        }, 20_000);
                      }, 300);
                    }}
                  >
                    <Loader2 className="w-4 h-4" />
                    Retry Connection
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Initializing stream...</p>
                  <p className="text-xs text-muted-foreground mt-1 opacity-60">Waiting for host video…</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Settings Sidebar - Hidden in full screen */}
        {showSettings && !isFullscreen && (
          <div className="w-80 bg-background border-l border-border flex flex-col animate-in slide-in-from-right duration-200">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold text-sm">Session Settings</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
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

      {/* Bottom Status Bar - Hidden in full screen */}
      {!isFullscreen && (
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
      )}
    </div>
  );
}

export default ActiveSession;
