"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/button';
import { X, Mic, MicOff, Volume2 } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useToast } from '../../hooks/use-toast';
import { transcribeAudioAPI as transcribeAudio } from '../../services/apiClientNew';
import { cn } from '../../lib/utils';

interface VoiceChatFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceChatFullScreen({ isOpen, onClose }: VoiceChatFullScreenProps) {
  const { sendMessage, isLoadingResponse, messages, stopCurrentAudio } = useChat();
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [currentUserText, setCurrentUserText] = useState('');
  const [currentAssistantText, setCurrentAssistantText] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
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
        console.log('VoiceChatFullScreen - About to call transcribeAudio');
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
              console.log('VoiceChatFullScreen - About to call sendMessage with:');
              console.log('VoiceChatFullScreen - English query (to backend):', translated_text);
              console.log('VoiceChatFullScreen - Original text (for display):', original_text);
              console.log('VoiceChatFullScreen - Detected language:', detected_language);
              try {
                // Send English translation to backend, display original text in chat, pass detected language
                await sendMessage(translated_text, original_text, true, detected_language);
              } catch (error) {
                console.error('VoiceChatFullScreen - Error in sendMessage:', error);
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
            console.log('VoiceChatFullScreen - Fallback: About to call sendMessage with:');
            console.log('VoiceChatFullScreen - English query (to backend):', translated_text);
            console.log('VoiceChatFullScreen - Original text (for display):', original_text);
            console.log('VoiceChatFullScreen - Detected language:', detected_language);
            try {
              // Send English translation to backend, display original text in chat, pass detected language
              await sendMessage(translated_text, original_text, true, detected_language);
            } catch (error) {
              console.error('VoiceChatFullScreen - Error in sendMessage (fallback):', error);
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
  }, [currentUserText, isTranscribing, isLoadingResponse, messages, toast]);

  const getStatusMessage = () => {
    if (isInitializing) return "Start speaking...";
    if (isRecording) return "Listening...";
    if (isTranscribing) return "Processing your message...";
    if (isLoadingResponse) return "Thinking...";
    if (isPlayingResponse) return "Speaking...";
    return "Tap the mic to start";
  };

  const getStatusColor = () => {
    if (isInitializing) return "text-blue-500";
    if (isRecording) return "text-red-500";
    if (isTranscribing || isLoadingResponse) return "text-blue-500";
    if (isPlayingResponse) return "text-green-500";
    return "text-muted-foreground";
  };

  // Canvas animation for dynamic cloud/mist effect
  const drawAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Create gradient background
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)'); // Blue center
    gradient.addColorStop(0.5, 'rgba(147, 197, 253, 0.1)'); // Light blue
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Transparent edges

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw animated clouds/mist particles
    const time = Date.now() * 0.001;
    const particleCount = 60;
    const baseSize = 15 + (audioLevel / 15); // Size based on audio level
    const audioIntensity = audioLevel / 255; // Normalize audio level

    for (let i = 0; i < particleCount; i++) {
      const x = (width / 2) + Math.sin(time + i * 0.1) * (120 + audioLevel * 0.8);
      const y = (height / 2) + Math.cos(time + i * 0.15) * (100 + audioLevel * 0.6);
      const size = baseSize + Math.sin(time * 2 + i) * 8 + (audioIntensity * 15);
      const opacity = 0.2 + (audioIntensity * 0.5);

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(147, 197, 253, ${opacity})`;
      ctx.fill();
    }

    // Draw additional wave effects when recording
    if (isRecording) {
      const waveCount = 4;
      for (let w = 0; w < waveCount; w++) {
        const waveRadius = 120 + w * 25 + Math.sin(time * 4) * 15;
        const waveOpacity = 0.15 - w * 0.03;
        const waveColor = w === 0 ? 'rgba(239, 68, 68, 0.2)' : `rgba(239, 68, 68, ${waveOpacity})`;
        
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, waveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = waveColor;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // Draw floating orbs that respond to audio
    if (audioLevel > 50) {
      const orbCount = Math.floor(audioIntensity * 8) + 2;
      for (let o = 0; o < orbCount; o++) {
        const orbX = (width / 2) + Math.cos(time * 0.5 + o) * (80 + audioLevel * 0.3);
        const orbY = (height / 2) + Math.sin(time * 0.7 + o) * (60 + audioLevel * 0.2);
        const orbSize = 8 + (audioIntensity * 12);
        const orbOpacity = 0.4 + (audioIntensity * 0.3);
        
        ctx.beginPath();
        ctx.arc(orbX, orbY, orbSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${orbOpacity})`;
        ctx.fill();
      }
    }

    // Continue animation
    animationRef.current = requestAnimationFrame(drawAnimation);
  }, [audioLevel, isRecording]);

  // Start/stop animation
  useEffect(() => {
    if (isOpen) {
      drawAnimation();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, drawAnimation]);

  if (!isOpen || !isMounted) return null;

  const overlay = (
    <div className="fixed inset-0 z-[9999] bg-white !bg-opacity-100 flex flex-col items-center justify-center voice-chat-fullscreen" style={{ backgroundColor: '#ffffff' }}>
      {/* Canvas for dynamic animation */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        width={window.innerWidth}
        height={window.innerHeight}
      />

      {/* Main content overlay - centered (no text overlays) */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full">
        <div className="flex-1" />

        {/* Bottom control buttons - fixed at bottom center */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center justify-center gap-8">
          {/* Microphone toggle button */}
          <Button
            onClick={toggleRecording}
            disabled={isTranscribing || isLoadingResponse}
            size="icon"
            className={cn(
              "h-20 w-20 rounded-full transition-all duration-300 shadow-2xl border-4 border-white",
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white voice-chat-recording-pulse"
                : "bg-blue-600 hover:bg-blue-700 text-white voice-chat-button-pulse"
            )}
          >
            {isRecording ? (
              <MicOff className="h-10 w-10" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
          </Button>

          {/* Close button */}
          <Button
            onClick={onClose}
            size="icon"
            className="h-20 w-20 rounded-full bg-gray-600 hover:bg-gray-700 text-white shadow-2xl transition-all duration-300 voice-chat-button-pulse border-4 border-white"
          >
            <X className="h-10 w-10" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Render as a portal to avoid stacking context/overflow issues
  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : null;
}
