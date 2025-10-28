"use client";

import React from 'react';
import { Loader2, Volume2 } from 'lucide-react';

interface TTSStatusIndicatorProps {
  isLoading: boolean;
  isStreaming: boolean;
  isPlaying: boolean;
  progressPercent: number;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
}

export function TTSStatusIndicator({
  isLoading,
  isStreaming,
  isPlaying,
  progressPercent,
  currentChunk,
  totalChunks,
  error,
}: TTSStatusIndicatorProps) {
  // Don't show anything if nothing is happening
  if (!isLoading && !isStreaming && !isPlaying && !error) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
      {/* Loading Icon - Shows when request is sent but no chunks yet */}
      {isLoading && (
        <div className="flex items-center gap-2 flex-1">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <span className="text-sm font-medium text-gray-700">
            Generating audio...
          </span>
        </div>
      )}

      {/* Progress Bar - Shows when chunks are being received/played */}
      {(isStreaming || isPlaying) && !isLoading && (
        <div className="flex items-center gap-3 flex-1">
          <Volume2 className="h-5 w-5 text-indigo-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">
                Playing audio
              </span>
              <span className="text-xs text-gray-500">
                {currentChunk}/{totalChunks} chunks
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {progressPercent}% complete
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && !isStreaming && !isPlaying && (
        <div className="flex items-center gap-2 flex-1">
          <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs text-red-600">!</span>
          </div>
          <span className="text-sm font-medium text-red-600">
            {error}
          </span>
        </div>
      )}
    </div>
  );
}

