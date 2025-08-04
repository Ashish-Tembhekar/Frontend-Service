"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { X, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Dialog, DialogContent } from '../ui/dialog';
import { useChat } from '../../contexts/ChatContext';
import { useToast } from '../../hooks/use-toast';
import { transcribeAudioAPI as transcribeAudio } from '../../services/apiClientNew';
import { cn } from '../../lib/utils';

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceChatModal({ isOpen, onClose }: VoiceChatModalProps) {
  // Fresh compilation to break cache
  const { sendMessage, isLoadingResponse, messages } = useChat();
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [currentUserText, setCurrentUserText] = useState('');
  const [currentAssistantText, setCurrentAssistantText] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>();
  const processedMessageIdRef = useRef<string | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount or modal close
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentUserText('');
      setCurrentAssistantText('');
      setIsPlayingResponse(false);
      setIsRecording(false);
      setIsTranscribing(false);
      setIsInitializing(true);
      processedMessageIdRef.current = null;
      
      // Auto-start recording when modal opens
      handleAutoStartRecording();
    } else {
      // Modal is closing - cleanup audio
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
        audioPlayerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isOpen]);

  const handleAutoStartRecording = async () => {
    if (isLoadingResponse || isTranscribing || isPlayingResponse) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      setIsInitializing(false);
      startRecording(stream);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasMicPermission(false);
      setIsInitializing(false);
      toast({
        title: "Microphone Access Denied",
        description: "Please enable microphone permissions to use voice chat.",
        variant: "destructive"
      });
    }
  };

  const handleStartRecording = async () => {
    if (isLoadingResponse || isTranscribing || isPlayingResponse) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      startRecording(stream);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasMicPermission(false);
      toast({
        title: "Microphone Access Denied",
        description: "Please enable microphone permissions to use voice chat.",
        variant: "destructive"
      });
    }
  };

  const startRecording = (stream: MediaStream) => {
    if (mediaRecorderRef.current) return;

    streamRef.current = stream;
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunksRef.current = [];

    // Set up voice activity detection
    setupVoiceActivityDetection(stream);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('VoiceChatModal - Audio blob created:', {
        size: audioBlob.size,
        type: audioBlob.type,
        chunks: audioChunksRef.current.length
      });
      
      // Clean up voice activity detection
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      setIsTranscribing(true);
      setCurrentUserText('Processing your message...');

      try {
        console.log('VoiceChatModal - About to call transcribeAudio');
        const transcribeResponse = await transcribeAudio(audioBlob);
        
        const { original_text, translated_text, detected_language } = transcribeResponse;
        
        if (original_text.trim()) {
          setCurrentUserText(original_text);
          
          // Show original language in input bar and send original text to backend
          const inputElement = document.querySelector('textarea');
          if (inputElement) {
            // Show the original language text in the input bar (for user to see what they said)
            inputElement.value = original_text;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Small delay to show the text, then send the English translation to backend
            setTimeout(async () => {
              console.log('VoiceChatModal - About to call sendMessage with:');
              console.log('VoiceChatModal - English query (to backend):', translated_text);
              console.log('VoiceChatModal - Original text (for display):', original_text);
              console.log('VoiceChatModal - Detected language:', detected_language);
              try {
                // Send English translation to backend, display original text in chat, pass detected language
                await sendMessage(translated_text, original_text, true, detected_language);
              } catch (error) {
                console.error('VoiceChatModal - Error in sendMessage:', error);
                toast({
                  title: "Message Send Failed",
                  description: "Could not send your message. Please try again.",
                  variant: "destructive"
                });
              }
              // Clear the input after sending
              inputElement.value = '';
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }, 500);
          } else {
            // Fallback: send directly if input element not found
            console.log('VoiceChatModal - Fallback: About to call sendMessage with:');
            console.log('VoiceChatModal - English query (to backend):', translated_text);
            console.log('VoiceChatModal - Original text (for display):', original_text);
            console.log('VoiceChatModal - Detected language:', detected_language);
            try {
              // Send English translation to backend, display original text in chat, pass detected language
              await sendMessage(translated_text, original_text, true, detected_language);
            } catch (error) {
              console.error('VoiceChatModal - Error in sendMessage (fallback):', error);
              toast({
                title: "Message Send Failed",
                description: "Could not send your message. Please try again.",
                variant: "destructive"
              });
            }
          }
          
        } else {
          toast({
            title: "No speech detected",
            description: "Couldn't detect any speech in the audio.",
            variant: "destructive"
          });
          setCurrentUserText('');
          // Auto-restart recording after a brief delay
          setTimeout(() => {
            if (isOpen) {
              handleAutoStartRecording();
            }
          }, 1000);
        }
      } catch (error) {
        toast({
          title: "Processing Failed",
          description: "Could not process the audio. Please try again.",
          variant: "destructive"
        });
        console.error(error);
        setCurrentUserText('');
        // Auto-restart recording after a brief delay
        setTimeout(() => {
          if (isOpen) {
            handleAutoStartRecording();
          }
        }, 1000);
      } finally {
        setIsTranscribing(false);
        mediaRecorderRef.current = null;
      }
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
    setCurrentUserText('');
    setCurrentAssistantText('');
  };

  const setupVoiceActivityDetection = (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      source.connect(analyserRef.current);
      
      let silenceStart = Date.now();
      const silenceThreshold = 30; // Adjust this value for sensitivity
      const silenceDuration = 2000; // 2 seconds of silence before auto-stop
      
      const checkAudioLevel = () => {
        if (!analyserRef.current || !isRecording || !isOpen) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        
        if (average < silenceThreshold) {
          if (Date.now() - silenceStart > silenceDuration) {
            // Auto-stop recording after silence
            handleStopRecording();
            return;
          }
        } else {
          silenceStart = Date.now();
        }
        
        requestAnimationFrame(checkAudioLevel);
      };
      
      checkAudioLevel();
    } catch (error) {
      console.error('Error setting up voice activity detection:', error);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    
    // Stop the stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clean up voice activity detection
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Handle playing response audio
  useEffect(() => {
    if (currentUserText && !isTranscribing && !isLoadingResponse) {
      // Get the latest assistant message
      const latestAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
      
      if (latestAssistantMessage && latestAssistantMessage.audioData && 
          latestAssistantMessage.id !== processedMessageIdRef.current) {
        processedMessageIdRef.current = latestAssistantMessage.id;
        // Extract text content from HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = latestAssistantMessage.content;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        setCurrentAssistantText(textContent.substring(0, 100) + (textContent.length > 100 ? '...' : ''));
        setIsPlayingResponse(true);
        
        // Play the audio
        const audioUrl = `data:${latestAssistantMessage.audioData.mime_type};base64,${latestAssistantMessage.audioData.audio_base64}`;
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;
        
        audio.onended = () => {
          setIsPlayingResponse(false);
          setCurrentAssistantText('');
          setCurrentUserText('');
          
          // Auto-restart recording after response ends
          setTimeout(() => {
            if (isOpen) {
              handleAutoStartRecording();
            }
          }, 500);
        };
        
        audio.onerror = () => {
          setIsPlayingResponse(false);
          setCurrentAssistantText('');
          setCurrentUserText('');
          toast({
            title: "Audio Playback Error",
            description: "Could not play the audio response.",
            variant: "destructive"
          });
          
          // Auto-restart recording after error
          setTimeout(() => {
            if (isOpen) {
              handleAutoStartRecording();
            }
          }, 500);
        };
        
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          setIsPlayingResponse(false);
          setCurrentAssistantText('');
          setCurrentUserText('');
          toast({
            title: "Audio Playback Error",
            description: "Could not play the audio response.",
            variant: "destructive"
          });
          
          // Auto-restart recording after error
          setTimeout(() => {
            if (isOpen) {
              handleAutoStartRecording();
            }
          }, 500);
        });
      }
    }
  }, [currentUserText, isTranscribing, isLoadingResponse, messages, toast]);

  const getStatusMessage = () => {
    if (isInitializing) return "Initializing...";
    if (isRecording) return "Listening...";
    if (isTranscribing) return "Processing your message...";
    if (isLoadingResponse) return "Thinking...";
    if (isPlayingResponse) return "Speaking...";
    return "Ready to listen";
  };

  const getStatusColor = () => {
    if (isInitializing) return "text-blue-500";
    if (isRecording) return "text-red-500";
    if (isTranscribing || isLoadingResponse) return "text-blue-500";
    if (isPlayingResponse) return "text-green-500";
    return "text-muted-foreground";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-full h-[600px] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Voice Chat</h2>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
          {/* Voice Animation Circle */}
          <div className="relative">
            <div 
              className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
                isInitializing ? "bg-blue-500/20 border-4 border-blue-500 voice-chat-pulse" :
                isRecording ? "bg-red-500/20 border-4 border-red-500 voice-chat-listening" : 
                isTranscribing || isLoadingResponse ? "bg-blue-500/20 border-4 border-blue-500 voice-chat-pulse" :
                isPlayingResponse ? "bg-green-500/20 border-4 border-green-500 voice-chat-speaking" :
                "bg-primary/20 border-4 border-primary"
              )}
            >
              {isInitializing && (
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-pulse opacity-75"></div>
              )}
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-75"></div>
              )}
              {(isTranscribing || isLoadingResponse) && (
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-pulse opacity-75"></div>
              )}
              {isPlayingResponse && (
                <div className="absolute inset-0 rounded-full border-4 border-green-500 animate-pulse opacity-75"></div>
              )}
              
              <div className="relative z-10">
                {isInitializing ? (
                  <Mic className="h-12 w-12 text-blue-500" />
                ) : isRecording ? (
                  <Mic className="h-12 w-12 text-red-500" />
                ) : isPlayingResponse ? (
                  <Volume2 className="h-12 w-12 text-green-500" />
                ) : (
                  <Mic className="h-12 w-12 text-primary" />
                )}
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className="text-center space-y-2">
            <p className={cn("text-lg font-medium", getStatusColor())}>
              {getStatusMessage()}
            </p>
            
            {/* User Text Display */}
            {currentUserText && (
              <div className="bg-primary/10 rounded-lg p-3 max-w-sm">
                <p className="text-sm text-primary font-medium">You said:</p>
                <p className="text-sm mt-1">{currentUserText}</p>
              </div>
            )}
            
            {/* Assistant Text Display */}
            {currentAssistantText && (
              <div className="bg-muted rounded-lg p-3 max-w-sm">
                <p className="text-sm text-muted-foreground font-medium">Assistant:</p>
                <p className="text-sm mt-1">{currentAssistantText}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {isRecording && (
              <Button
                size="lg"
                onClick={handleStopRecording}
                className="bg-red-500 hover:bg-red-600 text-white rounded-full px-8"
              >
                <MicOff className="h-5 w-5 mr-2" />
                Stop Recording
              </Button>
            )}
          </div>

          {/* Permission Error */}
          {hasMicPermission === false && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 max-w-sm">
              <p className="text-sm text-destructive text-center">
                Microphone access is required for voice chat. Please enable it in your browser settings.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 