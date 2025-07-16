// src/components/Chat/ChatInputBar.tsx
"use client";

import React, { useState, useRef, type ChangeEvent, type KeyboardEvent, useEffect } from 'react';
import { Button } from '../ui/button';
import { Plus, Send, X, Mic, MicOff, Phone } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { Textarea } from '../ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { appConfig } from '../../lib/config';
import { cn } from '../../lib/utils';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { transcribeAudioAPI as transcribeAudio } from '../../services/apiClientNew';
import { VoiceChatModal } from './VoiceChatModal';

export function ChatInputBar() {
  // Fresh compilation to break cache
  const [inputValue, setInputValue] = useState('');
  const { sendMessage, uploadFile, isLoadingResponse, messages } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const processedMessageIdRef = useRef<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [expectingAudioResponse, setExpectingAudioResponse] = useState(false);

  const { toast } = useToast();
  
  // Handle playing response audio when using microphone
  useEffect(() => {
    if (expectingAudioResponse && !isLoadingResponse) {
      // Get the latest assistant message
      const latestAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
      
      if (latestAssistantMessage && latestAssistantMessage.audioData && 
          latestAssistantMessage.id !== processedMessageIdRef.current) {
        processedMessageIdRef.current = latestAssistantMessage.id;
        
        // Play the audio response
        const audioUrl = `data:${latestAssistantMessage.audioData.mime_type};base64,${latestAssistantMessage.audioData.audio_base64}`;
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;
        
        audio.onended = () => {
          setExpectingAudioResponse(false);
          audioPlayerRef.current = null;
        };
        
        audio.onerror = () => {
          setExpectingAudioResponse(false);
          audioPlayerRef.current = null;
          toast({
            title: "Audio Playback Error",
            description: "Could not play the audio response.",
            variant: "destructive"
          });
        };
        
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          setExpectingAudioResponse(false);
          audioPlayerRef.current = null;
          toast({
            title: "Audio Playback Error",
            description: "Could not play the audio response.",
            variant: "destructive"
          });
        });
      }
    }
  }, [messages, expectingAudioResponse, isLoadingResponse, toast]);
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);
  
  const handleMicClick = async () => {
    if (isLoadingResponse || isTranscribing) return;

    if (isRecording) {
      stopRecording();
      return;
    }

    // Stop any currently playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
      setExpectingAudioResponse(false);
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
              setExpectingAudioResponse(true); // Set flag to expect audio response
              try {
                // Send English translation to backend, display original text in chat, pass detected language
                await sendMessage(translated_text, original_text, true, detected_language);
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
    if (event.target.files) {
      const file = event.target.files[0];
      if (file) {
        if (file.size > appConfig.maxFileSizeMB * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `Please upload a file smaller than ${appConfig.maxFileSizeMB}MB.`,
            variant: "destructive",
          });
          return;
        }
        await uploadFile(file);
      }
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async () => {
    if (isLoadingResponse || !inputValue.trim()) return;
    
    if (isRecording) {
      stopRecording();
    }
    
    // Stop any currently playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
      setExpectingAudioResponse(false);
    }
    
    await sendMessage(inputValue); // Regular text input - no audio playback
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
    <div className="w-full px-3 sm:px-4 py-3">
        {hasMicPermission === false && (
            <Alert variant="destructive" className="mb-2 max-w-2xl sm:max-w-3xl md:max-w-4xl mx-auto">
              <AlertTitle>Microphone Access Denied</AlertTitle>
              <AlertDescription>
                Please enable microphone permissions in your browser settings to use voice input.
              </AlertDescription>
            </Alert>
        )}
        <div className="flex flex-col gap-2 p-2.5 bg-card rounded-xl w-full max-w-2xl sm:max-w-3xl md:max-w-4xl border border-border pointer-events-auto shadow-sm mx-auto">
          <div className="flex items-center w-full">
            <Textarea
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={isRecording ? "Recording..." : (isTranscribing ? "Transcribing..." : "Ask Nexus Chat...")}
              className="chat-input-bar-textarea-theme"
              rows={1}
              disabled={isLoadingResponse || isRecording || isTranscribing}
            />
          </div>

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
            </div>
            
            <div className="flex items-center gap-1">
                <Button 
                    onClick={handleMicClick}
                    disabled={isMicDisabled}
                    size="icon" 
                    className={cn("chat-input-bar-mic-button-theme", { 'listening': isRecording })}
                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
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
        </div>
        
        <VoiceChatModal 
          isOpen={isVoiceChatOpen} 
          onClose={() => setIsVoiceChatOpen(false)} 
        />
    </div>
  );
}
