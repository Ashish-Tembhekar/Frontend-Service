"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Message, ChatThread } from '../types/chat';
import useLocalStorage from '../hooks/useLocalStorage';
import { uploadPdfDocument as uploadPdf, askQuestionAPI as askQuestion, generateKokoroAudio } from '../services/apiClientNew';
import { useToast } from '../hooks/use-toast';
import { validateFileSize } from '../lib/utils';
import { useStreamingAudio } from '../hooks/useStreamingAudio';
import { useAuth } from './AuthContext';
import { logUsageToFirestore, logTTSUsageToFirestore, type TTSUsageData } from '../services/usageLogger';
import { db } from '../lib/firebase/config';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    addDoc,
    getDocs,
    writeBatch,
    Timestamp,
    updateDoc
} from 'firebase/firestore';
import { getAudioSasUrl } from '../services/audioStorage';
import { useSSEContext } from './SSEContext';
import { appConfig } from '../lib/config';

interface ChatContextType {
    chatThreads: ChatThread[];
    currentChatThreadId: string | null;
    activeChatThread: ChatThread | null;
    messages: Message[];
    isLoadingResponse: boolean;
    isHistoryPanelOpen: boolean;

    // Audio settings
    isAudioResponseEnabled: boolean;
    toggleAudioResponse: () => void;

    // TTS Settings
    ttsProvider: 'chatterbox' | 'kokoro';
    setTtsProvider: (provider: 'chatterbox' | 'kokoro') => void;

    // Chatterbox Params
    ttsExaggeration: number;
    setTtsExaggeration: (value: number) => void;
    ttsCfgWeight: number;
    setTtsCfgWeight: (value: number) => void;
    ttsRefAudioFile: string | null;
    setTtsRefAudioFile: (filename: string | null) => void;

    // Kokoro Params
    kokoroVoice: string;
    setKokoroVoice: (voice: string) => void;
    kokoroSpeed: number;
    setKokoroSpeed: (speed: number) => void;

    // TTS Status
    ttsIsConnected: boolean;
    ttsIsLoading: boolean;
    ttsIsStreaming: boolean;
    ttsIsPlaying: boolean;
    ttsIsPaused: boolean;
    ttsProgressPercent: number;
    ttsCurrentChunk: number;
    ttsTotalChunks: number;
    ttsError: string | null;
    ttsUsage: TTSUsageData | null;
    ttsStreamingPlaybackPosition: number;
    currentTtsMessageId: string | null;

    // Role config
    chatbotRole: string;
    setChatbotRole: (role: string) => void;
    systemPrompt: string;
    setSystemPrompt: (prompt: string) => void;
    isLoadingRoleConfig: boolean;

