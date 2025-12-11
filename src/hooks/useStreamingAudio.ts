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

  // + NEW: Ref to track if persistence should be skipped for current request
  const skipPersistenceRef = useRef<boolean>(false);

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
        // Default to 0/unknown if missing
        const chunkIndex = message.chunk_index ?? 0;
        const totalChunks = message.total_chunks ?? 0;

        console.log(`🎵 Received audio chunk ${chunkIndex + 1}/${totalChunks || '?'}`);

        const chunkData: ChatterboxAudioChunk = {
          audio_data: message.audio_data,
          chunk_index: chunkIndex,
          total_chunks: totalChunks,
          text_chunk: message.text_chunk || '',
          is_final: message.is_final || false,
          mime_type: message.mime_type || 'audio/wav',
          language: message.language || 'en',
        };

        // + Accumulate chunk for later merging
        // Note: Kokoro might not send linear indices or total count, 
        // so we just append. Merging might require correct order if not guaranteed.
        // WebSocket guarantees order usually.
        audioBufferRef.current.push(message.audio_data);

        // Add to playback queue
        playbackQueueRef.current.push(chunkData);

        // Hide loading icon, update state
        setState(prev => ({
          ...prev,
          isStreaming: true,
          currentChunk: chunkIndex + 1,
          // Only update totalChunks if it's non-zero
          totalChunks: totalChunks > 0 ? totalChunks : prev.totalChunks,
          isLoading: false
        }));

        // Only start playback if not paused and not already playing
        if (!isPlayingRef.current && !isPausedRef.current) {
          console.log(`🎵 Starting playback for first chunk`);
          isPlayingRef.current = true;
          setState(prev => ({ ...prev, isPlaying: true }));
          playNextChunk();
        } else if (isPausedRef.current) {
          console.log('🎵 Chunk queued while paused, waiting for resume');
        }

        // + Check if this is the final chunk 
        if (message.is_final) {
          console.log('🎵 Final chunk received, merging audio...');

          try {
            const mergedBlob = mergeWavChunks(audioBufferRef.current);
            const mergedUrl = URL.createObjectURL(mergedBlob);
            const messageId = currentMessageIdRef.current;

            setState(prev => ({ ...prev, mergedAudioUrl: mergedUrl }));

            // + Check skipPersistence flag
            if (messageId && !skipPersistenceRef.current) {
              // Save to IndexedDB only if skipPersistence is false
              saveAudio(messageId, mergedBlob).then(() => {
                console.log(`🎵 Audio saved to IndexedDB for message: ${messageId}`);
              }).catch(err => console.error(err));
            } else {
              console.log(`🎵 Skipping audio persistence for message: ${messageId} (Real-time mode)`);
            }

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

  // NEW: Connect function now accepts provider
  const connect = useCallback((provider: 'chatterbox' | 'kokoro' = 'chatterbox') => {
    // If already connected to the SAME provider, do nothing
    // We need to track which provider we are connected to. 
    // For now, if wsRef.current exists, we assume it's the right one or we disconnect first.
    // Ideally, we should check, but disconnect() is safe.

    if (wsRef.current) {
      // If we want to switch providers, we must disconnect first.
      // But for simplicity, we'll assume the caller calls disconnect() if switching.
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        console.log('🎵 Already connected (or connecting).');
        return;
      }
    }

    if (isConnectingRef.current) return;

    isConnectingRef.current = true;
    setState(prev => ({ ...prev, error: null }));

    try {
      let wsUrl = '';
      if (provider === 'chatterbox') {
        if (!appConfig.chatterboxTtsUrl) {
          console.warn("NEXT_PUBLIC_CHATTERBOX_TTS_URL is not set.");
          isConnectingRef.current = false;
          return;
        }
        wsUrl = appConfig.chatterboxTtsUrl.replace(/^http/, 'ws') + '/tts-stream';
      } else {
        // Kokoro
        // We assume Kokoro runs on port 8090 by default or configured URL
        const msgUrl = (appConfig as any).kokoroTtsUrl || "http://localhost:8090";
        wsUrl = msgUrl.replace(/^http/, 'ws') + '/v1/stream';
      }

      console.log(`🎵 Connecting to ${provider} WebSocket at ${wsUrl}`);
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
        console.log(`🎵 Streaming TTS WebSocket connected to ${provider}`);
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

        // Stop heartbeat
        stopHeartbeat();

        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        isConnectingRef.current = false;
        setState(prev => ({ ...prev, isConnected: false, isStreaming: false, isPlaying: false, isLoading: false }));

        // Attempt to reconnect after 3 seconds ONLY if it was an unexpected close?
        // For now, we auto-reconnect to the same provider.
        // NOTE: We need to know which provider to reconnect to. 
        // We rely on the closure capture of `provider` arg? No, that won't work in setTimeout.
        // Simple fix: Don't auto-reconnect indefinitely for now, or use a ref for currentProvider.
        // Let's rely on the user/app to reconnect if needed for now to avoid loops.
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

  // Helper function to select the best Kokoro voice based on detected language
  // Based on voice quality grades from kokoro-tts/voices.md
  const getKokoroVoiceForLanguage = (language: string): string => {
    // Normalize language code (handle variations like 'en-us', 'en-gb', 'zh-cn', etc.)
    const langCode = language.toLowerCase().split('-')[0];

    switch (langCode) {
      case 'en':
        // American English - af_heart (Grade A) or af_bella (Grade A-)
        return 'af_heart';

      case 'ja':
        // Japanese - jf_alpha (Grade C+, highest for Japanese)
        return 'jf_alpha';

      case 'zh':
        // Mandarin Chinese - zf_xiaoxiao (all Chinese voices are Grade D, pick one)
        return 'zf_xiaoxiao';

      case 'es':
        // Spanish - ef_dora (female, only female voice available)
        return 'ef_dora';

      case 'fr':
        // French - ff_siwis (Grade B-, only French voice)
        return 'ff_siwis';

      case 'hi':
        // Hindi - hf_alpha (Grade C, highest training duration)
        return 'hf_alpha';

      case 'it':
        // Italian - if_sara (Grade C, female)
        return 'if_sara';

      case 'pt':
        // Portuguese (Brazilian) - pf_dora (female)
        return 'pf_dora';

      default:
        // Fallback to American English high-quality voice
        return 'af_heart';
    }
  };

  // + UPDATED: requestTTS now accepts skipPersistence
  // + Also accepts provider to format payload correctly if needed (though we rely on WS connection)
  const requestTTS = useCallback((text: string, messageId: string, language: string = 'en', ttsParams?: TTSParameters, provider: 'chatterbox' | 'kokoro' = 'chatterbox', skipPersistence: boolean = false) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: 'TTS service not connected', isLoading: false }));
      // Attempt to reconnect if not connected - but we need to know provider.
      // For now, we assume explicit connect() was called before.
      connect(provider);
      // We'll have to wait for connection... this might fail the first request if not handled.
      // Ideally queue it, but simplifiction: just return and expect retry or auto-connect effect.
      // Actually, ChatContext usually connects ahead of time.
      return;
    }

    stopAudio();
    playbackQueueRef.current = [];

    // + Reset the audio buffer and paused state for the new request
    audioBufferRef.current = [];
    currentMessageIdRef.current = messageId;
    isPausedRef.current = false; // Reset paused state for new request

    // + Store skipPersistence flag
    skipPersistenceRef.current = skipPersistence;

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

    // + UPDATED: Send the request with TTS parameters based on provider
    let request: any;

    if (provider === 'kokoro') {
      // + UPDATED: Dynamically select voice based on language
      const selectedVoice = getKokoroVoiceForLanguage(language);

      request = {
        text,
        language,
        voice: selectedVoice,
        speed: 1.0
      };

      console.log(`🎵 Kokoro TTS: Using voice "${selectedVoice}" for language "${language}"`);
    } else {
      request = {
        text,
        language,
        exaggeration: ttsParams?.exaggeration ?? 0.5,
        cfg_weight: ttsParams?.cfg_weight ?? 0.5,
        reference_audio_file: ttsParams?.reference_audio_file ?? null
      };
    }

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
