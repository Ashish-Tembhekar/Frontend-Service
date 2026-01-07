/**
 * Audio Storage Service - Azure Blob Storage Implementation
 * 
 * Provides persistent storage for large audio blobs via Azure Blob Storage.
 * Audio is stored per messageId and provider, and can be restored across sessions.
 */

import { appConfig } from '../lib/config';

const API_BASE = appConfig.fastApiBaseUrl;

// In-memory cache for audio blob URLs (to avoid repeated server calls)
const audioCache = new Map<string, string>();

/**
 * Generates a cache key for audio storage
 */
function getCacheKey(messageId: string, provider: 'chatterbox' | 'kokoro'): string {
  return `${messageId}_${provider}`;
}

/**
 * Uploads audio to Azure Blob Storage via backend API.
 */
async function uploadAudioToServer(
  userId: string,
  messageId: string,
  provider: 'chatterbox' | 'kokoro',
  audioBlob: Blob
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, `${messageId}_${provider}.wav`);

  const response = await fetch(
    `${API_BASE}/api/v1/audio/upload?user_id=${encodeURIComponent(userId)}&message_id=${encodeURIComponent(messageId)}&provider=${provider}`,
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
}

/**
 * Gets audio SAS URL from Azure Blob Storage via backend API.
 */
async function getAudioUrlFromServer(
  userId: string,
  messageId: string,
  provider: 'chatterbox' | 'kokoro'
): Promise<string | null> {
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/audio/${messageId}?user_id=${encodeURIComponent(userId)}&provider=${provider}`,
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
 * Deletes audio from Azure Blob Storage via backend API.
 */
async function deleteAudioFromServer(
  userId: string,
  messageId: string,
  provider?: 'chatterbox' | 'kokoro'
): Promise<void> {
  let url = `${API_BASE}/api/v1/audio/${messageId}?user_id=${encodeURIComponent(userId)}`;
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
}

/**
 * Saves an audio blob to Azure Blob Storage (via backend API)
 * Falls back to in-memory cache for immediate playback
 * 
 * @param messageId - The message ID the audio is associated with
 * @param blob - The audio blob to store
 * @param provider - The TTS provider ('chatterbox' or 'kokoro')
 * @param userId - Optional Firebase UID for server-side storage
 */
export async function saveAudio(
  messageId: string,
  blob: Blob,
  provider: 'chatterbox' | 'kokoro',
  userId?: string
): Promise<void> {
  try {
    // Create a local blob URL for immediate use
    const localUrl = URL.createObjectURL(blob);
    const cacheKey = getCacheKey(messageId, provider);
    audioCache.set(cacheKey, localUrl);

    console.log(`🎵 Audio cached locally for message: ${messageId} (provider: ${provider})`);

    // If we have a userId, also upload to server for persistence
    if (userId) {
      try {
        await uploadAudioToServer(userId, messageId, provider, blob);
        console.log(`🎵 Audio saved to Azure Blob Storage for message: ${messageId} (provider: ${provider})`);
      } catch (uploadError) {
        console.warn(`🎵 Failed to upload audio to server (will use local cache): ${uploadError}`);
        // Continue without throwing - local cache still works
      }
    }
  } catch (error) {
    console.error('Error saving audio:', error);
    throw error;
  }
}

/**
 * Retrieves an audio blob from Azure Blob Storage or local cache
 * Returns null if not found
 * 
 * @param messageId - The message ID
 * @param provider - The TTS provider ('chatterbox' or 'kokoro')
 * @param userId - Optional Firebase UID for server-side storage
 */
export async function getAudio(
  messageId: string,
  provider: 'chatterbox' | 'kokoro',
  userId?: string
): Promise<Blob | null> {
  try {
    const cacheKey = getCacheKey(messageId, provider);

    // Check local cache first
    const cachedUrl = audioCache.get(cacheKey);
    if (cachedUrl) {
      try {
        const response = await fetch(cachedUrl);
        if (response.ok) {
          console.log(`🎵 Retrieved audio from local cache for message: ${messageId} (provider: ${provider})`);
          return response.blob();
        }
      } catch {
        // Cache entry invalid, remove it
        audioCache.delete(cacheKey);
      }
    }

    // Try to fetch from server if userId is available
    if (userId) {
      try {
        const sasUrl = await getAudioUrlFromServer(userId, messageId, provider);
        if (sasUrl) {
          const response = await fetch(sasUrl);
          if (response.ok) {
            const blob = await response.blob();

            // Cache the result locally for subsequent accesses
            const localUrl = URL.createObjectURL(blob);
            audioCache.set(cacheKey, localUrl);

            console.log(`🎵 Retrieved audio from Azure Blob Storage for message: ${messageId} (provider: ${provider})`);
            return blob;
          }
        }
      } catch (fetchError) {
        console.warn(`🎵 Failed to fetch audio from server: ${fetchError}`);
      }
    }

    console.log(`🎵 No audio found for message: ${messageId} (provider: ${provider})`);
    return null;
  } catch (error) {
    console.error('Error getting audio:', error);
    return null;
  }
}

/**
 * Deletes an audio blob from Azure Blob Storage
 * 
 * @param messageId - The message ID
 * @param provider - The TTS provider ('chatterbox' or 'kokoro')
 * @param userId - Optional Firebase UID for server-side storage
 */
export async function deleteAudio(
  messageId: string,
  provider: 'chatterbox' | 'kokoro',
  userId?: string
): Promise<void> {
  try {
    const cacheKey = getCacheKey(messageId, provider);

    // Remove from local cache
    const cachedUrl = audioCache.get(cacheKey);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      audioCache.delete(cacheKey);
    }

    // Delete from server if userId is available
    if (userId) {
      try {
        await deleteAudioFromServer(userId, messageId, provider);
        console.log(`🎵 Audio deleted from Azure Blob Storage for message: ${messageId} (provider: ${provider})`);
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
