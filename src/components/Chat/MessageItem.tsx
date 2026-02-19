// src/components/Chat/MessageItem.tsx
import type { Message } from '../../types/chat';
import { appConfig } from '../../lib/config';
import React, { useMemo, useState } from 'react';
import { Bot, Loader2, User } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { AudioPlayer } from './AudioPlayer';
import { useChat } from '../../contexts/ChatContext';
import { SourceCitations } from './SourceCitations';

interface MessageItemProps {
  message: Message;
  isLastAssistantMessage?: boolean;
}

export function MessageItem({ message, isLastAssistantMessage = false }: MessageItemProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Get TTS status from context
  const {
    ttsIsLoading,
    ttsIsStreaming,
    ttsIsPlaying,
    ttsIsPaused, // NEW: Get paused state
    ttsProgressPercent,
    ttsCurrentChunk,
    ttsTotalChunks,
    ttsError,
    ttsStreamingPlaybackPosition, // NEW: Get streaming playback position
    currentTtsMessageId,
    pauseStreamingAudio, // NEW: Get pause function
    resumeStreamingAudio, // NEW: Get resume function
    stopChunkPlayback, // NEW: Get stop chunk playback function
    requestTTS, // NEW: Get requestTTS function for retry
    setAudioGeneratingForMessage, // NEW: Get function to set generating state
    stopCurrentAudio, // Stop active streaming/chunk playback before message audio playback
    currentChatThreadId, // Needed to retry Azure restore for persisted audio
    restoreAudioFromCache, // Needed to retry Azure restore for persisted audio
    // FIX: Swap-transition state
    ttsSwappedMessageId,
    ttsFinalStreamingPosition,
    ttsWasPausedAtSwap,
  } = useChat();

  // NEW: Handler to retry audio generation
  const handleRetryAudio = () => {
    // If Azure fetch failed/timed out, regenerate TTS instead of retrying fetch.
    if (message.audioRestoreFailed) {
      if (!message.content) return;

      setAudioGeneratingForMessage(message.id, true);

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = message.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const lang = (message as any).detected_language || 'en';
      requestTTS(textContent, message.id, lang);
      return;
    }

    // If this message has persisted Azure audio and hasn't failed yet, try fetch.
    if (message.audioBlobName && currentChatThreadId) {
      restoreAudioFromCache(message.id, currentChatThreadId);
      return;
    }

    if (!message.content) return;

    // Immediately set generating state to show streaming UI
    setAudioGeneratingForMessage(message.id, true);

    // Extract text content from HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = message.content;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    // Get language from message or default to 'en'
    const lang = (message as any).detected_language || 'en';

    // Request TTS regeneration (this will also trigger the streaming state in the hook)
    requestTTS(textContent, message.id, lang);
  };

  if (isSystem) {
    return (
      <TooltipProvider>
        <div className="my-4 text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600">
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                {message.content}
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>System message</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  if (!isUser && message.isLoading) {
    return (
      <div className="flex justify-start py-6">
        <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            </div>
            <span className="text-sm text-gray-600 font-medium">
              {message.processingStatus || 'Thinking...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (isUser && message.isLoading) {
    return (
      <div className="flex justify-end py-6">
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-700 text-white rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce"></div>
            </div>
            <span className="text-sm font-medium">
              {message.processingStatus || 'Processing voice input...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-4 py-6 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}>
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center shadow-sm">
            <Bot className="h-4 w-4 text-white" />
          </div>
        </div>
      )}

      <div className={`flex flex-col max-w-[90%] md:max-w-[80%] ${isUser ? 'items-end' : 'items-start'} w-full`}>
        <div
          className={`px-4 py-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 w-full ${isUser
            ? 'bg-gray-700 text-white'
            : 'bg-gray-100 text-gray-900'
            }`}
        >
          {isUser ? (
            <MarkdownRenderer content={message.content} />
          ) : (
            <div
              className="max-w-none break-words prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          )}

          {/* - REMOVED: The <audio> player is no longer needed. */}
          {/* Playback is now handled ambiently by the useStreamingAudio hook. */}

          {/* Developer mode: collapsible debug details */}
          {!isUser && appConfig.developerMode && (() => {
            const debugGraph = (message as any).debug_graph_context as string | undefined;
            const debugDocs = (message as any).debug_filtered_docs as Array<{ content_preview: string; metadata: Record<string, any> }> | undefined;
            const hasAnyDebug = Boolean(debugGraph) || Array.isArray(debugDocs);
            if (!hasAnyDebug) return null;
            const [devOpen, setDevOpen] = useState(false);
            const graphCount = useMemo(() => (debugGraph ? debugGraph.split('\n').filter(Boolean).length : 0), [debugGraph]);
            const docsCount = useMemo(() => (Array.isArray(debugDocs) ? debugDocs.length : 0), [debugDocs]);
            return (
              <div className="mt-4 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setDevOpen(v => !v)}
                  className="text-xs inline-flex items-center gap-2 px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                >
                  <span className="font-medium">Developer details</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200">graph {graphCount}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200">docs {docsCount}</span>
                  <span className="ml-1 text-[10px] opacity-70">{devOpen ? 'Hide' : 'Show'}</span>
                </button>

                {devOpen && (
                  <div className="mt-3 space-y-3">
                    {debugGraph && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">Graph context</div>
                        <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-2 rounded-md border border-gray-200 max-h-48 overflow-auto">
                          {debugGraph}
                        </pre>
                      </div>
                    )}
                    {Array.isArray(debugDocs) && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">Top documents after reranking</div>
                        <div className="space-y-2 max-h-60 overflow-auto">
                          {debugDocs.map((d, idx) => (
                            <div key={idx} className="text-xs p-2 rounded-md border border-gray-200 bg-gray-50">
                              <div className="font-medium">#{idx + 1} {d.metadata?.source || 'unknown source'} {d.metadata?.page != null ? `(p${d.metadata.page})` : ''}</div>
                              <div className="text-[11px] text-gray-600">{d.metadata?.heading || ''}</div>
                              <div className="mt-1 text-[11px] text-gray-700 whitespace-pre-wrap">{d.content_preview}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Images Section - Displayed between text and audio player */}
        {!isUser && appConfig.enableImageRetrieval && message.imageUrls && message.imageUrls.length > 0 && (
          <div className="w-full mt-3 space-y-2">
            {message.imageUrls.map((imageUrl, idx) => {
              // Construct full URL if relative
              const fullImageUrl = imageUrl.startsWith('http')
                ? imageUrl
                : `${appConfig.fastApiBaseUrl}${imageUrl}`;

              return (
                <div key={idx} className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                  <img
                    src={fullImageUrl}
                    alt={`Reference image ${idx + 1}`}
                    className="w-full h-auto object-contain max-h-96"
                    onError={(e) => {
                      console.error(`Failed to load image: ${fullImageUrl}`);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Sources/Citations - Displayed after images and before audio */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceCitations sources={message.sources} />
        )}

        {/* Audio Player - Shows for assistant messages with audio or currently generating */}
        {!isUser && (() => {
          // 🔍 DEBUG: Log audio state for every assistant message with audioBlobName
          if (message.audioBlobName || message.audioUrl || message.isAudioGenerating) {
            const computedIsLoadingAudio = !!message.audioBlobName && !message.audioUrl && !message.isAudioGenerating && !message.audioRestoreFailed;
            console.log(`🔍 [MessageItem RENDER] msg=${message.id}: audioUrl=${message.audioUrl ? 'SET' : 'NONE'}, audioBlobName=${message.audioBlobName ? 'SET' : 'NONE'}, isAudioGenerating=${message.isAudioGenerating}, audioRestoreFailed=${message.audioRestoreFailed}, → isLoadingAudio=${computedIsLoadingAudio}`);
          }
          return null;
        })()}
        {!isUser && (
          <div className="w-full">
            {/* Show AudioPlayer if this message has audio or is currently generating audio */}
            {(message.audioUrl || message.audioBlobName || message.isAudioGenerating || currentTtsMessageId === message.id || (currentTtsMessageId === message.id && ttsError)) && (
              <AudioPlayer
                audioUrl={message.audioUrl}
                isGenerating={message.isAudioGenerating || currentTtsMessageId === message.id}
                isLoadingAudio={!!message.isAudioLoading}
                hasDeferredAudio={!!message.audioBlobName}
                onRequestAudio={message.audioBlobName && currentChatThreadId
                  ? () => restoreAudioFromCache(message.id, currentChatThreadId)
                  : undefined}
                onBeforePlay={stopCurrentAudio}
                audioError={!!message.audioRestoreFailed}
                isStreamingPaused={currentTtsMessageId === message.id ? ttsIsPaused : false}
                isStreamingPlaying={currentTtsMessageId === message.id ? ttsIsPlaying : false}
                progressPercent={currentTtsMessageId === message.id ? ttsProgressPercent : 0}
                currentChunk={currentTtsMessageId === message.id ? ttsCurrentChunk : 0}
                totalChunks={currentTtsMessageId === message.id ? ttsTotalChunks : 0}
                streamingPlaybackPosition={currentTtsMessageId === message.id ? ttsStreamingPlaybackPosition : 0}
                onPauseStreaming={currentTtsMessageId === message.id ? pauseStreamingAudio : undefined}
                onResumeStreaming={currentTtsMessageId === message.id ? resumeStreamingAudio : undefined}
                onStopChunkPlayback={currentTtsMessageId === message.id ? stopChunkPlayback : undefined}
                error={currentTtsMessageId === message.id ? ttsError : null}
                onRetry={handleRetryAudio}
                onAudioLoadError={() => {
                  console.error(`🎵 Audio failed to load for message: ${message.id}`);
                }}
                // FIX: Pass swap-transition state for seamless chunk-to-combined audio handoff
                swapFinalPosition={ttsSwappedMessageId === message.id ? ttsFinalStreamingPosition : undefined}
                swapWasPaused={ttsSwappedMessageId === message.id ? ttsWasPausedAtSwap : undefined}
              />
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
