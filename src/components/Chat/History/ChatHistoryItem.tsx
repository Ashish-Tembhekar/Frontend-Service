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
    <div
      className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-sidebar-primary/20 text-sidebar-primary font-medium' : 'hover:bg-sidebar-accent text-sidebar-foreground'
      }`}
      onClick={() => loadChatThread(thread.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && loadChatThread(thread.id)}
      aria-current={isActive ? "page" : undefined}
    >
      <div className="flex items-center gap-2.5 truncate">
        <MessageSquareText className={`h-4 w-4 shrink-0 ${isActive ? 'text-sidebar-primary' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'}`} />
        <span className="truncate text-sm">{thread.title}</span>
      </div>
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 ${isActive ? 'opacity-80 hover:text-destructive' : 'hover:text-destructive'}`}
            onClick={(e) => e.stopPropagation()} 
            aria-label="Delete chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this chat thread.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
