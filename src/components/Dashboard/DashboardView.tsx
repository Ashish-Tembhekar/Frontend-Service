"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  FileText,
  Upload,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Image,
  Table,
  FileX,
  AlertCircle,
  ArrowLeft,
  Layers,
  Wifi,
  WifiOff,
  User
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useWebSocket } from '../../hooks/useWebSocket';
import { validateFileSize, formatFileSize } from '../../lib/utils';
import { appConfig } from '../../lib/config';
import Link from 'next/link';
import { ChunksModal } from './ChunksModal';
import { TTSControlPanel } from '../TTS/TTSControlPanel';
import { useChat } from '../../contexts/ChatContext';

// Types for the dashboard
interface FileStats {
  uuid: string;
  file_name: string;
  hash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  upload_method: string;
  file_size_bytes: number;
  file_size_mb: number;
  chunks_created: number;
  progress_percentage: number;
  error_message: string | null;
  processing_started_at: string;
  processing_completed_at: string | null;
  total_pages: number;
  pages_processed: number;
  pages_failed: number;
  images_extracted: number;
  tables_extracted: number;
  processing_duration_seconds: number;
  created_at: string;
  updated_at: string;
}

interface DashboardStats {
  total_files: number;
  status_counts: {
    completed: number;
    processing: number;
    failed: number;
  };
  upload_method_counts: {
    ui_upload: number;
    directory: number;
  };
  total_chunks: number;
  total_size_mb: number;
  detailed_stats: {
    total_pages: number;
    pages_processed: number;
    pages_failed: number;
    images_extracted: number;
    tables_extracted: number;
    total_processing_time_seconds: number;
  };
  recent_events: Array<{
    file_name: string;
    event_type: string;
    event_message: string;
    event_timestamp: string;
  }>;
}

interface UploadConfig {
  max_file_size_bytes: number;
  max_file_size_mb: number;
  supported_extensions: string[];
}

