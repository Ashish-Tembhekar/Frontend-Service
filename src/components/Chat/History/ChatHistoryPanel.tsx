// src/components/Chat/History/ChatHistoryPanel.tsx
"use client";

import { useChat } from '../../../contexts/ChatContext';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { ChatHistoryItem } from './ChatHistoryItem';
import { PlusCircle, Trash, PanelLeftClose, History, Sparkles } from 'lucide-react'; // Added Sparkles
import {
  Sheet,
  SheetContent,
} from "../../ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../ui/alert-dialog";
import { useIsMobile } from '../../../hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';

interface ChatHistoryPanelProps {
  isPopupMode?: boolean; 
}

export function ChatHistoryPanel({ isPopupMode = false }: ChatHistoryPanelProps) {
  const { chatThreads, currentChatThreadId, startNewChat, clearChatHistory, isHistoryPanelOpen, toggleHistoryPanel } = useChat();
  const isMobile = useIsMobile(); 

  const sortedThreads = [...chatThreads].sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());

  const panelContent = (
    <TooltipProvider>
      <>
        <div className="flex items-center justify-between p-4 border-b-2 border-slate-200/60 dark:border-slate-700/60 h-16 shrink-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <History className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Chat History</h2>
          </div>
        </div>
        <div className="p-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 h-12 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-white/20 dark:border-slate-700/20 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-all duration-200 shadow-sm" 
                onClick={startNewChat}
              >
                <PlusCircle className="h-5 w-5" />
                <span className="font-medium">New Chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Start a new conversation</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        <ScrollArea className="flex-grow px-4">
          {sortedThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                <Sparkles className="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No chat history yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Start a conversation to see it here</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {sortedThreads.map(thread => (
                <ChatHistoryItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === currentChatThreadId}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {chatThreads.length > 0 && (
          <div className="p-4 mt-auto border-t-2 border-slate-200/60 dark:border-slate-700/60 shrink-0">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200">
                      <Trash className="h-5 w-5" />
                      <span className="font-medium">Clear History</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete all chat history</p>
                  </TooltipContent>
                </Tooltip>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white dark:bg-slate-900 border border-white/20 dark:border-slate-700/20">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-slate-900 dark:text-slate-100">Clear Chat History?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                    This action cannot be undone. This will permanently delete all your chat threads.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearChatHistory}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </>
    </TooltipProvider>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside className={`
        hidden md:flex md:flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-r-2 border-slate-200/60 dark:border-slate-700/60 shadow-xl
        transition-all duration-300 ease-in-out
        ${isPopupMode ? 'md:hidden' : ''} 
        ${isHistoryPanelOpen ? 'w-72' : 'w-0 opacity-0 border-none invisible'}
        overflow-hidden shrink-0 
      `}>
        {isHistoryPanelOpen && panelContent} 
      </aside>

      {/* Mobile Drawer */}
      {!isPopupMode && (
        <Sheet open={isHistoryPanelOpen && isMobile} onOpenChange={(open) => {
          if (!open && isHistoryPanelOpen) {
             toggleHistoryPanel(); 
          } else if (open && !isHistoryPanelOpen) {
             toggleHistoryPanel(); 
          }
        }}>
          <SheetContent side="left" className="p-0 w-72 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-r-2 border-slate-200/60 dark:border-slate-700/60 flex flex-col">
            {panelContent}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
