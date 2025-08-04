// src/components/Chat/ChatView.tsx
"use client";

import { useChat } from '../../contexts/ChatContext';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInputBar } from './ChatInputBar';
import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area'; // Import ScrollArea

interface ChatViewProps {
  isPopupMode?: boolean;
}

export function ChatView({ isPopupMode = false }: ChatViewProps) {
  const { messages } = useChat();
  const messagesContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable viewport

  useEffect(() => {
    if (messagesContainerRef.current) {
      // Scroll to the bottom of the messages container
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full relative overflow-hidden backdrop-blur-sm">
      {/* Glass morphism effect for the chat container */}
      <div className="flex flex-col h-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/40 dark:border-slate-700/40 shadow-xl">
        <ChatHeader isPopupMode={isPopupMode} />

        {/* Use ScrollArea for the message list with improved styling */}
        <ScrollArea viewportRef={messagesContainerRef} className="flex-1 min-h-0 overflow-hidden px-4">
          <div className="py-4">
            <MessageList messages={messages} />
          </div>
        </ScrollArea>

        <ChatInputBar />
      </div>
    </div>
  );
}
