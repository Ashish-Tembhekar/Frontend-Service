/**
 * Chat Storage API Client
 * 
 * Provides functions to interact with the backend chat storage API.
 * Stores chat threads in PostgreSQL and audio files in Azure Blob Storage.
 */

import type { ChatThread, Message } from '../types/chat';
import { appConfig } from '../lib/config';

const API_BASE = appConfig.fastApiBaseUrl;

/**
 * Converts a frontend Message to the backend MessageCreate format.
 */
function messageToApiFormat(msg: Message): object {
    return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        content_type: msg.contentType || 'text',
        timestamp: msg.timestamp,
        audio_url: msg.audioUrl,
        image_urls: msg.imageUrls,
        llm_sources: msg.llmSources
    };
}

/**
 * Converts a backend thread response to the frontend ChatThread format.
 */
function apiToThreadFormat(apiThread: any): ChatThread {
    return {
        id: apiThread.id,
        title: apiThread.title,
        createdAt: apiThread.createdAt,
        lastUpdatedAt: apiThread.lastUpdatedAt,
        messages: (apiThread.messages || []).map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            contentType: msg.contentType,
            timestamp: msg.timestamp,
            audioUrl: msg.audioUrl,
            imageUrls: msg.imageUrls,
            llmSources: msg.llmSources,
            processingStatus: msg.processingStatus
        }))
    };
}

// ---------- Chat Thread API ----------

/**
 * Get all chat threads for a user.
 */
export async function getChatThreads(userId: string): Promise<ChatThread[]> {
    try {
        const response = await fetch(
            `${API_BASE}/api/v1/chat/threads?user_id=${encodeURIComponent(userId)}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get threads: ${response.statusText}`);
        }

        const threads = await response.json();
        return threads.map(apiToThreadFormat);
    } catch (error) {
        console.error('Failed to get chat threads:', error);
        throw error;
    }
}

/**
 * Create a new chat thread.
 */
export async function createChatThread(
    userId: string,
    thread: Partial<ChatThread>
): Promise<ChatThread> {
    try {
        const response = await fetch(
            `${API_BASE}/api/v1/chat/threads?user_id=${encodeURIComponent(userId)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: thread.id || `thread_${Date.now()}`,
                    title: thread.title || 'New Chat'
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to create thread: ${response.statusText}`);
        }

        const apiThread = await response.json();
        return apiToThreadFormat(apiThread);
    } catch (error) {
        console.error('Failed to create chat thread:', error);
        throw error;
    }
}

/**
 * Get a specific chat thread with all messages.
 */
export async function getChatThread(
    userId: string,
    threadId: string
): Promise<ChatThread> {
    try {
        const response = await fetch(
            `${API_BASE}/api/v1/chat/threads/${threadId}?user_id=${encodeURIComponent(userId)}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get thread: ${response.statusText}`);
        }

        const apiThread = await response.json();
        return apiToThreadFormat(apiThread);
    } catch (error) {
        console.error('Failed to get chat thread:', error);
        throw error;
    }
}

/**
 * Update a chat thread (title and/or messages).
 */
export async function updateChatThread(
    userId: string,
    threadId: string,
    updates: {
        title?: string;
        messages?: Message[];
    }
): Promise<ChatThread> {
    try {
        const body: any = {};
        if (updates.title) {
            body.title = updates.title;
        }
        if (updates.messages) {
            body.messages = updates.messages.map(messageToApiFormat);
        }

        const response = await fetch(
            `${API_BASE}/api/v1/chat/threads/${threadId}?user_id=${encodeURIComponent(userId)}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to update thread: ${response.statusText}`);
        }

        const apiThread = await response.json();
        return apiToThreadFormat(apiThread);
    } catch (error) {
        console.error('Failed to update chat thread:', error);
        throw error;
    }
}

/**
 * Delete a chat thread.
 */
export async function deleteChatThread(
    userId: string,
    threadId: string
): Promise<void> {
    try {
        const response = await fetch(
            `${API_BASE}/api/v1/chat/threads/${threadId}?user_id=${encodeURIComponent(userId)}`,
            {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to delete thread: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Failed to delete chat thread:', error);
        throw error;
    }
}

/**
 * Clear all chat threads for a user.
 */
export async function clearAllChatThreads(userId: string): Promise<void> {
    try {
        const response = await fetch(
            `${API_BASE}/api/v1/chat/threads?user_id=${encodeURIComponent(userId)}`,
            {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to clear threads: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Failed to clear chat threads:', error);
        throw error;
    }
}

// ---------- Audio Storage API ----------

/**
 * Upload audio to Azure Blob Storage.
 */
export async function uploadAudio(
    userId: string,
    messageId: string,
    provider: 'chatterbox' | 'kokoro',
    audioBlob: Blob
): Promise<string> {
    try {
        const formData = new FormData();
        formData.append('file', audioBlob, `${messageId}_${provider}.wav`);

        const response = await fetch(
            `${API_BASE}/api/v1/chat/audio/upload?user_id=${encodeURIComponent(userId)}&message_id=${encodeURIComponent(messageId)}&provider=${provider}`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to upload audio: ${response.statusText}`);
        }

        const result = await response.json();
        return result.blob_url;
    } catch (error) {
        console.error('Failed to upload audio:', error);
        throw error;
    }
}

/**
 * Get audio SAS URL from Azure Blob Storage.
 */
export async function getAudioUrl(
    userId: string,
    messageId: string,
    provider: 'chatterbox' | 'kokoro'
): Promise<string | null> {
    try {
        const response = await fetch(
            `${API_BASE}/api/v1/chat/audio/${messageId}?user_id=${encodeURIComponent(userId)}&provider=${provider}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`Failed to get audio URL: ${response.statusText}`);
        }

        const result = await response.json();
        return result.url;
    } catch (error) {
        console.error('Failed to get audio URL:', error);
        return null;
    }
}

/**
 * Delete audio from Azure Blob Storage.
 */
export async function deleteAudio(
    userId: string,
    messageId: string,
    provider?: 'chatterbox' | 'kokoro'
): Promise<void> {
    try {
        let url = `${API_BASE}/api/v1/chat/audio/${messageId}?user_id=${encodeURIComponent(userId)}`;
        if (provider) {
            url += `&provider=${provider}`;
        }

        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Failed to delete audio: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Failed to delete audio:', error);
        throw error;
    }
}

// ---------- Utility Functions ----------

/**
 * Check if the chat storage API is available.
 * Falls back to localStorage if API is not available.
 */
export async function isChatStorageApiAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/api/v1/chat/threads?user_id=test`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        // If we get a response (even an error), the API is available
        return response.status !== 0;
    } catch {
        return false;
    }
}
