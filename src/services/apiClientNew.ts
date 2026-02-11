"use client";

import type { AskQuestionResponse, UploadPdfResponse, TranscribeResponse, ListFilesResponse, DeleteChunksResponse } from '../types/chat';
import { appConfig } from '../lib/config';

// Define the Kokoro service URL (fallback to 8090 if not in config)
const KOKORO_API_URL = (appConfig as any).kokoroTtsUrl || "http://localhost:8090";

/**
 * Uploads a PDF file to the backend for indexing.
 */
export async function uploadPdfDocument(file: File): Promise<UploadPdfResponse> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${appConfig.fastApiBaseUrl}/upload-document/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during PDF upload:", response.status, errorBody);
      throw new Error(`PDF upload failed with status ${response.status}: ${errorBody}`);
    }

    const result: UploadPdfResponse = await response.json();
    return result;

  } catch (error) {
    console.error("Error calling upload-pdf endpoint:", error);
    if (error instanceof Error && error.message.startsWith('PDF upload failed')) {
      throw error;
    }
    throw new Error("Failed to connect to the document service. Please check the backend connection or try again.");
  }
}

/**
 * Lists all files in the backend database.
 */
export async function listFiles(): Promise<ListFilesResponse> {
  try {
    const response = await fetch(`${appConfig.fastApiBaseUrl}/files/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during list files:", response.status, errorBody);
      throw new Error(`List files request failed with status ${response.status}: ${errorBody}`);
    }

    const result: ListFilesResponse = await response.json();
    return result;

  } catch (error) {
    console.error("Error calling files endpoint:", error);
    if (error instanceof Error && error.message.startsWith('List files request failed')) {
      throw error;
    }
    throw new Error("Failed to connect to the document service. Please check the backend connection or try again.");
  }
}

/**
 * Deletes all chunks associated with a specific source file using UUID.
 */
export async function deleteFileChunks(uuid: string): Promise<DeleteChunksResponse> {
  try {
    const response = await fetch(`${appConfig.fastApiBaseUrl}/files/${uuid}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during delete chunks:", response.status, errorBody);
      throw new Error(`Delete chunks request failed with status ${response.status}: ${errorBody}`);
    }

    const result: DeleteChunksResponse = await response.json();
    return result;

  } catch (error) {
    console.error("Error calling delete-chunks endpoint:", error);
    if (error instanceof Error && error.message.startsWith('Delete chunks request failed')) {
      throw error;
    }
    throw new Error("Failed to connect to the document service. Please check the backend connection or try again.");
  }
}

/**
 * Asks a question to the backend.
 * Uses POST with JSON body to avoid URL length limitations.
 */
