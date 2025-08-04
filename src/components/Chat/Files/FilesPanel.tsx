// src/components/Chat/Files/FilesPanel.tsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { FileText, PanelLeftClose, FolderOpen, RefreshCw, Trash2 } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";
import { useIsMobile } from '../../../hooks/use-mobile';
import { listFiles, deleteFileChunks } from '../../../services/apiClientNew';
import type { ListFilesResponse } from '../../../types/chat';
import { useToast } from '../../../hooks/use-toast';

interface FilesPanelProps {
  isPopupMode?: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export function FilesPanel({ isPopupMode = false, isOpen, onToggle }: FilesPanelProps) {
  const [files, setFiles] = useState<ListFilesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const response = await listFiles();
      setFiles(response);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to load files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (uuid: string, filename: string) => {
    try {
      await deleteFileChunks(uuid);
      toast({
        title: "Success",
        description: `${filename} has been deleted successfully.`,
      });
      // Refresh the files list after deletion
      fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: `Failed to delete ${filename}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen]);

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'docx':
        return '📝';
      case 'md':
        return '📋';
      case 'txt':
        return '📄';
      default:
        return '📁';
    }
  };

  const getFileType = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'PDF Document';
      case 'docx':
        return 'Word Document';
      case 'md':
        return 'Markdown File';
      case 'txt':
        return 'Text File';
      default:
        return 'Document';
    }
  };

  const panelContent = (
    <>
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border h-16 shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-sidebar-primary" />
          <h2 className="text-lg font-semibold text-sidebar-foreground">Files</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchFiles}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Refresh files"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggle} 
            className="md:hidden text-muted-foreground hover:text-foreground"
          >
            <PanelLeftClose className="h-5 w-5" />
            <span className="sr-only">Close Files</span>
          </Button>
        </div>
      </div>
      
      <div className="flex-grow px-3 w-full overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading files...</span>
          </div>
        ) : !files ? (
          <p className="text-sm text-muted-foreground p-4 text-center italic">No files loaded.</p>
        ) : files.files.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center italic">No files uploaded yet.</p>
        ) : (
          <div className="space-y-2 py-2 w-full max-w-full">
            <div className="text-xs text-muted-foreground px-2">
              {files.total_files} file{files.total_files !== 1 ? 's' : ''}
            </div>
            {files.files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border border-sidebar-border hover:bg-sidebar-accent transition-colors w-full max-w-full"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                  <div className="text-2xl flex-shrink-0">{getFileIcon(file.file_name)}</div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="text-sm font-medium text-sidebar-foreground truncate">
                            {file.file_name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {getFileType(file.file_name)}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{file.file_name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex-shrink-0 ml-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/50"
                        aria-label={`Delete ${file.file_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete File</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{file.file_name}"? This action cannot be undone and will remove all associated data from the system.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteFile(file.uuid, file.file_name)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside className={`
        hidden md:flex md:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border
        transition-all duration-300 ease-in-out
        ${isPopupMode ? 'md:hidden' : ''} 
        ${isOpen ? 'w-72' : 'w-0 opacity-0 border-none invisible'}
        overflow-hidden shrink-0 max-w-72
      `}>
        {isOpen && panelContent} 
      </aside>

      {/* Mobile Drawer */}
      {!isPopupMode && (
        <Sheet open={isOpen && isMobile} onOpenChange={(open) => {
          if (!open && isOpen) {
             onToggle(); 
          } else if (open && !isOpen) {
             onToggle(); 
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