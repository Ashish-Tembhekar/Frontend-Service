// src/lib/config.ts

// This file can be used to store configuration variables for the application.
// For example, if you were connecting to an external FastAPI backend, you might store its URL here.

export const appConfig = {
  appName: "Nexus Chat",
  // Base URL for the FastAPI backend
  fastApiBaseUrl: process.env.NEXT_PUBLIC_FASTAPI_BASE_URL || "http://localhost:8000",
  maxFileSizeMB: 50, // Maximum file size for uploads in MB, increased for larger PDFs
};
