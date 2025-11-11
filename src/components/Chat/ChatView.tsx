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
    systemPrompt,
  } = useChat();
  const messagesContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable viewport

  // Generate sample prompts based on the role
  const generateSamplePrompts = () => {
    const roleKeyword = chatbotRole.toLowerCase();

    // Map roles to sample prompts
    const promptMap: Record<string, Array<{ icon: string; text: string }>> = {
      'researcher': [
        { icon: '📊', text: 'Analyze the research methodology' },
        { icon: '📈', text: 'Summarize key findings' },
        { icon: '🔬', text: 'Explain the experimental design' },
        { icon: '📝', text: 'What are the limitations?' },
        { icon: '🎯', text: 'Identify the main hypothesis' },
        { icon: '💡', text: 'Suggest future research directions' }
      ],
      'teacher': [
        { icon: '📚', text: 'Explain this concept simply' },
        { icon: '✏️', text: 'Create a study guide' },
        { icon: '🎓', text: 'What are the key learning points?' },
        { icon: '❓', text: 'Generate practice questions' },
        { icon: '🧠', text: 'Help me understand this better' },
        { icon: '📖', text: 'Provide real-world examples' }
      ],
      'lawyer': [
        { icon: '⚖️', text: 'What are the legal implications?' },
        { icon: '📋', text: 'Summarize the contract terms' },
        { icon: '🔍', text: 'Identify potential risks' },
        { icon: '💼', text: 'What are my obligations?' },
        { icon: '📑', text: 'Explain the legal framework' },
        { icon: '⚠️', text: 'What should I be aware of?' }
      ],
      'doctor': [
        { icon: '🏥', text: 'What are the symptoms?' },
        { icon: '💊', text: 'Explain the treatment options' },
        { icon: '🔬', text: 'What does this diagnosis mean?' },
        { icon: '📋', text: 'What are the side effects?' },
        { icon: '❤️', text: 'Prevention strategies' },
        { icon: '📊', text: 'Explain the test results' }
      ],
      'engineer': [
        { icon: '⚙️', text: 'Explain the technical specifications' },
        { icon: '🔧', text: 'How do I troubleshoot this?' },
        { icon: '📐', text: 'What is the design approach?' },
        { icon: '🛠️', text: 'Best practices for implementation' },
        { icon: '📊', text: 'Performance analysis' },
        { icon: '🔌', text: 'System architecture overview' }
      ],
      'writer': [
        { icon: '✍️', text: 'Help me improve this writing' },
        { icon: '📖', text: 'Suggest narrative improvements' },
        { icon: '💭', text: 'Brainstorm story ideas' },
        { icon: '🎨', text: 'Develop character profiles' },
        { icon: '📝', text: 'Check for clarity and flow' },
        { icon: '✨', text: 'Enhance the description' }
      ],
      'analyst': [
        { icon: '📊', text: 'Analyze the data trends' },
        { icon: '📈', text: 'What insights can we draw?' },
        { icon: '🔍', text: 'Identify patterns and anomalies' },
        { icon: '💹', text: 'Forecast future trends' },
        { icon: '📋', text: 'Create a summary report' },
        { icon: '🎯', text: 'What are the key metrics?' }
      ]
    };

    // Find matching prompts or use default
    for (const [key, prompts] of Object.entries(promptMap)) {
      if (roleKeyword.includes(key)) {
        return prompts;
      }
    }

    // Default prompts for custom roles
    return [
      { icon: '💬', text: 'What can you help me with?' },
      { icon: '📚', text: 'Summarize the key points' },
      { icon: '🤔', text: 'Explain this in detail' },
      { icon: '💡', text: 'Provide recommendations' },
      { icon: '📊', text: 'Analyze the information' },
      { icon: '✨', text: 'Give me actionable insights' }
    ];
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      // Scroll to the bottom of the messages container
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
          <div className="max-w-4xl mx-auto px-4 py-8">
            {messages.length === 0 ? (
              /* Welcome screen with dynamic role-based content */
              <div className="flex flex-col items-center justify-center h-full space-y-8 px-4">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h1 className="text-3xl font-semibold text-gray-900">
                    {chatbotRole}
                  </h1>
                  <p className="text-base text-gray-600 max-w-xl">
                    {systemPrompt.split('.')[0]}. Ask me anything related to your documents.
                  </p>
                </div>

                {/* Dynamic prompts grid based on role */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl">
                  {generateSamplePrompts().map((prompt, index) => (
                    <button
                      key={index}
                      className="p-4 text-left border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm transition-all duration-300 group"
                      onClick={() => {
                        // This would set the input value and focus
                        const textarea = document.querySelector('textarea');
                        if (textarea) {
                          textarea.value = prompt.text;
                          textarea.focus();
                        }
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-all duration-300">
                          <span className="text-sm">{prompt.icon}</span>
                        </div>
                        <span className="text-base text-gray-700 group-hover:text-gray-900 font-medium">{prompt.text}</span>
                      </div>
                    </button>
                  ))}
                </div>
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
