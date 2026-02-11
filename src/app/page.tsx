// src/app/page.tsx
"use client"; // Required for using ChatContext hooks like isHistoryPanelOpen

import { ChatView } from '../components/Chat/ChatView';
import { ChatHistoryPanel } from '../components/Chat/History/ChatHistoryPanel';
import { useChat } from '../contexts/ChatContext'; // Import useChat
import { useAuth } from '../contexts/AuthContext';
import { useSSEContext } from '../contexts/SSEContext';
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
    if (!loading) {
      if (!user) {
        // User is not logged in, redirect to login page
        router.push('/login');
      } else if (!user.isApproved) {
        // User is not approved, redirect to pending approval page
        router.push('/pending-approval');
      }
    }
  }, [user, loading, router]);

  // Use shared SSE connection from context
  const { isConnected, lastEvent, connectionStatus } = useSSEContext();

  // Debug SSE connection
  useEffect(() => {
    console.log('📡 Chat SSE connected:', isConnected);
    console.log('📡 Chat SSE status:', connectionStatus);
  }, [isConnected, connectionStatus]);

  // Handle SSE events for chat
  useEffect(() => {
    if (lastEvent) {
      console.log('📨 Processing SSE event in Chat:', lastEvent);
      // Add any chat-specific event handling here
    }
  }, [lastEvent]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Checking authentication...</span>
      </div>
    );
  }

  // Only render the chat interface if the user is authenticated and approved
  if (!user || !user.isApproved) {
    return null; // Will redirect in useEffect
  }

  return (
    <TooltipProvider>
      <main className="flex h-screen overflow-hidden bg-white">
        {/* Clean minimal sidebar */}
        <ChatHistoryPanel />

        {/* Main chat area - full width when sidebar closed */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isHistoryPanelOpen ? 'ml-0' : ''
          }`}>
          <ChatView />
        </div>
      </main>
    </TooltipProvider>
  );
}
