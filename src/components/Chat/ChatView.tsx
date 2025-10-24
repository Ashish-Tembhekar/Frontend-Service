// src/components/Chat/ChatView.tsx
"use client";

import { useChat } from '../../contexts/ChatContext';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInputBar } from './ChatInputBar';
import { TTSControlPanel } from '../TTS/TTSControlPanel';
import { TTSStatusIndicator } from '../TTS/TTSStatusIndicator';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '../ui/scroll-area'; // Import ScrollArea
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ChatViewProps {
  isPopupMode?: boolean;
}

export function ChatView({ isPopupMode = false }: ChatViewProps) {
  const {
    messages,
    ttsExaggeration,
    setTtsExaggeration,
    ttsCfgWeight,
    setTtsCfgWeight,
    ttsRefAudioFile,
    setTtsRefAudioFile,
    // + Get TTS status
    ttsIsLoading,
    ttsIsStreaming,
    ttsIsPlaying,
    ttsProgressPercent,
    ttsCurrentChunk,
    ttsTotalChunks,
    ttsError
  } = useChat();
  const messagesContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable viewport
  const [isTTSPanelOpen, setIsTTSPanelOpen] = useState(false);

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

      {/* TTS Status Indicator - Shows loading and progress */}
      <TTSStatusIndicator
        isLoading={ttsIsLoading}
        isStreaming={ttsIsStreaming}
        isPlaying={ttsIsPlaying}
        progressPercent={ttsProgressPercent}
        currentChunk={ttsCurrentChunk}
        totalChunks={ttsTotalChunks}
        error={ttsError}
      />

      {/* TTS Control Panel - Collapsible */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <button
          onClick={() => setIsTTSPanelOpen(!isTTSPanelOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-700">Voice Synthesis Settings</span>
          {isTTSPanelOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-600" />
          )}
        </button>
        {isTTSPanelOpen && (
          <div className="px-4 pb-4">
            <TTSControlPanel
              exaggeration={ttsExaggeration}
              cfgWeight={ttsCfgWeight}
              selectedRefAudio={ttsRefAudioFile}
              onExaggerationChange={setTtsExaggeration}
              onCfgWeightChange={setTtsCfgWeight}
              onRefAudioChange={setTtsRefAudioFile}
            />
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages area - clean and minimal */}
        <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
          <div className="max-w-4xl mx-auto px-4 py-8">
            {messages.length === 0 ? (
              /* Welcome screen for Technical Manual Agent */
              <div className="flex flex-col items-center justify-center h-full space-y-8 px-4">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h1 className="text-3xl font-semibold text-gray-900">
                    Technical Manual Assistant
                  </h1>
                  <p className="text-base text-gray-600 max-w-xl">
                    Get instant answers from technical documentation, service manuals, and engineering guides.
                  </p>
                </div>
                
                {/* Technical prompts grid - slightly bigger */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl">
                  {[
                    { icon: "🔧", text: "Troubleshoot battery voltage low error" },
                    { icon: "⚙️", text: "Torque specifications for engine bolts" },
                    { icon: "🔍", text: "Diagnostic procedure for ABS system" },
                    { icon: "📋", text: "Maintenance schedule for hydraulic system" },
                    { icon: "⚠️", text: "Safety precautions for electrical work" },
                    { icon: "📊", text: "Technical specifications for transmission" }
                  ].map((prompt, index) => (
                    <button
                      key={index}
                      className="p-4 text-left border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm transition-all duration-300 group"
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
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-all duration-300">
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