export async function askQuestionAPI(
  query: string,
  conversationHistory?: string,
  detectedLang?: string,
  needsAudio: boolean = false,
  userId?: string,
  systemPrompt?: string
): Promise<AskQuestionResponse> {
  try {
    const response = await fetch(`${appConfig.fastApiBaseUrl}/ask/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        conversation_history: conversationHistory || '',
        detected_lang: detectedLang || null,
        needs_audio: needsAudio,
        user_id: userId || null,
        system_prompt: systemPrompt || null,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during ask:", response.status, errorBody);
      throw new Error(`Ask request failed with status ${response.status}: ${errorBody}`);
    }

    const result: AskQuestionResponse = await response.json();
    return result;

  } catch (error) {
    console.error("Error calling ask endpoint:", error);
    if (error instanceof Error && error.message.startsWith('Ask request failed')) {
      throw error;
    }
    throw new Error("Failed to connect to the AI service. Please check the backend connection or try again.");
  }
}

/**
 * Generates a system prompt based on a role.
 */
export async function generateSystemPromptAPI(role: string): Promise<{ role: string; system_prompt: string; success: boolean }> {
  try {
    const url = new URL(`${appConfig.fastApiBaseUrl}/generate-system-prompt/`);
    url.searchParams.append('role', role);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during prompt generation:", response.status, errorBody);
      throw new Error(`Prompt generation failed with status ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error("Error calling generate-system-prompt endpoint:", error);
    if (error instanceof Error && error.message.startsWith('Prompt generation failed')) {
      throw error;
    }
    throw new Error("Failed to generate system prompt. Please check the backend connection or try again.");
  }
}

/**
 * Transcribes an audio file.
 */
export async function transcribeAudioAPI(audioBlob: Blob): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');

  try {
    const response = await fetch(`${appConfig.fastApiBaseUrl}/transcribe/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during transcription:", response.status, errorBody);
      throw new Error(`Transcription failed with status ${response.status}: ${errorBody}`);
    }

    const result: TranscribeResponse = await response.json();
    return result;

  } catch (error) {
    console.error("Error calling transcribe endpoint:", error);
    if (error instanceof Error && error.message.startsWith('Transcription failed')) {
      throw error;
    }
    throw new Error("Failed to connect to the transcription service. Please check the backend or try again.");
  }
}

/**
 * Parallel processing: transcribe audio and process query.
 */
export async function transcribeAndAskAPI(
  audioBlob: Blob,
  conversationHistory?: string,
  selectedLanguage?: string,
  needsAudio: boolean = true,
  userId?: string
): Promise<AskQuestionResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');

  if (conversationHistory && conversationHistory.trim() !== '') {
    formData.append('conversation_history', conversationHistory);
  }
  if (selectedLanguage && selectedLanguage !== 'auto') {
    formData.append('selected_language', selectedLanguage);
  }
  formData.append('needs_audio', needsAudio.toString());
  if (userId) {
    formData.append('user_id', userId);
  }

  try {
    const response = await fetch(`${appConfig.fastApiBaseUrl}/transcribe-and-ask/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during parallel transcribe-and-ask:", response.status, errorBody);
      throw new Error(`Parallel transcribe-and-ask failed with status ${response.status}: ${errorBody}`);
    }

    const result: AskQuestionResponse = await response.json();
    return result;

  } catch (error) {
    console.error("Error calling transcribe-and-ask endpoint:", error);
    if (error instanceof Error && error.message.startsWith('Parallel transcribe-and-ask failed')) {
      throw error;
    }
    throw new Error("Failed to connect to the voice processing service. Please check the backend or try again.");
  }
}

/**
 * Transcribe and ask with streaming TTS response.
 */
export async function transcribeAndAskStreamingAPI(
  audioBlob: Blob,
  conversationHistory?: string,
  selectedLanguage?: string,
  onStreamingAudio?: (text: string, language: string) => void,
  userId?: string
): Promise<AskQuestionResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');

  if (conversationHistory && conversationHistory.trim() !== '') {
    formData.append('conversation_history', conversationHistory);
  }
  if (selectedLanguage && selectedLanguage !== 'auto') {
    formData.append('selected_language', selectedLanguage);
  }
  formData.append('needs_audio', 'false'); // Always false for streaming logic
  if (userId) {
    formData.append('user_id', userId);
  }

  try {
    const response = await fetch(`${appConfig.fastApiBaseUrl}/transcribe-and-ask/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during streaming transcribe-and-ask:", response.status, errorBody);
      throw new Error(`Streaming transcribe-and-ask failed with status ${response.status}: ${errorBody}`);
    }

    const result: AskQuestionResponse = await response.json();

    // If text response exists, trigger callback to start streaming (Chatterbox logic)
    if (result.answer && onStreamingAudio) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = result.answer;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';

      if (textContent.trim()) {
        onStreamingAudio(textContent, result.detected_language || 'en');
      }
    }

    return result;

  } catch (error) {
    console.error("Error calling streaming transcribe-and-ask endpoint:", error);
    if (error instanceof Error && error.message.startsWith('Streaming transcribe-and-ask failed')) {
      throw error;
    }
    throw new Error("Failed to connect to the streaming voice processing service. Please check the backend or try again.");
  }
}

/**
 * Generates audio using the Kokoro TTS service.
 * Returns a Blob containing the WAV audio.
 */
export async function generateKokoroAudio(
  text: string,
  voice: string,
  speed: number,
  language: string
): Promise<Blob> {
  const formData = new FormData();
  formData.append("text", text);
  formData.append("voice", voice);
  formData.append("speed", speed.toString());
  formData.append("language", language);

  try {
    console.log(`🔊 Calling Kokoro API at ${KOKORO_API_URL}/generate`);
    const response = await fetch(`${KOKORO_API_URL}/generate`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Kokoro generation failed with status ${response.status}`);
    }

    return await response.blob();
  } catch (e) {
    console.error("❌ Kokoro API Error:", e);
    throw e;
  }
}