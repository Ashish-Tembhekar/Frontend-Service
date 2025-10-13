"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/button';
import { X, Mic, MicOff, Volume2 } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useToast } from '../../hooks/use-toast';
import { transcribeAudioAPI as transcribeAudio, transcribeAndAskAPI, transcribeAndAskStreamingAPI } from '../../services/apiClientNew';
import { cn } from '../../lib/utils';
import { useStreamingAudio } from '../../hooks/useStreamingAudio';

// Lottie Animation Component
const LottieAnimation = ({ 
  animationUrl, 
  isPlaying = true, 
  loop = true, 
  className = "",
  speed = 1
}: { 
  animationUrl: string; 
  isPlaying?: boolean; 
  loop?: boolean; 
  className?: string;
  speed?: number;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && containerRef.current && animationUrl) {
      // Load Lottie from CDN
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
      script.onload = () => {
        if (containerRef.current && !animationRef.current && (window as any).lottie) {
          fetch(animationUrl)
            .then(response => response.json())
            .then(animationData => {
              animationRef.current = (window as any).lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: loop,
                autoplay: isPlaying,
                animationData: animationData,
              });
              animationRef.current.setSpeed(speed);
            })
            .catch(() => {
              // Fallback to simple CSS animation if Lottie fails
              if (containerRef.current) {
                containerRef.current.innerHTML = '<div class="w-32 h-32 bg-gray-600 rounded-full animate-pulse"></div>';
              }
            });
        }
      };
      
      if (!(window as any).lottie) {
        document.head.appendChild(script);
      } else {
        script.onload(new Event('load'));
      }
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.destroy();
        animationRef.current = null;
      }
    };
  }, [animationUrl, loop, speed]);

  useEffect(() => {
    if (animationRef.current) {
      if (isPlaying) {
        animationRef.current.play();
      } else {
        animationRef.current.pause();
      }
    }
  }, [isPlaying]);

  return <div ref={containerRef} className={className} />;
};

interface VoiceChatFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceChatFullScreen({ isOpen, onClose }: VoiceChatFullScreenProps) {
  const { sendMessage, addProcessedMessages, isLoadingResponse, messages, stopCurrentAudio } = useChat();
  const { toast } = useToast();

