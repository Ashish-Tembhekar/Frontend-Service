// src/components/Chat/History/ChatHistoryPanel.tsx
"use client";

import { useChat } from '../../../contexts/ChatContext';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { ChatHistoryItem } from './ChatHistoryItem';
import { PlusCircle, Trash, PanelLeftClose, History, Sparkles, MoreHorizontal, Share, Edit, Archive } from 'lucide-react';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
} from "../../ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
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
  const { chatThreads, currentChatThreadId, startNewChat, clearChatHistory, isHistoryPanelOpen, toggleHistoryPanel, deleteChatThread, loadChatThread } = useChat();
  const isMobile = useIsMobile();
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);

  const sortedThreads = [...chatThreads].sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Clean minimal header */}
      <div className="px-4 py-4 border-b border-gray-300 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={startNewChat}
            className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
            aria-label="Start new chat"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat history list */}
      <div className="flex-1 overflow-y-auto">
        {sortedThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-12 h-12 bg-white/60 rounded-full flex items-center justify-center mb-3 shadow-sm border border-gray-200">
              <Sparkles className="h-6 w-6 text-gray-500" />
            </div>
            <p className="text-sm text-gray-700 font-medium">No chat history yet</p>
            <p className="text-xs text-gray-600 mt-1">Start a conversation to see it here</p>
          </div>
        ) : (
          <div className="py-2">
            <div className="px-4 text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Chats</div>
            <div className="space-y-1 px-4">
              {sortedThreads.map(thread => (
                <div
                  key={thread.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${thread.id === currentChatThreadId
                      ? 'bg-white shadow-sm border border-gray-200'
                      : 'hover:bg-white/60 hover:shadow-sm'
                    }`}
                  onClick={() => loadChatThread(thread.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {thread.title || 'New Chat'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(thread.lastUpdatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>

                  {/* Three dots menu */}
                  <div className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 p-1">
                        <DropdownMenuItem className="text-gray-700 text-sm px-2 py-1.5">
                          <Share className="h-3.5 w-3.5 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-gray-700 text-sm px-2 py-1.5">
                          <Edit className="h-3.5 w-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-gray-700 text-sm px-2 py-1.5">
                          <Archive className="h-3.5 w-3.5 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1" />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 text-sm px-2 py-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteThreadId(thread.id);
                          }}
                        >
                          <Trash className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clear history button - minimal */}
      {chatThreads.length > 0 && (
        <div className="px-4 py-4 border-t border-gray-300 bg-white/40 backdrop-blur-sm">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center gap-2 h-8 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
              >
                <Trash className="h-4 w-4" />
                <span className="text-xs font-medium">Clear History</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all your chat threads.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
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
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside className={`
        hidden md:flex md:flex-col bg-gray-100 border-r border-gray-300
        transition-all duration-300 ease-in-out
        ${isPopupMode ? 'md:hidden' : ''} 
        ${isHistoryPanelOpen ? 'w-64' : 'w-0 opacity-0 border-none invisible'}
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
          <SheetContent side="left" className="p-0 w-64 md:hidden bg-gray-100 border-r border-gray-300 flex flex-col">
            {panelContent}
          </SheetContent>
        </Sheet>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteThreadId !== null} onOpenChange={() => setDeleteThreadId(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash className="h-5 w-5" />
              Delete Chat
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete this chat? This action cannot be undone and all messages in this conversation will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              onClick={() => setDeleteThreadId(null)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteThreadId) {
                  deleteChatThread(deleteThreadId);
                  setDeleteThreadId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
