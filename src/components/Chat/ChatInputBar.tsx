// src/components/Chat/ChatInputBar.tsx
"use client";

import React, { useState, useRef, type ChangeEvent, type KeyboardEvent, useEffect } from 'react';
import { Button } from '../ui/button';
import { Plus, Send, X, Mic, MicOff, Phone, Square, Globe } from 'lucide-react';
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


export function ChatInputBar() {
  // Fresh compilation to break cache
  const [inputValue, setInputValue] = useState('');
  const { sendMessage, addProcessedMessages, uploadFile, isLoadingResponse, messages, stopCurrentAudio } = useChat();
  
  // Language options
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
  const [expectingAudioResponse, setExpectingAudioResponse] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [lastToastTime, setLastToastTime] = useState(0);

  const { toast } = useToast();


  
  // Handle audio playback state when using microphone
  useEffect(() => {
    if (expectingAudioResponse && !isLoadingResponse) {
      // Get the latest assistant message
      const latestAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
      
      if (latestAssistantMessage && latestAssistantMessage.audioData && 
          latestAssistantMessage.id !== processedMessageIdRef.current) {
        processedMessageIdRef.current = latestAssistantMessage.id;
        
        // Set audio playing state to true (audio is played by ChatContext)
        setIsAudioPlaying(true);
        
        // Create audio element to track when it ends
        const audioUrl = `data:${latestAssistantMessage.audioData.mime_type};base64,${latestAssistantMessage.audioData.audio_base64}`;
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;
        
        audio.onended = () => {
          setExpectingAudioResponse(false);
          setIsAudioPlaying(false);
          audioPlayerRef.current = null;
        };
        
        audio.onerror = () => {
          setExpectingAudioResponse(false);
          setIsAudioPlaying(false);
          audioPlayerRef.current = null;
          toast({
            title: "Audio Playback Error",
            description: "Could not play the audio response.",
            variant: "destructive"
          });
        };
      }
    }
  }, [messages, expectingAudioResponse, isLoadingResponse, toast]);
  
  // Cleanup audio on unmount
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
    console.log('ChatInputBar - handleMicClick called, isAudioPlaying:', isAudioPlaying, 'audioPlayerRef.current:', !!audioPlayerRef.current);
    
    if (isLoadingResponse || isTranscribing) return;

    // If audio is playing, stop it
    if (isAudioPlaying || audioPlayerRef.current) {
      console.log('ChatInputBar - Audio is playing, stopping it');
      stopCurrentAudio(); // Stop the audio from ChatContext
      if (audioPlayerRef.current) {
        (audioPlayerRef.current as HTMLAudioElement).pause();
        (audioPlayerRef.current as HTMLAudioElement).currentTime = 0;
        audioPlayerRef.current = null;
      }
      setIsAudioPlaying(false);
      setExpectingAudioResponse(false);
      console.log('ChatInputBar - Audio stopped');
      return;
    }

    if (isRecording) {
      stopRecording();
      return;
    }

    // Stop any currently playing audio
    if (audioPlayerRef.current) {
      (audioPlayerRef.current as HTMLAudioElement).pause();
      audioPlayerRef.current = null;
      setExpectingAudioResponse(false);
      setIsAudioPlaying(false);
    }

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
      console.log('ChatInputBar - Audio blob created:', {
        size: audioBlob.size,
        type: audioBlob.type,
        chunks: audioChunksRef.current.length
      });
      
      // Stop the tracks to turn off the mic icon in the browser tab
      stream.getTracks().forEach(track => track.stop());
      
      setIsTranscribing(true);
      setInputValue("Processing voice message...");
      setExpectingAudioResponse(true);

      try {
        console.log('ChatInputBar - Using parallel transcribe-and-ask processing');
        
        // Prepare conversation history
        const currentMessages = messages.filter(m => m.role !== 'system').slice(-10);
        let conversationHistoryString = '';
        for (let i = 0; i < currentMessages.length - 1; i += 2) {
          const userMsg = currentMessages[i];
          const assistantMsg = currentMessages[i + 1];
          if (userMsg && assistantMsg && userMsg.role === 'user' && assistantMsg.role === 'assistant') {
            conversationHistoryString += `User: ${userMsg.content}\nAssistant: ${assistantMsg.content}\n\n`;
          }
        }
        
        // Use parallel processing API - combines transcription and query processing
        const response = await transcribeAndAskAPI(
          audioBlob,
          conversationHistoryString,
          selectedLanguage,
          true // needs audio for voice interaction
        );
        
        console.log('ChatInputBar - Parallel processing response:', response);
        
        if (response.original_text && response.original_text.trim()) {
          // Show original language text in input bar briefly
          setInputValue(response.original_text);
          
          // Add the messages to chat context directly since we have the full response
          const userMessage = {
            id: `msg_user_${Date.now()}`,
            role: 'user' as const,
            content: response.original_text, // Display original text
            contentType: 'text' as const,
            timestamp: new Date().toISOString(),
          };

          const assistantMessage = {
            id: `msg_assistant_${Date.now() + 1}`,
            role: 'assistant' as const,
            content: response.answer,
            contentType: 'html' as const,
            timestamp: new Date().toISOString(),
            audioData: response.audio,
          };

          // Use the new method to add pre-processed messages
          addProcessedMessages(userMessage, assistantMessage);
          
          setTimeout(() => {
            setInputValue(''); // Clear input after showing transcription
          }, 1000);
          
        } else {
          toast({ 
            title: "No speech detected", 
            description: "Couldn't detect any speech in the audio.", 
            variant: "destructive" 
          });
          setExpectingAudioResponse(false);
        }
      } catch (error) {
        console.error('ChatInputBar - Error in parallel processing:', error);
        toast({ 
          title: "Voice Processing Failed", 
          description: "Could not process the voice message. Please try again.", 
          variant: "destructive" 
        });
        setExpectingAudioResponse(false);
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
    // Note: Don't reset expectingAudioResponse here, as the recording might still be processed
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    // Auto-resize textarea
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 100)}px`;
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    // Validate file size using utility function
    const validation = validateFileSize(file);
    if (!validation.isValid) {
      console.log('File validation failed:', validation.errorMessage);
      
      // Clear file input first
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      event.target.value = "";
      
      // Force a re-render by updating state
      setInputValue(prev => prev);
      
      // Show toast with rate limiting to prevent spam
      const now = Date.now();
      if (now - lastToastTime > 1000) { // Only show toast if 1 second has passed
        setLastToastTime(now);
        toast({
          title: "File too large",
          description: validation.errorMessage,
          variant: "destructive",
        });
      }
      
      return;
    }
    
    // File is valid, proceed with upload
    try {
      await uploadFile(file);
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      event.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (isLoadingResponse || !inputValue.trim()) return;
    
    if (isRecording) {
      stopRecording();
    }
    
    // Stop any currently playing audio
    const currentAudio = audioPlayerRef.current;
    if (currentAudio) {
      currentAudio.pause();
      audioPlayerRef.current = null;
      setExpectingAudioResponse(false);
      setIsAudioPlaying(false);
    }
    
    // For text input: send selected language if not auto, otherwise send undefined
    const languageToUse = selectedLanguage === 'auto' ? undefined : selectedLanguage;
    await sendMessage(inputValue, undefined, false, languageToUse); // Regular text input
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
    <div className="w-full px-4 py-4 bg-white">
      {hasMicPermission === false && (
        <Alert variant="destructive" className="mb-4 max-w-4xl mx-auto">
          <AlertTitle>Microphone Access Denied</AlertTitle>
          <AlertDescription>
            Please enable microphone permissions in your browser settings to use voice input.
          </AlertDescription>
        </Alert>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Clean input container */}
        <div className="relative flex items-end gap-3 p-3 bg-gray-100 rounded-2xl border border-gray-300 focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-300 hover:shadow-sm focus-within:shadow-md transition-all duration-300">
          {/* Textarea */}
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

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* File upload */}
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

            {/* Language selector - compact */}
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-[120px] h-9 text-sm border-gray-200">
                <Globe className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Voice controls */}
            <Button 
              onClick={handleMicClick}
              disabled={isMicDisabled && !isAudioPlaying}
              size="icon" 
              className={cn(
                "h-9 w-9 rounded-full transition-all duration-200",
                isRecording
                  ? "bg-red-100 text-red-600 animate-pulse"
                  : isAudioPlaying
                    ? "bg-red-100 text-red-600 hover:bg-red-200"
                    : "bg-gray-600 text-white hover:bg-white hover:text-gray-600"
              )}
              aria-label={isAudioPlaying ? "Stop speaking" : (isRecording ? "Stop recording" : "Start recording")}
            >
              {isAudioPlaying ? <Square className="h-4 w-4" /> : (isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />)}
            </Button>

            {/* Voice chat */}
            <Button 
              onClick={() => setIsVoiceChatOpen(true)}
              disabled={isLoadingResponse || isRecording || isTranscribing}
              size="icon" 
              className="h-9 w-9 rounded-full bg-gray-600 text-white hover:bg-white hover:text-gray-600 transition-all duration-200"
              aria-label="Start voice chat"
            >
              <Phone className="h-4 w-4" />
            </Button>

            {/* Send button */}
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

        {/* Footer text */}
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
        accept=".pdf" 
      />
      <VoiceChatFullScreen 
        isOpen={isVoiceChatOpen} 
        onClose={() => setIsVoiceChatOpen(false)} 
      />
    </div>
  );
}
