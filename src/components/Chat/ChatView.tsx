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
    <div className="flex flex-col h-full bg-background relative overflow-hidden"> {/* Ensures ChatView itself does not scroll and anchors ChatInputBar */}
      <ChatHeader isPopupMode={isPopupMode} />

      {/* Use ScrollArea for the message list */}
      <ScrollArea viewportRef={messagesContainerRef} className="flex-1 min-h-0 overflow-hidden">
        <MessageList messages={messages} />
      </ScrollArea>

      <ChatInputBar />
    </div>
  );
}
