// src/components/Chat/ChatHeader.tsx
"use client";

import React from 'react';
import { Button } from '../ui/button';
import { PanelLeftClose, PanelLeftOpen, PlusCircle, BarChart3, Sparkles } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import Link from 'next/link';

interface ChatHeaderProps {
  isPopupMode?: boolean;
}

export function ChatHeader({ isPopupMode = false }: ChatHeaderProps) {
  const { toggleHistoryPanel, isHistoryPanelOpen, startNewChat } = useChat();
  
return (
    <TooltipProvider>
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b-2 border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shadow-sm h-16 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          {!isPopupMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleHistoryPanel}
                  aria-label={isHistoryPanelOpen ? "Close history panel" : "Open history panel"}
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
                >
                  {isHistoryPanelOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isHistoryPanelOpen ? "Close chat history" : "Open chat history"}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {!isPopupMode && !isHistoryPanelOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startNewChat}
                  aria-label="Start new chat"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Start new chat</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Brand section */}
          <div className="flex items-center gap-2 ml-2">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Nexus Chat
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Go to dashboard"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <BarChart3 className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>Go to dashboard</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                <Avatar className="h-7 w-7 text-sm border-2 border-white dark:border-slate-700 shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-medium">
                    GU
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline">
                  Guest User
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Guest user account</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
