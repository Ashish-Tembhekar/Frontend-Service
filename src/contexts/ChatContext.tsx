// src/contexts/ChatContext.tsx
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Message, ChatThread } from '../types/chat';
import useLocalStorage from '../hooks/useLocalStorage';
import { uploadPdfDocument as uploadPdf, askQuestionAPI as askQuestion } from '../services/apiClientNew';
import { useToast } from '../hooks/use-toast';
import { validateFileSize } from '../lib/utils';
import { useStreamingAudio } from '../hooks/useStreamingAudio';
import { useAuth } from './AuthContext';
import { logUsageToFirestore, logTTSUsageToFirestore, type TTSUsageData } from '../services/usageLogger';
import { db } from '../lib/firebase/config';
import { getAudio } from '../services/audioStorage';

interface ChatContextType {
  chatThreads: ChatThread[];
  currentChatThreadId: string | null;
  activeChatThread: ChatThread | null;
  messages: Message[];
  isLoadingResponse: boolean;
  isHistoryPanelOpen: boolean;
  // + Add new state and toggle function
  isAudioResponseEnabled: boolean;
  toggleAudioResponse: () => void;
  // + Add TTS parameters
  ttsExaggeration: number;
  setTtsExaggeration: (value: number) => void;
  ttsCfgWeight: number;
  setTtsCfgWeight: (value: number) => void;
  ttsRefAudioFile: string | null;
  setTtsRefAudioFile: (filename: string | null) => void;
  // + Add TTS status properties
  ttsIsConnected: boolean;
  ttsIsLoading: boolean;
  ttsIsStreaming: boolean;
  ttsIsPlaying: boolean;
  ttsIsPaused: boolean; // NEW: Track paused state during streaming
  ttsProgressPercent: number;
  ttsCurrentChunk: number;
  ttsTotalChunks: number;
  ttsError: string | null;
  ttsUsage: TTSUsageData | null;
  ttsStreamingPlaybackPosition: number; // NEW: Cumulative playback position during streaming
  // + Add audio URL tracking for messages
  currentTtsMessageId: string | null;
  // + Add role and system prompt properties
  chatbotRole: string;
  setChatbotRole: (role: string) => void;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  isLoadingRoleConfig: boolean;
  sendMessage: (userInput: string, originalText?: string, isVoiceMessage?: boolean, detectedLang?: string) => Promise<void>;
  addProcessedMessages: (userMessage: Message, assistantMessage: Message) => void;
  uploadFile: (file: File) => Promise<void>;
  startNewChat: () => void;
  loadChatThread: (threadId: string) => void;
  deleteChatThread: (threadId: string) => void;
  clearChatHistory: () => void;
  toggleHistoryPanel: () => void;
  setIsHistoryPanelOpen: (isOpen: boolean) => void;
  getThreadTitle: (threadId: string) => string;
  stopCurrentAudio: () => void;
  pauseStreamingAudio: () => void; // NEW: Pause streaming playback
  resumeStreamingAudio: () => void; // NEW: Resume streaming playback
  stopChunkPlayback: () => void; // NEW: Stop chunk playback when transitioning to combined audio
  requestTTS: (text: string, messageId: string, language?: string) => void;
  setAudioForMessage: (messageId: string, audioUrl: string) => void;
  setAudioGeneratingForMessage: (messageId: string, isGenerating: boolean) => void;
  restoreAudioFromCache: (messageId: string) => Promise<void>; // NEW: Restore audio from IndexedDB
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
  const { toast } = useToast();
  const { user } = useAuth(); // Get authenticated user for usage tracking

  // + Callback for when audio merging is complete - updates the message with the audio URL
  const handleAudioComplete = useCallback((messageId: string, audioUrl: string) => {
    console.log(`🎵 Audio complete for message ${messageId}, URL: ${audioUrl.substring(0, 50)}...`);
    setMessages(prev => {
      const updatedMessages = prev.map(m =>
        m.id === messageId
          ? { ...m, audioUrl, isAudioGenerating: false }
          : m
      );
      return updatedMessages;
    });
  }, []);

  // + Pass the callback to useStreamingAudio
  const streamingAudio = useStreamingAudio(handleAudioComplete);

