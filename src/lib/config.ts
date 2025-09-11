// src/lib/config.ts

// This file can be used to store configuration variables for the application.
// For example, if you were connecting to an external FastAPI backend, you might store its URL here.

export const appConfig = {
  appName: "Technical AI Assistant",
  // Base URL for the FastAPI backend
  fastApiBaseUrl: process.env.NEXT_PUBLIC_FASTAPI_BASE_URL || "http://localhost:8000",
  // Developer mode toggle (mirrors backend DEVELOPER_MODE)
  developerMode: (process.env.NEXT_PUBLIC_DEVELOPER_MODE || "false").toLowerCase() === "true",
  // File size limits in MB
  maxFileSizeMB: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || "50"), // Maximum file size for general uploads in MB
  maxPdfSizeMB: parseInt(process.env.NEXT_PUBLIC_MAX_PDF_SIZE_MB || "2"), // Maximum PDF file size in MB (default 2MB)
};
