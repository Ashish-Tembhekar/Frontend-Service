/**
 * Audio Storage Service using IndexedDB
 * 
 * Provides persistent storage for large audio blobs that exceed LocalStorage limits.
 * Audio is stored per messageId and can be restored across page reloads.
 */

const DB_NAME = 'chatbot-audio-db';
const DB_VERSION = 1;
const STORE_NAME = 'audio-blobs';

interface StoredAudio {
  messageId: string;
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
      
      // Create the audio store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'messageId' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Saves an audio blob to IndexedDB
 */
export async function saveAudio(messageId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const audioData: StoredAudio = {
        messageId,
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
        console.log(`Audio saved for message: ${messageId}`);
        resolve();
      };
    });
  } catch (error) {
    console.error('Error saving audio to IndexedDB:', error);
    throw error;
  }
}

/**
 * Retrieves an audio blob from IndexedDB
 * Returns null if not found
 */
export async function getAudio(messageId: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(messageId);
      
      request.onerror = () => {
        console.error('Failed to get audio:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        const result = request.result as StoredAudio | undefined;
        if (result) {
          resolve(result.audioBlob);
        } else {
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
 * Deletes an audio blob from IndexedDB
 */
export async function deleteAudio(messageId: string): Promise<void> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(messageId);
      
      request.onerror = () => {
        console.error('Failed to delete audio:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log(`Audio deleted for message: ${messageId}`);
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

