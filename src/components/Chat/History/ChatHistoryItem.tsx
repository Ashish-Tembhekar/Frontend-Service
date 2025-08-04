// src/components/Chat/History/ChatHistoryItem.tsx
"use client";

import type { ChatThread } from '../../../types/chat';
import { Button } from '../../ui/button';
import { MessageSquareText, Trash2 } from 'lucide-react';
import { useChat } from '../../../contexts/ChatContext';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';

interface ChatHistoryItemProps {
  thread: ChatThread;
  isActive: boolean;
}

export function ChatHistoryItem({ thread, isActive }: ChatHistoryItemProps) {
  const { loadChatThread, deleteChatThread } = useChat();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    deleteChatThread(thread.id);
  };

  return (
    <TooltipProvider>
      <div
        className={`theme-sidebar-item group ${
          isActive ? 'active' : ''
        }`}
        onClick={() => loadChatThread(thread.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && loadChatThread(thread.id)}
        aria-current={isActive ? "page" : undefined}
      >
        <div className="theme-sidebar-item-text flex-1 min-w-0">
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
            isActive 
              ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
              : 'bg-slate-100 dark:bg-slate-800'
          }`}>
            <MessageSquareText className={`h-4 w-4 ${
              isActive 
                ? 'text-white' 
                : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'
            }`} />
          </div>
          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
            <span className="truncate text-sm font-medium">{thread.title}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {new Date(thread.lastUpdatedAt).toLocaleDateString([], { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
        
        {/* Delete Button - Temporarily always visible for debugging */}
        <div className="shrink-0 ml-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-100 group-hover:opacity-100 focus:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={(e) => e.stopPropagation()} 
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this conversation</p>
                </TooltipContent>
              </Tooltip>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white dark:bg-slate-900 border border-white/20 dark:border-slate-700/20">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-900 dark:text-slate-100">Delete Chat?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                  This action cannot be undone. This will permanently delete this chat thread.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </TooltipProvider>
  );
}
