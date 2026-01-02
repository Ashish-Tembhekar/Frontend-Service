/**
 * Audio Storage Service - Azure Blob Storage Implementation
 * 
 * Provides persistent storage for large audio blobs via Azure Blob Storage.
 * Audio is stored per messageId and provider, and can be restored across sessions.
 * 
 * This replaces the previous IndexedDB implementation with server-side storage.
 */

import {
  uploadAudio as uploadAudioToServer,
  getAudioUrl as getAudioUrlFromServer,
  deleteAudio as deleteAudioFromServer
} from './chatStorageAPI';

// In-memory cache for audio blob URLs (to avoid repeated server calls)
const audioCache = new Map<string, string>();

/**
 * Generates a cache key for audio storage
 */
function getCacheKey(messageId: string, provider: 'chatterbox' | 'kokoro'): string {
  return `${messageId}_${provider}`;
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

/**
 * Legacy function for backward compatibility
 * The IndexedDB implementation is replaced with Azure Blob Storage
 */
export function openDatabase(): Promise<IDBDatabase> {
  console.warn('🎵 openDatabase is deprecated - audio is now stored in Azure Blob Storage');
  return Promise.reject(new Error('IndexedDB audio storage is deprecated'));
}
