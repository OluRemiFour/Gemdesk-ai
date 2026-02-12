# GemDesk Frontend

GemDesk is an AI-powered desktop assistant built with Electron, React, and Vite. It allows you to "share your screen with AI" to perform complex tasks using Gemini.

## Features

- **AI Workspace**: Chat with Gemini to perform actions on your computer.
- **Screen Sharing**: High-quality screenshot capture and WebRTC-based sharing.
- **Persistent History**: Connected to a MongoDB backend for saving your conversations.
- **Voice Commands**: Integrated speech-to-text and text-to-speech capabilities.

## Prerequisites

- Node.js (v18+)
- [GemDesk Backend](https://github.com/OluRemiFour/Gemdesk-backend) running locally or hosted.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file based on the environment:
    ```env
    VITE_GEMINI_API_KEY=your_gemini_api_key
    VITE_BACKEND_URL=https://gemdesk-backend.onrender.com
    ```

## Running the App

- **Development**:
  ```bash
  npm run dev
  ```
  This starts the Vite dev server and the Electron application.

## Architecture

- **Renderer Process**: React + Tailwind + Lucide Icons.
- **Main Process**: Electron IPC handling for system commands, computer control, and screen capture.
- **Backend Service**: Communicates with the standalone `gemdesk-backend` via REST API.
