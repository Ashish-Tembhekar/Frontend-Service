// src/app/page.tsx
"use client"; // Required for using ChatContext hooks like isHistoryPanelOpen

import { ChatView } from '../components/Chat/ChatView';
import { ChatHistoryPanel } from '../components/Chat/History/ChatHistoryPanel';
import { useChat } from '../contexts/ChatContext'; // Import useChat

export default function FullScreenChatPage() {
  const { isHistoryPanelOpen } = useChat(); // Get panel state

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      {/* ChatHistoryPanel will control its own visibility and width via isHistoryPanelOpen */}
      <ChatHistoryPanel />
      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
        {/* The ChatView takes up the remaining space */}
        <ChatView />
      </div>
    </main>
  );
}
