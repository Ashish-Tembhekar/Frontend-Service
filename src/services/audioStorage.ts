/**
 * Audio Storage Service — Azure Blob Storage
 *
 * Uploads TTS audio to Azure Blob Storage via the backend.
 * Retrieves time-limited SAS URLs for on-demand playback.
 */

import { appConfig } from '../lib/config';

const API_BASE = appConfig.fastApiBaseUrl;

// In-memory SAS URL cache for the current browser session
// Avoids re-fetching SAS URLs for messages already played in this session
const sasUrlCache = new Map<string, string>();

function getSasCacheKey(messageId: string, userId: string, sessionId: string): string {
  return `${userId}:${sessionId}:${messageId}`;
}

/**
 * Upload a WAV blob to Azure Blob Storage via the backend.
 *
 * @returns The Azure blob name (path) on success, or null on failure.
 */
export async function saveAudio(
  messageId: string,
  blob: Blob,
  userId?: string,
  sessionId?: string,
): Promise<string | null> {
  if (!userId || !sessionId) {
    console.warn('☁️  Missing userId or sessionId — cannot upload to Azure');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('file', blob, `${messageId}.wav`);

    const url =
      `${API_BASE}/api/v1/audio/upload` +
      `?user_id=${encodeURIComponent(userId)}` +
      `&session_id=${encodeURIComponent(sessionId)}` +
      `&message_id=${encodeURIComponent(messageId)}`;

    const response = await fetch(url, { method: 'POST', body: formData });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`☁️  Audio uploaded to Azure: ${result.blob_name}`);
    return result.blob_name as string;
  } catch (error) {
    console.error('☁️  Failed to upload audio to Azure:', error);
    return null;
  }
}

/**
 * Get a time-limited SAS URL for an audio blob.
 *
 * The SAS URL can be used directly as an <audio> src — no need to
 * download the blob and create a local Blob URL.
 *
 * @returns SAS URL string, or null if not found.
 */
export async function getAudioSasUrl(
  messageId: string,
  userId?: string,
  sessionId?: string,
): Promise<string | null> {
  if (!userId || !sessionId) {
    console.warn('☁️  Missing userId or sessionId — cannot fetch SAS URL');
    return null;
  }

  // Check session cache first
  const cacheKey = getSasCacheKey(messageId, userId, sessionId);
  const cached = sasUrlCache.get(cacheKey);
  if (cached) {
    console.log(`☁️  Using cached SAS URL for message: ${messageId}`);
    return cached;
  }

  try {
    const url =
      `${API_BASE}/api/v1/audio/${encodeURIComponent(messageId)}` +
      `?user_id=${encodeURIComponent(userId)}` +
      `&session_id=${encodeURIComponent(sessionId)}`;

    const response = await fetch(url, { method: 'GET' });

    if (response.status === 404) {
      console.log(`☁️  Audio not found in Azure (404): ${messageId}`);
      return null;
    }

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const sasUrl = result.sas_url as string;

    // Cache for the current browser session
    sasUrlCache.set(cacheKey, sasUrl);
    console.log(`☁️  SAS URL fetched for message: ${messageId}`);
    return sasUrl;
  } catch (error) {
    console.error('☁️  Failed to get SAS URL:', error);
    return null;
  }
}

/**
 * Delete an audio blob from Azure via the backend.
 */
export async function deleteAudio(
  messageId: string,
  userId?: string,
  sessionId?: string,
): Promise<void> {
  if (!userId || !sessionId) return;

  // Clear from session cache
  sasUrlCache.delete(getSasCacheKey(messageId, userId, sessionId));

  try {
    const url =
      `${API_BASE}/api/v1/audio/${encodeURIComponent(messageId)}` +
      `?user_id=${encodeURIComponent(userId)}` +
      `&session_id=${encodeURIComponent(sessionId)}`;

    const response = await fetch(url, { method: 'DELETE' });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
    }

    console.log(`☁️  Audio deleted from Azure: ${messageId}`);
  } catch (error) {
    console.error('☁️  Failed to delete audio from Azure:', error);
  }
}

/**
 * Clear the in-memory SAS URL cache (e.g. on sign-out).
 */
export function clearAllAudio(): void {
  sasUrlCache.clear();
  console.log('☁️  SAS URL cache cleared');
}
