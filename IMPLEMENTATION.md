# GemDesk - Remote Desktop Application

A lightweight, developer-first remote desktop tool built for speed, security, and clarity. Inspired by VS Code, Linear, and Raycast.

## Features Implemented

### 🏠 Home Screen
- Command-palette-style launcher with two primary actions
- Create Session and Join Session buttons with keyboard shortcuts
- Navigation to Settings and Session History
- Clean, professional developer-focused UI

### 🖥️ Create Session
- Generate unique session IDs for remote access
- QR code display for easy sharing
- Real-time connection status monitoring
- Connection request approval system
- Session timeout tracking

### 🔗 Join Session
- Session ID input with validation
- Connection status feedback
- Approval waiting state
- Error handling for invalid sessions

### ⚡ Active Session
- Remote desktop streaming interface
- Real-time performance metrics (FPS, latency, bandwidth)
- Settings panel with:
  - Stream quality adjustment
  - Control permissions (mouse/keyboard)
  - Connection information display
- Fullscreen mode
- Session controls (end, settings, maximize)

### 📜 Session History
- View past remote desktop sessions
- Session details (date, duration, status)
- Host vs Guest session differentiation
- Clear history functionality

### ⚙️ Settings Panel
Comprehensive settings organized into sections:

#### Network
- Default connection quality
- Adaptive quality toggle
- Port range configuration

#### Security
- Connection approval requirements
- Session timeout settings
- Connection notifications

#### Display
- Default display mode
- FPS counter toggle
- Hardware acceleration

#### Keyboard Shortcuts
- Customizable keyboard bindings
- Quick access commands

## Design Principles

### Unix Tooling / Developer Utility Archetype
- Matte surfaces with high contrast
- Sharp edges with restrained rounding
- Motion only when it clarifies state
- No synthetic gradients or neon glows
- Professional, focused aesthetic

### Color Scheme
- Dark theme inspired by VS Code
- Background: `hsl(220, 13%, 9%)`
- Foreground: `hsl(0, 0%, 95%)`
- Muted elements for secondary information
- High contrast for important actions

## Component Architecture

The application is broken down into reusable, focused components:

```
src/components/
├── HomeScreen.tsx       # Main landing page
├── CreateSession.tsx    # Host session creation
├── JoinSession.tsx      # Remote connection
├── ActiveSession.tsx    # Active remote desktop view
├── SessionHistory.tsx   # Past sessions
└── SettingsPanel.tsx    # Application settings
```

## Tech Stack

- **Framework**: React + Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Routing**: React Router
- **TypeScript**: Full type safety

## Keyboard Shortcuts

- `⌘ + C` - Create Session
- `⌘ + J` - Join Session
- `⌘ + F` - Toggle Fullscreen
- `⌘ + Q` - End Session

## Future Enhancements

- WebRTC implementation for real remote desktop streaming
- Actual QR code generation
- Persistent session history (localStorage)
- Real connection status monitoring
- Multiple display support
- File transfer capabilities
- Chat functionality during sessions
- Session recording

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

## License

MIT License
