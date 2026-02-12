import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCheck, Copy, Loader2, QrCode, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import ActiveSession from './ActiveSession';

const SOCKET_URL = import.meta.env.VITE_SIGNALING_SERVER || 'http://localhost:3001';

interface CreateSessionProps {
  onBack: () => void;
}

function CreateSession({ onBack }: CreateSessionProps) {
  const [sessionId, setSessionId] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [connectionRequest, setConnectionRequest] = useState<{
    requesterId: string;
    requesterName: string;
  } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Generate session ID
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    setSessionId(id);

    newSocket.emit('create-session', id);

    newSocket.on('connection-request', ({ viewerId }) => {
      setConnectionRequest({
        requesterId: viewerId,
        requesterName: 'Remote Developer'
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAcceptConnection = async () => {
    if (!socket || !connectionRequest) return;

    try {
      // Get screen capture source from Electron
      // @ts-ignore
      const sources = await window.electron.getSources();
      const source = sources[0]; // Just take the first one (screen) for now

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          //@ts-ignore
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
          }
        }
      } as any);

      setStream(mediaStream);
      socket.emit('approve-request', { 
        sessionId, 
        viewerId: connectionRequest.requesterId, 
        approved: true 
      });
      
      setConnectionRequest(null);
      setWaiting(false);
      setSessionActive(true);
    } catch (err) {
      console.error('Error capturing screen:', err);
    }
  };

  const handleDenyConnection = () => {
    setConnectionRequest(null);
    setWaiting(true);
  };

  if (sessionActive) {
    return (
      <ActiveSession 
        onEnd={onBack} 
        isHost={true} 
        sessionId={sessionId} 
        socket={socket} 
        stream={stream} 
      />
    );
  }

  return (
    <div className="w-screen h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Create Session</h1>
            <p className="text-xs text-muted-foreground">Share this ID to allow remote access</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Session ID Display */}
          <div className="bg-card border border-border p-8 mb-6">
            <div className="text-center mb-6">
              <label className="block text-sm text-muted-foreground mb-3 uppercase tracking-wider">
                Session ID
              </label>
              <div className="flex items-center justify-center gap-4">
                <div className="font-mono text-4xl font-bold tracking-[0.5em] text-foreground">
                  {sessionId}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* QR Code Placeholder */}
            <div className="flex justify-center mb-6">
              <div className="w-48 h-48 bg-muted border border-border flex items-center justify-center">
                <QrCode className="w-16 h-16 text-muted-foreground" />
              </div>
            </div>

            {/* Status */}
            <div className="bg-muted/30 border border-border p-4">
              <div className="flex items-center gap-3">
                {waiting && !connectionRequest && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Waiting for connection...</div>
                      <div className="text-xs text-muted-foreground">
                        Session will expire in 23:45:12
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Connection Request */}
          {connectionRequest && (
            <div className="bg-card border border-border p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-foreground/10 border border-border flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">Connection Request</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    <span className="font-medium text-foreground">{connectionRequest.requesterName}</span> wants to connect to your computer
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={handleAcceptConnection} className="gap-2">
                      <UserCheck className="w-4 h-4" />
                      Accept
                    </Button>
                    <Button variant="outline" onClick={handleDenyConnection}>
                      Deny
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          {waiting && !connectionRequest && (
            <div className="bg-muted/30 border border-border p-4">
              <h3 className="text-sm font-medium mb-2">How it works</h3>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Share the session ID with the person you want to grant access</li>
                <li>They will enter this ID in their GemDesk client</li>
                <li>You'll receive a connection request to approve or deny</li>
                <li>Once approved, they can view and control your desktop</li>
              </ol>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default CreateSession;
