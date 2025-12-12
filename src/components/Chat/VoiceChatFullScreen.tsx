"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, Mic, MicOff } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useToast } from '@/hooks/use-toast';
import { transcribeAndAskStreamingAPI } from '@/services/apiClientNew';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { logUsageToFirestore } from '@/services/usageLogger';
import SiriWave from 'siriwave';

interface VoiceChatFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceChatFullScreen({ isOpen, onClose }: VoiceChatFullScreenProps) {
  const {
    addProcessedMessages,
    isLoadingResponse,
    messages,
    stopCurrentAudio,
    requestTTS,
    ttsIsPlaying,
    ttsIsStreaming,
    ttsIsConnected,
  } = useChat();
  const { toast } = useToast();
  const { user } = useAuth(); // Get authenticated user for usage tracking

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [currentUserText, setCurrentUserText] = useState('');
  const [currentAssistantText, setCurrentAssistantText] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Ref for SiriWave instance and container
  const siriWaveRef = useRef<SiriWave | null>(null);
  const siriContainerRef = useRef<HTMLDivElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const processedMessageIdRef = useRef<string | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vadAnimationIdRef = useRef<number | null>(null);
  const recordingStartMsRef = useRef<number>(0);
  const [isMounted, setIsMounted] = useState(false);

  const isRecordingRef = useRef<boolean>(false);
  const voiceDetectedRef = useRef<boolean>(false);
  const lastVoiceTimeRef = useRef<number>(0);

  const bargeInStreamRef = useRef<MediaStream | null>(null);
  const bargeInAudioContextRef = useRef<AudioContext | null>(null);
  const bargeInAnalyserRef = useRef<AnalyserNode | null>(null);
  const isBargeInActiveRef = useRef<boolean>(false);

  // Animation frame reference for the wave update loop
  const waveAnimationFrameRef = useRef<number | null>(null);
  // Current audio level (0-255) from mic
  const audioLevelRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
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
      if (siriWaveRef.current) {
        siriWaveRef.current.stop();
        siriWaveRef.current = null;
      }
      if (waveAnimationFrameRef.current) {
        cancelAnimationFrame(waveAnimationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
    if (isOpen) {
      try { stopCurrentAudio?.(); } catch { }
      setCurrentUserText('');
      setCurrentAssistantText('');
      setIsPlayingResponse(false);
      setIsRecording(false);
      setIsTranscribing(false);
      setIsInitializing(true);
      handleAutoStartRecording();
      processedMessageIdRef.current = null;
    } else {
      stopCleanup();
    }
  }, [isOpen]);

  const stopCleanup = () => {
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
    if (siriWaveRef.current) {
      siriWaveRef.current.stop();
      siriWaveRef.current = null;
    }
  };

  // Initialize SiriWave when container is ready
  useEffect(() => {
    if (isOpen && siriContainerRef.current && !siriWaveRef.current) {
      try {
        console.log("Initializing SiriWave");
        siriWaveRef.current = new SiriWave({
          container: siriContainerRef.current,
          width: siriContainerRef.current.offsetWidth || 600,
          height: 400,
          style: 'ios9',
          speed: 0.1,
          amplitude: 0.4,
          autostart: true,
        });
      } catch (e) {
        console.error("SiriWave initialization failed", e);
      }
    }
  }, [isOpen]);

