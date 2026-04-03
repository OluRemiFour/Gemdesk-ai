import { useState, useEffect } from 'react';
import { Monitor, UserPlus, Settings, Clock, Info, Sparkles, AlertTriangle, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CreateSession from './CreateSession';
import JoinSession from './JoinSession';
import SessionHistory from './SessionHistory';
import SettingsPanel from './SettingsPanel';

type View = 'home' | 'create' | 'join' | 'history' | 'settings' | 'ai';

function HomeScreen() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [autoStartRecording, setAutoStartRecording] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Listen for the OS window close button
  useEffect(() => {
    if (window.electron?.onWindowCloseRequested) {
      const cleanup = window.electron.onWindowCloseRequested(() => {
        setShowCloseModal(true);
      });
      return cleanup;
    }
  }, []);

  useEffect(() => {
    if (window.electron?.onGlobalHotkey) {
      const cleanup = window.electron.onGlobalHotkey(() => {
        console.log('[HomeScreen] Global hotkey Ctrl+G triggered - Opening Overlay');
        if (window.electron?.openOverlay) {
          window.electron.openOverlay();
        }
      });
      return cleanup;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        setCurrentView('create');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setCurrentView('join');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        if (window.electron?.openOverlay) {
          window.electron.openOverlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleConfirmClose = () => {
    if (window.electron?.confirmClose) {
      window.electron.confirmClose();
    }
  };

  if (currentView === 'create') {
    return <CreateSession onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'join') {
    return <JoinSession onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'history') {
    return <SessionHistory onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'settings') {
    return <SettingsPanel onBack={() => setCurrentView('home')} />;
  }

  return (
    <div className="w-screen h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Ambient gradient background accents */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-[160px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/60 px-6 py-4 backdrop-blur-sm bg-background/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center rounded-lg shadow-lg shadow-primary/5">
              <Monitor className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">GemDesk</h1>
              <p className="text-xs text-muted-foreground">Professional Remote Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('history')}
              className="gap-2 hover:bg-white/5 transition-colors"
            >
              <Clock className="w-4 h-4" />
              <span className="text-sm">History</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('settings')}
              className="gap-2 hover:bg-white/5 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          {/* Primary Actions */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => setCurrentView('create')}
              className="group relative bg-card/60 backdrop-blur-sm border border-border/60 hover:border-foreground/20 p-8 text-left transition-all duration-300 hover:bg-accent/80 rounded-xl hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
            >
              <div className="absolute top-4 right-4 w-10 h-10 bg-foreground/5 border border-border/50 flex items-center justify-center group-hover:bg-foreground/10 transition-all duration-300 rounded-lg group-hover:scale-110">
                <Monitor className="w-5 h-5 transition-colors group-hover:text-primary" />
              </div>
              <div className="pr-14">
                <h2 className="text-xl font-semibold mb-2">Create Session</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Generate a session ID and allow someone to connect to your computer
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <kbd className="px-2 py-1 bg-muted/60 border border-border/50 rounded-md text-xs font-mono">⌘</kbd>
                <kbd className="px-2 py-1 bg-muted/60 border border-border/50 rounded-md text-xs font-mono">C</kbd>
              </div>
            </button>

            <button
              onClick={() => setCurrentView('join')}
              className="group relative bg-card/60 backdrop-blur-sm border border-border/60 hover:border-foreground/20 p-8 text-left transition-all duration-300 hover:bg-accent/80 rounded-xl hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
            >
              <div className="absolute top-4 right-4 w-10 h-10 bg-foreground/5 border border-border/50 flex items-center justify-center group-hover:bg-foreground/10 transition-all duration-300 rounded-lg group-hover:scale-110">
                <UserPlus className="w-5 h-5 transition-colors group-hover:text-primary" />
              </div>
              <div className="pr-14">
                <h2 className="text-xl font-semibold mb-2">Join Session</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter a session ID to connect to another computer
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <kbd className="px-2 py-1 bg-muted/60 border border-border/50 rounded-md text-xs font-mono">⌘</kbd>
                <kbd className="px-2 py-1 bg-muted/60 border border-border/50 rounded-md text-xs font-mono">J</kbd>
              </div>
            </button>

            <button
              onClick={() => {
                if (window.electron?.openOverlay) {
                  window.electron.openOverlay();
                }
              }}
              className="group relative bg-[#121212]/80 backdrop-blur-sm border border-primary/20 hover:border-primary/40 p-8 text-left transition-all duration-300 hover:bg-primary/5 rounded-xl hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5"
            >
              <div className="absolute top-4 right-4 w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 rounded-lg group-hover:scale-110">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="pr-14">
                <h2 className="text-xl font-semibold mb-2 text-primary">Analyze Screen</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Let Gemini AI understand your screen and help you solve complex problems
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-primary/60">
                <kbd className="px-2 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs font-mono">⌘</kbd>
                <kbd className="px-2 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs font-mono">A</kbd>
              </div>
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-muted/20 backdrop-blur-sm border border-border/50 p-4 rounded-xl">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">Secure & Private</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All connections are end-to-end encrypted. Sessions expire after 24 hours of inactivity.
                  No data is stored on our servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 px-6 py-3 backdrop-blur-sm bg-background/80">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>Version 1.0.0 • Build 2026.1</div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              Status: <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span> Connected
            </span>
            <span>•</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>

      {/* ─── Close Confirmation Modal ─── */}
      {showCloseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCloseModal(false)}
          />
          {/* Modal */}
          <div className="relative bg-[#141414] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-md p-0 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Close GemDesk?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">This will end all active operations</p>
                </div>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to close GemDesk? Any active remote sessions, AI conversations, and screen sharing will be terminated immediately.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowCloseModal(false)}
                className="px-4 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmClose}
                className="bg-red-500/90 hover:bg-red-500 text-white px-4 gap-2 shadow-lg shadow-red-500/20"
              >
                <LogOut className="w-4 h-4" />
                Close GemDesk
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomeScreen;
