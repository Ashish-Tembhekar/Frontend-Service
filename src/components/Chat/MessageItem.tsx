// src/components/Chat/MessageItem.tsx
import type { Message } from '../../types/chat';
import { Bot, Loader2, User } from 'lucide-react'; 
import { MarkdownRenderer } from './MarkdownRenderer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <TooltipProvider>
        <div className="my-4 text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-600 dark:text-slate-400">
                <div className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full"></div>
                {message.content}
                <div className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full"></div>
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
      <TooltipProvider>
        <div className="flex items-center gap-3 my-6 py-4 px-4 justify-start">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI is thinking...</p>
            </TooltipContent>
          </Tooltip>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nexus AI</span>
            <span className="text-sm text-slate-500 dark:text-slate-400 italic">Thinking...</span>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className={`flex items-end gap-3 my-6 message-item ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg">
                <Bot className="h-5 w-5 text-white" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Nexus AI Assistant</p>
            </TooltipContent>
          </Tooltip>
        )}
        <div className={`flex flex-col max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
          {!isUser && (
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 ml-1">
              Nexus AI
            </span>
          )}
          <div
            className={`rounded-2xl px-4 py-3 shadow-sm ${
              isUser 
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {/* Render user messages with Markdown, but assistant messages directly as HTML without prose styling */ }
            {isUser ? (
              <MarkdownRenderer content={message.content} />
            ) : (
              <div 
                className="max-w-none break-words prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: message.content }} 
              />
            )}

            {/* Audio player for assistant's voice responses */}
            {!isUser && message.audioData && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mt-3">
                    <audio 
                      controls 
                      src={`data:${message.audioData.mime_type};base64,${message.audioData.audio_base64}`}
                      className="w-full h-10 rounded-lg"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Voice response from AI</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          
          <div className={`text-xs text-slate-500 dark:text-slate-400 mt-2 ${
            isUser ? 'text-right' : 'text-left'
          }`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {isUser && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full shadow-sm">
                <User className="h-4 w-4 text-white" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Your message</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
