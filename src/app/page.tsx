// src/app/page.tsx
"use client"; // Required for using ChatContext hooks like isHistoryPanelOpen

import { ChatView } from '../components/Chat/ChatView';
import { ChatHistoryPanel } from '../components/Chat/History/ChatHistoryPanel';
import { useChat } from '../contexts/ChatContext'; // Import useChat
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { appConfig } from '../lib/config';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function FullScreenChatPage() {
  const { isHistoryPanelOpen } = useChat(); // Get panel state
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect logic - protect the chat interface
  useEffect(() => {
    if (!loading && !user) {
      // User is not logged in, redirect to login page
      router.push('/login');
    }
  }, [user, loading, router]);

  // WebSocket connection for real-time chat updates
  const wsUrl = appConfig.fastApiBaseUrl.replace('http', 'ws') + '/ws/dashboard';
  const { isConnected, lastMessage, connectionStatus, userId, sessionId } = useWebSocket(wsUrl);

  // Debug WebSocket connection
  useEffect(() => {
    console.log('🔌 Chat WebSocket connected:', isConnected);
    console.log('🔌 Chat User ID:', userId);
    console.log('🔌 Chat Session ID:', sessionId);
  }, [isConnected, userId, sessionId]);

  // Handle WebSocket messages for chat
  useEffect(() => {
    if (lastMessage) {
      console.log('📨 Processing WebSocket message in Chat:', lastMessage);
      // Add any chat-specific message handling here
    }
  }, [lastMessage]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Checking authentication...</span>
      </div>
    );
  }

  // Only render the chat interface if the user is authenticated
  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <TooltipProvider>
      <main className="flex h-screen overflow-hidden bg-white">
        {/* Clean minimal sidebar */}
        <ChatHistoryPanel />

        {/* Main chat area - full width when sidebar closed */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isHistoryPanelOpen ? 'ml-0' : ''
        }`}>
          <ChatView />
        </div>
      </main>
    </TooltipProvider>
  );
}
