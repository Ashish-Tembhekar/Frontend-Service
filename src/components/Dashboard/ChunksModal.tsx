"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { X, FileText, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { appConfig } from '../../lib/config';

interface Chunk {
  chunk_id: string | number;  // Backend returns number, convert to string
  content: string;
  metadata: {
    document_uuid: string;
    page_number?: number;
    page_num?: number;        // Backend uses page_num from hybrid_chunking
    chunk_index?: number;
    heading?: string;         // Backend includes heading
    has_image?: boolean;      // Backend includes image info
    has_table?: boolean;      // Backend includes table info
    source?: string;          // Backend includes source
    type?: string;            // Backend includes type
    [key: string]: any;
  };
  type?: string;              // Backend includes type at root level
}

interface FileChunksResponse {
  file_uuid: string;
  total_chunks: number;
  chunks: Chunk[];
}

interface ChunksModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUuid: string;
  fileName: string;
}

export function ChunksModal({ isOpen, onClose, fileUuid, fileName }: ChunksModalProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchChunks = async () => {
    if (!fileUuid) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${appConfig.fastApiBaseUrl}/files/${fileUuid}/chunks`);
      if (response.ok) {
        const data: FileChunksResponse = await response.json();
        setChunks(data.chunks);
      } else {
        throw new Error('Failed to fetch chunks');
      }
    } catch (error) {
      console.error('Error fetching chunks:', error);
      toast({
        title: "Error",
        description: "Failed to load file chunks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (content: string, chunkId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedChunkId(chunkId);
      toast({
        title: "Copied!",
        description: "Chunk content copied to clipboard",
      });
      setTimeout(() => setCopiedChunkId(null), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isOpen && fileUuid) {
      fetchChunks();
    }
  }, [isOpen, fileUuid]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h2 className="text-xl font-bold">File Chunks</h2>
            <p className="text-sm text-muted-foreground">{fileName}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading chunks...</span>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Summary and Refresh */}
              <div className="flex items-center justify-between p-6 border-b shrink-0">
                <h3 className="text-lg font-semibold">
                  Total Chunks: {chunks.length}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchChunks}
                >
                  Refresh
                </Button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {chunks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No chunks found for this file</p>
                  </div>
                ) : (
                  <div className="space-y-4 pb-6">
                    {chunks.map((chunk, index) => (
                      <Card key={String(chunk.chunk_id)} className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                Chunk {index + 1}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                ID: {chunk.chunk_id}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(chunk.content, String(chunk.chunk_id))}
                              className="h-8 w-8 p-0"
                            >
                              {copiedChunkId === String(chunk.chunk_id) ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          
                          {/* Metadata */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(chunk.metadata.page_number || chunk.metadata.page_num) && (
                              <Badge variant="outline">
                                Page {chunk.metadata.page_number || chunk.metadata.page_num}
                              </Badge>
                            )}
                            {chunk.metadata.heading && (
                              <Badge variant="outline">
                                {chunk.metadata.heading}
                              </Badge>
                            )}
                            {chunk.metadata.has_image && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                📷 Has Image
                              </Badge>
                            )}
                            {chunk.metadata.has_table && (
                              <Badge variant="outline" className="bg-green-100 text-green-800">
                                📊 Has Table
                              </Badge>
                            )}
                            {chunk.metadata.chunk_index !== undefined && (
                              <Badge variant="outline">
                                Index {chunk.metadata.chunk_index}
                              </Badge>
                            )}
                            {Object.entries(chunk.metadata)
                              .filter(([key]) => !['document_uuid', 'page_number', 'page_num', 'chunk_index', 'heading', 'has_image', 'has_table', 'type'].includes(key))
                              .filter(([key, value]) => value !== null && value !== undefined && value !== '' && value !== false)
                              .map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                          <div className="bg-muted/50 rounded-md p-3">
                            <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                              {chunk.content}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 