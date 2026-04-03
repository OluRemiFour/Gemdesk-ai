import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Monitor, UserPlus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatService, Chat } from '@/services/ChatService';

interface SessionHistoryProps {
  onBack: () => void;
}

function SessionHistory({ onBack }: SessionHistoryProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    setLoading(true);
    const data = await ChatService.getChats();
    setChats(data);
    setLoading(false);
  };

  const handleDeleteChat = async (id: string) => {
    if (confirm('Are you sure you want to delete this session?')) {
      await ChatService.deleteChat(id);
      loadChats();
    }
  };

  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      setClearing(true);
      for (const chat of chats) {
        await ChatService.deleteChat(chat._id);
      }
      await loadChats();
      setClearing(false);
    }
  };

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
            <h1 className="text-lg font-semibold">Session History</h1>
            <p className="text-xs text-muted-foreground">Review past interactions and sessions</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 text-destructive hover:bg-destructive/10"
            onClick={handleClearAll}
            disabled={clearing}
          >
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {clearing ? 'Clearing...' : 'Clear All'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="w-full max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Loading history...</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="bg-card border border-border p-12 text-center">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Session History</h3>
              <p className="text-sm text-muted-foreground">
                Your past sessions will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {chats.map((session) => (
                <div
                  key={session._id}
                  className="bg-card border border-border hover:border-foreground/20 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="w-10 h-10 bg-foreground/5 border border-border flex items-center justify-center flex-shrink-0">
                        <Monitor className="w-5 h-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">
                                {session.title || 'Untitled Session'}
                              </h3>
                              <span className="text-[10px] px-1.5 py-0.5 bg-muted border border-border font-mono text-muted-foreground">
                                {session._id.slice(-8).toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              Session ID: <span className="font-mono">{session._id}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-green-500/10 text-green-500 border border-green-500/20">
                              Completed
                            </span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(session.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => alert(`Session Details:\n\nID: ${session._id}\nTitle: ${session.title || 'Untitled Session'}\nCreated: ${new Date(session.created_at).toLocaleString()}`)}>
                          Details
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteChat(session._id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          {!loading && chats.length > 0 && (
            <div className="mt-6 bg-muted/30 border border-border p-4">
              <p className="text-xs text-muted-foreground">
                Session history is stored securely. Clearing your history will remove these records permanently.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default SessionHistory;
