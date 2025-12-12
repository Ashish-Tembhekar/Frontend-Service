// src/components/Chat/ChatHeader.tsx
"use client";

import React from 'react';
import { Button } from '../ui/button';
import { PanelLeftClose, PanelLeftOpen, PlusCircle, Sparkles } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { UserMenu } from '../Auth/UserMenu';

interface ChatHeaderProps {
  isPopupMode?: boolean;
}

export function ChatHeader({ isPopupMode = true }: ChatHeaderProps) {
  const { toggleHistoryPanel, isHistoryPanelOpen, startNewChat } = useChat();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white h-14 shrink-0 sticky top-0 z-20">
      {/* Left side - minimal controls */}
      <div className="flex items-center gap-2">
        {!isPopupMode && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleHistoryPanel}
            aria-label={isHistoryPanelOpen ? "Close history panel" : "Open history panel"}
            className="h-9 w-9 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
          >
            {isHistoryPanelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        )}

        {!isPopupMode && !isHistoryPanelOpen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={startNewChat}
            aria-label="Start new chat"
            className="h-9 w-9 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Center - title */}
      {/* <div className="flex-1 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Technical Manual Assistant</h1>
      </div> */}

      {/* Right side - minimal actions */}
      <div className="flex items-center gap-2">
        {/* Log out/User Menu placed here */}

        <UserMenu />
      </div>
    </div>
  );
}
