"use client";

import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useStreamingAudio } from '../../hooks/useStreamingAudio';
import { cn } from '../../lib/utils';

interface StreamingAudioPlayerProps {
  text?: string;
  language?: string;
  autoPlay?: boolean;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export function StreamingAudioPlayer({
  text,
  language = 'en',
  autoPlay = false,
  onPlaybackStart,
  onPlaybackEnd,
  onError,
  className
}: StreamingAudioPlayerProps) {
  const {
    isConnected,
    isStreaming,
    isPlaying,
    currentChunk,
    totalChunks,
    error,
    connect,
    disconnect,
    requestTTS,
    stopAudio
  } = useStreamingAudio();

  const hasPlayedRef = useRef(false);
  const previousTextRef = useRef<string>('');

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Handle auto-play when text changes
  useEffect(() => {
    if (autoPlay && text && text !== previousTextRef.current && isConnected && !isStreaming) {
      previousTextRef.current = text;
      hasPlayedRef.current = false;
      handlePlay();
    }
  }, [text, autoPlay, isConnected, isStreaming]);

  // Handle playback state changes
  useEffect(() => {
    if (isPlaying && !hasPlayedRef.current) {
      hasPlayedRef.current = true;
      onPlaybackStart?.();
    } else if (!isPlaying && hasPlayedRef.current && !isStreaming) {
      onPlaybackEnd?.();
    }
  }, [isPlaying, isStreaming, onPlaybackStart, onPlaybackEnd]);

  // Handle errors
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  const handlePlay = () => {
    if (!text) return;
    
    if (isPlaying) {
      stopAudio();
    } else {
      requestTTS(text, language);
    }
  };

  const getStatusText = () => {
    if (!isConnected) return 'Connecting...';
    if (isStreaming && currentChunk === 0) return 'Starting...';
    if (isStreaming) return `Streaming ${currentChunk}/${totalChunks}`;
    if (isPlaying) return 'Playing...';
    return 'Ready';
  };

  const getProgressPercentage = () => {
    if (totalChunks === 0) return 0;
    return (currentChunk / totalChunks) * 100;
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {/* Play/Stop Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePlay}
        disabled={!isConnected || !text}
        className="h-8 w-8 p-0"
      >
        {isStreaming || isPlaying ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </Button>

      {/* Status and Progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          {/* Loading indicator */}
          {(isStreaming || isPlaying) && (
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          )}
          
          {/* Status text */}
          <span className="text-xs text-gray-500 truncate">
            {getStatusText()}
          </span>
          
          {/* Error indicator */}
          {error && (
            <span className="text-xs text-red-500 truncate" title={error}>
              Error
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalChunks > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        )}
      </div>

      {/* Connection status indicator */}
      <div className={cn(
        "w-2 h-2 rounded-full",
        isConnected ? "bg-green-500" : "bg-red-500"
      )} title={isConnected ? "Connected" : "Disconnected"} />
    </div>
  );
}

// Simplified version for inline use
export function InlineStreamingAudioPlayer({
  text,
  language = 'en',
  className
}: {
  text?: string;
  language?: string;
  className?: string;
}) {
  const { isConnected, isPlaying, requestTTS, stopAudio, connect } = useStreamingAudio();

  useEffect(() => {
    // Auto-connect when component mounts
    connect();
  }, [connect]);

  const handleToggle = () => {
    if (!text) return;
    
    if (isPlaying) {
      stopAudio();
    } else {
      requestTTS(text, language);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={!isConnected || !text}
      className={cn("h-6 w-6 p-0", className)}
    >
      {isPlaying ? (
        <VolumeX className="h-3 w-3" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
    </Button>
  );
}
