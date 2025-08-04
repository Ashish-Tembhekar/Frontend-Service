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
