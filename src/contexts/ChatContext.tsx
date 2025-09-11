// src/contexts/ChatContext.tsx
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Message, ChatThread, AudioData } from '../types/chat';
import useLocalStorage from '../hooks/useLocalStorage';
import { uploadPdfDocument as uploadPdf, askQuestionAPI as askQuestion } from '../services/apiClientNew';
import { useToast } from '../hooks/use-toast';
import { validateFileSize } from '../lib/utils';

interface ChatContextType {
  chatThreads: ChatThread[];
  currentChatThreadId: string | null;
  activeChatThread: ChatThread | null;
  messages: Message[];
  isLoadingResponse: boolean;
  isHistoryPanelOpen: boolean;
  sendMessage: (userInput: string, originalText?: string, isVoiceMessage?: boolean, detectedLang?: string) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  startNewChat: () => void;
  loadChatThread: (threadId: string) => void;
  deleteChatThread: (threadId: string) => void;
  clearChatHistory: () => void;
  toggleHistoryPanel: () => void;
  setIsHistoryPanelOpen: (isOpen: boolean) => void;
  getThreadTitle: (threadId: string) => string;
  stopCurrentAudio: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const updateOrAddThreadInArray = (threads: ChatThread[], threadToUpsert: ChatThread): ChatThread[] => {
  const index = threads.findIndex(t => t.id === threadToUpsert.id);
  if (index !== -1) {
    const newThreads = [...threads];
    newThreads[index] = threadToUpsert;
    return newThreads.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
  } else {
    return [threadToUpsert, ...threads].sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
  }
};

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [chatThreads, setChatThreads] = useLocalStorage<ChatThread[]>('nexus_chat_threads_v2', []);
  const [currentChatThreadId, setCurrentChatThreadId] = useLocalStorage<string | null>('nexus_current_chat_thread_id_v2', null);
  const [activeChatThread, setActiveChatThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useLocalStorage('nexus_history_panel_open_v2', false);
  const [currentAudioElement, setCurrentAudioElement] = useState<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Helper to add or update a message in the current thread for local storage
  const updateMessagesInCurrentThread = (newMessages: Message[], title?: string) => {
    if (!currentChatThreadId) return;

    // Strip audioData before saving to localStorage to prevent exceeding quota
    const messagesForStorage = newMessages.map(({ audioData, ...message }) => message);

    setChatThreads(prevThreads => {
      const threadIndex = prevThreads.findIndex(t => t.id === currentChatThreadId);
      if (threadIndex === -1) return prevThreads;
      
      const updatedThread = {
        ...prevThreads[threadIndex],
        messages: messagesForStorage, // Use the sanitized messages
        lastUpdatedAt: new Date().toISOString(),
        ...(title && { title }),
      };

      const newThreads = [...prevThreads];
      newThreads[threadIndex] = updatedThread;
      return newThreads.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedState = window.localStorage.getItem('nexus_history_panel_open_v2');
      if (storedState === null) {
        setIsHistoryPanelOpen(window.innerWidth >= 768);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    const threadsExist = chatThreads.length > 0;
    const currentIdIsValid = currentChatThreadId && chatThreads.some(t => t.id === currentChatThreadId);

    if (threadsExist && !currentIdIsValid) {
      const mostRecentThread = [...chatThreads].sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime())[0];
      setCurrentChatThreadId(mostRecentThread.id);
    } else if (!threadsExist && currentChatThreadId) {
      startNewChat();
    } else if (!currentChatThreadId && !threadsExist) {
        startNewChat();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatThreads, currentChatThreadId]);


  useEffect(() => {
    if (currentChatThreadId) {
      const thread = chatThreads.find(t => t.id === currentChatThreadId);
      setActiveChatThread(thread || null);
      // When loading from storage, messages won't have audioData, which is correct.
      setMessages(thread?.messages || []);
    } else {
      setActiveChatThread(null);
      setMessages([]);
    }
  }, [currentChatThreadId, chatThreads]);
  
  const uploadFile = async (file: File) => {
    if (!currentChatThreadId) return;

    // Validate file size before proceeding
    const validation = validateFileSize(file);
    if (!validation.isValid) {
      console.log('File validation failed in ChatContext:', validation.errorMessage);
      toast({
        title: "File too large",
        description: validation.errorMessage,
        variant: "destructive",
      });
      return;
    }

    const systemMessageId = `msg_system_${Date.now()}`;
    const systemMessage: Message = {
      id: systemMessageId,
      role: 'system',
      content: `Uploading and indexing ${file.name}...`,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => {
        const newMessages = [...prev, systemMessage];
        updateMessagesInCurrentThread(newMessages);
        return newMessages;
    });

    try {
      await uploadPdf(file);
      const successMessage: Message = {
        ...systemMessage,
        content: `${file.name} successfully indexed. You can now ask questions about it.`,
      };
      
      setMessages(prev => {
        const finalMessages = prev.map(m => m.id === systemMessageId ? successMessage : m);
        updateMessagesInCurrentThread(finalMessages);
        return finalMessages;
      });

    } catch (error) {
      const errorMessageContent = error instanceof Error ? error.message : 'An unknown error occurred.';
      const errorMessage: Message = {
        ...systemMessage,
        content: `Error indexing ${file.name}: ${errorMessageContent}`,
      };
      setMessages(prev => {
        const finalMessages = prev.map(m => m.id === systemMessageId ? errorMessage : m);
        updateMessagesInCurrentThread(finalMessages);
        return finalMessages;
      });
    }
  };


  // Helper function to play audio
  const playAudioResponse = (audioData: AudioData | null) => {
    if (!audioData?.audio_base64) return;
    
    try {
      const audio = new Audio(`data:${audioData.mime_type};base64,${audioData.audio_base64}`);
      setCurrentAudioElement(audio);
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        setCurrentAudioElement(null);
      });
    } catch (error) {
      console.error('Error creating audio element:', error);
      setCurrentAudioElement(null);
    }
  };

  // Function to stop current audio
  const stopCurrentAudio = () => {
    if (currentAudioElement) {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      setCurrentAudioElement(null);
    }
  };

  const sendMessage = async (userInput: string, originalText?: string, isVoiceMessage: boolean = false, detectedLang?: string) => {
    if (!userInput.trim() || !currentChatThreadId) return;

    setIsLoadingResponse(true);

    // Use original text for display in chat history, or fall back to userInput
    const displayText = originalText || userInput;

    const userMessage: Message = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: displayText,
      contentType: 'text',
      timestamp: new Date().toISOString(),
    };

    const assistantPlaceholderMessage: Message = {
      id: `msg_assistant_${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    };
    
    const isNewThread = activeChatThread?.messages.length === 0 && activeChatThread.title === "New Chat";
    const newTitle = isNewThread ? (displayText.substring(0, 30) + (displayText.length > 30 ? '...' : '')) : undefined;

    setMessages(prevMessages => {
        const updatedMessages = [...prevMessages, userMessage, assistantPlaceholderMessage];
        updateMessagesInCurrentThread(updatedMessages, newTitle);
        return updatedMessages;
    });

    try {
      console.log('ChatContext - About to call askQuestion with:', userInput);
      console.log('ChatContext - detectedLang:', detectedLang);
      console.log('ChatContext - isVoiceMessage:', isVoiceMessage);
      
      // Prepare conversation history as a formatted string from the last 5 Q&A pairs
      let conversationHistoryString = '';
      const currentMessages = activeChatThread?.messages || [];
      
      // Get the last 10 messages (5 Q&A pairs) excluding system messages
      const recentMessages = currentMessages
        .filter(msg => msg.role !== 'system')
        .slice(-10);
      
      // Convert to conversation history string format
      for (let i = 0; i < recentMessages.length - 1; i += 2) {
        const userMsg = recentMessages[i];
        const assistantMsg = recentMessages[i + 1];
        
        if (userMsg && assistantMsg && userMsg.role === 'user' && assistantMsg.role === 'assistant') {
          conversationHistoryString += `User: ${userMsg.content}\nAssistant: ${assistantMsg.content}\n\n`;
        }
      }
      
      console.log('ChatContext - Conversation history string:', conversationHistoryString);
      
      // Pass conversation history as string and detected language
      // For voice messages: use detectedLang if provided, otherwise undefined
      // For text messages: use detectedLang if provided (user selected language), otherwise undefined
      // Only generate audio for voice interactions (microphone or direct call)
      const needsAudio = isVoiceMessage;
      const response = await askQuestion(userInput, conversationHistoryString, detectedLang, needsAudio);
      console.log('ChatContext - askQuestion response:', response);
      
      if (!response) {
        throw new Error('No response received from askQuestion');
      }
      
      if (!response.answer) {
        throw new Error('Response does not contain an answer property');
      }
      
      const finalAssistantMessage: Message = {
        ...assistantPlaceholderMessage,
        content: response.answer,
        contentType: 'html',
        isLoading: false,
        timestamp: new Date().toISOString(),
        audioData: response.audio,
        // Attach developer debug fields for UI if provided (independently)
        ...(response.debug_graph_context !== undefined
          ? { debug_graph_context: response.debug_graph_context } as any
          : {}),
        ...(response.debug_filtered_docs !== undefined
          ? { debug_filtered_docs: response.debug_filtered_docs } as any
          : {}),
      };
      
      setMessages(prev => {
        const finalMessages = prev.map(m => m.id === assistantPlaceholderMessage.id ? finalAssistantMessage : m);
        updateMessagesInCurrentThread(finalMessages, newTitle);
        return finalMessages;
      });

      // Auto-play audio only for voice messages and when audio is available
      if (isVoiceMessage && response.audio) {
        playAudioResponse(response.audio);
      }

    } catch (error) {
      const errorMessageContent = error instanceof Error ? error.message : 'Sorry, I encountered an error.';
      toast({
        title: "Error",
        description: errorMessageContent,
        variant: "destructive",
      });
      const errorAssistantMessage: Message = {
         ...assistantPlaceholderMessage,
        content: `<p><strong>Error:</strong> ${errorMessageContent}</p>`,
        contentType: 'html',
        isLoading: false,
        timestamp: new Date().toISOString(),
        audioData: null,
      };
      
      setMessages(prev => {
        const finalMessages = prev.map(m => m.id === assistantPlaceholderMessage.id ? errorAssistantMessage : m);
        updateMessagesInCurrentThread(finalMessages, newTitle);
        return finalMessages;
      });
    } finally {
      setIsLoadingResponse(false);
    }
  };

  const startNewChat = () => {
    if (activeChatThread && activeChatThread.title === 'New Chat' && activeChatThread.messages.length === 0) {
        if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsHistoryPanelOpen(false);
        }
        return; 
    }

    const newThreadId = `thread_${Date.now()}`;
    const newThread: ChatThread = {
      id: newThreadId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
    
    setChatThreads(prevThreads => updateOrAddThreadInArray(prevThreads, newThread));
    setCurrentChatThreadId(newThreadId);
    
    if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsHistoryPanelOpen(false);
    }
  };

  const loadChatThread = (threadId: string) => {
    const thread = chatThreads.find(t => t.id === threadId);
    if (thread) {
      setCurrentChatThreadId(threadId);
      if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsHistoryPanelOpen(false);
      }
    }
  };

  const deleteChatThread = (threadId: string) => {
    const remainingThreads = chatThreads.filter(t => t.id !== threadId);    
    setChatThreads(remainingThreads);

    if (currentChatThreadId === threadId) {
      if (remainingThreads.length > 0) {
        const mostRecentThread = [...remainingThreads].sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime())[0];
        setCurrentChatThreadId(mostRecentThread.id);
      } else {
        startNewChat();
      }
    }
  };

  const clearChatHistory = () => {
    setChatThreads([]);
    startNewChat();
    if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsHistoryPanelOpen(false);
    }
  };
  
  const getThreadTitle = (threadId: string): string => {
    const thread = chatThreads.find(t => t.id === threadId);
    return thread ? thread.title : "Chat";
  };

  const toggleHistoryPanel = () => {
    setIsHistoryPanelOpen(prev => !prev);
  };

  return (
    <ChatContext.Provider value={{
      chatThreads,
      currentChatThreadId,
      activeChatThread,
      messages,
      isLoadingResponse,
      isHistoryPanelOpen,
      sendMessage,
      uploadFile,
      startNewChat,
      loadChatThread,
      deleteChatThread,
      clearChatHistory,
      toggleHistoryPanel,
      setIsHistoryPanelOpen,
      getThreadTitle,
      stopCurrentAudio,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
