/**
 * Audio Storage Service using IndexedDB
 * 
 * Provides persistent storage for large audio blobs that exceed LocalStorage limits.
 * Audio is stored per messageId and can be restored across page reloads.
 */

const DB_NAME = 'chatbot-audio-db';
const DB_VERSION = 2; // Incremented to trigger schema update
const STORE_NAME = 'audio-blobs';

interface StoredAudio {
  storageKey: string; // Composite key: messageId_provider
  messageId: string;
  provider: 'chatterbox' | 'kokoro'; // Track which TTS provider generated this audio
  audioBlob: Blob;
  mimeType: string;
  createdAt: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Opens or creates the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open audio database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Delete old store if it exists (clean slate for new schema)
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }

      // Create the audio store with composite key
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'storageKey' });
      store.createIndex('createdAt', 'createdAt', { unique: false });
      store.createIndex('messageId', 'messageId', { unique: false });
      store.createIndex('provider', 'provider', { unique: false });
    };
  });
}

/**
 * Saves an audio blob to IndexedDB with provider tracking
 * Uses composite key: messageId_provider to prevent overwrites when switching TTS services
 */
export async function saveAudio(
  messageId: string,
  blob: Blob,
  provider: 'chatterbox' | 'kokoro'
): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Create composite key to store separate audio for each provider
      const storageKey = `${messageId}_${provider}`;

      const audioData: StoredAudio = {
        storageKey,
        messageId,
        provider,
        audioBlob: blob,
        mimeType: blob.type || 'audio/wav',
        createdAt: Date.now(),
      };

      const request = store.put(audioData);

      request.onerror = () => {
        console.error('Failed to save audio:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log(`🎵 Audio saved for message: ${messageId} (provider: ${provider})`);
        resolve();
      };
    });
  } catch (error) {
    console.error('Error saving audio to IndexedDB:', error);
    throw error;
  }
}

/**
 * Retrieves an audio blob from IndexedDB for a specific provider
 * Returns null if not found
 */
export async function getAudio(
  messageId: string,
  provider: 'chatterbox' | 'kokoro'
): Promise<Blob | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      // Use composite key to get provider-specific audio
      const storageKey = `${messageId}_${provider}`;
      const request = store.get(storageKey);

      request.onerror = () => {
        console.error('Failed to get audio:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result as StoredAudio | undefined;
        if (result) {
          console.log(`🎵 Retrieved audio for message: ${messageId} (provider: ${provider})`);
          resolve(result.audioBlob);
        } else {
          console.log(`🎵 No audio found for message: ${messageId} (provider: ${provider})`);
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('Error getting audio from IndexedDB:', error);
    return null;
  }
}

/**
 * Deletes an audio blob from IndexedDB for a specific provider
 */
export async function deleteAudio(
  messageId: string,
  provider: 'chatterbox' | 'kokoro'
): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Use composite key to delete provider-specific audio
      const storageKey = `${messageId}_${provider}`;
      const request = store.delete(storageKey);

      request.onerror = () => {
        console.error('Failed to delete audio:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log(`🎵 Audio deleted for message: ${messageId} (provider: ${provider})`);
        resolve();
      };
    });
  } catch (error) {
    console.error('Error deleting audio from IndexedDB:', error);
    throw error;
  }
}

/**
 * Clears all audio from IndexedDB (useful for cleanup)
 */
export async function clearAllAudio(): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error clearing audio from IndexedDB:', error);
    throw error;
  }
}

