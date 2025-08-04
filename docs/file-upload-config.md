# File Upload Configuration

## PDF Size Limit Configuration

The application now supports configurable file size limits with specific restrictions for PDF files. This feature allows you to set different size limits for PDFs versus other file types.

### Environment Variables

You can configure the file size limits using the following environment variables:

- `NEXT_PUBLIC_MAX_FILE_SIZE_MB`: Maximum file size for general uploads (default: 50MB)
- `NEXT_PUBLIC_MAX_PDF_SIZE_MB`: Maximum file size specifically for PDF files (default: 2MB)

### Example Configuration

Create a `.env.local` file in your project root with:

```env
# FastAPI Backend URL
NEXT_PUBLIC_FASTAPI_BASE_URL=http://localhost:8000

# File Upload Size Limits (in MB)
NEXT_PUBLIC_MAX_FILE_SIZE_MB=50
NEXT_PUBLIC_MAX_PDF_SIZE_MB=2
```

### Implementation Details

The PDF size limit is enforced at multiple levels:

1. **Frontend Validation**: File size is checked before upload in both `ChatInputBar.tsx` and `ChatContext.tsx`
2. **Utility Functions**: Reusable validation functions in `src/lib/utils.ts`
3. **Configuration**: Centralized configuration in `src/lib/config.ts`

### Validation Logic

- PDF files are identified by MIME type (`application/pdf`) or file extension (`.pdf`)
- PDF files use the `NEXT_PUBLIC_MAX_PDF_SIZE_MB` limit
- All other files use the `NEXT_PUBLIC_MAX_FILE_SIZE_MB` limit
- Validation occurs before the file is sent to the backend

### Error Messages

When a file exceeds the size limit, users receive specific error messages:
- For PDFs: "PDF files must be smaller than XMB. Please upload a smaller PDF."
- For other files: "Please upload a file smaller than XMB."

### Utility Functions

The following utility functions are available in `src/lib/utils.ts`:

- `validateFileSize(file: File)`: Validates file size and returns validation result
- `isPdfFile(file: File)`: Checks if a file is a PDF
- `formatFileSize(bytes: number)`: Formats file size in human-readable format 