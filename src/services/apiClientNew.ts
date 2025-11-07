"use client";

import type { AskQuestionResponse, UploadPdfResponse, TranscribeResponse, ListFilesResponse, DeleteChunksResponse } from '../types/chat';
import { appConfig } from '../lib/config';

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
    console.log('apiClientNew - listFiles called');
    
    const response = await fetch(`${appConfig.fastApiBaseUrl}/files/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('apiClientNew - List files response status:', response.status);
    console.log('apiClientNew - List files response ok:', response.ok);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during list files:", response.status, errorBody);
      throw new Error(`List files request failed with status ${response.status}: ${errorBody}`);
    }

    const result: ListFilesResponse = await response.json();
    console.log('apiClientNew - List files response data:', result);
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
    console.log('apiClientNew - deleteFileChunks called with uuid:', uuid);
    
    const response = await fetch(`${appConfig.fastApiBaseUrl}/files/${uuid}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('apiClientNew - Delete chunks response status:', response.status);
    console.log('apiClientNew - Delete chunks response ok:', response.ok);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during delete chunks:", response.status, errorBody);
      throw new Error(`Delete chunks request failed with status ${response.status}: ${errorBody}`);
    }

    const result: DeleteChunksResponse = await response.json();
    console.log('apiClientNew - Delete chunks response data:', result);
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
 * Asks a question to the backend and gets a response.
 * Now includes conversation history for context as a formatted string.
 */
export async function askQuestionAPI(
  query: string,
  conversationHistory?: string,
  detectedLang?: string,
  needsAudio: boolean = false,
  userId?: string
): Promise<AskQuestionResponse> {
  try {
    console.log('apiClientNew - askQuestionAPI called with query:', query);
    console.log('apiClientNew - askQuestionAPI called with conversationHistory:', conversationHistory);
    console.log('apiClientNew - askQuestionAPI called with detectedLang:', detectedLang);
    console.log('apiClientNew - askQuestionAPI called with needsAudio:', needsAudio);
    console.log('apiClientNew - askQuestionAPI called with userId:', userId);

    const url = new URL(`${appConfig.fastApiBaseUrl}/ask/`);
    url.searchParams.append('q', query);

    if (detectedLang) {
      url.searchParams.append('detected_lang', detectedLang);
    }

    // Add conversation history as a string parameter
    if (conversationHistory && conversationHistory.trim() !== '') {
      url.searchParams.append('conversation_history', conversationHistory);
    }

    // Add audio flag parameter
    if (needsAudio) {
      url.searchParams.append('needs_audio', 'true');
    }

    // Add user ID for usage tracking
    if (userId) {
      url.searchParams.append('user_id', userId);
    }

    console.log('apiClientNew - Request URL:', url.toString());
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('apiClientNew - Response status:', response.status);
    console.log('apiClientNew - Response ok:', response.ok);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error from FastAPI backend during ask:", response.status, errorBody);
      throw new Error(`Ask request failed with status ${response.status}: ${errorBody}`);
    }

    const result: AskQuestionResponse = await response.json();
    console.log('apiClientNew - Response data:', result);
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
 * Transcribes an audio file using the backend service.
 */
export async function transcribeAudioAPI(audioBlob: Blob): Promise<TranscribeResponse> {
    console.log('apiClientNew - transcribeAudioAPI called with blob size:', audioBlob.size);
    console.log('apiClientNew - transcribeAudioAPI blob type:', audioBlob.type);

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    try {
        console.log('apiClientNew - Making transcribe request to:', `${appConfig.fastApiBaseUrl}/transcribe/`);
        
        const response = await fetch(`${appConfig.fastApiBaseUrl}/transcribe/`, {
            method: 'POST',
            body: formData,
        });

        console.log('apiClientNew - Transcribe response status:', response.status);
        console.log('apiClientNew - Transcribe response ok:', response.ok);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Error from FastAPI backend during transcription:", response.status, errorBody);
            throw new Error(`Transcription failed with status ${response.status}: ${errorBody}`);
        }

        const result: TranscribeResponse = await response.json();
        console.log('apiClientNew - Transcribe response data:', result);
        return result;

    } catch (error) {
        console.error("Error calling transcribe endpoint:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack trace',
            name: error instanceof Error ? error.name : 'Unknown'
        });
        
        if (error instanceof Error && error.message.startsWith('Transcription failed')) {
            throw error;
        }
        throw new Error("Failed to connect to the transcription service. Please check the backend or try again.");
    }
}

/**
 * Parallel processing: transcribe audio and process query in one optimized call.
 * This combines transcription and query processing for faster voice interactions.
 */