  // + Add state for the audio response toggle, persisted in local storage
  const [isAudioResponseEnabled, setIsAudioResponseEnabled] = useLocalStorage('nexus_audio_response_enabled_v1', true);

  // + Add TTS parameters, persisted in local storage
  const [ttsExaggeration, setTtsExaggeration] = useLocalStorage('nexus_tts_exaggeration_v1', 0.5);
  const [ttsCfgWeight, setTtsCfgWeight] = useLocalStorage('nexus_tts_cfg_weight_v1', 0.5);
  const [ttsRefAudioFile, setTtsRefAudioFile] = useLocalStorage<string | null>('nexus_tts_ref_audio_file_v1', null);

  // + Add role and system prompt state
  const [chatbotRole, setChatbotRole] = useLocalStorage('nexus_chatbot_role_v1', 'Helpful Document Assistant');
  const [systemPrompt, setSystemPrompt] = useLocalStorage('nexus_system_prompt_v1', 'You are a helpful document assistant. Provide clear, accurate, and concise answers based on the provided documents.');
  const [isLoadingRoleConfig, setIsLoadingRoleConfig] = useState(false);

  // Load role configuration from Firestore on mount
  useEffect(() => {
    const loadRoleConfig = async () => {
      if (!user?.uid) return;

      try {
        setIsLoadingRoleConfig(true);
        const { doc, getDoc, collection } = await import('firebase/firestore');
        const docRef = doc(db, 'users', user.uid, 'config', 'chatbot');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role) setChatbotRole(data.role);
          if (data.systemPrompt) setSystemPrompt(data.systemPrompt);
        }
      } catch (error) {
        console.error('Error loading role config from Firestore:', error);
      } finally {
        setIsLoadingRoleConfig(false);
      }
    };

