import { ArrowLeft, Clock, Monitor, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionHistoryProps {
  onBack: () => void;
}

interface HistoryItem {
  id: string;
  type: 'host' | 'guest';
  peer: string;
  date: string;
  duration: string;
  status: 'completed' | 'disconnected';
}

const mockHistory: HistoryItem[] = [
  {
    id: 'ABC12345',
    type: 'host',
    peer: 'Remote User',
    date: '2024-01-15 14:32',
    duration: '45:23',
    status: 'completed'
  },
  {
    id: 'XYZ98765',
    type: 'guest',
    peer: 'Desktop-PC',
    date: '2024-01-14 09:15',
    duration: '1:23:45',
    status: 'completed'
  },
  {
    id: 'DEF54321',
    type: 'host',
    peer: 'Support Engineer',
    date: '2024-01-12 16:45',
    duration: '12:08',
    status: 'disconnected'
  },
];

function SessionHistory({ onBack }: SessionHistoryProps) {
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
            <p className="text-xs text-muted-foreground">Review past remote desktop sessions</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-2">
            <Trash2 className="w-4 h-4" />
            Clear All
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="w-full max-w-4xl mx-auto">
          {mockHistory.length === 0 ? (
            <div className="bg-card border border-border p-12 text-center">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Session History</h3>
              <p className="text-sm text-muted-foreground">
                Your past sessions will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mockHistory.map((session) => (
                <div
                  key={session.id}
                  className="bg-card border border-border hover:border-foreground/20 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="w-10 h-10 bg-foreground/5 border border-border flex items-center justify-center flex-shrink-0">
                        {session.type === 'host' ? (
                          <Monitor className="w-5 h-5" />
                        ) : (
                          <UserPlus className="w-5 h-5" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">
                                {session.type === 'host' ? 'Hosted Session' : 'Joined Session'}
                              </h3>
                              <span className="text-xs px-2 py-0.5 bg-muted border border-border font-mono">
                                {session.id}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {session.type === 'host' ? 'Connected with' : 'Connected to'}{' '}
                              <span className="font-medium text-foreground">{session.peer}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {session.status === 'completed' ? (
                              <span className="text-xs px-2 py-1 bg-green-500/10 text-green-500 border border-green-500/20">
                                Completed
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-destructive/10 text-destructive border border-destructive/20">
                                Disconnected
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span>{session.date}</span>
                          </div>
                          <span>•</span>
                          <span>Duration: {session.duration}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          Details
                        </Button>
                        <Button variant="ghost" size="sm">
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
          {mockHistory.length > 0 && (
            <div className="mt-6 bg-muted/30 border border-border p-4">
              <p className="text-xs text-muted-foreground">
                Session history is stored locally on your device. Clearing your browser data will remove this history.
                Sessions older than 30 days are automatically removed.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default SessionHistory;