    // Actions
    sendMessage: (userInput: string, originalText?: string, isVoiceMessage?: boolean, detectedLang?: string) => Promise<void>;
    addProcessedMessages: (userMessage: Message, assistantMessage: Message, skipTTS?: boolean) => void;
    uploadFile: (file: File) => Promise<void>;
    startNewChat: () => void;
    loadChatThread: (threadId: string) => void;
    deleteChatThread: (threadId: string) => void;
    clearChatHistory: () => void;
    toggleHistoryPanel: () => void;
    setIsHistoryPanelOpen: (isOpen: boolean) => void;
    getThreadTitle: (threadId: string) => string;
    stopCurrentAudio: () => void;
    pauseStreamingAudio: () => void;
    resumeStreamingAudio: () => void;
    stopChunkPlayback: () => void;
    requestTTS: (text: string, messageId: string, language?: string, skipPersistence?: boolean) => void;
    setAudioForMessage: (messageId: string, audioUrl: string) => void;
    setAudioGeneratingForMessage: (messageId: string, isGenerating: boolean) => void;
    restoreAudioFromCache: (messageId: string, threadId: string) => Promise<void>;
    connectChatterboxTTS: () => void;
    disconnectChatterboxTTS: () => void;
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

// Helper function to convert Firestore Timestamp to ISO string
const timestampToISO = (timestamp: Timestamp | Date | string | undefined | null): string => {
    if (!timestamp) return new Date().toISOString();
    if (typeof timestamp === 'string') return timestamp;
    // Check if it's a Date object
    if (timestamp instanceof Date) return timestamp.toISOString();
    // Check if it has toDate method (Firestore Timestamp)
    if (typeof (timestamp as Timestamp).toDate === 'function') {
        return (timestamp as Timestamp).toDate().toISOString();
    }
    // Fallback: try to create a date from seconds if it has that property
    if ('seconds' in timestamp && typeof timestamp.seconds === 'number') {
        return new Date(timestamp.seconds * 1000).toISOString();
    }
    // Final fallback
    return new Date().toISOString();
};

// Helper function to sanitize objects for Firestore (replace undefined with null, remove functions)
const sanitizeForFirestore = <T extends Record<string, unknown>>(obj: T): T => {
    const sanitized: Record<string, unknown> = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (typeof value === 'function') {
                // Skip functions
                continue;
            } else if (value === undefined) {
                // Replace undefined with null
                sanitized[key] = null;
            } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                // Recursively sanitize nested objects (but not arrays)
                sanitized[key] = sanitizeForFirestore(value as Record<string, unknown>);
            } else if (Array.isArray(value)) {
                // Sanitize arrays - convert undefined elements to null
                sanitized[key] = value.map((item: unknown) =>
                    item === undefined ? null :
                        (typeof item === 'object' && item !== null && !Array.isArray(item)
                            ? sanitizeForFirestore(item as Record<string, unknown>)
                            : item)
                );
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized as T;
};

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Chat threads are now stored in Firestore (users/{uid}/threads)
    const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
    const [currentChatThreadId, setCurrentChatThreadId] = useState<string | null>(null);
    const [isFirestoreLoading, setIsFirestoreLoading] = useState(true);
    const [activeChatThread, setActiveChatThread] = useState<ChatThread | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingResponse, setIsLoadingResponse] = useState(false);
    // Ref to track in-flight (optimistic) message IDs that haven't been persisted to Firestore yet.
    // This prevents the onSnapshot listener from wiping them when it fires with stale data.
    const pendingMessageIdsRef = useRef<Set<string>>(new Set());
    // Ref to track thread IDs that exist only in local state (not yet persisted to Firestore).
    // Threads are created locally first and only written to Firestore when the first message is sent.
    // This prevents empty conversation sessions from accumulating in Firestore on every refresh.
    const pendingThreadIdsRef = useRef<Set<string>>(new Set());
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useLocalStorage('nexus_history_panel_open_v2', false);
    const { toast } = useToast();
    const { user } = useAuth();

    // Real-time Firestore sync for chat threads
    useEffect(() => {
        if (!user?.uid) {
            setChatThreads([]);
            setCurrentChatThreadId(null);
            setIsFirestoreLoading(false);
            return;
        }

        console.log('🔥 Setting up Firestore listener for threads...');
        const threadsRef = collection(db, 'users', user.uid, 'threads');
        const threadsQuery = query(threadsRef, orderBy('lastUpdatedAt', 'desc'));

        const unsubscribe = onSnapshot(
            threadsQuery,
            (snapshot) => {
                const threads: ChatThread[] = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        title: data.title || 'New Chat',
                        messages: [], // Messages are fetched separately
                        createdAt: timestampToISO(data.createdAt),
                        lastUpdatedAt: timestampToISO(data.lastUpdatedAt),
                    };
                });
                console.log(`🔥 Received ${threads.length} threads from Firestore`);
                // Merge Firestore threads with any pending (local-only) threads.
                // Pending threads haven't been written to Firestore yet (no messages sent).
                const firestoreIds = new Set(threads.map(t => t.id));
                setChatThreads(prev => {
                    const stillPending = prev.filter(t =>
                        pendingThreadIdsRef.current.has(t.id) && !firestoreIds.has(t.id)
                    );
                    // Also clean up pendingThreadIdsRef: remove IDs now in Firestore
                    for (const id of pendingThreadIdsRef.current) {
                        if (firestoreIds.has(id)) {
                            pendingThreadIdsRef.current.delete(id);
                        }
                    }
                    return [...stillPending, ...threads];
                });
                setIsFirestoreLoading(false);

                // Auto-select the most recent thread if none is selected
                if (!currentChatThreadId && threads.length > 0) {
                    setCurrentChatThreadId(threads[0].id);
                }
            },
            (error) => {
                console.error('Error listening to threads:', error);
                toast({
                    title: "Sync Error",
                    description: "Failed to sync chat history. Please refresh the page.",
                    variant: "destructive",
                });
                setIsFirestoreLoading(false);
            }
        );

        return () => {
            console.log('🔥 Unsubscribing from Firestore threads listener');
            unsubscribe();
        };
    }, [user?.uid, toast]);

    // Fetch messages when currentChatThreadId changes
    useEffect(() => {
        if (!user?.uid || !currentChatThreadId) {
            setMessages([]);
            return;
        }

        console.log(`🔥 Setting up Firestore listener for messages in thread: ${currentChatThreadId}`);
        const messagesRef = collection(db, 'users', user.uid, 'threads', currentChatThreadId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(
            messagesQuery,
            (snapshot) => {
                const firestoreMsgs: Message[] = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        role: data.role,
                        content: data.content,
                        contentType: data.contentType,
                        timestamp: timestampToISO(data.timestamp),
                        // audioUrl is NOT persisted to Firestore (local blob: URLs are useless).
                        // It will be restored on-demand from Azure via audioBlobName + SAS URL.
                        audioBlobName: data.audioBlobName,
                        imageUrls: data.imageUrls,
                        sources: data.sources,
                    };
                });
                console.log(`🔥 Received ${firestoreMsgs.length} messages from Firestore`);

                // Remove any pending IDs that now exist in Firestore (they've been persisted)
                const firestoreIds = new Set(firestoreMsgs.map(m => m.id));
                for (const id of pendingMessageIdsRef.current) {
                    if (firestoreIds.has(id)) {
                        pendingMessageIdsRef.current.delete(id);
                    }
                }

                // Merge Firestore data with local state, preserving:
                // 1. Pending (in-flight) messages not yet persisted to Firestore
                // 2. Local audioUrl for freshly generated audio (not persisted to Firestore)
                setMessages(prev => {
                    // Build a map of local audioUrls for freshly generated audio
                    const localAudioUrls = new Map<string, string>();
                    for (const msg of prev) {
                        if (msg.audioUrl && freshlyGeneratedAudioRefs.current.has(msg.id)) {
                            localAudioUrls.set(msg.id, msg.audioUrl);
                        }
                    }

                    // Start with Firestore messages, preserving local audioUrls
                    const merged: Message[] = firestoreMsgs.map(msg => {
                        const localUrl = localAudioUrls.get(msg.id);
                        return localUrl ? { ...msg, audioUrl: localUrl } : msg;
                    });

                    // Append any pending messages not yet in Firestore
                    if (pendingMessageIdsRef.current.size > 0) {
                        console.log(`🔥 Merging Firestore data with ${pendingMessageIdsRef.current.size} pending message(s)`);
                        const pendingMessages = prev.filter(m => pendingMessageIdsRef.current.has(m.id));
                        for (const pm of pendingMessages) {
                            if (!firestoreIds.has(pm.id)) {
                                merged.push(pm);
                            }
                        }
                    }

                    return merged;
                });
            },
            (error) => {
                console.error('Error listening to messages:', error);
            }
        );

        return () => {
            console.log('🔥 Unsubscribing from Firestore messages listener');
            unsubscribe();
        };
    }, [user?.uid, currentChatThreadId]);

    // TTS Provider State
    const [ttsProvider, setTtsProvider] = useLocalStorage<'chatterbox' | 'kokoro'>('nexus_tts_provider_v1', 'chatterbox');

    // Auto-switch to Chatterbox if Kokoro is selected but unavailable
    useEffect(() => {
        if (ttsProvider === 'kokoro' && !appConfig.isKokoroAvailable) {
            console.warn('⚠️ Kokoro TTS is not available (URL not configured). Switching to Chatterbox.');
            setTtsProvider('chatterbox');
        }
    }, [ttsProvider, setTtsProvider]);

    // Chatterbox Params
    const [ttsExaggeration, setTtsExaggeration] = useLocalStorage('nexus_tts_exaggeration_v1', 0.5);
    const [ttsCfgWeight, setTtsCfgWeight] = useLocalStorage('nexus_tts_cfg_weight_v1', 0.5);
    const [ttsRefAudioFile, setTtsRefAudioFile] = useLocalStorage<string | null>('nexus_tts_ref_audio_file_v1', null);

    // Kokoro Params
    const [kokoroVoice, setKokoroVoice] = useLocalStorage('nexus_kokoro_voice_v1', 'af_heart');
    const [kokoroSpeed, setKokoroSpeed] = useLocalStorage('nexus_kokoro_speed_v1', 1.0);

    // Track message IDs that have freshly generated audio in the current session
    // These should NOT trigger a backend fetch since they already have local Blob URLs
    const freshlyGeneratedAudioRefs = useRef<Set<string>>(new Set());
    // Track the originating thread for each TTS request to avoid session-switch races
    const ttsMessageThreadRef = useRef<Map<string, string>>(new Map());

    const handleAudioComplete = useCallback((messageId: string, audioUrl: string) => {
        console.log(`🎵 Audio complete for message ${messageId}, URL: ${audioUrl.substring(0, 50)}...`);
        // Track this message as having freshly generated audio
        freshlyGeneratedAudioRefs.current.add(messageId);
        setMessages(prev => prev.map(m =>
            m.id === messageId
                ? { ...m, audioUrl, isAudioGenerating: false }
                : m
        ));
    }, []);

    // Called AFTER Azure Blob upload completes (background) — persists audioBlobName to Firestore
    const handleBlobNameReady = useCallback(async (messageId: string, blobName: string, sourceThreadId?: string) => {
        console.log(`☁️  Blob name ready for message ${messageId}: ${blobName}`);
        // Update local state
        setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, audioBlobName: blobName } : m
        ));
        // Persist audioBlobName directly to Firestore
        const resolvedThreadId = sourceThreadId || ttsMessageThreadRef.current.get(messageId) || currentChatThreadId;
        if (user?.uid && resolvedThreadId) {
            try {
                const messageDoc = doc(db, 'users', user.uid, 'threads', resolvedThreadId, 'messages', messageId);
                await setDoc(messageDoc, { audioBlobName: blobName }, { merge: true });
                console.log(`🔥 Persisted audioBlobName to Firestore for message: ${messageId} in thread: ${resolvedThreadId}`);
                ttsMessageThreadRef.current.delete(messageId);
            } catch (error) {
                console.error(`🔥 Failed to persist audioBlobName for message ${messageId}:`, error);
            }
        } else {
            ttsMessageThreadRef.current.delete(messageId);
        }
    }, [user?.uid, currentChatThreadId]);

    const streamingAudio = useStreamingAudio(handleAudioComplete, handleBlobNameReady, user?.uid, currentChatThreadId || undefined);
    const [isAudioResponseEnabled, setIsAudioResponseEnabled] = useLocalStorage('nexus_audio_response_enabled_v1', true);

    // Use shared SSE for status updates (including LLM processing status)
    const { lastEvent: sseLastEvent } = useSSEContext();

    // Role config
    const [chatbotRole, setChatbotRole] = useLocalStorage('nexus_chatbot_role_v1', 'Helpful Document Assistant');
    const [systemPrompt, setSystemPrompt] = useLocalStorage('nexus_system_prompt_v1', 'You are a helpful document assistant. Provide clear, accurate, and concise answers based on the provided documents.');
    const [isLoadingRoleConfig, setIsLoadingRoleConfig] = useState(false);

    // Handle SSE events for LLM status updates
    useEffect(() => {
        if (sseLastEvent && sseLastEvent.type === 'llm_status_update') {
            const { question_id, status } = sseLastEvent;
            if (question_id && status) {
                // Update the processing status of the loading assistant message
                setMessages(prev => prev.map(msg =>
                    msg.isLoading && msg.role === 'assistant'
                        ? { ...msg, processingStatus: status }
                        : msg
                ));
            }
        }
    }, [sseLastEvent]);

    useEffect(() => {
        const loadRoleConfig = async () => {
            if (!user?.uid) return;
            try {
                setIsLoadingRoleConfig(true);
                const { doc, getDoc } = await import('firebase/firestore');
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

    // Role config loading from Firestore
    // Connection established only when Chatterbox TTS is actively used
    useEffect(() => {
        // Cleanup: disconnect WebSocket when component unmounts
        return () => {
            streamingAudio.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (streamingAudio.ttsUsage && user?.uid) {
            logTTSUsageToFirestore(user.uid, streamingAudio.ttsUsage);
        }
    }, [streamingAudio.ttsUsage, user?.uid]);

    // Disconnect WebSocket when switching providers to ensure fresh connection to the correct service
    useEffect(() => {
        if (streamingAudio.isConnected) {
            console.log('🎵 TTS Provider changed, disconnecting current WebSocket...');
            streamingAudio.disconnect();
        }
    }, [ttsProvider]);


    // Write messages to Firestore and update thread metadata
    const updateMessagesInCurrentThread = useCallback(async (newMessages: Message[], title?: string) => {
        if (!currentChatThreadId || !user?.uid) return;

        console.log('🔥 Persisting messages to Firestore, title:', title);

        try {
            const threadRef = doc(db, 'users', user.uid, 'threads', currentChatThreadId);
            const messagesRef = collection(db, 'users', user.uid, 'threads', currentChatThreadId, 'messages');

            // If this thread was created locally (pending), persist it to Firestore now
            if (pendingThreadIdsRef.current.has(currentChatThreadId)) {
                console.log('🔥 Persisting pending thread to Firestore on first message:', currentChatThreadId);
                await setDoc(threadRef, {
                    title: title || 'New Chat',
                    createdAt: serverTimestamp(),
                    lastUpdatedAt: serverTimestamp(),
                });
                pendingThreadIdsRef.current.delete(currentChatThreadId);
            }

            // Write all finalized (non-loading) messages to Firestore.
            // We use setDoc with merge:true so re-writing already-persisted messages is safe.
            // This avoids relying on stale closure state to determine which messages are "new".
            const messagesToWrite = newMessages.filter(m => !m.isLoading);

            // Write each finalized message to Firestore
            for (const msg of messagesToWrite) {

                const messageDoc = doc(messagesRef, msg.id);
                const { audioData, isLoading, processingStatus, isAudioGenerating, ...messageForStorage } = msg as Message & { audioData?: unknown };

                // Sanitize the message object - replace undefined with null for Firestore compatibility
                // NOTE: audioUrl is deliberately excluded — local blob: URLs are useless after refresh.
                // Audio is restored from Azure via audioBlobName + SAS URL on-demand.
                const { audioUrl: _audioUrl, ...messageWithoutAudioUrl } = messageForStorage;
                const sanitizedMessage = sanitizeForFirestore({
                    ...messageWithoutAudioUrl,
                    // Initialize optional fields to null if undefined
                    contentType: messageForStorage.contentType ?? null,
                    audioBlobName: messageForStorage.audioBlobName ?? null,
                    imageUrls: messageForStorage.imageUrls ?? null,
                    sources: messageForStorage.sources ?? null,
                    // Use the client-side timestamp from message creation, not serverTimestamp()
                    // This ensures user message always has an earlier timestamp than assistant message
                    timestamp: messageForStorage.timestamp,
                });

                console.log('🔥 Sanitized data for Firestore:', sanitizedMessage);
                await setDoc(messageDoc, sanitizedMessage, { merge: true });
            }

            // Update thread metadata (title and lastUpdatedAt)
            const updateData: Record<string, any> = {
                lastUpdatedAt: serverTimestamp(),
            };
            if (title) {
                updateData.title = title;
            }
            await updateDoc(threadRef, updateData);

            console.log('🔥 Successfully persisted to Firestore');
        } catch (error) {
            console.error('Error persisting to Firestore:', error);
            toast({
                title: "Save Error",
                description: "Failed to save message. Changes may not persist.",
                variant: "destructive",
            });
        }
    }, [currentChatThreadId, user?.uid, toast]);

    const setAudioForMessage = useCallback((messageId: string, audioUrl: string) => {
        setMessages(prev => {
            return prev.map(m =>
                m.id === messageId
                    ? { ...m, audioUrl, isAudioGenerating: false }
                    : m
            );
        });
    }, []);

    const setAudioGeneratingForMessage = useCallback((messageId: string, isGenerating: boolean) => {
        setMessages(prev => {
            return prev.map(m =>
                m.id === messageId
                    ? { ...m, isAudioGenerating: isGenerating }
                    : m
            );
        });
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedState = window.localStorage.getItem('nexus_history_panel_open_v2');
            if (storedState === null) {
                setIsHistoryPanelOpen(window.innerWidth >= 768);
            }
        }
    }, []);

    // Note: Effect for handling initial thread creation is placed after startNewChat definition

    // Update activeChatThread when currentChatThreadId or chatThreads changes
    useEffect(() => {
        if (currentChatThreadId) {
            const thread = chatThreads.find(t => t.id === currentChatThreadId);
            setActiveChatThread(thread || null);
            // Note: messages are now fetched from Firestore via the messages onSnapshot listener
        } else {
            setActiveChatThread(null);
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

    const toggleAudioResponse = useCallback(() => {
        setIsAudioResponseEnabled(prev => !prev);
    }, [setIsAudioResponseEnabled]);

    // Helper to handle the actual API calls for TTS based on provider
    const handleTTSGeneration = async (text: string, messageId: string, lang: string, skipPersistence: boolean = false) => {
        if (!text.trim()) return;
        if (!currentChatThreadId) return;

        if (!skipPersistence) {
            ttsMessageThreadRef.current.set(messageId, currentChatThreadId);
        }
        setAudioGeneratingForMessage(messageId, true);

        // Check if we need to connect
        // Note: streamingAudio.isConnected is a boolean, doesn't tell us WHICH provider.
        // But requestTTS inside the hook will check connection and reconnect if needed (if we modified it to be smart, but we just made it assume connection or try to connect).
        // Best approach: If not connected, call connect(provider).

        // We can explicitly connect if strictly not connected.
        // But useStreamingAudio.requestTTS handles connection check but it might default to 'chatterbox' if we rely on internal reconnection logic.
        // So let's ensure we are connected to the RIGHT provider.

        // We can pass the provider to requestTTS and let it handle connection logic if implicit.

        // Logic:
        // Always try to use streaming for both.

        try {
            streamingAudio.requestTTS(text, messageId, lang, {
                exaggeration: ttsExaggeration,
                cfg_weight: ttsCfgWeight,
                reference_audio_file: ttsRefAudioFile
            }, ttsProvider, skipPersistence); // Pass ttsProvider and skipPersistence

        } catch (error) {
            console.error("TTS Request failed", error);
            ttsMessageThreadRef.current.delete(messageId);
            setAudioGeneratingForMessage(messageId, false);
            toast({
                title: "TTS Error",
                description: "Failed to initiate text-to-speech.",
                variant: "destructive"
            });
        }
    };

    const addProcessedMessages = (userMessage: Message, assistantMessage: Message, skipTTS: boolean = false) => {
        if (!currentChatThreadId) return;

        const isNewThread = activeChatThread?.messages.length === 0 && activeChatThread.title === "New Chat";
        const newTitle = isNewThread ? (userMessage.content.substring(0, 30) + (userMessage.content.length > 30 ? '...' : '')) : undefined;

        const assistantMessageForState = {
            ...assistantMessage,
            audioData: null,
            isAudioGenerating: isAudioResponseEnabled && !skipTTS // Do not show generating state if skipping TTS
        };

        // Mark as pending so onSnapshot doesn't wipe them before Firestore persistence
        pendingMessageIdsRef.current.add(userMessage.id);
        pendingMessageIdsRef.current.add(assistantMessageForState.id);

        setMessages(prevMessages => {
            const updatedMessages = [...prevMessages, userMessage, assistantMessageForState];
            updateMessagesInCurrentThread(updatedMessages, newTitle);
            return updatedMessages;
        });

        if (isAudioResponseEnabled && !skipTTS) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = assistantMessage.content;
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            const lang = (assistantMessage as any).detected_language || 'en';

            handleTTSGeneration(textContent, assistantMessage.id, lang);
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

        // Mark both messages as pending so onSnapshot doesn't wipe them before Firestore persistence
        pendingMessageIdsRef.current.add(userMessage.id);
        pendingMessageIdsRef.current.add(assistantPlaceholderMessage.id);

        setMessages(prevMessages => {
            const updatedMessages = [...prevMessages, userMessage, assistantPlaceholderMessage];
            updateMessagesInCurrentThread(updatedMessages, newTitle);
            return updatedMessages;
        });

        try {
            let conversationHistoryString = '';
            // Use messages from state (not activeChatThread.messages which is always [] since Firestore migration)
            const currentMessages = messages.filter(msg => msg.role !== 'system' && !msg.isLoading);
            const recentMessages = currentMessages.slice(-10);

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
                isAudioGenerating: isAudioResponseEnabled,
                imageUrls: response.image_urls || [], // Add image URLs from response
                sources: response.sources || [], // Add sources from response
                ...(response.debug_graph_context && { debug_graph_context: response.debug_graph_context }),
                ...(response.debug_filtered_docs && { debug_filtered_docs: response.debug_filtered_docs }),
            };

            // DEBUG: Log the full response to see if session_name is present
            console.log('🔍 DEBUG: Full API response keys:', Object.keys(response));
            console.log('🔍 DEBUG: response.session_name value:', response.session_name);
            console.log('🔍 DEBUG: typeof response.session_name:', typeof response.session_name);

            setMessages(prev => {
                const finalMessages = prev.map(m => m.id === assistantPlaceholderMessage.id ? finalAssistantMessage : m);
                // Use LLM-generated session_name if available, otherwise fall back to newTitle
                const titleToUse = response.session_name || newTitle;
                console.log('🔍 DEBUG: newTitle:', newTitle);
                console.log('🔍 DEBUG: titleToUse:', titleToUse);
                console.log('🔍 DEBUG: currentChatThreadId:', currentChatThreadId);
                updateMessagesInCurrentThread(finalMessages, titleToUse);
                if (response.session_name) {
                    console.log(`📝 Updated session title to: ${response.session_name}`);
                }
                return finalMessages;
            });

            if (isAudioResponseEnabled) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = response.answer;
                const textContent = tempDiv.textContent || tempDiv.innerText || '';

                handleTTSGeneration(textContent, assistantPlaceholderMessage.id, response.detected_language || 'en');
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
            // Clear pending message IDs — by now they've been persisted to Firestore
            // (or replaced with error messages that were persisted).
            // The next onSnapshot will pick them up from Firestore.
            pendingMessageIdsRef.current.delete(userMessage.id);
            pendingMessageIdsRef.current.delete(assistantPlaceholderMessage.id);
            setIsLoadingResponse(false);
        }
    };

    const startNewChat = useCallback(async () => {
        if (!user?.uid) return;

        // Check if there's already a pending (local-only) empty "New Chat" thread we can reuse
        const existingPendingThread = chatThreads.find(t =>
            pendingThreadIdsRef.current.has(t.id) && t.title === 'New Chat'
        );
        if (existingPendingThread) {
            setCurrentChatThreadId(existingPendingThread.id);
            setMessages([]);
            if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
                setIsHistoryPanelOpen(false);
            }
            return;
        }

        // Also check if the current thread is already a "New Chat" with no messages
        if (currentChatThreadId) {
            const currentThread = chatThreads.find(t => t.id === currentChatThreadId);
            if (currentThread?.title === 'New Chat' && messages.length === 0) {
                if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsHistoryPanelOpen(false);
                }
                return;
            }
        }

        // Create thread LOCALLY only — it will be persisted to Firestore when the first message is sent.
        // This prevents empty conversation sessions from accumulating in Firestore on every refresh.
        const newThreadId = `thread_${Date.now()}`;
        const now = new Date().toISOString();
        const newThread: ChatThread = {
            id: newThreadId,
            title: 'New Chat',
            messages: [],
            createdAt: now,
            lastUpdatedAt: now,
        };

        pendingThreadIdsRef.current.add(newThreadId);
        setChatThreads(prev => [newThread, ...prev]);
        setCurrentChatThreadId(newThreadId);
        setMessages([]);

        console.log('📝 Created pending local thread (not yet in Firestore):', newThreadId);

        if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsHistoryPanelOpen(false);
        }
    }, [user?.uid, chatThreads, messages.length, currentChatThreadId, isHistoryPanelOpen, setIsHistoryPanelOpen]);

    // Handle initial thread creation when Firestore loads with no threads
    useEffect(() => {
        if (!isFirestoreLoading && !user?.uid) return;

        // If Firestore loaded and there are no threads, and user is logged in, create one
        if (!isFirestoreLoading && chatThreads.length === 0 && user?.uid && !currentChatThreadId) {
            startNewChat();
        }

        // If current thread was deleted, switch to the most recent
        if (!isFirestoreLoading && chatThreads.length > 0 && currentChatThreadId) {
            const threadStillExists = chatThreads.some(t => t.id === currentChatThreadId);
            if (!threadStillExists) {
                const mostRecentThread = [...chatThreads].sort((a, b) =>
                    new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
                )[0];
                setCurrentChatThreadId(mostRecentThread.id);
            }
        }
    }, [isFirestoreLoading, chatThreads, currentChatThreadId, user?.uid, startNewChat]);

    const getAudioRestoreKey = useCallback((threadId: string, messageId: string) => {
        return `${threadId}:${messageId}`;
    }, []);

    const restoreAudioFromCache = useCallback(async (messageId: string, threadId: string) => {
        const restoreKey = getAudioRestoreKey(threadId, messageId);
        try {
            setMessages(prev => prev.map(m =>
                m.id === messageId
                    ? { ...m, audioRestoreFailed: false }
                    : m
            ));

            // Fetch a time-limited SAS URL from Azure Blob Storage
            const sasUrl = await getAudioSasUrl(messageId, user?.uid, threadId);

            if (sasUrl) {
                setMessages(prev => prev.map(m =>
                    m.id === messageId
                        ? { ...m, audioUrl: sasUrl, isAudioGenerating: false, audioRestoreFailed: false }
                        : m
                ));
                console.log(`☁️  Restored audio SAS URL for message: ${messageId}`);
            } else {
                setMessages(prev => prev.map(m =>
                    m.id === messageId
                        ? { ...m, audioRestoreFailed: true }
                        : m
                ));
                console.warn(`☁️  No audio found in Azure for message: ${messageId}`);
            }
        } catch (error) {
            setMessages(prev => prev.map(m =>
                m.id === messageId
                    ? { ...m, audioRestoreFailed: true }
                    : m
            ));
            console.error(`Failed to restore audio for message ${messageId}:`, error);
        } finally {
            audioRestorationInProgressRef.current.delete(restoreKey);
            audioRestoreAttemptedRef.current.add(restoreKey);
        }
    }, [user?.uid, getAudioRestoreKey]);

    // Auto-restore audio from Azure for messages that have audioBlobName but no audioUrl.
    // This runs on page load when onSnapshot delivers messages from Firestore,
    // and also when switching threads via loadChatThread.
    const audioRestorationInProgressRef = useRef(new Set<string>());
    const audioRestoreAttemptedRef = useRef(new Set<string>());

    useEffect(() => {
        // Clear restoration tracking when switching threads/users so each thread can retry cleanly
        audioRestorationInProgressRef.current.clear();
        audioRestoreAttemptedRef.current.clear();
    }, [currentChatThreadId, user?.uid]);

    useEffect(() => {
        if (!user?.uid || !currentChatThreadId) return;

        for (const message of messages) {
            if (
                message.role === 'assistant' &&
                message.audioBlobName &&
                !message.audioUrl &&
                !freshlyGeneratedAudioRefs.current.has(message.id) &&
                !audioRestorationInProgressRef.current.has(getAudioRestoreKey(currentChatThreadId, message.id)) &&
                !audioRestoreAttemptedRef.current.has(getAudioRestoreKey(currentChatThreadId, message.id))
            ) {
                const restoreKey = getAudioRestoreKey(currentChatThreadId, message.id);
                audioRestorationInProgressRef.current.add(restoreKey);
                console.log(`☁️  Auto-restoring audio from Azure for message: ${message.id}`);
                restoreAudioFromCache(message.id, currentChatThreadId);
            }
        }
    }, [messages, user?.uid, currentChatThreadId, restoreAudioFromCache, getAudioRestoreKey]);

    const loadChatThread = useCallback(async (threadId: string) => {
        const thread = chatThreads.find(t => t.id === threadId);
        if (thread) {
            setCurrentChatThreadId(threadId);
            if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
                setIsHistoryPanelOpen(false);
            }

            console.log(`🎵 Loading thread: ${threadId}, messages count: ${thread.messages.length}`);

            for (const message of thread.messages) {
                // Only restore audio for assistant messages that have an Azure blob name
                // and don't have freshly generated audio (those already have a local Blob URL)
                if (message.role === 'assistant' && message.audioBlobName) {
                    if (freshlyGeneratedAudioRefs.current.has(message.id)) {
                        console.log(`🎵 Skipping Azure fetch for freshly generated audio: ${message.id}`);
                        continue;
                    }
                    console.log(`☁️  Restoring audio from Azure for message: ${message.id} in thread: ${threadId}`);
                    restoreAudioFromCache(message.id, threadId);
                }
            }
        }
    }, [chatThreads, isHistoryPanelOpen, setCurrentChatThreadId, setIsHistoryPanelOpen, restoreAudioFromCache]);

    const deleteChatThread = useCallback(async (threadId: string) => {
        if (!user?.uid) return;

        try {
            // If thread is pending (local-only, never persisted), just remove locally
            if (pendingThreadIdsRef.current.has(threadId)) {
                pendingThreadIdsRef.current.delete(threadId);
                setChatThreads(prev => prev.filter(t => t.id !== threadId));
                console.log('📝 Removed pending local thread:', threadId);
            } else {
                // Delete thread document from Firestore
                // Note: This doesn't delete the messages subcollection (Firestore limitation)
                // Messages become orphaned but won't be fetched
                const threadRef = doc(db, 'users', user.uid, 'threads', threadId);
                await deleteDoc(threadRef);
                console.log('🔥 Deleted thread from Firestore:', threadId);
            }

            // Switch to another thread if we deleted the current one
            if (currentChatThreadId === threadId) {
                const remainingThreads = chatThreads.filter(t => t.id !== threadId);
                if (remainingThreads.length > 0) {
                    const mostRecentThread = [...remainingThreads].sort((a, b) =>
                        new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
                    )[0];
                    setCurrentChatThreadId(mostRecentThread.id);
                } else {
                    // No threads left, create a new one
                    startNewChat();
                }
            }
        } catch (error) {
            console.error('Error deleting chat thread:', error);
            toast({
                title: "Error",
                description: "Failed to delete chat. Please try again.",
                variant: "destructive",
            });
        }
    }, [user?.uid, currentChatThreadId, chatThreads, startNewChat, toast]);

    const clearChatHistory = useCallback(async () => {
        if (!user?.uid) return;

        try {
            // Clear any pending (local-only) threads first
            pendingThreadIdsRef.current.clear();

            // Get all thread documents and delete them from Firestore
            const threadsRef = collection(db, 'users', user.uid, 'threads');
            const snapshot = await getDocs(threadsRef);

            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            console.log(`🔥 Deleted ${snapshot.docs.length} threads from Firestore`);

            // Reset local state and create a fresh new chat (will be local-only until first message)
            setChatThreads([]);
            setCurrentChatThreadId(null);
            setMessages([]);
            await startNewChat();

            if (isHistoryPanelOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
                setIsHistoryPanelOpen(false);
            }
        } catch (error) {
            console.error('Error clearing chat history:', error);
            toast({
                title: "Error",
                description: "Failed to clear chat history. Please try again.",
                variant: "destructive",
            });
        }
    }, [user?.uid, isHistoryPanelOpen, startNewChat, setIsHistoryPanelOpen, toast]);

    const getThreadTitle = (threadId: string): string => {
        const thread = chatThreads.find(t => t.id === threadId);
        return thread ? thread.title : "Chat";
    };

    const toggleHistoryPanel = () => {
        setIsHistoryPanelOpen(prev => !prev);
    };

    const requestTTS = useCallback((text: string, messageId: string, language: string = 'en', skipPersistence: boolean = false) => {
        handleTTSGeneration(text, messageId, language, skipPersistence);
    }, [handleTTSGeneration]);

    return (
        <ChatContext.Provider value={{
            chatThreads,
            currentChatThreadId,
            activeChatThread,
            messages,
            isLoadingResponse,
            isHistoryPanelOpen,
            isAudioResponseEnabled,
            toggleAudioResponse,

            // Provider State
            ttsProvider,
            setTtsProvider,

            // Chatterbox
            ttsExaggeration,
            setTtsExaggeration,
            ttsCfgWeight,
            setTtsCfgWeight,
            ttsRefAudioFile,
            setTtsRefAudioFile,

            // Kokoro
            kokoroVoice,
            setKokoroVoice,
            kokoroSpeed,
            setKokoroSpeed,

            // TTS Status
            ttsIsConnected: streamingAudio.isConnected,
            ttsIsLoading: streamingAudio.isLoading,
            ttsIsStreaming: streamingAudio.isStreaming,
            ttsIsPlaying: streamingAudio.isPlaying,
            ttsIsPaused: streamingAudio.isPaused,
            ttsProgressPercent: streamingAudio.progressPercent,
            ttsCurrentChunk: streamingAudio.currentChunk,
            ttsTotalChunks: streamingAudio.totalChunks,
            ttsError: streamingAudio.error,
            ttsUsage: streamingAudio.ttsUsage,
            ttsStreamingPlaybackPosition: streamingAudio.streamingPlaybackPosition,
            currentTtsMessageId: streamingAudio.currentMessageId,

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
            pauseStreamingAudio: streamingAudio.pauseAudio,
            resumeStreamingAudio: streamingAudio.resumeAudio,
            stopChunkPlayback: streamingAudio.stopChunkPlayback,
            requestTTS,
            setAudioForMessage,
            setAudioGeneratingForMessage,
            restoreAudioFromCache,
            connectChatterboxTTS: streamingAudio.connect,
            disconnectChatterboxTTS: streamingAudio.disconnect,
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
