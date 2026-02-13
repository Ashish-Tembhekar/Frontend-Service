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
  detected_language?: string; // Language code used for this assistant response (e.g. en, hi, de)
  timestamp: string; // ISO string
  isLoading?: boolean; // For assistant messages being generated
  processingStatus?: string; // For showing granular LLM processing status
  audioData?: AudioData | null; // For assistant voice responses (legacy)
  audioUrl?: string; // Playable URL (blob: for freshly generated, SAS URL for restored from Azure)
  audioBlobName?: string; // Azure Blob path for persistent audio storage (e.g. user/session/msg.wav)
  isAudioLoading?: boolean; // True only while lazy-loading audio URL from Azure after user clicks play
  audioRestoreFailed?: boolean; // True when Azure SAS URL restoration failed for this message
  isAudioGenerating?: boolean; // To show loading/streaming state in the AudioPlayer UI
  imageUrls?: string[]; // URLs of images to display with the message
  sources?: Source[]; // Sources used to generate the answer
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
 * Represents the successful response from the POST /upload-document/ endpoint.
 */
export interface UploadPdfResponse {
  status: string;
  filename: string;
  uuid: string;
  chunks: number;
  total_documents_in_store: number;
}

/**
 * Represents the response from the GET /files/ endpoint.
 */
export interface ListFilesResponse {
  total_files: number;
  files: Array<{
    uuid: string;
    file_name: string;
    hash: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
}

/**
 * Represents the response from the GET /chunks/{source_name} endpoint.
 */
export interface DeleteChunksResponse {
  success: boolean;
  message: string;
  deleted_chunks?: number;
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
  source?: string; // Filename
}

/**
 * Usage data from OpenAI API
 */
export interface UsageSummary {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  user_id?: string;
  model?: string;
  provider?: string;
}

/**
 * Represents the response from the GET /ask/ endpoint.
 */
export interface AskQuestionResponse {
  question: string;
  answer: string; // This is an HTML string
  sources: Source[];
  audio: AudioData | null;
  usage?: UsageSummary | null; // OpenAI API usage data (only present when using OpenAI)
  image_urls?: string[]; // URLs of relevant images from the backend
  session_name?: string; // LLM-generated session title for dynamic naming
  // Fields from parallel transcribe-and-ask endpoint
  original_text?: string;
  translated_text?: string;
  detected_language?: string;
  final_language?: string;
  original_question?: string;
  english_question?: string;
  conversation_history?: string;
  processing_method?: string;
  // Developer mode fields (optional)
  debug_graph_context?: string;
  debug_filtered_docs?: Array<{
    content_preview: string;
    metadata: Record<string, any>;
  }>;
}

/**
 * Represents the response from the POST /transcribe/ endpoint.
 */
export interface TranscribeResponse {
  original_text: string;
  detected_language: string;
  translated_text: string;
}