  // Streaming audio hook
  const streamingAudio = useStreamingAudio();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [currentUserText, setCurrentUserText] = useState('');
  const [currentAssistantText, setCurrentAssistantText] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isStreamingMode, setIsStreamingMode] = useState(true); // Enable streaming by default
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>();
  const processedMessageIdRef = useRef<string | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Robust runtime refs for VAD to avoid stale closures
  const isRecordingRef = useRef<boolean>(false);
  const voiceDetectedRef = useRef<boolean>(false);
  const lastVoiceTimeRef = useRef<number>(0);
  const vadAnimationIdRef = useRef<number | null>(null);
  const recordingStartMsRef = useRef<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  // Barge-in detection while assistant is speaking
  const bargeInStreamRef = useRef<MediaStream | null>(null);
  const bargeInAudioContextRef = useRef<AudioContext | null>(null);
  const bargeInAnalyserRef = useRef<AnalyserNode | null>(null);
  const isBargeInActiveRef = useRef<boolean>(false);

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
    setIsMounted(true);
    if (isOpen) {
      // Ensure no previous TTS keeps playing
      try { stopCurrentAudio?.(); } catch {}
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
        audioPlayerRef.current = null;
      }
      setCurrentUserText('');
      setCurrentAssistantText('');
      setIsPlayingResponse(false);
      setIsRecording(false);
      setIsTranscribing(false);
      // Auto-arm microphone: start recording immediately
      setIsInitializing(true);
      handleAutoStartRecording();
      processedMessageIdRef.current = null;
    } else {
      // Modal is closing - cleanup audio
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
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

  // Connect to streaming audio when component mounts and streaming is enabled
  useEffect(() => {
    if (isStreamingMode && isOpen) {
      streamingAudio.connect();
    }

    return () => {
      streamingAudio.disconnect();
    };
  }, [isStreamingMode, isOpen]); // Don't include streamingAudio functions to avoid infinite loops

  // Handle streaming audio state changes
  useEffect(() => {
    if (isStreamingMode) {
      // Update playing state based on streaming audio
      if (streamingAudio.isPlaying && !isPlayingResponse) {
        setIsPlayingResponse(true);
      } else if (!streamingAudio.isPlaying && !streamingAudio.isStreaming && isPlayingResponse) {
        // Audio finished playing
        setIsPlayingResponse(false);
        setCurrentAssistantText('');
        setCurrentUserText('');
        stopBargeInDetector();
      }
    }
  }, [streamingAudio.isPlaying, streamingAudio.isStreaming, isPlayingResponse, isStreamingMode]);

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

  // Start a lightweight VAD while assistant is speaking. If user speaks, stop audio and start recording immediately (barge-in).
  const startBargeInDetector = async () => {
    if (isBargeInActiveRef.current || !isOpen) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      bargeInStreamRef.current = stream;
      bargeInAudioContextRef.current = new AudioContext();
      bargeInAnalyserRef.current = bargeInAudioContextRef.current.createAnalyser();
      const source = bargeInAudioContextRef.current.createMediaStreamSource(stream);
      bargeInAnalyserRef.current.fftSize = 256;
      const bufferLength = bargeInAnalyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      source.connect(bargeInAnalyserRef.current);

      isBargeInActiveRef.current = true;
      const threshold = 25; // lower threshold for quicker detection
      const consecutiveFramesRequired = 2;
      let hotFrames = 0;

      const tick = () => {
        if (!isBargeInActiveRef.current || !bargeInAnalyserRef.current || !isOpen || !isPlayingResponse) return;
        bargeInAnalyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((s, v) => s + v, 0) / bufferLength;
        if (average > threshold) {
          hotFrames += 1;
          if (hotFrames >= consecutiveFramesRequired) {
            // Trigger barge-in
            isBargeInActiveRef.current = false;
            if (audioPlayerRef.current) {
              try { audioPlayerRef.current.pause(); } catch {}
              audioPlayerRef.current = null;
            }
            setIsPlayingResponse(false);
            setCurrentAssistantText('');
            // Use the already-open stream for immediate recording
            if (bargeInStreamRef.current) {
              startRecording(bargeInStreamRef.current);
            }
            stopBargeInDetector();
            return;
          }
        } else {
          hotFrames = 0;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (err) {
      // If permission denied or any error, just skip barge-in
      console.warn('Barge-in detector failed to start:', err);
    }
  };

  const stopBargeInDetector = () => {
    isBargeInActiveRef.current = false;
    try {
      if (bargeInAudioContextRef.current) {
        bargeInAudioContextRef.current.close();
        bargeInAudioContextRef.current = null;
      }
    } catch {}
    if (bargeInStreamRef.current && bargeInStreamRef.current !== streamRef.current) {
      bargeInStreamRef.current.getTracks().forEach(t => t.stop());
      bargeInStreamRef.current = null;
    }
    bargeInAnalyserRef.current = null;
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
      console.log('VoiceChatFullScreen - Audio blob created:', {
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
        console.log('VoiceChatFullScreen - Using parallel transcribe-and-ask processing');
        
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
        
        // Use streaming or traditional API based on setting
        const response = isStreamingMode
          ? await transcribeAndAskStreamingAPI(
              audioBlob,
              conversationHistoryString,
              'auto', // Always use auto-detect for full-screen voice chat
              (text: string, language: string) => {
                // Callback for streaming audio
                console.log('VoiceChatFullScreen - Starting streaming TTS for:', text.substring(0, 100) + '...');
                streamingAudio.requestTTS(text, language);
                setIsPlayingResponse(true);
                setCurrentAssistantText(text.substring(0, 100) + (text.length > 100 ? '...' : ''));
                startBargeInDetector();
              }
            )
          : await transcribeAndAskAPI(
              audioBlob,
              conversationHistoryString,
              'auto', // Always use auto-detect for full-screen voice chat
              true // needs audio for voice interaction
            );
        
        console.log('VoiceChatFullScreen - Parallel processing response:', response);
        
        if (response.original_text && response.original_text.trim()) {
          setCurrentUserText(response.original_text);
          
          // Show original language in input bar
          const inputElement = document.querySelector('textarea');
          if (inputElement) {
            inputElement.value = response.original_text;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Clear the input after a brief delay
            setTimeout(() => {
              inputElement.value = '';
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }, 1000);
          }
          
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
            audioData: isStreamingMode ? undefined : response.audio, // No audio data for streaming mode
          };

          // Use the new method to add pre-processed messages
          addProcessedMessages(userMessage, assistantMessage);
          
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
          title: "Voice Processing Failed",
          description: "Could not process the voice message. Please try again.",
          variant: "destructive"
        });
        console.error('VoiceChatFullScreen - Error in parallel processing:', error);
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
    isRecordingRef.current = true;
    voiceDetectedRef.current = false;
    lastVoiceTimeRef.current = Date.now();
    recordingStartMsRef.current = Date.now();
    setCurrentUserText('');
    setCurrentAssistantText('');
  };

  const setupVoiceActivityDetection = (stream: MediaStream) => {
    try {
      // Close any previous VAD context
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
      }
      audioContextRef.current = new AudioContext();
      // Ensure context is running even if not user-gesture initiated
      try { void audioContextRef.current.resume(); } catch {}
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Use time-domain data for RMS-based detection
      analyserRef.current.fftSize = 1024;
      const bufferLength = analyserRef.current.fftSize;
      const timeDomain = new Uint8Array(bufferLength);

      source.connect(analyserRef.current);

      // Gate silence stopping until we detect actual speech
      let silenceStartMs: number | null = null;
      let hotVoiceFrames = 0;
      const voiceStartRmsThreshold = 0.03; // detect speech onset
      const voiceHotFramesRequired = 3;
      const silenceRmsThreshold = 0.015; // lower is more sensitive to silence
      const silenceDurationMs = 800; // ms of silence before stopping
      const maxRecordingMs = 15000; // hard stop after 15s to avoid hanging

      const checkAudioLevel = () => {
        if (!analyserRef.current || !isRecordingRef.current || !isOpen) return;

        analyserRef.current.getByteTimeDomainData(timeDomain);
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const centered = (timeDomain[i] - 128) / 128; // normalize to [-1, 1]
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        // Map to 0..255-ish for animation
        setAudioLevel(Math.min(255, Math.floor(rms * 1024)));

        const now = Date.now();

        // Hard timeout as a failsafe
        if (now - recordingStartMsRef.current > maxRecordingMs) {
          handleStopRecording();
          return;
        }

        // Detect voice start first
        if (!voiceDetectedRef.current) {
          if (rms > voiceStartRmsThreshold) {
            hotVoiceFrames += 1;
            if (hotVoiceFrames >= voiceHotFramesRequired) {
              voiceDetectedRef.current = true;
              silenceStartMs = null;
              lastVoiceTimeRef.current = now;
            }
          } else {
            hotVoiceFrames = 0;
          }
        } else {
          // After voice is detected, watch for silence to stop
          if (rms < silenceRmsThreshold) {
            if (silenceStartMs === null) silenceStartMs = Date.now();
            if (Date.now() - silenceStartMs >= silenceDurationMs) {
              handleStopRecording();
              return;
            }
          } else {
            silenceStartMs = null;
            lastVoiceTimeRef.current = now;
          }
        }

        vadAnimationIdRef.current = requestAnimationFrame(checkAudioLevel);
      };

      vadAnimationIdRef.current = requestAnimationFrame(checkAudioLevel);
    } catch (error) {
      console.error('Error setting up voice activity detection:', error);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      isRecordingRef.current = false;
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

    // No pre-detection cleanup needed
    if (vadAnimationIdRef.current) {
      cancelAnimationFrame(vadAnimationIdRef.current);
      vadAnimationIdRef.current = null;
    }
  };

  // Manual start: allow starting even if assistant is speaking (stop TTS first)
  const startRecordingManual = async () => {
    try {
      if (isPlayingResponse) {
        try { stopCurrentAudio?.(); } catch {}
        if (audioPlayerRef.current) {
          try { audioPlayerRef.current.pause(); } catch {}
          audioPlayerRef.current = null;
        }
        setIsPlayingResponse(false);
        setCurrentAssistantText('');
        stopBargeInDetector();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      startRecording(stream);
    } catch (error) {
      console.error('Manual mic start failed:', error);
      setHasMicPermission(false);
      toast({
        title: "Microphone Access Denied",
        description: "Please enable microphone permissions to use voice chat.",
        variant: "destructive"
      });
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      // Bypass the isPlayingResponse guard to allow manual interruption
      startRecordingManual();
    }
  };

  // Handle playing response audio (only for traditional mode, not streaming)
  useEffect(() => {
    if (!isStreamingMode && currentUserText && !isTranscribing && !isLoadingResponse) {
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
        
        // Play the audio (ensure only one source)
        const audioUrl = `data:${latestAssistantMessage.audioData.mime_type};base64,${latestAssistantMessage.audioData.audio_base64}`;
        // Stop any previous audio sources in app context and local
        try { stopCurrentAudio?.(); } catch {}
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.currentTime = 0;
          audioPlayerRef.current = null;
        }

        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;
        
        audio.onended = () => {
          setIsPlayingResponse(false);
          setCurrentAssistantText('');
          setCurrentUserText('');
          stopBargeInDetector();
          // Release reference to ensure no overlap next time
          audioPlayerRef.current = null;
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
          stopBargeInDetector();
          audioPlayerRef.current = null;
        };
        
        audio.play()
          .then(() => {
            // Start listening for barge-in while speaking
            startBargeInDetector();
          })
          .catch(error => {
            console.error('Error playing audio:', error);
            setIsPlayingResponse(false);
            setCurrentAssistantText('');
            setCurrentUserText('');
            toast({
              title: "Audio Playback Error",
              description: "Could not play the audio response.",
              variant: "destructive"
            });
            stopBargeInDetector();
          });
      }
    }
  }, [isStreamingMode, currentUserText, isTranscribing, isLoadingResponse, messages, toast]);

  const getStatusMessage = () => {
    if (isInitializing) return "Start speaking...";
    if (isRecording) return "Listening...";
    if (isTranscribing) return "Processing your message...";
    if (isLoadingResponse) return "Thinking...";
    if (isPlayingResponse) {
      if (isStreamingMode && streamingAudio.isStreaming) {
        return `Speaking... (${streamingAudio.currentChunk}/${streamingAudio.totalChunks})`;
      }
      return "Speaking...";
    }

    // Show streaming connection status when idle
    if (isStreamingMode) {
      return streamingAudio.isConnected
        ? "Tap the mic to start (Streaming Ready)"
        : "Tap the mic to start (Connecting...)";
    }

    return "Tap the mic to start";
  };

  const getStatusColor = () => {
    if (isInitializing) return "text-blue-500";
    if (isRecording) return "text-red-500";
    if (isTranscribing || isLoadingResponse) return "text-blue-500";
    if (isPlayingResponse) return "text-green-500";
    return "text-muted-foreground";
  };

  // Simple minimalistic animations - no external library needed
  const getAnimationStyle = () => {
    if (isRecording) {
      // Recording: Simple pulsing circle with audio-reactive scaling
      const scale = 1 + (audioLevel / 255) * 0.3;
      return {
        transform: `scale(${scale})`,
        background: 'linear-gradient(45deg, #ef4444, #f87171)',
        animation: 'pulse 1.5s ease-in-out infinite'
      };
    } else if (isPlayingResponse) {
      // Speaking: Gentle breathing effect
      return {
        background: 'linear-gradient(45deg, #10b981, #34d399)',
        animation: 'breathe 2s ease-in-out infinite'
      };
    } else if (isLoadingResponse || isTranscribing) {
      // Loading: Smooth rotation
      return {
        background: 'linear-gradient(45deg, #3b82f6, #60a5fa)',
        animation: 'spin 2s linear infinite'
      };
    } else {
      // Idle: Subtle pulse
      return {
        background: 'linear-gradient(45deg, #6b7280, #9ca3af)',
        animation: 'slowPulse 3s ease-in-out infinite'
      };
    }
  };

  // Get animation speed based on audio level
  const getAnimationSpeed = () => {
    if (isRecording && audioLevel > 0) {
      return 0.5 + (audioLevel / 255) * 1.5; // Speed between 0.5x and 2x based on audio
    }
    return 1;
  };

  if (!isOpen || !isMounted) return null;

  const overlay = (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center voice-chat-fullscreen">
      {/* Add custom CSS animations */}
      <style jsx>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes slowPulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Main content overlay */}
      <div className="flex flex-col items-center justify-center min-h-screen w-full">
        {/* Center Animation Circle */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative flex flex-col items-center">
            {/* Simple animated circle */}
            <div className="mb-12">
              <div 
                className="w-48 h-48 rounded-full transition-all duration-300 shadow-lg"
                style={getAnimationStyle()}
              />
            </div>
            
            {/* Clean status text */}
            <div className="text-center">
              <p className={`text-lg font-medium ${getStatusColor()}`}>
                {getStatusMessage()}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom control buttons - clean design */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center justify-center gap-6">
          {/* Microphone toggle button */}
          <Button
            onClick={toggleRecording}
            disabled={isTranscribing || isLoadingResponse}
            size="icon"
            className={cn(
              "h-16 w-16 rounded-full transition-all duration-200 shadow-lg",
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-gray-700 hover:bg-gray-800 text-white"
            )}
          >
            {isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>

          {/* Streaming mode toggle */}
          <Button
            onClick={() => setIsStreamingMode(!isStreamingMode)}
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full transition-all duration-200 shadow-lg",
              isStreamingMode
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-gray-400 hover:bg-gray-500 text-white"
            )}
            title={isStreamingMode ? "Streaming Audio (Fast)" : "Traditional Audio (Slower)"}
          >
            <Volume2 className="h-4 w-4" />
          </Button>

          {/* Close button */}
          <Button
            onClick={onClose}
            size="icon"
            className="h-16 w-16 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 shadow-lg transition-all duration-200"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Render as a portal to avoid stacking context/overflow issues
  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : null;
}
