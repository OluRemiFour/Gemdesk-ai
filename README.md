# GemDesk AI

[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

GemDesk is a powerful, open-source AI desktop assistant built with Electron, React, and Vite. It redefines human-computer interaction by allowing you to "share your screen with AI" and perform complex tasks seamlessly using your voice or text. 

GemDesk bridges the gap between your desktop and advanced AI models, acting as a smart, context-aware co-pilot right on your machine.

---

## ✨ Features

- **Advanced AI Workspace**: Chat with your personalized AI assistant to perform automated actions, draft content, and control your computer effortlessly.
- **Intelligent Screen Sharing**: Real-time WebRTC-based screen sharing with high-quality screenshot capture, enabling the AI to "see" your screen and provide context-aware assistance.
- **Voice Commands & TTS**: Integrated speech-to-text (STT) for hands-free interactions and text-to-speech (TTS) for auditory AI responses.
- **Persistent History**: Connected to a robust MongoDB backend, automatically saving your conversations and context for seamless continuity across sessions.
- **System Control**: Leverages Electron's deep system integration to execute local actions based on your AI instructions.
- **Modern UI**: A sleek, responsive interface built with React, Tailwind CSS, and Lucide Icons.

## 🚀 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Git**
- The [GemDesk Backend](https://github.com/OluRemiFour/Gemdesk-backend) running locally or hosted in the cloud.

## 🛠️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/gemdesk.git
   cd gemdesk
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your configuration based on the environment:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_BACKEND_URL=https://gemdesk-backend.onrender.com
   ```

## 💻 Running the Application

To start the Vite development server along with the Electron application:

```bash
npm run dev
```

This will launch the GemDesk AI assistant on your desktop.

## 🏗️ Architecture

- **Renderer Process**: Built with React, styled with Tailwind CSS, utilizing Lucide Icons for a fluid user experience.
- **Main Process**: Electron IPC handling system-level commands, direct computer control capabilities, and native screen capture.
- **Backend Service**: Communicates with the standalone `gemdesk-backend` via secure REST APIs for database operations and extended capabilities.

## 🤝 Contributing

**GemDesk AI is open-source and contributions are always welcome!**

Whether it's bug reports, feature requests, documentation improvements, or code contributions, we value your help to make GemDesk better. 

To contribute:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
