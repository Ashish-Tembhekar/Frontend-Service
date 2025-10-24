"use client";

import { useRef, useCallback, useEffect, useState } from 'react';
import { appConfig } from '../lib/config';

// + UPDATED: Interface to match the direct response from the Chatterbox server
interface ChatterboxAudioChunk {
  audio_data: string; // The key is 'audio_data' not 'audio_base64'
  chunk_index: number;
  total_chunks: number;
  text_chunk: string;
  is_final: boolean;
  mime_type: string; // The server should provide this, default to 'audio/wav'
  language: string;
}

interface StreamingAudioState {
  isConnected: boolean;
  isStreaming: boolean;
  isPlaying: boolean;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
  isLoading: boolean; // Loading icon state (request sent, waiting for first chunk)
  progressPercent: number; // Progress bar percentage (0-100)
}

interface TTSParameters {
  exaggeration?: number;
  cfg_weight?: number;
  reference_audio_file?: string | null;
}

export function useStreamingAudio() {
  const wsRef = useRef<WebSocket | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackQueueRef = useRef<ChatterboxAudioChunk[]>([]);
  const isPlayingRef = useRef(false);
  const isConnectingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<StreamingAudioState>({
    isConnected: false,
    isStreaming: false,
    isPlaying: false,
    currentChunk: 0,
    totalChunks: 0,
    error: null,
    isLoading: false,
    progressPercent: 0
  });

  const playNextChunk = useCallback(() => {
    if (playbackQueueRef.current.length === 0) {
      // End of queue
      isPlayingRef.current = false;
      setState(prev => ({ ...prev, isPlaying: false, isStreaming: false, currentChunk: prev.totalChunks, progressPercent: 100, isLoading: false }));
      return;
    }

    const chunk = playbackQueueRef.current.shift()!;

    try {
      // + UPDATED: The key from the server is 'audio_data'
      const audioUrl = `data:${chunk.mime_type || 'audio/wav'};base64,${chunk.audio_data}`;
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      // Calculate progress percentage
      const progressPercent = state.totalChunks > 0
        ? Math.round((chunk.chunk_index / state.totalChunks) * 100)
        : 0;

      audio.onended = () => {
        currentAudioRef.current = null;
        // Update progress as chunks finish playing
        setState(prev => ({ ...prev, progressPercent }));
        // Use a small timeout to prevent race conditions between chunks
        setTimeout(playNextChunk, 240);
      };

      audio.onerror = (error) => {
        console.error('🎵 Audio playback error:', error);
        currentAudioRef.current = null;
        setState(prev => ({ ...prev, isPlaying: false, error: 'Audio playback error', isLoading: false }));
      };

      audio.play().catch(error => {
        console.error('🎵 Error starting audio playback:', error);
        currentAudioRef.current = null;
        setState(prev => ({ ...prev, isPlaying: false, error: 'Failed to start audio playback', isLoading: false }));
      });

    } catch (error) {
      console.error('🎵 Error creating audio element:', error);
      setState(prev => ({ ...prev, error: 'Failed to create audio element', isLoading: false }));
    }
  }, [state.totalChunks]);

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'info':
        // This message from Chatterbox tells us how many chunks to expect
        setState(prev => ({ ...prev, totalChunks: message.total_chunks }));
        break;

      case 'audio_chunk':
        const chunkData: ChatterboxAudioChunk = {
          audio_data: message.audio_data,
          chunk_index: message.chunk_index,
          total_chunks: message.total_chunks,
          text_chunk: message.text_chunk,
          is_final: message.is_final,
          mime_type: 'audio/wav', // Chatterbox sends wav
          language: message.language,
        };

        playbackQueueRef.current.push(chunkData);
        // Hide loading icon once first chunk arrives, show progress bar
        setState(prev => ({ ...prev, isStreaming: true, currentChunk: message.chunk_index + 1, isLoading: false }));

        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          setState(prev => ({ ...prev, isPlaying: true }));
          playNextChunk();
        }
        break;

      case 'error':
        console.error('🎵 TTS service error:', message.error);
        setState(prev => ({ ...prev, error: message.error, isStreaming: false, isPlaying: false, isLoading: false }));
        break;

      default:
        console.log('🎵 Unknown message from TTS service:', message.type);
    }
  }, [playNextChunk]);

  const connect = useCallback(() => {
    if (wsRef.current || isConnectingRef.current || !appConfig.chatterboxTtsUrl) {
      if (!appConfig.chatterboxTtsUrl) {
        console.warn("NEXT_PUBLIC_CHATTERBOX_TTS_URL is not set. Audio streaming is disabled.");
      }
      return;
    }

    isConnectingRef.current = true;
    setState(prev => ({ ...prev, error: null }));

    try {
      // + UPDATED: Connect directly to the Chatterbox service URL
      const wsUrl = appConfig.chatterboxTtsUrl.replace(/^http/, 'ws') + '/tts-stream';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set a timeout to detect if connection doesn't open within 10 seconds
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn('🎵 WebSocket connection timeout, closing...');
          ws.close();
        }
      }, 10000);

      ws.onopen = () => {
        console.log('🎵 Streaming TTS WebSocket connected directly to Chatterbox');
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        isConnectingRef.current = false;
        setState(prev => ({ ...prev, isConnected: true }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing TTS WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🎵 Streaming TTS WebSocket disconnected');
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        isConnectingRef.current = false;
        setState(prev => ({ ...prev, isConnected: false, isStreaming: false, isPlaying: false, isLoading: false }));

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🎵 Attempting to reconnect TTS WebSocket...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('🎵 Streaming TTS WebSocket error:', error);
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        isConnectingRef.current = false;
        setState(prev => ({ ...prev, error: 'WebSocket connection error', isLoading: false }));
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      isConnectingRef.current = false;
      setState(prev => ({ ...prev, error: 'Failed to create WebSocket connection', isLoading: false }));
    }
  }, [handleWebSocketMessage]);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setState(prev => ({ ...prev, isPlaying: false, isStreaming: false }));
  }, []);

  const requestTTS = useCallback((text: string, language: string = 'en', ttsParams?: TTSParameters) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: 'TTS service not connected', isLoading: false }));
      // Attempt to reconnect if not connected
      connect();
      return;
    }

    stopAudio();
    playbackQueueRef.current = [];

    // Show loading icon immediately when request is sent
    setState(prev => ({
      ...prev,
      isStreaming: true,
      isPlaying: false,
      currentChunk: 0,
      totalChunks: 0,
      error: null,
      isLoading: true,
      progressPercent: 0
    }));

    // + UPDATED: Send the request with TTS parameters
    const request = {
      text,
      language,
      exaggeration: ttsParams?.exaggeration ?? 0.5,
      cfg_weight: ttsParams?.cfg_weight ?? 0.5,
      reference_audio_file: ttsParams?.reference_audio_file ?? null
    };

    wsRef.current.send(JSON.stringify(request));
  }, [stopAudio, connect]);

  const disconnect = useCallback(() => {
    stopAudio();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    isConnectingRef.current = false;
    setState({
      isConnected: false,
      isStreaming: false,
      isPlaying: false,
      currentChunk: 0,
      totalChunks: 0,
      error: null,
      isLoading: false,
      progressPercent: 0
    });
  }, [stopAudio]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { ...state, connect, disconnect, requestTTS, stopAudio };
}
