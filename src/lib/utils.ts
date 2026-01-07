import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { appConfig } from "./config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates file size based on file type
 * @param file - The file to validate
 * @returns Object with validation result and error message if applicable
 */
export function validateFileSize(file: File): { isValid: boolean; errorMessage?: string } {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const maxSizeMB = isPdf ? appConfig.maxPdfSizeMB : appConfig.maxFileSizeMB;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    const errorMessage = isPdf
      ? `PDF files must be smaller than ${appConfig.maxPdfSizeMB}MB. Please upload a smaller PDF.`
      : `Please upload a file smaller than ${appConfig.maxFileSizeMB}MB.`;

    return { isValid: false, errorMessage };
  }

  return { isValid: true };
}

/**
 * Checks if a file is a PDF
 * @param file - The file to check
 * @returns True if the file is a PDF
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Formats file size in human readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Fetch with timeout support
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise with fetch response
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Fetch with automatic retry logic and exponential backoff
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param timeoutMs - Timeout per request in milliseconds (default: 10000)
 * @returns Promise with fetch response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  timeoutMs: number = 10000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      // If response is ok, return it
      if (response.ok) {
        return response;
      }

      // If it's a 4xx error (client error), don't retry
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // For 5xx errors, retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed
  throw lastError || new Error('Request failed after all retries');
}