export function DashboardView() {
  const [files, setFiles] = useState<FileStats[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [uploadConfig, setUploadConfig] = useState<UploadConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Get TTS settings from ChatContext
  const {
    ttsExaggeration,
    setTtsExaggeration,
    ttsCfgWeight,
    setTtsCfgWeight,
    ttsRefAudioFile,
    setTtsRefAudioFile,
  } = useChat();
  const [selectedFile, setSelectedFile] = useState<FileStats | null>(null);
  const [isChunksModalOpen, setIsChunksModalOpen] = useState(false);
  const [selectedFileForChunks, setSelectedFileForChunks] = useState<FileStats | null>(null);
  const { toast } = useToast();

  // WebSocket connection for real-time updates
  const wsUrl = appConfig.fastApiBaseUrl.replace('http', 'ws') + '/ws/dashboard';
  const { isConnected, lastMessage, connectionStatus, userId, sessionId } = useWebSocket(wsUrl);
  
  // Debug WebSocket connection
  useEffect(() => {
    console.log('🔌 WebSocket URL:', wsUrl);
    console.log('🔌 WebSocket connected:', isConnected);
    console.log('🔌 User ID:', userId);
    console.log('🔌 Session ID:', sessionId);
  }, [wsUrl, isConnected, userId, sessionId]);

  // Fetch data functions
  const fetchFiles = async () => {
    try {
      const response = await fetch(`${appConfig.fastApiBaseUrl}/files/`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch(`${appConfig.fastApiBaseUrl}/dashboard/stats`);
      if (response.ok) {
        const data = await response.json();
        setDashboardStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchUploadConfig = async () => {
    try {
      const response = await fetch(`${appConfig.fastApiBaseUrl}/upload-config/`);
      if (response.ok) {
        const data = await response.json();
        setUploadConfig(data);
      }
    } catch (error) {
      console.error('Error fetching upload config:', error);
    }
  };

  const refreshData = async () => {
    await Promise.all([fetchFiles(), fetchDashboardStats()]);
  };

  // Upload file function
  const handleFileUpload = async (file: File) => {
    const validation = validateFileSize(file);
    if (!validation.isValid) {
      toast({
        title: "File too large",
        description: validation.errorMessage,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('🚀 Starting file upload...');
      const response = await fetch(`${appConfig.fastApiBaseUrl}/upload-document/`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Upload successful",
          description: `${file.name} has been uploaded and is being processed.`,
        });
        console.log('✅ Upload completed, result:', result);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Delete file function
  const handleDeleteFile = async (uuid: string, fileName: string) => {
    try {
      const response = await fetch(`${appConfig.fastApiBaseUrl}/files/${uuid}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "File deleted",
          description: `${fileName} has been deleted successfully.`,
        });
        refreshData();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewChunks = (file: FileStats) => {
    setSelectedFileForChunks(file);
    setIsChunksModalOpen(true);
  };

  // File input handler
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input
    event.target.value = '';
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchFiles(),
        fetchDashboardStats(),
        fetchUploadConfig(),
      ]);
      setIsLoading(false);
    };

    fetchData();
  }, []);

  // Connection status helper functions
  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'connecting':
      case 'reconnecting':
        return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'connecting':
      case 'reconnecting':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'disconnected':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (lastMessage) {
      console.log('📨 Processing WebSocket message in DashboardView:', lastMessage);
      
      // Handle user connection notifications
      if (lastMessage.type === 'user_connected') {
        console.log('👤 User connected:', lastMessage.user_id);
        toast({
          title: "User Connected",
          description: `User ${lastMessage.user_id?.slice(-8)} joined`,
          duration: 3000,
        });
      } else if (lastMessage.type === 'user_disconnected') {
        console.log('👤 User disconnected:', lastMessage.user_id);
        toast({
          title: "User Disconnected", 
          description: `User ${lastMessage.user_id?.slice(-8)} left`,
          duration: 3000,
        });
      }
      
      // Update files list when we receive status updates, job updates, or file deletions
      else if (lastMessage.type === 'status_update' || 
          lastMessage.type === 'file_deleted' || 
          lastMessage.type === 'job_status_update' ||
          lastMessage.type === 'pdf_processing_complete' ||
          lastMessage.type === 'pdf_processing_failed') {
        console.log('🔄 Refreshing data due to:', lastMessage.type);
        refreshData();
      }
    }
  }, [lastMessage, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

     return (
     <div className="container mx-auto p-6 space-y-6 pb-8">
      {/* Connection Status Bar */}
      <div className={`flex items-center justify-between rounded-lg border p-4 ${getConnectionStatusColor()}`}>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {getConnectionStatusIcon()}
            <span className="text-sm font-medium">
              Real-time updates: {getConnectionStatusText()}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm opacity-75">
            <User className="w-3 h-3" />
            <span>User: {userId.slice(-8)}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {connectionStatus !== 'connected' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          )}
          
          {connectionStatus === 'connected' && (
            <Badge variant="secondary" className="text-xs">
              Session: {sessionId.slice(-6)}
            </Badge>
          )}
        </div>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to chat"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">File Management Dashboard</h1>
              {isConnected && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                  <span>Online</span>
                </div>
              )}
              {!isConnected && (
                <div className="flex items-center gap-1 text-sm text-red-600">
                  <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                  <span>Offline</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground">Monitor and manage your uploaded files</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={refreshData}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload File'}
          </Button>
          <input
            id="file-upload"
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-100 border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Total Files</CardTitle>
              <FileText className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{dashboardStats.total_files}</div>
              <p className="text-xs text-gray-600">
                {dashboardStats.status_counts.completed} completed, {dashboardStats.status_counts.processing} processing
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-100 border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Total Chunks</CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{dashboardStats.total_chunks}</div>
              <p className="text-xs text-gray-600">
                Across all processed files
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-100 border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Total Size</CardTitle>
              <FileText className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{dashboardStats.total_size_mb.toFixed(1)} MB</div>
              <p className="text-xs text-gray-600">
                Combined file size
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-100 border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Failed Files</CardTitle>
              <FileX className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{dashboardStats.status_counts.failed}</div>
              <p className="text-xs text-gray-600">
                Processing errors
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="files" className="space-y-4">
        <TabsList className="bg-gray-100 border-gray-200">
          <TabsTrigger value="files" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Files</TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Statistics</TabsTrigger>
          <TabsTrigger value="recent" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Recent Events</TabsTrigger>
        </TabsList>

                                   <TabsContent value="files" className="space-y-4">
            <Card className="flex flex-col mb-8 bg-white border-gray-200 shadow-sm">
             <CardHeader className="flex-shrink-0 pb-2 bg-gray-50 border-b border-gray-200">
               <CardTitle className="text-lg text-gray-800">File List</CardTitle>
             </CardHeader>
             <CardContent className="flex-1 min-h-0 p-0">
                               <div className="h-[250px] sm:h-[280px] md:h-[320px] lg:h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                <div className="space-y-4 p-6 pr-8">
                  {files.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">
                      <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-gray-500" />
                      </div>
                      <p className="font-medium">No files uploaded yet</p>
                      <p className="text-sm text-gray-500">Upload your first file to get started</p>
                    </div>
                  ) : (
                    <>
                                            {/* Show processing files first */}
                      {files.filter(f => f.status === 'processing').length > 0 && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                          <div className="flex items-center gap-2 text-green-700">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span className="font-medium">
                              {files.filter(f => f.status === 'processing').length} file(s) currently processing
                            </span>
                            {/* {isConnected && (
                              <span className="text-xs bg-green-200 px-2 py-1 rounded-full">
                                Real-time updates active
                              </span>
                            )} */}
                          </div>
                        </div>
                      )}
                                             {files.map((file) => (
                      <div
                        key={file.uuid}
                        className="border border-gray-300 rounded-lg p-4 bg-gray-100 hover:bg-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-5 h-5" />
                            <span className="font-medium">{file.file_name}</span>
                            {getStatusBadge(file.status)}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewChunks(file)}
                              disabled={file.status !== 'completed'}
                              title={file.status !== 'completed' ? 'Only available for completed files' : 'View chunks'}
                            >
                              <Layers className="w-4 h-4 mr-1" />
                              Chunks
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedFile(file)}
                            >
                              Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteFile(file.uuid, file.file_name)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Size:</span>
                            <span className="ml-1">{formatFileSize(file.file_size_bytes)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Chunks:</span>
                            <span className="ml-1">{file.chunks_created}</span>
                          </div>
                          {file.file_name.toLowerCase().endsWith('.pdf') && (
                            <div>
                              <span className="text-muted-foreground">Pages:</span>
                              <span className="ml-1">{file.total_pages}</span>
                            </div>
                          )}
                          {!file.file_name.toLowerCase().endsWith('.pdf') && (
                            <div>
                              <span className="text-muted-foreground">Type:</span>
                              <span className="ml-1">{file.file_name.split('.').pop()?.toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Uploaded:</span>
                            <span className="ml-1">
                              {new Date(file.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {file.status === 'processing' && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>Processing progress</span>
                              <span>{file.progress_percentage}%</span>
                            </div>
                            <Progress value={file.progress_percentage} className="h-2" />
                          </div>
                        )}

                        {file.error_message && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 inline mr-1" />
                            {file.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {dashboardStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                  <CardTitle className="text-gray-800">Processing Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{dashboardStats.detailed_stats.total_pages}</div>
                      <div className="text-sm text-muted-foreground">Total Pages</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{dashboardStats.detailed_stats.pages_processed}</div>
                      <div className="text-sm text-muted-foreground">Pages Processed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{dashboardStats.detailed_stats.images_extracted}</div>
                      <div className="text-sm text-muted-foreground">Images Extracted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{dashboardStats.detailed_stats.tables_extracted}</div>
                      <div className="text-sm text-muted-foreground">Tables Extracted</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                  <CardTitle className="text-gray-800">Upload Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>UI Upload</span>
                      <span className="font-medium">{dashboardStats.upload_method_counts.ui_upload}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Directory</span>
                      <span className="font-medium">{dashboardStats.upload_method_counts.directory}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

                                                                                                                                               <TabsContent value="recent" className="space-y-4">
              {dashboardStats?.recent_events && (
                <Card className="flex flex-col mb-8 bg-white border-gray-200 shadow-sm">
                <CardHeader className="flex-shrink-0 pb-2 bg-gray-50 border-b border-gray-200">
                  <CardTitle className="text-lg text-gray-800">Recent Events</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-0">
                  <div className="h-[250px] sm:h-[280px] md:h-[320px] lg:h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                   <div className="space-y-2 p-6 pr-8">
                     {dashboardStats.recent_events.map((event, index) => (
                       <div key={index} className="flex items-center space-x-3 p-2 rounded border border-gray-300 bg-gray-100 hover:bg-gray-200 shadow-sm transition-colors">
                         <div className="flex-1">
                           <div className="font-medium">{event.file_name}</div>
                           <div className="text-sm text-muted-foreground">{event.event_message}</div>
                         </div>
                         <div className="text-xs text-muted-foreground">
                           {new Date(event.event_timestamp).toLocaleString()}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               </CardContent>
             </Card>
           )}
         </TabsContent>
      </Tabs>

      {/* TTS Control Panel */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-gray-800">Voice Synthesis Settings</CardTitle>
          <CardDescription>Configure text-to-speech parameters for chatbot responses</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TTSControlPanel
            exaggeration={ttsExaggeration}
            cfgWeight={ttsCfgWeight}
            selectedRefAudio={ttsRefAudioFile}
            onExaggerationChange={setTtsExaggeration}
            onCfgWeightChange={setTtsCfgWeight}
            onRefAudioChange={setTtsRefAudioFile}
          />
        </CardContent>
      </Card>

      {/* File Details Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">File Details</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFile(null)}
              >
                Close
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">File Name:</span>
                    <span className="ml-2">{selectedFile.file_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-2">{getStatusBadge(selectedFile.status)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Size:</span>
                    <span className="ml-2">{formatFileSize(selectedFile.file_size_bytes)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Chunks:</span>
                    <span className="ml-2">{selectedFile.chunks_created}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Processing Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Pages:</span>
                    <span className="ml-2">{selectedFile.total_pages}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pages Processed:</span>
                    <span className="ml-2">{selectedFile.pages_processed}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Images Extracted:</span>
                    <span className="ml-2">{selectedFile.images_extracted}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tables Extracted:</span>
                    <span className="ml-2">{selectedFile.tables_extracted}</span>
                  </div>
                </div>
              </div>

              {selectedFile.error_message && (
                <div>
                  <h3 className="font-medium mb-2 text-red-600">Error</h3>
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                    {selectedFile.error_message}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chunks Modal */}
      <ChunksModal
        isOpen={isChunksModalOpen}
        onClose={() => {
          setIsChunksModalOpen(false);
          setSelectedFileForChunks(null);
        }}
        fileUuid={selectedFileForChunks?.uuid || ''}
        fileName={selectedFileForChunks?.file_name || ''}
      />
    </div>
  );
} 