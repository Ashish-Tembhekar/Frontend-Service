"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Loader2, Volume2 } from 'lucide-react';
import { revokeAudioUrl } from '../../lib/audioUtils';

interface AudioPlayerProps {
  audioUrl?: string;
  isGenerating?: boolean;
  isStreamingPaused?: boolean; // NEW: Whether streaming playback is paused
  isStreamingPlaying?: boolean; // NEW: Whether streaming playback is active
  progressPercent?: number;
  currentChunk?: number;
  totalChunks?: number;
  streamingPlaybackPosition?: number; // NEW: Position in seconds when transitioning from streaming
  onPauseStreaming?: () => void; // NEW: Callback to pause streaming playback
  onResumeStreaming?: () => void; // NEW: Callback to resume streaming playback
  onStopChunkPlayback?: () => void; // NEW: Callback to stop chunk playback when transitioning
  error?: string | null; // NEW: Error message from TTS service
  audioError?: boolean; // NEW: Whether audio failed to load
  onRetry?: () => void; // NEW: Callback to retry audio generation
  onAudioLoadError?: () => void; // NEW: Callback when audio fails to load
}

export function AudioPlayer({
  audioUrl,
  isGenerating = false,
  isStreamingPaused = false,
  isStreamingPlaying = false,
  progressPercent = 0,
  currentChunk = 0,
  totalChunks = 0,
  streamingPlaybackPosition = 0,
  onPauseStreaming,
  onResumeStreaming,
  onStopChunkPlayback,
  error = null,
  audioError = false,
  onRetry,
  onAudioLoadError,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [audioLoadError, setAudioLoadError] = useState(false); // NEW: Track audio load errors

  // Track if we've already applied the initial seek position from streaming
  const hasAppliedInitialSeek = useRef(false);
  // Store the position to seek to when audio becomes ready
  const pendingSeekPosition = useRef<number>(0);
  // Track previous isGenerating state to detect transition
  const prevIsGenerating = useRef(isGenerating);
  // Track if we've auto-played this audio already
  const hasAutoPlayed = useRef(false);

  // Cleanup audio URL when component unmounts or URL changes
  useEffect(() => {
    return () => {
      // Note: We don't revoke here because the URL is managed by ChatContext
      // The context will revoke when appropriate
    };
  }, [audioUrl]);

  // Track the streaming playback position for seamless transition
  useEffect(() => {
    // Update the pending seek position while streaming
    if (isGenerating && streamingPlaybackPosition > 0) {
      pendingSeekPosition.current = streamingPlaybackPosition;
      hasAppliedInitialSeek.current = false; // Reset so we seek when transitioning
    }
  }, [isGenerating, streamingPlaybackPosition]);

  // Reset state when audioUrl changes, but handle seamless transition
  useEffect(() => {
    if (audioUrl) {
      // When audioUrl appears, we're transitioning from streaming to complete
      // Don't reset currentTime if we have a pending seek position
      setIsPlaying(false);
      setDuration(0);
      setIsReady(false);
      hasAutoPlayed.current = false; // Reset auto-play flag for new audio
      setAudioLoadError(false); // NEW: Reset audio load error

      // Keep the visual continuity by using the streaming position
      if (pendingSeekPosition.current > 0 && !hasAppliedInitialSeek.current) {
        setCurrentTime(pendingSeekPosition.current);
      } else {
        setCurrentTime(0);
      }
    } else {
      // No audioUrl, reset everything
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsReady(false);
      hasAppliedInitialSeek.current = false;
      pendingSeekPosition.current = 0;
      hasAutoPlayed.current = false;
      setAudioLoadError(false); // NEW: Reset audio load error
    }
  }, [audioUrl]);

  // Track when we transition from generating to ready
  useEffect(() => {
    prevIsGenerating.current = isGenerating;
  }, [isGenerating]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      setDuration(audioDuration);
      setIsReady(true);

      // Apply pending seek position from streaming (seamless transition)
      if (pendingSeekPosition.current > 0 && !hasAppliedInitialSeek.current) {
        // IMPORTANT: Stop chunk playback FIRST to prevent audio overlap
        if (onStopChunkPlayback) {
          console.log('🎵 Stopping chunk playback before transitioning to combined audio');
          onStopChunkPlayback();
        }

        // Clamp to valid range
        const seekTo = Math.min(pendingSeekPosition.current, audioDuration);
        console.log(`🎵 Seamless transition: Seeking to ${seekTo.toFixed(2)}s from streaming position`);
        audioRef.current.currentTime = seekTo;
        setCurrentTime(seekTo);
        hasAppliedInitialSeek.current = true;

        // Only auto-play if streaming was NOT paused (respect user's pause state)
        if (!isStreamingPaused) {
          // Auto-play to maintain continuity (user was already listening)
          audioRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(err => {
            console.log('🎵 Auto-play blocked, user can click play:', err);
          });
        } else {
          console.log('🎵 Skipping auto-play: streaming was paused by user');
        }
        hasAutoPlayed.current = true;
      } else if (prevIsGenerating.current && !hasAutoPlayed.current) {
        // Only auto-play if we just transitioned from generating state
        // AND we haven't auto-played this audio yet
        console.log('🎵 Auto-playing newly generated audio (Kokoro)');
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.log('🎵 Auto-play blocked, user can click play:', err);
        });
        hasAutoPlayed.current = true;
      } else {
        // Audio already exists (loading old messages or switching chat sessions)
        // Don't auto-play
        console.log('🎵 Audio ready but not auto-playing (existing audio)');
      }
    }
  }, [onStopChunkPlayback, isStreamingPaused]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !isReady) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isPlaying, isReady]);

  const handleReplay = useCallback(() => {
    if (!audioRef.current || !isReady) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(console.error);
    setIsPlaying(true);
  }, [isReady]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !isReady) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [isReady]);

  const formatTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle streaming pause/resume toggle
  const handleStreamingToggle = useCallback(() => {
    if (isStreamingPaused) {
      onResumeStreaming?.();
    } else {
      onPauseStreaming?.();
    }
  }, [isStreamingPaused, onPauseStreaming, onResumeStreaming]);

  // NEW: Error state - show error UI with retry button
  // Don't show error if we're currently generating (retry in progress)
  if ((error || audioError || audioLoadError) && !isGenerating) {
    const errorMessage = error || (audioError || audioLoadError ? 'Failed to load audio' : 'Unknown error');

    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 border border-red-300 rounded-lg shadow-sm mt-2">
        {/* Error Icon */}
        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-red-600 text-white flex-shrink-0">
          <span className="text-lg font-bold">!</span>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-red-700">
              Error generating audio
            </span>
          </div>
          <div className="text-xs text-red-600 mt-0.5">
            {errorMessage}
          </div>
        </div>

        {/* Retry Button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors shadow-sm flex items-center gap-1.5"
            aria-label="Retry audio generation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </button>
        )}
      </div>
    );
  }

  // Streaming state - show progress bar with pause/resume controls while generating
  if (isGenerating && !audioUrl) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm mt-2">
        {/* Streaming Pause/Resume Button */}
        <button
          onClick={handleStreamingToggle}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-md flex-shrink-0"
          aria-label={isStreamingPaused ? 'Resume' : 'Pause'}
        >
          {isStreamingPaused ? (
            <Play className="h-5 w-5 ml-0.5" />
          ) : isStreamingPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">
              {isStreamingPaused ? 'Paused' : 'Streaming audio...'}
            </span>
            {totalChunks > 0 && (
              <span className="text-xs text-gray-500">{currentChunk}/{totalChunks} chunks</span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${isStreamingPaused
                ? 'bg-gray-400'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Volume indicator */}
        <Volume2 className={`h-5 w-5 flex-shrink-0 ${isStreamingPaused ? 'text-gray-400' : 'text-blue-600'}`} />
      </div>
    );
  }

  // No audio available
  if (!audioUrl) {
    return null;
  }

  // Complete state - show full audio player
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm mt-2">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={(e) => {
          console.error('🎵 Audio element failed to load:', audioUrl, e);
          setAudioLoadError(true);
          setIsReady(false);
          onAudioLoadError?.();
        }}
        preload="metadata"
      />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlayPause}
        disabled={!isReady}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white transition-colors shadow-md"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </button>

      {/* Progress Section */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-10">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={!isReady}
            className="flex-1 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-green-600 disabled:cursor-not-allowed"
          />
          <span className="text-xs text-gray-600 w-10 text-right">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Replay Button */}
      <button
        onClick={handleReplay}
        disabled={!isReady}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-green-100 disabled:opacity-50 text-green-700 transition-colors"
        aria-label="Replay"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}

