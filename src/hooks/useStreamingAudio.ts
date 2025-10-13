"use client";

import { useRef, useCallback, useEffect, useState } from 'react';
import { appConfig } from '../lib/config';

interface AudioChunk {
  audio_base64: string;
  chunk_index: number;
  total_chunks: number;
  text_chunk: string;
  is_final: boolean;
  mime_type: string;
  language: string;
}

interface StreamingAudioState {
  isConnected: boolean;
  isStreaming: boolean;
  isPlaying: boolean;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
}

export function useStreamingAudio() {
  const wsRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackQueueRef = useRef<AudioChunk[]>([]);
  const isPlayingRef = useRef(false);
  const isConnectingRef = useRef(false);
  
  const [state, setState] = useState<StreamingAudioState>({
    isConnected: false,
    isStreaming: false,
    isPlaying: false,
    currentChunk: 0,
    totalChunks: 0,
    error: null
  });

  // Play the next chunk in the queue
  const playNextChunk = useCallback(() => {
    if (playbackQueueRef.current.length === 0) {
      return;
    }

    const chunk = playbackQueueRef.current.shift()!;

    try {
      // Create audio element for this chunk
      const audioUrl = `data:${chunk.mime_type};base64,${chunk.audio_base64}`;
      const audio = new Audio(audioUrl);

      // Store reference to current audio
      currentAudioRef.current = audio;
      isPlayingRef.current = true;

      setState(prev => ({ ...prev, isPlaying: true }));

      audio.onended = () => {
        console.log('🎵 Chunk playback ended, playing next...');
        isPlayingRef.current = false;
        currentAudioRef.current = null;

        // Play next chunk if available
        if (playbackQueueRef.current.length > 0) {
          // Use setTimeout to avoid direct recursion in the callback
          setTimeout(() => playNextChunk(), 0);
        } else {
          setState(prev => ({ ...prev, isPlaying: false }));
        }
      };

      audio.onerror = (error) => {
        console.error('🎵 Audio playback error:', error);
        isPlayingRef.current = false;
        currentAudioRef.current = null;
        setState(prev => ({ ...prev, isPlaying: false, error: 'Audio playback error' }));
      };

      // Start playback
      audio.play().catch(error => {
        console.error('🎵 Error starting audio playback:', error);
        isPlayingRef.current = false;
        currentAudioRef.current = null;
        setState(prev => ({ ...prev, isPlaying: false, error: 'Failed to start audio playback' }));
      });

    } catch (error) {
      console.error('🎵 Error creating audio element:', error);
      setState(prev => ({ ...prev, error: 'Failed to create audio element' }));
    }
  }, []);

  // Handle individual audio chunks
  const handleAudioChunk = useCallback((chunk: AudioChunk) => {
    // Add chunk to playback queue
    playbackQueueRef.current.push(chunk);

    // Update state
    setState(prev => ({
      ...prev,
      currentChunk: chunk.chunk_index + 1,
      totalChunks: chunk.total_chunks
    }));

    // Start playback if not already playing
    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [playNextChunk]);

  // Handle fallback audio (single combined audio)
  const handleFallbackAudio = useCallback((audioData: any) => {
    try {
      const audioUrl = `data:${audioData.mime_type};base64,${audioData.audio_base64}`;
      const audio = new Audio(audioUrl);

      currentAudioRef.current = audio;
      setState(prev => ({ ...prev, isPlaying: true, isStreaming: false }));

      audio.onended = () => {
        setState(prev => ({ ...prev, isPlaying: false }));
        currentAudioRef.current = null;
      };

      audio.onerror = (error) => {
        console.error('🎵 Fallback audio error:', error);
        setState(prev => ({ ...prev, isPlaying: false, error: 'Fallback audio playback error' }));
      };

      audio.play().catch(error => {
        console.error('🎵 Error playing fallback audio:', error);
        setState(prev => ({ ...prev, isPlaying: false, error: 'Failed to play fallback audio' }));
      });

    } catch (error) {
      console.error('🎵 Error with fallback audio:', error);
      setState(prev => ({ ...prev, error: 'Fallback audio error' }));
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'tts_started':
        console.log('🎵 TTS streaming started');
        setState(prev => ({ ...prev, isStreaming: true, currentChunk: 0, totalChunks: 0 }));
        break;

      case 'tts_audio_chunk':
        console.log('🎵 Received audio chunk:', message.data.chunk_index + 1, '/', message.data.total_chunks);
        handleAudioChunk(message.data);
        break;

      case 'tts_complete':
        console.log('🎵 TTS streaming completed');
        setState(prev => ({ ...prev, isStreaming: false }));
        break;

      case 'tts_fallback':
        console.log('🎵 TTS fallback audio received');
        handleFallbackAudio(message.data);
        break;

      case 'error':
        console.error('🎵 TTS error:', message.message);
        setState(prev => ({ ...prev, error: message.message, isStreaming: false }));
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('🎵 Unknown message type:', message.type);
    }
  }, [handleAudioChunk, handleFallbackAudio]);

  // Connect to streaming TTS WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnectingRef.current) {
      return; // Already connected or connecting
    }

    isConnectingRef.current = true;

    try {
      const wsUrl = appConfig.fastApiBaseUrl.replace('http', 'ws') + '/ws/streaming-tts';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🎵 Streaming TTS WebSocket connected');
        isConnectingRef.current = false;
        setState(prev => ({ ...prev, isConnected: true, error: null }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🎵 Streaming TTS WebSocket disconnected');
        isConnectingRef.current = false;
        setState(prev => ({ ...prev, isConnected: false }));
      };

      ws.onerror = (error) => {
        console.error('🎵 Streaming TTS WebSocket error:', error);
        isConnectingRef.current = false;
        setState(prev => ({ ...prev, error: 'WebSocket connection error' }));
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      isConnectingRef.current = false;
      setState(prev => ({ ...prev, error: 'Failed to create WebSocket connection' }));
    }
  }, [handleWebSocketMessage]);

  // Stop current audio playback
  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    // Clear audio queue
    audioQueueRef.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    audioQueueRef.current = [];
    playbackQueueRef.current = [];

    isPlayingRef.current = false;
    setState(prev => ({ ...prev, isPlaying: false, isStreaming: false }));
  }, []);

  // Request TTS for text
  const requestTTS = useCallback((text: string, language: string = 'en') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: 'WebSocket not connected' }));
      return;
    }

    // Clear previous state
    playbackQueueRef.current = [];
    stopAudio();

    setState(prev => ({
      ...prev,
      isStreaming: true,
      isPlaying: false,
      currentChunk: 0,
      totalChunks: 0,
      error: null
    }));

    // Send TTS request
    const request = {
      type: 'tts_request',
      text,
      language
    };

    wsRef.current.send(JSON.stringify(request));
  }, [stopAudio]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    // Stop audio directly without dependency
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    // Clear audio queue
    audioQueueRef.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    audioQueueRef.current = [];
    playbackQueueRef.current = [];
    isPlayingRef.current = false;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isConnectingRef.current = false;
    setState(prev => ({ ...prev, isConnected: false, isStreaming: false, isPlaying: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []); // Empty dependency array since disconnect is stable

  return {
    ...state,
    connect,
    disconnect,
    requestTTS,
    stopAudio
  };
}
