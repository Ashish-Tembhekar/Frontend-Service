// src/components/Chat/History/ChatHistoryPanel.tsx
"use client";

import { useChat } from '../../../contexts/ChatContext';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { ChatHistoryItem } from './ChatHistoryItem';
import { PlusCircle, Trash, PanelLeftClose, History } from 'lucide-react'; // Added History icon
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

interface ChatHistoryPanelProps {
  isPopupMode?: boolean; 
}

export function ChatHistoryPanel({ isPopupMode = false }: ChatHistoryPanelProps) {
  const { chatThreads, currentChatThreadId, startNewChat, clearChatHistory, isHistoryPanelOpen, toggleHistoryPanel } = useChat();
  const isMobile = useIsMobile(); 

  const sortedThreads = [...chatThreads].sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());

  const panelContent = (
    <>
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border h-16 shrink-0">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-sidebar-primary" />
          <h2 className="text-lg font-semibold text-sidebar-foreground">History</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleHistoryPanel} className="md:hidden text-muted-foreground hover:text-foreground">
            <PanelLeftClose className="h-5 w-5" />
            <span className="sr-only">Close History</span>
        </Button>
      </div>
      <div className="p-3">
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring" 
          onClick={startNewChat}
        >
          <PlusCircle className="h-5 w-5" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-grow px-3">
        {sortedThreads.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center italic">No chat history yet.</p>
        ) : (
          <div className="space-y-1.5">
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
        <div className="p-3 mt-auto border-t border-sidebar-border shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/50">
                <Trash className="h-5 w-5" />
                Clear History
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all your chat threads.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={clearChatHistory}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside className={`
        hidden md:flex md:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border
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
          <SheetContent side="left" className="p-0 w-72 md:hidden bg-sidebar border-r-0 flex flex-col">
            {panelContent}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
