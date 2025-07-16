// src/components/Chat/MessageItem.tsx
import type { Message } from '../../types/chat';
import { Bot, Loader2 } from 'lucide-react'; 
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="my-3 text-center text-xs text-muted-foreground italic">
        {message.content}
      </div>
    );
  }
  
  if (!isUser && message.isLoading) {
    return (
      <div className="flex items-center gap-3 my-4 py-3.5 px-3 justify-start">
        <div className="theme-assistant-avatar">
            <div className="theme-assistant-avatar-icon">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
        </div>
        <span className="theme-assistant-loading-text">Just a second...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-3 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
          <div className="theme-assistant-avatar">
              <div className="theme-assistant-avatar-icon">
                 <Bot />
              </div>
          </div>
      )}
      <div
        className={isUser ? 'theme-user-bubble' : 'theme-assistant-bubble'}
      >
        {/* Render user messages with Markdown, but assistant messages directly as HTML without prose styling */ }
        {isUser ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <div 
            className="max-w-none break-words"
            dangerouslySetInnerHTML={{ __html: message.content }} 
          />
        )}

        {/* Audio player for assistant's voice responses */}
        {!isUser && message.audioData && (
            <div className="mt-2">
                <audio 
                    controls 
                    src={`data:${message.audioData.mime_type};base64,${message.audioData.audio_base64}`}
                    className="w-full h-10"
                >
                    Your browser does not support the audio element.
                </audio>
            </div>
        )}
        
        <p className={isUser ? "theme-user-bubble-timestamp" : "theme-assistant-bubble-timestamp"}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