    loadRoleConfig();
  }, [user?.uid]);

  useEffect(() => {
    streamingAudio.connect();
    return () => {
      streamingAudio.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monitor TTS usage and log to Firestore when available
  useEffect(() => {
    if (streamingAudio.ttsUsage && user?.uid) {
      logTTSUsageToFirestore(user.uid, streamingAudio.ttsUsage);
    }
  }, [streamingAudio.ttsUsage, user?.uid]);

  const updateMessagesInCurrentThread = (newMessages: Message[], title?: string) => {
    if (!currentChatThreadId) return;
    const messagesForStorage = newMessages.map(({ audioData, ...message }) => message);

    setChatThreads(prevThreads => {
      const threadIndex = prevThreads.findIndex(t => t.id === currentChatThreadId);
      if (threadIndex === -1) return prevThreads;

      const updatedThread = {
        ...prevThreads[threadIndex],
        messages: messagesForStorage,
        lastUpdatedAt: new Date().toISOString(),
        ...(title && { title }),
      };

      const newThreads = [...prevThreads];
      newThreads[threadIndex] = updatedThread;
      return newThreads.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
    });
  };

  // + Add function to set audio URL for a specific message
  const setAudioForMessage = useCallback((messageId: string, audioUrl: string) => {
    setMessages(prev => {
      const updatedMessages = prev.map(m =>
        m.id === messageId
          ? { ...m, audioUrl, isAudioGenerating: false }
          : m
      );
      // Note: We don't persist audioUrl to storage as blobs are session-only
      return updatedMessages;
    });
  }, []);

  // + Add function to set audio generating state for a specific message
  const setAudioGeneratingForMessage = useCallback((messageId: string, isGenerating: boolean) => {
    setMessages(prev => {
      const updatedMessages = prev.map(m =>
        m.id === messageId
          ? { ...m, isAudioGenerating: isGenerating }
          : m
      );
      return updatedMessages;
    });
  }, []);

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
    // Remove duplicate empty threads - keep only one empty "New Chat" thread
    const emptyThreads = chatThreads.filter(t => t.messages.length === 0 && t.title === 'New Chat');
    const nonEmptyThreads = chatThreads.filter(t => t.messages.length > 0);

    // If there are multiple empty threads, keep only the most recent one
    if (emptyThreads.length > 1) {
      const mostRecentEmpty = [...emptyThreads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const cleanedThreads = [...nonEmptyThreads, mostRecentEmpty];
      setChatThreads(cleanedThreads);
    }

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
      setMessages(thread?.messages || []);
    } else {
      setActiveChatThread(null);
      setMessages([]);
    }
  }, [currentChatThreadId, chatThreads]);
  
  const uploadFile = async (file: File) => {
    if (!currentChatThreadId) return;

    const validation = validateFileSize(file);
    if (!validation.isValid) {
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

  const stopCurrentAudio = useCallback(() => {
    streamingAudio.stopAudio();
  }, [streamingAudio]);

  // + Add a function to toggle the audio response setting
  const toggleAudioResponse = useCallback(() => {
    setIsAudioResponseEnabled(prev => {
      const newState = !prev;
      // If turning audio off, stop any currently playing audio
      if (!newState) {
        stopCurrentAudio();
      }
      return newState;
    });
  }, [setIsAudioResponseEnabled, stopCurrentAudio]);

  const addProcessedMessages = (userMessage: Message, assistantMessage: Message) => {
    if (!currentChatThreadId) return;

    const isNewThread = activeChatThread?.messages.length === 0 && activeChatThread.title === "New Chat";
    const newTitle = isNewThread ? (userMessage.content.substring(0, 30) + (userMessage.content.length > 30 ? '...' : '')) : undefined;

    // Mark assistant message as generating audio if audio is enabled
    const assistantMessageForState = {
      ...assistantMessage,
      audioData: null,
      isAudioGenerating: isAudioResponseEnabled
    };

    setMessages(prevMessages => {
      const updatedMessages = [...prevMessages, userMessage, assistantMessageForState];
      updateMessagesInCurrentThread(updatedMessages, newTitle);
      return updatedMessages;
    });

    // ~ UPDATED: Only request TTS if the audio toggle is enabled, pass messageId
    if (isAudioResponseEnabled) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = assistantMessage.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      if (textContent.trim()) {
        const lang = (assistantMessage as any).detected_language || 'en';
        streamingAudio.requestTTS(textContent, assistantMessage.id, lang, {
          exaggeration: ttsExaggeration,
          cfg_weight: ttsCfgWeight,
          reference_audio_file: ttsRefAudioFile
        });
      }
    }
  };

  const sendMessage = async (userInput: string, originalText?: string, isVoiceMessage: boolean = false, detectedLang?: string) => {
    if (!userInput.trim() || !currentChatThreadId) return;

    setIsLoadingResponse(true);
    stopCurrentAudio();

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
      let conversationHistoryString = '';
      const currentMessages = activeChatThread?.messages || [];
      const recentMessages = currentMessages.filter(msg => msg.role !== 'system').slice(-10);
      
      for (let i = 0; i < recentMessages.length - 1; i += 2) {
        const userMsg = recentMessages[i];
        const assistantMsg = recentMessages[i + 1];
        if (userMsg && assistantMsg && userMsg.role === 'user' && assistantMsg.role === 'assistant') {
          conversationHistoryString += `User: ${userMsg.content}\nAssistant: ${assistantMsg.content}\n\n`;
        }
      }
      
      const response = await askQuestion(userInput, conversationHistoryString, detectedLang, false, user?.uid, systemPrompt);

      if (!response || !response.answer) {
        throw new Error('No valid response received from the AI service.');
      }

      // Log usage data to Firestore if available
      if (response.usage && user?.uid) {
        await logUsageToFirestore(user.uid, response.usage);
      }
      
      const finalAssistantMessage: Message = {
        ...assistantPlaceholderMessage,
        content: response.answer,
        contentType: 'html',
        isLoading: false,
        timestamp: new Date().toISOString(),
        audioData: null,
        isAudioGenerating: isAudioResponseEnabled, // Mark as generating if audio is enabled
        ...(response.debug_graph_context && { debug_graph_context: response.debug_graph_context }),
        ...(response.debug_filtered_docs && { debug_filtered_docs: response.debug_filtered_docs }),
      };

      setMessages(prev => {
        const finalMessages = prev.map(m => m.id === assistantPlaceholderMessage.id ? finalAssistantMessage : m);
        updateMessagesInCurrentThread(finalMessages, newTitle);
        return finalMessages;
      });

      // ~ UPDATED: Check the toggle state before initiating TTS, pass messageId
      if (isAudioResponseEnabled) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = response.answer;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';

        if (textContent.trim()) {
          streamingAudio.requestTTS(textContent, assistantPlaceholderMessage.id, response.detected_language || 'en', {
            exaggeration: ttsExaggeration,
            cfg_weight: ttsCfgWeight,
            reference_audio_file: ttsRefAudioFile
          });
        }
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
    // If the current thread is already an empty "New Chat", don't create another one
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

  // NEW: Restore audio from IndexedDB for a specific message
  const restoreAudioFromCache = useCallback(async (messageId: string) => {
    try {
      const blob = await getAudio(messageId);
      if (blob) {
        const audioUrl = URL.createObjectURL(blob);
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, audioUrl, isAudioGenerating: false }
            : m
        ));
        console.log(`🎵 Restored audio from cache for message: ${messageId}`);
      }
    } catch (error) {
      console.error(`Failed to restore audio for message ${messageId}:`, error);
    }
  }, []);

  const loadChatThread = useCallback(async (threadId: string) => {
    const thread = chatThreads.find(t => t.id === threadId);
    if (thread) {
      setCurrentChatThreadId(threadId);
      if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsHistoryPanelOpen(false);
      }

      // Restore audio for assistant messages from IndexedDB
      for (const message of thread.messages) {
        if (message.role === 'assistant' && !message.audioUrl) {
          // Try to restore from cache (non-blocking)
          restoreAudioFromCache(message.id);
        }
      }
    }
  }, [chatThreads, isHistoryPanelOpen, setCurrentChatThreadId, setIsHistoryPanelOpen, restoreAudioFromCache]);

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

  // + Updated requestTTS to accept messageId and set generating state
  const requestTTS = useCallback((text: string, messageId: string, language: string = 'en') => {
    // Mark the message as generating audio
    setAudioGeneratingForMessage(messageId, true);

    streamingAudio.requestTTS(text, messageId, language, {
      exaggeration: ttsExaggeration,
      cfg_weight: ttsCfgWeight,
      reference_audio_file: ttsRefAudioFile
    });
  }, [streamingAudio, ttsExaggeration, ttsCfgWeight, ttsRefAudioFile, setAudioGeneratingForMessage]);

  return (
    <ChatContext.Provider value={{
      chatThreads,
      currentChatThreadId,
      activeChatThread,
      messages,
      isLoadingResponse,
      isHistoryPanelOpen,
      isAudioResponseEnabled, // + Expose new state
      toggleAudioResponse,    // + Expose new function
      ttsExaggeration,        // + Expose TTS parameters
      setTtsExaggeration,
      ttsCfgWeight,
      setTtsCfgWeight,
      ttsRefAudioFile,
      setTtsRefAudioFile,
      // + Expose TTS status
      ttsIsConnected: streamingAudio.isConnected,
      ttsIsLoading: streamingAudio.isLoading,
      ttsIsStreaming: streamingAudio.isStreaming,
      ttsIsPlaying: streamingAudio.isPlaying,
      ttsIsPaused: streamingAudio.isPaused, // NEW: Expose paused state
      ttsProgressPercent: streamingAudio.progressPercent,
      ttsCurrentChunk: streamingAudio.currentChunk,
      ttsTotalChunks: streamingAudio.totalChunks,
      ttsError: streamingAudio.error,
      ttsUsage: streamingAudio.ttsUsage,
      ttsStreamingPlaybackPosition: streamingAudio.streamingPlaybackPosition, // NEW: Expose playback position
      // + Expose current TTS message ID
      currentTtsMessageId: streamingAudio.currentMessageId,
      // + Expose role and system prompt
      chatbotRole,
      setChatbotRole,
      systemPrompt,
      setSystemPrompt,
      isLoadingRoleConfig,
      sendMessage,
      addProcessedMessages,
      uploadFile,
      startNewChat,
      loadChatThread,
      deleteChatThread,
      clearChatHistory,
      toggleHistoryPanel,
      setIsHistoryPanelOpen,
      getThreadTitle,
      stopCurrentAudio,
      pauseStreamingAudio: streamingAudio.pauseAudio, // NEW: Expose pause function
      resumeStreamingAudio: streamingAudio.resumeAudio, // NEW: Expose resume function
      stopChunkPlayback: streamingAudio.stopChunkPlayback, // NEW: Expose stop chunk playback function
      requestTTS,
      setAudioForMessage,
      setAudioGeneratingForMessage,
      restoreAudioFromCache, // NEW: Expose restore function
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

