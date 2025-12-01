/**
 * Audio Utilities for WAV chunk merging
 * 
 * This module provides utilities for merging multiple WAV audio chunks
 * into a single valid WAV file. This is necessary because simply concatenating
 * WAV files results in "clicking" sounds due to each chunk having its own header.
 */

// WAV header size is always 44 bytes for standard PCM format
const WAV_HEADER_SIZE = 44;

/**
 * Decodes a base64 string to a Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Patches the WAV header to reflect the correct file size
 * 
 * WAV header structure:
 * - Offset 4 (4 bytes): ChunkSize = 36 + SubChunk2Size (file size - 8)
 * - Offset 40 (4 bytes): SubChunk2Size = NumSamples * NumChannels * BitsPerSample/8 (data size)
 */
function patchWavHeader(header: Uint8Array, totalDataSize: number): Uint8Array {
  const patchedHeader = new Uint8Array(header);
  
  // Calculate chunk size (file size - 8 bytes for RIFF and size field)
  const chunkSize = 36 + totalDataSize;
  
  // Write ChunkSize at offset 4 (little-endian)
  patchedHeader[4] = chunkSize & 0xff;
  patchedHeader[5] = (chunkSize >> 8) & 0xff;
  patchedHeader[6] = (chunkSize >> 16) & 0xff;
  patchedHeader[7] = (chunkSize >> 24) & 0xff;
  
  // Write SubChunk2Size at offset 40 (little-endian)
  patchedHeader[40] = totalDataSize & 0xff;
  patchedHeader[41] = (totalDataSize >> 8) & 0xff;
  patchedHeader[42] = (totalDataSize >> 16) & 0xff;
  patchedHeader[43] = (totalDataSize >> 24) & 0xff;
  
  return patchedHeader;
}

/**
 * Merges multiple WAV chunks (base64 encoded) into a single valid WAV Blob
 * 
 * Logic:
 * 1. Decode the base64 strings to Uint8Array
 * 2. Extract the WAV header (first 44 bytes) from the first chunk as master header
 * 3. Strip the 44-byte header from all chunks to get raw PCM data
 * 4. Concatenate all raw PCM data
 * 5. Patch the master header with correct sizes
 * 6. Combine the patched header + concatenated PCM data into a new Blob
 * 
 * @param chunks - Array of base64-encoded WAV audio chunks
 * @returns A Blob containing the merged WAV audio
 */
export function mergeWavChunks(chunks: string[]): Blob {
  if (chunks.length === 0) {
    throw new Error('No audio chunks to merge');
  }

  // Decode all chunks
  const decodedChunks = chunks.map(base64ToUint8Array);
  
  // Extract the master header from the first chunk
  const firstChunk = decodedChunks[0];
  if (firstChunk.length < WAV_HEADER_SIZE) {
    throw new Error('First chunk is too small to contain a valid WAV header');
  }
  const masterHeader = firstChunk.slice(0, WAV_HEADER_SIZE);
  
  // Extract raw PCM data from all chunks (strip headers)
  const pcmDataArrays: Uint8Array[] = decodedChunks.map(chunk => {
    // Each chunk should have a header, strip it
    if (chunk.length > WAV_HEADER_SIZE) {
      return chunk.slice(WAV_HEADER_SIZE);
    }
    // If chunk is somehow smaller than or equal to header size, skip it
    return new Uint8Array(0);
  });
  
  // Calculate total PCM data size
  const totalPcmSize = pcmDataArrays.reduce((acc, arr) => acc + arr.length, 0);
  
  // Patch the master header with the correct total size
  const patchedHeader = patchWavHeader(masterHeader, totalPcmSize);
  
  // Concatenate all PCM data
  const mergedPcmData = new Uint8Array(totalPcmSize);
  let offset = 0;
  for (const pcmData of pcmDataArrays) {
    mergedPcmData.set(pcmData, offset);
    offset += pcmData.length;
  }
  
  // Combine header and PCM data
  const finalAudio = new Uint8Array(WAV_HEADER_SIZE + totalPcmSize);
  finalAudio.set(patchedHeader, 0);
  finalAudio.set(mergedPcmData, WAV_HEADER_SIZE);
  
  // Create and return the Blob
  return new Blob([finalAudio], { type: 'audio/wav' });
}

/**
 * Creates an Object URL from the merged audio blob
 * Remember to call URL.revokeObjectURL when done to prevent memory leaks
 */
export function createAudioUrl(chunks: string[]): string {
  const blob = mergeWavChunks(chunks);
  return URL.createObjectURL(blob);
}

/**
 * Revokes an Object URL to free up memory
 */
export function revokeAudioUrl(url: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