export async function transcribeAndAskAPI(
    audioBlob: Blob,
    conversationHistory?: string,
    selectedLanguage?: string,
    needsAudio: boolean = true,
    userId?: string
): Promise<AskQuestionResponse> {
    console.log('apiClientNew - transcribeAndAskAPI called with blob size:', audioBlob.size);
    console.log('apiClientNew - transcribeAndAskAPI conversationHistory:', conversationHistory);
    console.log('apiClientNew - transcribeAndAskAPI selectedLanguage:', selectedLanguage);
    console.log('apiClientNew - transcribeAndAskAPI needsAudio:', needsAudio);
    console.log('apiClientNew - transcribeAndAskAPI userId:', userId);

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.trim() !== '') {
        formData.append('conversation_history', conversationHistory);
    }

    // Add selected language if provided
    if (selectedLanguage && selectedLanguage !== 'auto') {
        formData.append('selected_language', selectedLanguage);
    }

    // Add audio flag
    formData.append('needs_audio', needsAudio.toString());

    // Add user ID for usage tracking
    if (userId) {
        formData.append('user_id', userId);
    }

    try {
        console.log('apiClientNew - Making parallel transcribe-and-ask request to:', `${appConfig.fastApiBaseUrl}/transcribe-and-ask/`);
        
        const response = await fetch(`${appConfig.fastApiBaseUrl}/transcribe-and-ask/`, {
            method: 'POST',
            body: formData,
        });

        console.log('apiClientNew - Transcribe-and-ask response status:', response.status);
        console.log('apiClientNew - Transcribe-and-ask response ok:', response.ok);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Error from FastAPI backend during parallel transcribe-and-ask:", response.status, errorBody);
            throw new Error(`Parallel transcribe-and-ask failed with status ${response.status}: ${errorBody}`);
        }

        const result: AskQuestionResponse = await response.json();
        console.log('apiClientNew - Transcribe-and-ask response data:', result);
        return result;

    } catch (error) {
        console.error("Error calling transcribe-and-ask endpoint:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack trace',
            name: error instanceof Error ? error.name : 'Unknown'
        });
        
        if (error instanceof Error && error.message.startsWith('Parallel transcribe-and-ask failed')) {
            throw error;
        }
        throw new Error("Failed to connect to the voice processing service. Please check the backend or try again.");
    }
}

/**
 * Transcribe and ask with streaming TTS response.
 * This version returns the text response immediately and uses WebSocket for streaming audio.
 */
export async function transcribeAndAskStreamingAPI(
    audioBlob: Blob,
    conversationHistory?: string,
    selectedLanguage?: string,
    onStreamingAudio?: (text: string, language: string) => void,
    userId?: string
): Promise<AskQuestionResponse> {
    console.log('apiClientNew - transcribeAndAskStreamingAPI called with blob size:', audioBlob.size);
    console.log('apiClientNew - transcribeAndAskStreamingAPI conversationHistory:', conversationHistory);
    console.log('apiClientNew - transcribeAndAskStreamingAPI selectedLanguage:', selectedLanguage);
    console.log('apiClientNew - transcribeAndAskStreamingAPI userId:', userId);

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.trim() !== '') {
        formData.append('conversation_history', conversationHistory);
    }

    // Add selected language if provided
    if (selectedLanguage && selectedLanguage !== 'auto') {
        formData.append('selected_language', selectedLanguage);
    }

    // Request text response without audio (we'll stream audio separately)
    formData.append('needs_audio', 'false');

    // Add user ID for usage tracking
    if (userId) {
        formData.append('user_id', userId);
    }

    try {
        console.log('apiClientNew - Making streaming transcribe-and-ask request to:', `${appConfig.fastApiBaseUrl}/transcribe-and-ask/`);

        const response = await fetch(`${appConfig.fastApiBaseUrl}/transcribe-and-ask/`, {
            method: 'POST',
            body: formData,
        });

        console.log('apiClientNew - Streaming transcribe-and-ask response status:', response.status);
        console.log('apiClientNew - Streaming transcribe-and-ask response ok:', response.ok);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Error from FastAPI backend during streaming transcribe-and-ask:", response.status, errorBody);
            throw new Error(`Streaming transcribe-and-ask failed with status ${response.status}: ${errorBody}`);
        }

        const result: AskQuestionResponse = await response.json();
        console.log('apiClientNew - Streaming transcribe-and-ask response data:', result);

        // If we have a text response and a streaming callback, initiate streaming TTS
        if (result.answer && onStreamingAudio) {
            // Extract text content from HTML response
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = result.answer;
            const textContent = tempDiv.textContent || tempDiv.innerText || '';

            if (textContent.trim()) {
                // Trigger streaming audio for the response
                onStreamingAudio(textContent, result.detected_language || 'en');
            }
        }

        return result;

    } catch (error) {
        console.error("Error calling streaming transcribe-and-ask endpoint:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack trace',
            name: error instanceof Error ? error.name : 'Unknown'
        });

        if (error instanceof Error && error.message.startsWith('Streaming transcribe-and-ask failed')) {
            throw error;
        }
        throw new Error("Failed to connect to the streaming voice processing service. Please check the backend or try again.");
    }
}