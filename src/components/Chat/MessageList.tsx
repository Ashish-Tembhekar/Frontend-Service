// src/components/Chat/MessageList.tsx
"use client";

import type { Message } from '../../types/chat';
import { MessageItem } from './MessageItem';
import { useChat } from '../../contexts/ChatContext';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const { activeChatThread } = useChat();

  if (messages.length === 0 && activeChatThread) {
    // Case for empty chat with an active thread: Display greeting
    // This div should take the full height of its parent (the ScrollArea viewport)
    // and center its content.
    return (
      <div className="flex items-center justify-center h-[calc(100vh-150px)] w-full text-center px-4">
        <div className="flex flex-col items-center max-w-xl w-full">
          <h1 className="text-5xl font-semibold mb-4 leading-tight">
            <span className="bg-gradient-to-r from-[#3FB2FF] to-[#33A6A6] bg-clip-text text-transparent">
              Hello, Guest !
            </span>
          </h1>
          <p className="text-xl text-muted-foreground">
            How can I help you today?
          </p>
        </div>
      </div>
    );
  }

  // Case for chat with messages: Display message list
  // This outer div is the content that scrolls within the ScrollArea.
  // pb-56 ensures space for the fixed ChatInputBar.
  // pt-4 provides some top padding for the first message.

  // Find the index of the last assistant message
  const lastAssistantMessageIndex = messages.map((msg, idx) => ({ msg, idx }))
    .reverse()
    .find(({ msg }) => msg.role === 'assistant')?.idx ?? -1;

  return (
    <div className="w-full max-w-2xl sm:max-w-3xl md:max-w-4xl mx-auto px-4 pt-4 pb-20">
      <div className="space-y-2">
        {messages.map((msg, idx) => (
          <MessageItem
            key={msg.id}
            message={msg}
            isLastAssistantMessage={idx === lastAssistantMessageIndex}
          />
        ))}
      </div>
    </div>
  );
}
