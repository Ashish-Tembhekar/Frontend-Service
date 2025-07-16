# **App Name**: Nexus Chat

## Core Features:

- Custom Chat UI: A custom-designed chat interface that allows users to exchange messages with an AI assistant, and also allows users to upload files.
- Dual-View Mode: Provides options for popup and full-screen modes, ensuring the chat interface can be flexibly integrated into various contexts.
- Chat History Management: Enables users to view and reload past conversations, and optionally clear the entire chat history.
- FastAPI Integration: Tool that connects to an external FastAPI backend to send and receive messages in an OpenAI-compatible format, supporting both standard responses and Server-Sent Events (SSE) for streaming.
- API Configuration: Allows to set the base URL of the API server

## Style Guidelines:

- Primary color: HSL 210, 75%, 50% (converted to hex: #3FB2FF) - a vibrant blue to give a sense of technology, communication, and trust.
- Background color: HSL 210, 20%, 98% (converted to hex: #FAFCFF) - a very light blue to maintain a clean and airy feel.
- Accent color: HSL 180, 60%, 40% (converted to hex: #33A6A6) - a teal tone used for interactive elements, providing a refreshing and contrasting highlight without overwhelming the primary color.
- Clean, sans-serif font to ensure readability and a modern feel.
- Minimalist layout with a focus on a clear separation of the message thread, input bar, and history panel, ensuring ease of navigation and use.
- Simple, geometric icons for actions like upload, submit, and clear history, to ensure ease of use.