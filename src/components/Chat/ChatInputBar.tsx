// src/components/Chat/ChatInputBar.tsx
"use client";

import React, { useState, useRef, type ChangeEvent, type KeyboardEvent, useEffect } from 'react';
import { Button } from '../ui/button';
import { Plus, Send, X, Mic, MicOff, Phone, Square, Globe, Volume2, VolumeX } from 'lucide-react'; // + Import Volume icons
import { useChat } from '../../contexts/ChatContext';
import { Textarea } from '../ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { appConfig } from '../../lib/config';
import { cn, validateFileSize } from '../../lib/utils';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { transcribeAudioAPI as transcribeAudio, transcribeAndAskAPI } from '../../services/apiClientNew';
import { VoiceChatFullScreen } from './VoiceChatFullScreen';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { logUsageToFirestore } from '../../services/usageLogger';

import { VoiceChatSelectionDialog } from './VoiceChatSelectionDialog';
import { useIsMobile } from '../../hooks/use-mobile';

export function ChatInputBar() {
  const [inputValue, setInputValue] = useState('');
  // + Destructure the new state and toggle function from the context
  const {
    sendMessage,
    addProcessedMessages,
    uploadFile,
    isLoadingResponse,
    messages,
    stopCurrentAudio,
    isAudioResponseEnabled,
    toggleAudioResponse,
    setTtsProvider // + Destructure this
  } = useChat();
  const { user } = useAuth(); // Get authenticated user for usage tracking
  const isMobile = useIsMobile();

  const languageOptions = [
    { value: 'auto', label: 'Auto-detect' },
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'Hindi' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'zh-cn', label: 'Chinese (Simplified)' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ru', label: 'Russian' },
    { value: 'ar', label: 'Arabic' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'it', label: 'Italian' },
  ];

  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null) as React.MutableRefObject<HTMLAudioElement | null>;
  const processedMessageIdRef = useRef<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false); // + Added state
  const [expectingAudioResponse, setExpectingAudioResponse] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [lastToastTime, setLastToastTime] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounterRef = useRef(0);

  const { toast } = useToast();

  useEffect(() => {
    // This effect is now simplified as the context handles audio playback initiation
    // We just need to know if audio is playing to update the UI
    // The `useStreamingAudio` hook manages the actual playback state.
    // This can be further simplified or removed if the UI state is managed by the hook.
  }, [messages, expectingAudioResponse, isLoadingResponse, toast]);

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
        setIsAudioPlaying(false);
      }
    };
  }, []);

  const handleMicClick = async () => {
    if (isLoadingResponse || isTranscribing) return;

    if (isAudioPlaying) {
      stopCurrentAudio();
      setIsAudioPlaying(false);
      return;
    }

    if (isRecording) {
      stopRecording();
      return;
    }

    stopCurrentAudio();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      startRecording(stream);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasMicPermission(false);
      toast({ title: "Microphone Access Denied", description: "Please enable microphone permissions in your browser settings to use voice input.", variant: "destructive" });
    }
  };

  const startRecording = (stream: MediaStream) => {
    if (mediaRecorderRef.current) return;

    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      stream.getTracks().forEach(track => track.stop());

      setIsTranscribing(true);
      setInputValue("Processing voice message...");

      try {
        const currentMessages = messages.filter(m => m.role !== 'system').slice(-10);
        let conversationHistoryString = '';
        for (let i = 0; i < currentMessages.length - 1; i += 2) {
          const userMsg = currentMessages[i];
          const assistantMsg = currentMessages[i + 1];
          if (userMsg && assistantMsg && userMsg.role === 'user' && assistantMsg.role === 'assistant') {
            conversationHistoryString += `User: ${userMsg.content}\nAssistant: ${assistantMsg.content}\n\n`;
          }
        }

        // This remains the same, as `addProcessedMessages` will handle the audio toggle
        const response = await transcribeAndAskAPI(
          audioBlob,
          conversationHistoryString,
          selectedLanguage,
          true,
          user?.uid
        );

        // Log usage data to Firestore if available
        if (response.usage && user?.uid) {
          await logUsageToFirestore(user.uid, response.usage);
        }

        if (response.original_text && response.original_text.trim()) {
          setInputValue(response.original_text);

          const userMessage = {
            id: `msg_user_${Date.now()}`,
            role: 'user' as const,
            content: response.original_text,
            contentType: 'text' as const,
            timestamp: new Date().toISOString(),
          };

          const assistantMessage = {
            id: `msg_assistant_${Date.now() + 1}`,
            role: 'assistant' as const,
            content: response.answer,
            contentType: 'html' as const,
            timestamp: new Date().toISOString(),
            audioData: null, // No longer passing audio data here
            sources: response.sources || [],
            imageUrls: response.image_urls || [],
            ...(response.debug_graph_context && { debug_graph_context: response.debug_graph_context }),
            ...(response.debug_filtered_docs && { debug_filtered_docs: response.debug_filtered_docs }),
          };

          addProcessedMessages(userMessage, assistantMessage);

          setTimeout(() => {
            setInputValue('');
          }, 1000);

        } else {
          toast({
            title: "No speech detected",
            description: "Couldn't detect any speech in the audio.",
            variant: "destructive"
          });
        }
      } catch (error) {
        toast({
          title: "Voice Processing Failed",
          description: "Could not process the voice message. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsTranscribing(false);
        mediaRecorderRef.current = null;
      }
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 100)}px`;
  };

  const uploadSelectedFile = async (file: File) => {
    const validation = validateFileSize(file);
    if (!validation.isValid) {
      setInputValue(prev => prev);
      const now = Date.now();
      if (now - lastToastTime > 1000) {
        setLastToastTime(now);
        toast({
          title: "File too large",
          description: validation.errorMessage,
          variant: "destructive",
        });
      }
      return;
    }

    try {
      await uploadFile(file);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    await uploadSelectedFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    event.target.value = "";
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isLoadingResponse || isRecording || isTranscribing) return;
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isLoadingResponse || isRecording || isTranscribing) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isLoadingResponse || isRecording || isTranscribing) return;
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragActive(false);
    if (isLoadingResponse || isRecording || isTranscribing) return;

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      toast({
        title: "Multiple files detected",
        description: "Please drop one file at a time.",
        variant: "destructive",
      });
    }
    await uploadSelectedFile(files[0]);
  };

  const handleSubmit = async () => {
    if (isLoadingResponse || !inputValue.trim()) return;

    if (isRecording) {
      stopRecording();
    }

    stopCurrentAudio();

    const languageToUse = selectedLanguage === 'auto' ? undefined : selectedLanguage;
    await sendMessage(inputValue, undefined, false, languageToUse);
    setInputValue('');

    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
    }
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const isMicDisabled = isLoadingResponse || isTranscribing;

  return (
    <div
      className="w-full px-4 py-4 bg-white"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {hasMicPermission === false && (
        <Alert variant="destructive" className="mb-4 max-w-4xl mx-auto">
          <AlertTitle>Microphone Access Denied</AlertTitle>
          <AlertDescription>
            Please enable microphone permissions in your browser settings to use voice input.
          </AlertDescription>
        </Alert>
      )}

      <div className="max-w-4xl mx-auto relative">
        {isDragActive && (
          <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/70 flex items-center justify-center">
            <div className="text-sm font-medium text-blue-700">Drop a file to upload</div>
          </div>
        )}
        <div
          className={cn(
            "relative flex items-end gap-2 md:gap-3 p-2 md:p-3 bg-gray-100 rounded-2xl border border-gray-300 focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-300 hover:shadow-sm focus-within:shadow-md transition-all duration-300",
            isDragActive && "border-blue-400 bg-blue-50"
          )}
        >
          <div className="flex-1 min-h-[44px] flex items-center">
            <Textarea
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={isRecording ? "Recording..." : (isTranscribing ? "Transcribing..." : "Message AI Assistant...")}
              className="flex-1 resize-none border-none bg-transparent focus:ring-0 text-gray-900 placeholder:text-gray-500 text-base leading-6"
              rows={1}
              disabled={isLoadingResponse || isRecording || isTranscribing}
            />
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingResponse || isRecording || isTranscribing}
              className="h-9 w-9 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200"
              aria-label="Upload file"
            >
              <Plus className="h-4 w-4" />
            </Button>

            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className={`h-9 text-sm border-gray-200 ${isMobile ? 'w-[50px] px-2' : 'w-[120px]'}`}>
                <Globe className="h-3 w-3 md:mr-1" />
                {!isMobile && <SelectValue placeholder="Language" />}
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* + ADDED: Audio Response Toggle Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={toggleAudioResponse}
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-9 w-9 rounded-full transition-all duration-200",
                      isAudioResponseEnabled
                        ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                        : "text-gray-500 hover:bg-gray-200"
                    )}
                    aria-label={isAudioResponseEnabled ? "Disable audio responses" : "Enable audio responses"}
                  >
                    {isAudioResponseEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isAudioResponseEnabled ? "Disable Audio Responses" : "Enable Audio Responses"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleMicClick}
                    disabled={isMicDisabled}
                    size="icon"
                    className={cn(
                      "h-9 w-9 rounded-full transition-all duration-200",
                      isRecording
                        ? "bg-red-100 text-red-600 animate-pulse"
                        : "bg-gray-600 text-white hover:bg-white hover:text-gray-600"
                    )}
                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isRecording ? "Stop Recording" : "Voice Input"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {appConfig.developerMode && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setIsSelectionDialogOpen(true)}
                      disabled={isLoadingResponse || isRecording || isTranscribing}
                      size="icon"
                      className="h-9 w-9 rounded-full bg-gray-600 text-white hover:bg-white hover:text-gray-600 transition-all duration-200"
                      aria-label="Start voice chat"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start Real-time Voice Chat</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isLoadingResponse || !inputValue.trim() || isRecording || isTranscribing}
              size="icon"
              className="h-9 w-9 rounded-full bg-gray-500 text-white hover:bg-white hover:text-gray-500 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-2 text-center">
          <p className="text-xs text-gray-500">
            Technical Manual Assistant may produce inaccurate information. <span className="text-gray-600 hover:underline cursor-pointer">Privacy Notice</span>
          </p>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.docx,.doc,.txt,.md"
      />

      <VoiceChatSelectionDialog
        isOpen={isSelectionDialogOpen}
        onClose={() => setIsSelectionDialogOpen(false)}
        onConfirm={(provider) => {
          setTtsProvider(provider);
          setIsVoiceChatOpen(true);
        }}
        defaultProvider="kokoro"
      />

      <VoiceChatFullScreen
        isOpen={isVoiceChatOpen}
        onClose={() => setIsVoiceChatOpen(false)}
      />
    </div>
  );
}
