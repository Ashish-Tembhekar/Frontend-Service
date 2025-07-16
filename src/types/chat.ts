// src/types/chat.ts

export interface AudioData {
  audio_base64: string;
  mime_type: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string; // Can be plain text, Markdown (for user), or HTML (for assistant)
  contentType?: 'text' | 'html'; // Explicitly define content type
  timestamp: string; // ISO string
  isLoading?: boolean; // For assistant messages being generated
  audioData?: AudioData | null; // For assistant voice responses
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string; // ISO string
  lastUpdatedAt: string; // ISO string
}

// --- Backend Specific Types ---

/**
 * Represents the successful response from the POST /upload-pdf/ endpoint.
 */
export interface UploadPdfResponse {
  status: string;
  chunks: number;
  document_types: Record<string, number>;
}

/**
 * Represents a single source document returned by the /ask/ endpoint.
 */
export interface Source {
  page: number | null;
  section: string | null;
  type: string;
  content_preview: string;
  image_id?: string;
  table_id?: string;
}

/**
 * Represents the response from the GET /ask/ endpoint.
 */
export interface AskQuestionResponse {
  question: string;
  answer: string; // This is an HTML string
  sources: Source[];
  audio: AudioData | null;
}

/**
 * Represents the response from the POST /transcribe/ endpoint.
 */
export interface TranscribeResponse {
    original_text: string;
    detected_language: string;
    translated_text: string;
}
