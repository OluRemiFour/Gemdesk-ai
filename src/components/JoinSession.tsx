import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ActiveSession from './ActiveSession';
import { io, Socket } from 'socket.io-client';

import { ChatService } from '@/services/ChatService';

const SOCKET_URL = import.meta.env.VITE_SIGNALING_SERVER || 'http://localhost:3001';

interface JoinSessionProps {
  onBack: () => void;
}

function JoinSession({ onBack }: JoinSessionProps) {
  const [sessionId, setSessionId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [sessionActive]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('request-approved', async ({ hostId }) => {
      setWaitingApproval(false);
      
      // Save session to history
      await ChatService.createChat(`Remote Session: ${sessionId}`);
      
      setSessionActive(true);
    });

    newSocket.on('request-denied', () => {
      setWaitingApproval(false);
      setError('Connection was denied by the host');
      setIsConnecting(false);
    });

    newSocket.on('error', (msg) => {
      setError(msg);
      setIsConnecting(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleConnect = async () => {
    if (sessionId.trim().length < 6 || !socket) {
      setError('Please enter a valid session ID');
      return;
    }

    setError(null);
    setIsConnecting(true);
    socket.emit('join-session', sessionId.trim());
  };

  const handleCancel = () => {
    setIsConnecting(false);
    setWaitingApproval(false);
    setError(null);
    setSessionId('');
    if (socket) {
      socket.disconnect();
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);
      
      newSocket.on('request-approved', ({ hostId }) => {
        setWaitingApproval(false);
        setSessionActive(true);
      });

      newSocket.on('request-denied', () => {
        setWaitingApproval(false);
        setError('Connection was denied by the host');
        setIsConnecting(false);
      });

      newSocket.on('error', (msg) => {
        setError(msg);
        setIsConnecting(false);
      });
    }
  };

  const handleBack = () => {
    setSessionActive(false);
    handleCancel();
    onBack();
  };

  if (sessionActive) {
    return (
      <ActiveSession 
        onEnd={handleBack} 
        isHost={false} 
        sessionId={sessionId} 
        socket={socket} 
      />
    );
  }

  return (
    <div className="w-screen h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { handleCancel(); onBack(); }} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Join Session</h1>
            <p className="text-xs text-muted-foreground">Enter a session ID to connect</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="bg-card border border-border p-8">
            {/* Input Section */}
            <div className="mb-6">
              <label className="block text-sm text-muted-foreground mb-3 uppercase tracking-wider">
                Session ID
              </label>
              <Input
                ref={inputRef}
                autoFocus
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value.trim().toUpperCase())}
                placeholder="XXXXXXXX"
                className="text-center font-mono text-2xl tracking-[0.3em] h-16 uppercase"
                maxLength={8}
                disabled={isConnecting || waitingApproval}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConnect();
                  }
                }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-destructive/10 border border-destructive/20 p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-destructive">{error}</div>
                </div>
              </div>
            )}

            {/* Status Messages */}
            {isConnecting && (
              <div className="mb-6 bg-muted/30 border border-border p-4 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <div className="text-sm">Connecting to session...</div>
              </div>
            )}

            {waitingApproval && (
              <div className="mb-6 bg-muted/30 border border-border p-4 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Waiting for approval...</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    The host needs to approve your connection request
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {!isConnecting && !waitingApproval ? (
                <>
                  <Button
                    onClick={handleConnect}
                    disabled={sessionId.trim().length < 6}
                    className="flex-1"
                  >
                    Connect
                  </Button>
                  <Button variant="outline" onClick={() => { handleCancel(); onBack(); }}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={handleCancel} className="flex-1">
                  Cancel Connection
                </Button>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 bg-muted/30 border border-border p-4">
            <h3 className="text-sm font-medium mb-2">Quick Tips</h3>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Session IDs are 8 characters long and case-insensitive</li>
              <li>The host must approve your connection before you can access their desktop</li>
              <li>You can paste the session ID directly into the input field</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default JoinSession;
