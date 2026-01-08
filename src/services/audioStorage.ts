/**
 * Audio Storage Service - Simple File-Based Backend Storage
 * 
 * Provides persistent storage for audio files via backend file system.
 * Audio is stored per user, session, and message.
 */

import { appConfig } from '../lib/config';

const API_BASE = appConfig.fastApiBaseUrl;

// In-memory cache for audio blob URLs (to avoid repeated server calls)
const audioCache = new Map<string, string>();

/**
 * Uploads audio to backend file storage.
 */
async function uploadAudioToServer(
  userId: string,
  sessionId: string,
  messageId: string,
  audioBlob: Blob
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, `${messageId}.wav`);

  const response = await fetch(
    `${API_BASE}/api/v1/audio/upload?user_id=${encodeURIComponent(userId)}&session_id=${encodeURIComponent(sessionId)}&message_id=${encodeURIComponent(messageId)}`,
    {
      method: 'POST',
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload audio: ${response.statusText}`);
  }

  const result = await response.json();
  return result.file_path;
}

/**
 * Gets audio file from backend file storage.
 */
async function getAudioFromServer(
  userId: string,
  sessionId: string,
  messageId: string
): Promise<Blob | null> {
  try {
    const url = `${API_BASE}/api/v1/audio/${messageId}?user_id=${encodeURIComponent(userId)}&session_id=${encodeURIComponent(sessionId)}`;
    console.log(`🎵 Fetching audio from backend: ${url}`);

    const response = await fetch(url, {
      method: 'GET'
    });

    if (response.status === 404) {
      console.log(`🎵 Audio not found on backend (404): ${messageId}`);
      return null;
    }

    if (!response.ok) {
      console.error(`🎵 Failed to get audio from backend: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to get audio: ${response.statusText}`);
    }

    console.log(`🎵 Successfully fetched audio from backend: ${messageId}`);
    return await response.blob();
  } catch (error) {
    console.error('Failed to get audio from server:', error);
    return null;
  }
}

/**
 * Deletes audio from backend file storage.
 */
async function deleteAudioFromServer(
  userId: string,
  sessionId: string,
  messageId: string
): Promise<void> {
  const url = `${API_BASE}/api/v1/audio/${messageId}?user_id=${encodeURIComponent(userId)}&session_id=${encodeURIComponent(sessionId)}`;

  const response = await fetch(url, {
    method: 'DELETE'
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete audio: ${response.statusText}`);
  }
}

/**
 * Saves an audio blob to backend file storage
 * Falls back to in-memory cache for immediate playback
 * 
 * @param messageId - The message ID the audio is associated with
 * @param blob - The audio blob to store
 * @param userId - User's unique identifier (required)
 * @param sessionId - Chat session/thread identifier (required)
 */
export async function saveAudio(
  messageId: string,
  blob: Blob,
  userId?: string,
  sessionId?: string
): Promise<void> {
  try {
    // Create a local blob URL for immediate use
    const localUrl = URL.createObjectURL(blob);
    audioCache.set(messageId, localUrl);

    console.log(`🎵 Audio cached locally for message: ${messageId}`);

    // If we have userId and sessionId, upload to server for persistence
    if (userId && sessionId) {
      try {
        await uploadAudioToServer(userId, sessionId, messageId, blob);
        console.log(`🎵 Audio saved to backend storage for message: ${messageId}`);
      } catch (uploadError) {
        console.warn(`🎵 Failed to upload audio to server (will use local cache): ${uploadError}`);
        // Continue without throwing - local cache still works
      }
    } else {
      console.warn(`🎵 Missing userId or sessionId, audio will only be cached locally`);
    }
  } catch (error) {
    console.error('Error saving audio:', error);
    throw error;
  }
}

/**
 * Retrieves an audio blob from backend storage or local cache
 * Returns null if not found
 * 
 * @param messageId - The message ID
 * @param userId - User's unique identifier (required for server retrieval)
 * @param sessionId - Chat session/thread identifier (required for server retrieval)
 */
export async function getAudio(
  messageId: string,
  userId?: string,
  sessionId?: string
): Promise<Blob | null> {
  try {
    // Check local cache first
    const cachedUrl = audioCache.get(messageId);
    if (cachedUrl) {
      try {
        const response = await fetch(cachedUrl);
        if (response.ok) {
          console.log(`🎵 Retrieved audio from local cache for message: ${messageId}`);
          return response.blob();
        }
      } catch {
        // Cache entry invalid, remove it
        audioCache.delete(messageId);
      }
    }

    // Try to fetch from server if userId and sessionId are available
    if (userId && sessionId) {
      try {
        const blob = await getAudioFromServer(userId, sessionId, messageId);
        if (blob) {
          // Cache the result locally for subsequent accesses
          const localUrl = URL.createObjectURL(blob);
          audioCache.set(messageId, localUrl);

          console.log(`🎵 Retrieved audio from backend storage for message: ${messageId}`);
          return blob;
        }
      } catch (fetchError) {
        console.warn(`🎵 Failed to fetch audio from server: ${fetchError}`);
      }
    }

    console.log(`🎵 No audio found for message: ${messageId}`);
    return null;
  } catch (error) {
    console.error('Error getting audio:', error);
    return null;
  }
}

/**
 * Deletes an audio blob from backend storage
 * 
 * @param messageId - The message ID
 * @param userId - User's unique identifier (required for server deletion)
 * @param sessionId - Chat session/thread identifier (required for server deletion)
 */
export async function deleteAudio(
  messageId: string,
  userId?: string,
  sessionId?: string
): Promise<void> {
  try {
    // Remove from local cache
    const cachedUrl = audioCache.get(messageId);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      audioCache.delete(messageId);
    }

    // Delete from server if userId and sessionId are available
    if (userId && sessionId) {
      try {
        await deleteAudioFromServer(userId, sessionId, messageId);
        console.log(`🎵 Audio deleted from backend storage for message: ${messageId}`);
      } catch (deleteError) {
        console.warn(`🎵 Failed to delete audio from server: ${deleteError}`);
      }
    }
  } catch (error) {
    console.error('Error deleting audio:', error);
    throw error;
  }
}

/**
 * Clears all cached audio URLs (useful for cleanup)
 * Note: This only clears the local cache, not the server storage
 */
export async function clearAllAudio(): Promise<void> {
  try {
    // Revoke all cached blob URLs
    audioCache.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    audioCache.clear();
    console.log('🎵 All local audio cache cleared');
  } catch (error) {
    console.error('Error clearing audio cache:', error);
    throw error;
  }
}
