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
