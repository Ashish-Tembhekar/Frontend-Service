// src/app/page.tsx
"use client"; // Required for using ChatContext hooks like isHistoryPanelOpen

import { ChatView } from '../components/Chat/ChatView';
import { ChatHistoryPanel } from '../components/Chat/History/ChatHistoryPanel';
import { useChat } from '../contexts/ChatContext'; // Import useChat
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

export default function FullScreenChatPage() {
  const { isHistoryPanelOpen } = useChat(); // Get panel state

  return (
    <TooltipProvider>
      <main className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* ChatHistoryPanel will control its own visibility and width via isHistoryPanelOpen */}
        <ChatHistoryPanel />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out relative ${
        isHistoryPanelOpen ? 'ml-0' : ''
        }`}>
          {/* Add a subtle background pattern */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(156,163,175,0.1)_1px,transparent_0)] bg-[length:20px_20px] opacity-50"></div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Subtle background pattern for visual appeal</p>
            </TooltipContent>
          </Tooltip>
          
          {/* The ChatView takes up the remaining space */}
          <ChatView />
        </div>
      </main>
    </TooltipProvider>
  );
}
