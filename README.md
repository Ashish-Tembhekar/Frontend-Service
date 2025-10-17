# InnovaPoint - Chat UI Frontend

This is a modern, responsive frontend for the Unstructured Data Chatbot, built with Next.js 15 (App Router), TypeScript, and Tailwind CSS. It features real-time audio streaming, a dynamic file management dashboard, and a clean, component-based architecture.

## 🚀 Features

- **Modern Tech Stack**: Built with Next.js 15, React 18, and TypeScript for a type-safe and performant user experience.
- **Real-time Audio Streaming**: Connects directly to a TTS service (like Chatterbox on Lightning AI) to stream audio responses chunk-by-chunk for instant playback.
- **Real-time Dashboard**: A file management dashboard that receives live updates via WebSockets for file uploads, processing status, and errors.
- **Voice-to-Text**: Capture user audio from the microphone, send it to the backend for transcription, and process the response.
- **Full Voice Chat Mode**: A full-screen, immersive voice-first interaction mode.
- **Responsive Design**: A beautiful and functional UI on both desktop and mobile devices, powered by shadcn/ui and Tailwind CSS.
- **Client-Side State Management**: Uses React Context (`ChatContext`) for robust state management across the application.

## 🛠️ Getting Started

1. **Navigate to the frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   - This project uses `npm` for package management.
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   - Create a local environment file by copying the example:
     ```bash
     cp .env.local.example .env.local
     ```
   - Edit `.env.local` and add the required URLs for your backend services.

4. **Run the development server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:9002`.

## ⚙️ Environment Configuration (`.env.local`)

You must configure the following variables in your `.env.local` file for the application to function correctly:

```env
# URL for your Python backend (for text responses, file uploads, etc.)
NEXT_PUBLIC_FASTAPI_BASE_URL=http://localhost:8000

# URL for your Chatterbox/Lightning AI streaming TTS service (for audio responses)
NEXT_PUBLIC_CHATTERBOX_TTS_URL=https://your-lightning-ai-service-url.lightning.ai

# Optional: Enable developer mode to see debug info in the UI
NEXT_PUBLIC_DEVELOPER_MODE=true
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                   # Next.js App Router pages (/, /dashboard, /popup)
│   ├── components/
│   │   ├── Chat/              # Components for the main chat interface
│   │   ├── Dashboard/         # Components for the file management dashboard
│   │   └── ui/                # Reusable UI components from shadcn/ui
│   ├── contexts/
│   │   └── ChatContext.tsx    # Global state management for chat
│   ├── hooks/
│   │   ├── useStreamingAudio.ts # Hook for real-time TTS streaming
│   │   ├── useWebSocket.ts    # Hook for general WebSocket communication
│   │   └── useLocalStorage.ts # Hook for persisting state
│   ├── lib/
│   │   ├── config.ts          # Application configuration
│   │   └── utils.ts           # Utility functions
│   ├── services/
│   │   └── apiClientNew.ts    # Functions for making API calls to the backend
│   └── types/
│       └── chat.ts            # TypeScript types for chat and API responses
├── public/                    # Static assets
├── tailwind.config.ts         # Tailwind CSS configuration
├── next.config.ts             # Next.js configuration
└── package.json               # Project dependencies
```

## 🚀 Deployment

This application is configured for static export, making it easy to deploy to services like Vercel, Netlify, or any static web host.

1. **Build the application:**
   ```bash
   npm run build
   ```
   This command generates a static version of your site in the `out/` directory.

2. **Deploy:**
   - Upload the contents of the `out/` directory to your hosting provider. The included `vercel.json` and `deploy.sh` script provide configurations for common platforms.