  // Handle resizing of the SiriWave container
  useEffect(() => {
    const handleResize = () => {
      if (siriWaveRef.current && siriContainerRef.current) {
        // SiriWave might need recreation for width changes or assume CSS handles it
        // Check if siriwave instance has resize method? No.
        // But the canvas style usually fits.
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main Waveform Animation Loop
  useEffect(() => {
    if (!isOpen) return;

    let phase = 0;

    const animateWave = () => {
      if (!siriWaveRef.current) {
        waveAnimationFrameRef.current = requestAnimationFrame(animateWave);
        return;
      }

      let targetAmplitude = 0;
      let targetSpeed = 0.1;

      if (isRecordingRef.current) {
        // Microphone Input Logic
        // Map 0-255 audio level to amplitude
        const level = audioLevelRef.current / 255;
        // Make it sensitive
        targetAmplitude = level > 0.01 ? Math.min(1.5, level * 2.5) : 0.1;
        targetSpeed = 0.2;
      } else if (isPlayingResponse) {
        // TTS Playback Logic (Simulated)
        // Create a chaotic "speaking" waveform
        phase += 0.2;
        const base = Math.abs(Math.sin(phase));
        const noise = Math.random() * 0.5;
        targetAmplitude = (base * 0.6 + noise * 0.4) + 0.2;
        targetSpeed = 0.25;
      } else if (isLoadingResponse || isTranscribing) {
        // Thinking state
        targetAmplitude = 0.2 + Math.sin(Date.now() / 400) * 0.1;
        targetSpeed = 0.1;
      } else {
        // Idle
        targetAmplitude = 0.05;
        targetSpeed = 0.05;
      }

      // Smooth interpolation
      const currentAmp = (siriWaveRef.current as any).amplitude || 0;
      const newAmp = currentAmp + (targetAmplitude - currentAmp) * 0.15;

      try {
        siriWaveRef.current.setAmplitude(newAmp);
        siriWaveRef.current.setSpeed(targetSpeed);
      } catch (e) {
        // Ignore errors if instance disposed
      }

      waveAnimationFrameRef.current = requestAnimationFrame(animateWave);
    };

    waveAnimationFrameRef.current = requestAnimationFrame(animateWave);

    return () => {
      if (waveAnimationFrameRef.current) {
        cancelAnimationFrame(waveAnimationFrameRef.current);
      }
    };
  }, [isOpen, isPlayingResponse, isLoadingResponse, isTranscribing]);


  // Handle streaming audio state changes
  useEffect(() => {
    if (ttsIsPlaying && !isPlayingResponse) {
      setIsPlayingResponse(true);
    } else if (!ttsIsPlaying && !ttsIsStreaming && isPlayingResponse) {
      setIsPlayingResponse(false);
      setCurrentAssistantText('');
      setCurrentUserText('');
      stopBargeInDetector();
    }
  }, [ttsIsPlaying, ttsIsStreaming, isPlayingResponse]);

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
      const threshold = 25;
      const consecutiveFramesRequired = 2;
      let hotFrames = 0;

      const tick = () => {
        if (!isBargeInActiveRef.current || !bargeInAnalyserRef.current || !isOpen || !isPlayingResponse) return;
        bargeInAnalyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((s, v) => s + v, 0) / bufferLength;
        if (average > threshold) {
          hotFrames += 1;
          if (hotFrames >= consecutiveFramesRequired) {
            isBargeInActiveRef.current = false;
            stopCurrentAudio(); // Stop streaming audio playback
            setIsPlayingResponse(false);
            setCurrentAssistantText('');
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
    } catch { }
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

    setupVoiceActivityDetection(stream);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setIsTranscribing(true);
      setCurrentUserText('Processing your message...');

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

        const voiceResponseMessageId = `msg_voice_${Date.now()}`;

        const response = await transcribeAndAskStreamingAPI(
          audioBlob,
          conversationHistoryString,
          'auto',
          (text: string, language: string) => {
            console.log('VoiceChatFullScreen - Starting streaming TTS for:', text.substring(0, 100) + '...');
            requestTTS(text, voiceResponseMessageId, language, true);
            setIsPlayingResponse(true);
            setCurrentAssistantText(text.substring(0, 100) + (text.length > 100 ? '...' : ''));
            startBargeInDetector();
          },
          user?.uid
        );

        if (response.usage && user?.uid) {
          await logUsageToFirestore(user.uid, response.usage);
        }

        if (response.original_text && response.original_text.trim()) {
          setCurrentUserText(response.original_text);

          const inputElement = document.querySelector('textarea');
          if (inputElement) {
            inputElement.value = response.original_text;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => {
              inputElement.value = '';
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }, 1000);
          }

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
            audioData: undefined,
          };

          addProcessedMessages(userMessage, assistantMessage, true);

        } else {
          toast({ title: "No speech detected", description: "Couldn't detect any speech in the audio.", variant: "destructive" });
          setCurrentUserText('');
          setTimeout(() => { if (isOpen) { handleAutoStartRecording(); } }, 1000);
        }
      } catch (error) {
        toast({ title: "Voice Processing Failed", description: "Could not process the voice message. Please try again.", variant: "destructive" });
        console.error('VoiceChatFullScreen - Error in processing:', error);
        setCurrentUserText('');
        setTimeout(() => { if (isOpen) { handleAutoStartRecording(); } }, 1000);
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
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch { }
      }
      audioContextRef.current = new AudioContext();
      try { void audioContextRef.current.resume(); } catch { }
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current.fftSize = 1024;
      const bufferLength = analyserRef.current.fftSize;
      const timeDomain = new Uint8Array(bufferLength);
      source.connect(analyserRef.current);

      let silenceStartMs: number | null = null;
      let hotVoiceFrames = 0;
      const voiceStartRmsThreshold = 0.03;
      const voiceHotFramesRequired = 3;
      const silenceRmsThreshold = 0.015;
      const silenceDurationMs = 800;
      const maxRecordingMs = 15000;

      const checkAudioLevel = () => {
        if (!analyserRef.current || !isRecordingRef.current || !isOpen) return;
        analyserRef.current.getByteTimeDomainData(timeDomain);
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const centered = (timeDomain[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        // Update audio level ref for SiriWave
        audioLevelRef.current = Math.min(255, Math.floor(rms * 1024));

        const now = Date.now();

        if (now - recordingStartMsRef.current > maxRecordingMs) {
          handleStopRecording();
          return;
        }
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
      audioLevelRef.current = 0; // Reset level
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (vadAnimationIdRef.current) {
      cancelAnimationFrame(vadAnimationIdRef.current);
      vadAnimationIdRef.current = null;
    }
  };

  const startRecordingManual = async () => {
    try {
      if (isPlayingResponse) {
        stopCurrentAudio();
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
      toast({ title: "Microphone Access Denied", description: "Please enable microphone permissions to use voice chat.", variant: "destructive" });
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      startRecordingManual();
    }
  };

  const getStatusMessage = () => {
    if (isInitializing) return "Start speaking...";
    if (isRecording) return "Listening...";
    if (isTranscribing) return "Processing your message...";
    if (isLoadingResponse) return "Thinking...";
    if (isPlayingResponse) {
      if (ttsIsStreaming) {
        return `Speaking...`;
      }
      return "Processing...";
    }
    return ttsIsConnected
      ? "Tap the mic to start (Streaming Ready)"
      : "Tap the mic to start (Connecting...)";
  };

  const getStatusColor = () => {
    if (isInitializing) return "text-blue-500";
    if (isRecording) return "text-red-500";
    if (isTranscribing || isLoadingResponse) return "text-blue-500";
    if (isPlayingResponse) return "text-green-500";
    return "text-muted-foreground";
  };

  if (!isOpen || !isMounted) return null;

  const overlay = (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center voice-chat-fullscreen">
      <div className="flex flex-col items-center justify-center min-h-screen w-full">
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <div className="relative flex flex-col items-center w-full max-w-4xl">
            {/* SiriWave Container */}
            <div className="w-full h-64 flex items-center justify-center overflow-hidden mb-8">
              <div ref={siriContainerRef} className="w-full h-full" />
            </div>

            <div className="text-center z-10">
              <p className={`text-lg font-medium transition-colors duration-300 ${getStatusColor()}`}>{getStatusMessage()}</p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center justify-center gap-6">
          <Button
            onClick={toggleRecording}
            disabled={isTranscribing || isLoadingResponse}
            size="icon"
            className={cn("h-16 w-16 rounded-full transition-all duration-200 shadow-lg", isRecording ? "bg-red-500 hover:bg-red-600 text-white" : "bg-gray-700 hover:bg-gray-800 text-white")}
          >
            {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          <Button onClick={onClose} size="icon" className="h-16 w-16 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 shadow-lg transition-all duration-200">
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : null;
}
