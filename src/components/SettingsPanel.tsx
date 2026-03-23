import { useState, useEffect } from 'react';
import { ArrowLeft, Network, Shield, Monitor, Keyboard, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface SettingsPanelProps {
  onBack: () => void;
}

const DEFAULT_SETTINGS = {
  connectionQuality: 'high',
  adaptiveQuality: true,
  portRangeStart: '49152',
  portRangeEnd: '65535',
  requireApproval: true,
  sessionTimeout: '30',
  showNotifications: true,
  displayMode: 'fit',
  showFps: true,
  hardwareAcceleration: true,
  wakeWordEnabled: false,
  visionEnabled: true,
  ttsEnabled: true,
};

function SettingsPanel({ onBack }: SettingsPanelProps) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const savedSettings = localStorage.getItem('gemdesk_settings');
    if (savedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
  }, []);

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('gemdesk_settings', JSON.stringify(newSettings));
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
            <h1 className="text-lg font-semibold">Settings</h1>
            <p className="text-xs text-muted-foreground">Configure GemDesk preferences</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
          {/* Network Settings */}
          <section className="bg-card border border-border">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <Network className="w-5 h-5" />
                <div>
                  <h2 className="font-semibold">Network</h2>
                  <p className="text-xs text-muted-foreground">Connection and bandwidth settings</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Default Connection Quality</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose the default stream quality for new sessions
                  </p>
                </div>
                <Select 
                  value={settings.connectionQuality} 
                  onValueChange={(val) => updateSetting('connectionQuality', val)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (Faster)</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="ultra">Ultra (Slower)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Adaptive Quality</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically adjust quality based on connection speed
                  </p>
                </div>
                <Switch 
                  checked={settings.adaptiveQuality} 
                  onCheckedChange={(val) => updateSetting('adaptiveQuality', val)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Port Range</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    UDP port range for peer-to-peer connections
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={settings.portRangeStart}
                    onChange={(e) => updateSetting('portRangeStart', e.target.value)}
                    className="w-24 text-right font-mono text-sm"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    value={settings.portRangeEnd}
                    onChange={(e) => updateSetting('portRangeEnd', e.target.value)}
                    className="w-24 text-right font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Security Settings */}
          <section className="bg-card border border-border">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" />
                <div>
                  <h2 className="font-semibold">Security</h2>
                  <p className="text-xs text-muted-foreground">Privacy and access control</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Require Approval for Connections</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Always show a confirmation dialog when someone tries to connect
                  </p>
                </div>
                <Switch 
                  checked={settings.requireApproval} 
                  onCheckedChange={(val) => updateSetting('requireApproval', val)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Session Timeout</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically end sessions after period of inactivity
                  </p>
                </div>
                <Select 
                  value={settings.sessionTimeout} 
                  onValueChange={(val) => updateSetting('sessionTimeout', val)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Show Connection Notifications</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Display system notifications for connection events
                  </p>
                </div>
                <Switch 
                  checked={settings.showNotifications} 
                  onCheckedChange={(val) => updateSetting('showNotifications', val)}
                />
              </div>
            </div>
          </section>

          {/* Display Settings */}
          <section className="bg-card border border-border">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5" />
                <div>
                  <h2 className="font-semibold">Display</h2>
                  <p className="text-xs text-muted-foreground">Screen sharing preferences</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Default Display Mode</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    How remote desktop should be displayed by default
                  </p>
                </div>
                <Select 
                  value={settings.displayMode} 
                  onValueChange={(val) => updateSetting('displayMode', val)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fit">Fit to Window</SelectItem>
                    <SelectItem value="actual">Actual Size</SelectItem>
                    <SelectItem value="fullscreen">Fullscreen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Show FPS Counter</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Display frame rate and performance metrics during session
                  </p>
                </div>
                <Switch 
                  checked={settings.showFps} 
                  onCheckedChange={(val) => updateSetting('showFps', val)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Hardware Acceleration</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use GPU for video decoding (requires restart)
                  </p>
                </div>
                <Switch 
                  checked={settings.hardwareAcceleration} 
                  onCheckedChange={(val) => updateSetting('hardwareAcceleration', val)}
                />
              </div>
            </div>
          </section>

          {/* AI & Overlay Settings */}
          <section className="bg-card border border-border">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="font-semibold">AI & Overlay</h2>
                  <p className="text-xs text-muted-foreground">Configure AI assistant behavior</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Wake Word Detection</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Listen for "Hi Gemdesk" to activate the assistant
                  </p>
                </div>
                <Switch 
                  checked={settings.wakeWordEnabled} 
                  onCheckedChange={(val) => updateSetting('wakeWordEnabled', val)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Vision (Screen Context)</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Allow AI to see your screen for better context
                  </p>
                </div>
                <Switch 
                  checked={settings.visionEnabled} 
                  onCheckedChange={(val) => updateSetting('visionEnabled', val)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">AI Voice (TTS)</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Speak AI responses aloud using text-to-speech
                  </p>
                </div>
                <Switch 
                  checked={settings.ttsEnabled} 
                  onCheckedChange={(val) => updateSetting('ttsEnabled', val)}
                />
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="bg-card border border-border">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <Keyboard className="w-5 h-5" />
                <div>
                  <h2 className="font-semibold">Keyboard Shortcuts</h2>
                  <p className="text-xs text-muted-foreground">Customize keyboard bindings</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">Create Session</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">⌘</kbd>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">C</kbd>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">Join Session</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">⌘</kbd>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">J</kbd>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">Analyze Screen Overlay</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">⌘</kbd>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">G</kbd>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">End Session</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">⌘</kbd>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">Q</kbd>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* About */}
          <section className="bg-card border border-border">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-foreground/10 border border-border flex items-center justify-center">
                  <Monitor className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold mb-1">GemDesk</h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    Version 1.0.0 • Build 2026.1
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A lightweight, developer-first remote desktop tool built for speed, security, and clarity.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <Button variant="outline" size="sm" onClick={() => window.open('https://gemdesk-sigma.vercel.app/#documentation', '_blank')}>Documentation</Button>
                    <Button variant="outline" size="sm" onClick={() => window.open('#', '_blank')}>GitHub</Button>
                    <Button variant="outline" size="sm" onClick={() => window.open('https://gemdesk-sigma.vercel.app/#report-issue', '_blank')}>Report Issue</Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default SettingsPanel;
