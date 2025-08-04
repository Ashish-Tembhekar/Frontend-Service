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
import { transcribeAudioAPI as transcribeAudio } from '../../services/apiClientNew';
import { VoiceChatModal } from './VoiceChatModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';


export function ChatInputBar() {
  // Fresh compilation to break cache
  const [inputValue, setInputValue] = useState('');
  const { sendMessage, uploadFile, isLoadingResponse, messages, stopCurrentAudio } = useChat();
  
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
      setInputValue("Transcribing audio...");

      try {
        console.log('ChatInputBar - About to call transcribeAudio');
        const transcribeResponse = await transcribeAudio(audioBlob);
        
        const { original_text, translated_text, detected_language } = transcribeResponse;
        
        if (original_text.trim()) {
            // Show original language text in input bar (for user to see what they said)
            setInputValue(original_text);
            
            // Then auto-send English translation to backend after brief delay
            setTimeout(async () => {
              console.log('ChatInputBar - About to call sendMessage with:');
              console.log('ChatInputBar - English query (to backend):', translated_text);
              console.log('ChatInputBar - Original text (for display):', original_text);
              console.log('ChatInputBar - Detected language:', detected_language);
              console.log('ChatInputBar - Selected language:', selectedLanguage);
              setExpectingAudioResponse(true); // Set flag to expect audio response
              try {
                // Use selected language if not auto, otherwise use detected language
                const languageToUse = selectedLanguage === 'auto' ? detected_language : selectedLanguage;
                await sendMessage(translated_text, original_text, true, languageToUse);
              } catch (error) {
                console.error('ChatInputBar - Error in sendMessage:', error);
                toast({
                  title: "Message Send Failed",
                  description: "Could not send your message. Please try again.",
                  variant: "destructive"
                });
                setExpectingAudioResponse(false); // Reset flag on error
              }
              setInputValue(''); // Clear input after sending
            }, 500);
        } else {
            toast({ title: "No speech detected", description: "Couldn't detect any speech in the audio.", variant: "destructive" });
            setExpectingAudioResponse(false); // Reset flag if no speech detected
        }
      } catch (error) {
        toast({ title: "Transcription Failed", description: "Could not process the audio. Please try again.", variant: "destructive" });
        console.error(error);
        setExpectingAudioResponse(false); // Reset flag if transcription fails
      } finally {
        setInputValue('');
        setIsTranscribing(false);
        mediaRecorderRef.current = null;
        // Don't set expectingAudioResponse to false here, as we might still be processing a valid request
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
  <TooltipProvider>
    <div className="w-full px-4 sm:px-6 py-4">
      {hasMicPermission === false && (
        <Alert variant="destructive" className="mb-3 max-w-2xl sm:max-w-3xl md:max-w-4xl mx-auto">
          <AlertTitle>Microphone Access Denied</AlertTitle>
          <AlertDescription>
            Please enable microphone permissions in your browser settings to use voice input.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl w-full max-w-2xl sm:max-w-3xl md:max-w-4xl border border-white/20 dark:border-slate-700/20 shadow-lg mx-auto card-modern">

        {/* Textarea */}
        <div className="flex items-center w-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <Textarea
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder={isRecording ? "Recording..." : (isTranscribing ? "Transcribing..." : "Ask Nexus Chat anything...")}
                className="chat-input-bar-textarea-theme bg-transparent border-none focus:ring-0 resize-none text-slate-700 dark:text-slate-300 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                rows={1}
                disabled={isLoadingResponse || isRecording || isTranscribing}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>Press Enter to send, Shift+Enter for new line</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Buttons & Dropdown */}
        <div className="flex items-center justify-between w-full pl-1">
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isLoadingResponse || isRecording || isTranscribing}
              className="chat-input-bar-plus-button-theme"
              aria-label="Upload file"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            {/* Language Dropdown */}
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
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
          </div>

          <div className="flex items-center gap-1">
            <Button 
              onClick={handleMicClick}
              disabled={isMicDisabled && !isAudioPlaying}
              size="icon" 
              className={cn("chat-input-bar-mic-button-theme", { 
                'listening': isRecording,
                'bg-red-500 hover:bg-red-600 text-white': isAudioPlaying 
              })}
              aria-label={isAudioPlaying ? "Stop speaking" : (isRecording ? "Stop recording" : "Start recording")}
            >
              {isAudioPlaying ? <Square className="h-4 w-4" /> : (isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />)}
            </Button>

            <Button 
              onClick={() => setIsVoiceChatOpen(true)}
              disabled={isLoadingResponse || isRecording || isTranscribing}
              size="icon" 
              className="chat-input-bar-mic-button-theme"
              aria-label="Start voice chat"
            >
              <Phone className="h-4 w-4" />
            </Button>

            <Button 
              onClick={handleSubmit} 
              disabled={isLoadingResponse || !inputValue.trim() || isRecording || isTranscribing} 
              size="icon" 
              className="chat-input-bar-send-button-theme"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf" 
        />

        <VoiceChatModal 
          isOpen={isVoiceChatOpen} 
          onClose={() => setIsVoiceChatOpen(false)} 
        />
      </div>
    </div>
  </TooltipProvider>
);
}
