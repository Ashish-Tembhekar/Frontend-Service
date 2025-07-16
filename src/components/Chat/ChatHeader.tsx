// src/components/Chat/ChatHeader.tsx
"use client";

import React from 'react';
import { Button } from '../ui/button';
import { PanelLeftClose, PanelLeftOpen, PlusCircle } from 'lucide-react'; // Added PlusCircle
import { useChat } from '../../contexts/ChatContext';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface ChatHeaderProps {
  isPopupMode?: boolean;
}

export function ChatHeader({ isPopupMode = false }: ChatHeaderProps) {
  const { toggleHistoryPanel, isHistoryPanelOpen, startNewChat } = useChat(); // Added startNewChat
  
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shadow-sm h-16 shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-1 sm:gap-3"> {/* Adjusted gap for new button */}
        {!isPopupMode && (
           <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleHistoryPanel} 
            aria-label={isHistoryPanelOpen ? "Close history panel" : "Open history panel"} 
            className="text-muted-foreground hover:text-foreground"
          >
            {isHistoryPanelOpen ? <PanelLeftClose className="h-6 w-6" /> : <PanelLeftOpen className="h-6 w-6" />}
          </Button>
        )}
        {!isPopupMode && !isHistoryPanelOpen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={startNewChat}
            aria-label="Start new chat"
            className="text-muted-foreground hover:text-foreground"
          >
            <PlusCircle className="h-6 w-6" />
          </Button>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 text-sm border">
            <AvatarFallback className="bg-muted text-muted-foreground">
              GU
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground hidden sm:inline">Guest User</span>
        </div>
      </div>
    </div>
  );
}
