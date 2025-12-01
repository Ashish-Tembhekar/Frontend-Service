"use client";

import { useRef, useCallback, useEffect, useState } from 'react';
import { appConfig } from '../lib/config';
import { TTSUsageData } from '../services/usageLogger';
import { createAudioUrl, revokeAudioUrl, mergeWavChunks } from '../lib/audioUtils';
import { saveAudio } from '../services/audioStorage';

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
  isPaused: boolean; // NEW: Track if user has paused during streaming
  currentChunk: number;
  totalChunks: number;
  error: string | null;
  isLoading: boolean; // Loading icon state (request sent, waiting for first chunk)
  progressPercent: number; // Progress bar percentage (0-100)
  ttsUsage: TTSUsageData | null; // TTS usage data from the service
  currentMessageId: string | null; // The message ID for which audio is being generated
  mergedAudioUrl: string | null; // The URL of the merged audio blob once complete
  streamingPlaybackPosition: number; // NEW: Cumulative playback position in seconds during streaming
}

interface TTSParameters {
  exaggeration?: number;
  cfg_weight?: number;
  reference_audio_file?: string | null;
}

// Callback type for when audio merging is complete
export type OnAudioCompleteCallback = (messageId: string, audioUrl: string) => void;

export function useStreamingAudio(onAudioComplete?: OnAudioCompleteCallback) {
  const wsRef = useRef<WebSocket | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackQueueRef = useRef<ChatterboxAudioChunk[]>([]);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false); // NEW: Track paused state in ref for immediate access
  const isConnectingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());

  // + NEW: Refs for audio accumulation and message tracking
  const audioBufferRef = useRef<string[]>([]); // Accumulated base64 audio chunks
  const currentMessageIdRef = useRef<string | null>(null); // Current message ID for TTS
  const onAudioCompleteRef = useRef<OnAudioCompleteCallback | undefined>(onAudioComplete);

  // + NEW: Refs for tracking playback position during streaming
  const completedChunksDurationRef = useRef<number>(0); // Total duration of all finished chunks
  const currentChunkStartTimeRef = useRef<number | null>(null); // When current chunk started playing

  // Keep the callback ref updated
  useEffect(() => {
    onAudioCompleteRef.current = onAudioComplete;
  }, [onAudioComplete]);

  const [state, setState] = useState<StreamingAudioState>({
    isConnected: false,
    isStreaming: false,
    isPlaying: false,
    isPaused: false, // NEW: Initial paused state
    currentChunk: 0,
    totalChunks: 0,
    error: null,
    isLoading: false,
    progressPercent: 0,
    ttsUsage: null,
    currentMessageId: null,
    mergedAudioUrl: null,
    streamingPlaybackPosition: 0, // NEW: Start at 0 seconds
  });

  const playNextChunk = useCallback(() => {
    // NEW: Don't play if paused - chunks will accumulate in queue
    if (isPausedRef.current) {
      console.log('🎵 Playback paused, not playing next chunk');
      return;
    }

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

      // NEW: Track when this chunk starts playing
      currentChunkStartTimeRef.current = Date.now();

      // NEW: Track chunk duration when metadata is loaded
      audio.onloadedmetadata = () => {
        console.log(`🎵 Chunk ${chunk.chunk_index + 1} duration: ${audio.duration}s`);
      };

      audio.onended = () => {
        // NEW: Add this chunk's duration to cumulative total
        const chunkDuration = audio.duration || 0;
        completedChunksDurationRef.current += chunkDuration;
        currentChunkStartTimeRef.current = null;

        // Update state with new playback position
        setState(prev => ({
          ...prev,
          streamingPlaybackPosition: completedChunksDurationRef.current,
        }));

        currentAudioRef.current = null;
        // Update progress as chunks finish playing - calculate progress using prev state
        setState(prev => {
          const progressPercent = prev.totalChunks > 0
            ? Math.round((chunk.chunk_index / prev.totalChunks) * 100)
            : 0;
          return { ...prev, progressPercent };
        });
        // Use a small timeout to prevent race conditions between chunks
        // Only continue if not paused
        if (!isPausedRef.current) {
          setTimeout(playNextChunk, 240);
        }
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
  }, []); // Empty dependency array - all state access is through setState callbacks

  const startHeartbeat = useCallback(() => {
    // Clear any existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Send ping every 15 seconds (well before the server's timeout)
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('🎵 Sending keepalive ping to TTS server');
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15000); // 15 seconds
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'pong':
        // Server responded to our ping
        console.log('🎵 Received pong from TTS server');
        lastHeartbeatRef.current = Date.now();
        break;

      case 'info':
        // This message from Chatterbox tells us how many chunks to expect
        setState(prev => ({ ...prev, totalChunks: message.total_chunks }));
        break;

      case 'audio_chunk':
        console.log(`🎵 Received audio chunk ${message.chunk_index + 1}/${message.total_chunks}`);
        console.log(`🎵 Queue length before push: ${playbackQueueRef.current.length}`);
        console.log(`🎵 Currently playing: ${isPlayingRef.current}`);
        console.log(`🎵 Paused: ${isPausedRef.current}`);
        console.log(`🎵 WebSocket readyState: ${wsRef.current?.readyState}`);

        const chunkData: ChatterboxAudioChunk = {
          audio_data: message.audio_data,
          chunk_index: message.chunk_index,
          total_chunks: message.total_chunks,
          text_chunk: message.text_chunk,
          is_final: message.is_final,
          mime_type: 'audio/wav', // Chatterbox sends wav
          language: message.language,
        };

        // + Accumulate chunk for later merging
        audioBufferRef.current.push(message.audio_data);

        // Add to playback queue
        playbackQueueRef.current.push(chunkData);
        console.log(`🎵 Queue length after push: ${playbackQueueRef.current.length}`);

        // Hide loading icon once first chunk arrives, show progress bar
        setState(prev => ({ ...prev, isStreaming: true, currentChunk: message.chunk_index + 1, isLoading: false }));

        // Only start playback if not paused and not already playing
        if (!isPlayingRef.current && !isPausedRef.current) {
          console.log(`🎵 Starting playback for first chunk`);
          isPlayingRef.current = true;
          setState(prev => ({ ...prev, isPlaying: true }));
          playNextChunk();
        } else if (isPausedRef.current) {
          console.log('🎵 Chunk queued while paused, waiting for resume');
        }

        // + Check if this is the final chunk - if so, merge all audio and save to IndexedDB
        if (message.is_final) {
          console.log('🎵 Final chunk received, merging audio...');
          try {
            // Merge chunks into a blob
            const mergedBlob = mergeWavChunks(audioBufferRef.current);
            const mergedUrl = URL.createObjectURL(mergedBlob);
            const messageId = currentMessageIdRef.current;

            console.log(`🎵 Audio merged successfully for message: ${messageId}`);
            setState(prev => ({ ...prev, mergedAudioUrl: mergedUrl }));

            // Save to IndexedDB for persistence
            if (messageId) {
              saveAudio(messageId, mergedBlob).then(() => {
                console.log(`🎵 Audio saved to IndexedDB for message: ${messageId}`);
              }).catch(err => {
                console.error('🎵 Failed to save audio to IndexedDB:', err);
              });
            }

            // Call the callback if provided
            if (messageId && onAudioCompleteRef.current) {
              onAudioCompleteRef.current(messageId, mergedUrl);
            }
          } catch (error) {
            console.error('🎵 Error merging audio chunks:', error);
          }
        }
        break;

      case 'usage':
        console.log('🎵 Received TTS usage data:', message.usage);
        setState(prev => ({ ...prev, ttsUsage: message.usage }));
        break;

      case 'error':
        console.error('🎵 TTS service error:', message.error);
        // Clear the audio buffer on error
        audioBufferRef.current = [];
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
        lastHeartbeatRef.current = Date.now();
        setState(prev => ({ ...prev, isConnected: true }));

        // Start sending keepalive pings
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing TTS WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🎵 Streaming TTS WebSocket disconnected');
        console.log('🎵 Close event code:', event.code);
        console.log('🎵 Close event reason:', event.reason);
        console.log('🎵 Close event wasClean:', event.wasClean);

        // Stop heartbeat
        stopHeartbeat();

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
        console.error('🎵 WebSocket readyState:', ws.readyState);
        console.error('🎵 WebSocket URL:', ws.url);
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
  }, [handleWebSocketMessage, startHeartbeat, stopHeartbeat]);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    isPausedRef.current = false; // Reset paused state when stopping
    setState(prev => ({ ...prev, isPlaying: false, isStreaming: false, isPaused: false }));
  }, []);

  // NEW: Pause the audio playback (chunks continue to accumulate in queue)
  const pauseAudio = useCallback(() => {
    console.log('🎵 Pausing audio playback');
    isPausedRef.current = true;

    // Calculate current playback position including current chunk progress
    let currentPosition = completedChunksDurationRef.current;
    if (currentAudioRef.current && !isNaN(currentAudioRef.current.currentTime)) {
      currentPosition += currentAudioRef.current.currentTime;
    }

    // Pause current audio if playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }

    isPlayingRef.current = false;
    setState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: true,
      streamingPlaybackPosition: currentPosition, // Update with current position
    }));
  }, []);

  // NEW: Resume the audio playback (play accumulated chunks)
  const resumeAudio = useCallback(() => {
    console.log('🎵 Resuming audio playback');
    isPausedRef.current = false;
    setState(prev => ({ ...prev, isPaused: false }));

    // If we have a current audio element that was paused, resume it
    if (currentAudioRef.current && currentAudioRef.current.paused) {
      currentAudioRef.current.play().then(() => {
        isPlayingRef.current = true;
        setState(prev => ({ ...prev, isPlaying: true }));
      }).catch(error => {
        console.error('🎵 Error resuming audio:', error);
        // If resume fails, try playing next chunk
        currentAudioRef.current = null;
        if (playbackQueueRef.current.length > 0) {
          isPlayingRef.current = true;
          setState(prev => ({ ...prev, isPlaying: true }));
          playNextChunk();
        }
      });
    } else if (playbackQueueRef.current.length > 0) {
      // No current audio, but we have queued chunks - start playing them
      isPlayingRef.current = true;
      setState(prev => ({ ...prev, isPlaying: true }));
      playNextChunk();
    }
  }, [playNextChunk]);

  // NEW: Stop chunk playback when transitioning to combined audio (prevents overlap)
  const stopChunkPlayback = useCallback(() => {
    console.log('🎵 Stopping chunk playback for transition to combined audio');

    // Stop current chunk audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    // Clear the playback queue to prevent any more chunks from playing
    playbackQueueRef.current = [];

    // Update state but keep streaming flags since we're just transitioning
    isPlayingRef.current = false;
    isPausedRef.current = false;
    setState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      isStreaming: false, // No longer streaming chunks
    }));
  }, []);

  // + UPDATED: requestTTS now accepts messageId for tracking which message the audio belongs to
  const requestTTS = useCallback((text: string, messageId: string, language: string = 'en', ttsParams?: TTSParameters) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: 'TTS service not connected', isLoading: false }));
      // Attempt to reconnect if not connected
      connect();
      return;
    }

    stopAudio();
    playbackQueueRef.current = [];

    // + Reset the audio buffer and paused state for the new request
    audioBufferRef.current = [];
    currentMessageIdRef.current = messageId;
    isPausedRef.current = false; // Reset paused state for new request

    // + Reset playback position tracking for new request
    completedChunksDurationRef.current = 0;
    currentChunkStartTimeRef.current = null;

    // + Revoke any previous merged audio URL to prevent memory leaks
    setState(prev => {
      if (prev.mergedAudioUrl) {
        revokeAudioUrl(prev.mergedAudioUrl);
      }
      return prev;
    });

    // Show loading icon immediately when request is sent
    setState(prev => ({
      ...prev,
      isStreaming: true,
      isPlaying: false,
      isPaused: false, // Reset paused state
      currentChunk: 0,
      totalChunks: 0,
      error: null,
      isLoading: true,
      progressPercent: 0,
      currentMessageId: messageId,
      mergedAudioUrl: null,
      streamingPlaybackPosition: 0, // Reset playback position
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
    stopHeartbeat();

    // + Clear audio buffer and paused state
    audioBufferRef.current = [];
    currentMessageIdRef.current = null;
    isPausedRef.current = false;

    // + Reset playback position tracking
    completedChunksDurationRef.current = 0;
    currentChunkStartTimeRef.current = null;

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

    // + Revoke merged audio URL before resetting state
    setState(prev => {
      if (prev.mergedAudioUrl) {
        revokeAudioUrl(prev.mergedAudioUrl);
      }
      return {
        isConnected: false,
        isStreaming: false,
        isPlaying: false,
        isPaused: false,
        currentChunk: 0,
        totalChunks: 0,
        error: null,
        isLoading: false,
        progressPercent: 0,
        ttsUsage: null,
        currentMessageId: null,
        mergedAudioUrl: null,
        streamingPlaybackPosition: 0, // Reset playback position
      };
    });
  }, [stopAudio, stopHeartbeat]);

  useEffect(() => {
    // Cleanup function to disconnect when component unmounts
    return () => {
      // Call disconnect logic directly to avoid dependency issues
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      playbackQueueRef.current = [];
      isPlayingRef.current = false;
      isPausedRef.current = false;

      // + Clear audio buffer on unmount
      audioBufferRef.current = [];
      currentMessageIdRef.current = null;

      // + Reset playback position tracking on unmount
      completedChunksDurationRef.current = 0;
      currentChunkStartTimeRef.current = null;

      // Stop heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

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
    };
  }, []); // Empty dependency array - only run on mount/unmount

  return { ...state, connect, disconnect, requestTTS, stopAudio, pauseAudio, resumeAudio, stopChunkPlayback };
}
