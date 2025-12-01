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
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Track if we've already applied the initial seek position from streaming
  const hasAppliedInitialSeek = useRef(false);
  // Store the position to seek to when audio becomes ready
  const pendingSeekPosition = useRef<number>(0);

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
    }
  }, [audioUrl]);

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

        // Auto-play to maintain continuity (user was already listening)
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.log('🎵 Auto-play blocked, user can click play:', err);
        });
      }
    }
  }, [onStopChunkPlayback]);

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
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isStreamingPaused
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

