import { useState, useEffect } from 'react';
import { Monitor, UserPlus, Settings, Clock, Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CreateSession from './CreateSession';
import JoinSession from './JoinSession';
import SessionHistory from './SessionHistory';
import SettingsPanel from './SettingsPanel';
// import AIWorkspace from '@/components/AIWorkspace';

type View = 'home' | 'create' | 'join' | 'history' | 'settings' | 'ai';

function HomeScreen() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [autoStartRecording, setAutoStartRecording] = useState(false);

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

  /*
  if (currentView === 'ai') {
    return (
      <AIWorkspace 
        onBack={() => {
          setCurrentView('home');
          setAutoStartRecording(false);
        }} 
        autoStartRecording={autoStartRecording}
      />
    );
  }
  */

  return (
    <div className="w-screen h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-foreground/10 border border-border flex items-center justify-center">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">GemDesk</h1>
              <p className="text-xs text-muted-foreground">Professional Remote Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-2">

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('history')}
              className="gap-2"
            >
              <Clock className="w-4 h-4" />
              <span className="text-sm">History</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('settings')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          {/* Primary Actions */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => setCurrentView('create')}
              className="group relative bg-card border border-border hover:border-foreground/20 p-8 text-left transition-all duration-200 hover:bg-accent"
            >
              <div className="absolute top-4 right-4 w-10 h-10 bg-foreground/5 border border-border flex items-center justify-center group-hover:bg-foreground/10 transition-colors">
                <Monitor className="w-5 h-5" />
              </div>
              <div className="pr-14">
                <h2 className="text-xl font-semibold mb-2">Create Session</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Generate a session ID and allow someone to connect to your computer
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">⌘</kbd>
                <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">C</kbd>
              </div>
            </button>

            <button
              onClick={() => setCurrentView('join')}
              className="group relative bg-card border border-border hover:border-foreground/20 p-8 text-left transition-all duration-200 hover:bg-accent"
            >
              <div className="absolute top-4 right-4 w-10 h-10 bg-foreground/5 border border-border flex items-center justify-center group-hover:bg-foreground/10 transition-colors">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="pr-14">
                <h2 className="text-xl font-semibold mb-2">Join Session</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter a session ID to connect to another computer
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">⌘</kbd>
                <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">J</kbd>
              </div>
            </button>

            <button
              onClick={() => {
                if (window.electron?.openOverlay) {
                  window.electron.openOverlay();
                }
              }}
              className="group relative bg-[#121212] border border-primary/20 hover:border-primary/40 p-8 text-left transition-all duration-200 hover:bg-primary/5"
            >
              <div className="absolute top-4 right-4 w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="pr-14">
                <h2 className="text-xl font-semibold mb-2 text-primary">Analyze Screen</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Let Gemini AI understand your screen and help you solve complex problems
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-primary/60">
                <kbd className="px-2 py-1 bg-primary/10 border border-primary/20 rounded text-xs font-mono">⌘</kbd>
                <kbd className="px-2 py-1 bg-primary/10 border border-primary/20 rounded text-xs font-mono">A</kbd>
              </div>
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-muted/30 border border-border p-4">
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
      <footer className="border-t border-border px-6 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>Version 1.0.0 • Build 2026.1</div>
          <div className="flex items-center gap-4">
            <span>Status: <span className="text-green-500">●</span> Connected</span>
            <span>•</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomeScreen;
