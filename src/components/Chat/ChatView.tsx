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
  const {
    messages,
    chatbotRole,
    ttsProvider,
    ttsIsConnected,
    connectChatterboxTTS,
    disconnectChatterboxTTS,
  } = useChat();
  const messagesContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable viewport

  // Establish Chatterbox WebSocket connection when user is in chat window
  // (Only if Chatterbox is the selected TTS provider)
  useEffect(() => {
    if (ttsProvider === 'chatterbox' && !ttsIsConnected) {
      console.log('🎵 User entered chat window - establishing Chatterbox WebSocket connection...');
      connectChatterboxTTS();
    }
  }, [ttsProvider, ttsIsConnected, connectChatterboxTTS]);

  // Scroll to bottom effect
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Minimal header */}
      <ChatHeader isPopupMode={isPopupMode} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages area - clean and minimal */}
        <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
          <div className="max-w-4xl mx-auto px-4 py-8 h-full">
            {messages.length === 0 ? (
              /* Welcome screen - Minimalist Role Display */
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <h1
                  className="text-3xl md:text-4xl font-medium text-gray-900 tracking-tight capitalize"
                  style={{ fontFamily: 'var(--font-lora), serif' }}
                >
                  {chatbotRole}
                </h1>
                <p className="text-gray-500 text-lg max-w-md text-center">
                  Upload a document and ask questions from it in your language.
                </p>
              </div>
            ) : (
              /* Messages list */
              <MessageList messages={messages} />
            )}
          </div>
        </div>

        {/* Input bar at bottom */}
        <ChatInputBar />
      </div>
    </div>
  );
}
