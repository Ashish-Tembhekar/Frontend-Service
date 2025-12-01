/**
 * Usage Logger Service
 * 
 * This service logs OpenAI API usage data to Firestore.
 * Each user has a document in the 'usage' collection that tracks their API usage.
 */

import { db } from '../lib/firebase/config';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  increment,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

/**
 * Usage data structure from backend
 */
export interface UsageData {
  timestamp: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

/**
 * Aggregated usage summary from backend
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
 * TTS usage data from TTS service
 */
export interface TTSUsageData {
  timestamp: string;
  device: string;
  text_length: number;
  estimated_tokens: number;
  num_chunks: number;
  gpu_memory_used_mb: number;
  cpu_memory_used_mb: number;
  elapsed_time_seconds: number;
  tokens_per_second: number;
}

/**
 * User usage document structure in Firestore
 */
export interface UserUsageDocument {
  userId: string;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  lastUpdated: Timestamp;
  createdAt: Timestamp;
  recentUsage: UsageEntry[];
  // TTS usage fields
  ttsUsageCalls?: number;
  ttsTotalTokens?: number;
  ttsTotalGpuMemoryMb?: number;
  ttsTotalCpuMemoryMb?: number;
  ttsTotalElapsedSeconds?: number;
  recentTtsUsage?: TTSUsageEntry[];
}

/**
 * Individual usage entry
 */
export interface UsageEntry {
  timestamp: Timestamp;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  calls: number;
}

/**
 * Individual TTS usage entry
 */
export interface TTSUsageEntry {
  timestamp: Timestamp;
  textLength: number;
  estimatedTokens: number;
  numChunks: number;
  gpuMemoryUsedMb: number;
  cpuMemoryUsedMb: number;
  elapsedTimeSeconds: number;
  tokensPerSecond: number;
  device: string;
}

/**
 * Log usage data to Firestore
 * 
 * @param userId - The Firebase user ID
 * @param usageSummary - Usage summary from the backend API response
 */
export async function logUsageToFirestore(
  userId: string,
  usageSummary: UsageSummary
): Promise<void> {
  if (!userId || !usageSummary) {
    console.warn('Cannot log usage: missing userId or usageSummary');
    return;
  }

  // Skip if no actual usage (e.g., when using non-OpenAI providers)
  if (usageSummary.total_calls === 0 || usageSummary.total_tokens === 0) {
    console.log('No usage to log (non-OpenAI provider or no API calls)');
    return;
  }

  try {
    const usageDocRef = doc(db, 'usage', userId);
    const usageDoc = await getDoc(usageDocRef);

    const usageEntry: UsageEntry = {
      timestamp: Timestamp.now(),
      model: usageSummary.model || 'unknown',
      inputTokens: usageSummary.total_input_tokens,
      outputTokens: usageSummary.total_output_tokens,
      totalTokens: usageSummary.total_tokens,
      costUsd: usageSummary.total_cost_usd,
      calls: usageSummary.total_calls,
    };

    if (usageDoc.exists()) {
      // Update existing document
      await updateDoc(usageDocRef, {
        totalCalls: increment(usageSummary.total_calls),
        totalInputTokens: increment(usageSummary.total_input_tokens),
        totalOutputTokens: increment(usageSummary.total_output_tokens),
        totalTokens: increment(usageSummary.total_tokens),
        totalCostUsd: increment(usageSummary.total_cost_usd),
        lastUpdated: serverTimestamp(),
        // Keep only the last 100 usage entries
        recentUsage: arrayUnion(usageEntry),
      });

      console.log('✅ Usage data updated in Firestore for user:', userId);
    } else {
      // Create new document
      const newUsageDoc: UserUsageDocument = {
        userId,
        totalCalls: usageSummary.total_calls,
        totalInputTokens: usageSummary.total_input_tokens,
        totalOutputTokens: usageSummary.total_output_tokens,
        totalTokens: usageSummary.total_tokens,
        totalCostUsd: usageSummary.total_cost_usd,
        lastUpdated: Timestamp.now(),
        createdAt: Timestamp.now(),
        recentUsage: [usageEntry],
      };

      await setDoc(usageDocRef, newUsageDoc);
      console.log('✅ New usage document created in Firestore for user:', userId);
    }
  } catch (error) {
    console.error('❌ Error logging usage to Firestore:', error);
    // Don't throw - we don't want to break the user experience if logging fails
  }
}

/**
 * Log TTS usage data to Firestore
 *
 * @param userId - The Firebase user ID
 * @param ttsUsage - TTS usage data from the TTS service
 */
export async function logTTSUsageToFirestore(
  userId: string,
  ttsUsage: TTSUsageData
): Promise<void> {
  if (!userId || !ttsUsage) {
    console.warn('Cannot log TTS usage: missing userId or ttsUsage');
    return;
  }

  try {
    const usageDocRef = doc(db, 'usage', userId);
    const usageDoc = await getDoc(usageDocRef);

    const ttsUsageEntry: TTSUsageEntry = {
      timestamp: Timestamp.now(),
      textLength: ttsUsage.text_length,
      estimatedTokens: ttsUsage.estimated_tokens,
      numChunks: ttsUsage.num_chunks,
      gpuMemoryUsedMb: ttsUsage.gpu_memory_used_mb,
      cpuMemoryUsedMb: ttsUsage.cpu_memory_used_mb,
      elapsedTimeSeconds: ttsUsage.elapsed_time_seconds,
      tokensPerSecond: ttsUsage.tokens_per_second,
      device: ttsUsage.device,
    };

    if (usageDoc.exists()) {
      // Update existing document
      await updateDoc(usageDocRef, {
        ttsUsageCalls: increment(1),
        ttsTotalTokens: increment(ttsUsage.estimated_tokens),
        ttsTotalGpuMemoryMb: increment(ttsUsage.gpu_memory_used_mb),
        ttsTotalCpuMemoryMb: increment(ttsUsage.cpu_memory_used_mb),
        ttsTotalElapsedSeconds: increment(ttsUsage.elapsed_time_seconds),
        lastUpdated: serverTimestamp(),
        // Keep only the last 100 TTS usage entries
        recentTtsUsage: arrayUnion(ttsUsageEntry),
      });

      console.log('✅ TTS usage data updated in Firestore for user:', userId);
    } else {
      // Create new document with TTS usage
      const newUsageDoc: UserUsageDocument = {
        userId,
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        lastUpdated: Timestamp.now(),
        createdAt: Timestamp.now(),
        recentUsage: [],
        ttsUsageCalls: 1,
        ttsTotalTokens: ttsUsage.estimated_tokens,
        ttsTotalGpuMemoryMb: ttsUsage.gpu_memory_used_mb,
        ttsTotalCpuMemoryMb: ttsUsage.cpu_memory_used_mb,
        ttsTotalElapsedSeconds: ttsUsage.elapsed_time_seconds,
        recentTtsUsage: [ttsUsageEntry],
      };

      await setDoc(usageDocRef, newUsageDoc);
      console.log('✅ New usage document created in Firestore with TTS data for user:', userId);
    }
  } catch (error) {
    console.error('❌ Error logging TTS usage to Firestore:', error);
    // Don't throw - we don't want to break the user experience if logging fails
  }
}

/**
 * Get user usage data from Firestore
 *
 * @param userId - The Firebase user ID
 * @returns User usage document or null if not found
 */
export async function getUserUsage(userId: string): Promise<UserUsageDocument | null> {
  if (!userId) {
    console.warn('Cannot get usage: missing userId');
    return null;
  }

  try {
    const usageDocRef = doc(db, 'usage', userId);
    const usageDoc = await getDoc(usageDocRef);

    if (usageDoc.exists()) {
      return usageDoc.data() as UserUsageDocument;
    } else {
      console.log('No usage data found for user:', userId);
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting usage from Firestore:', error);
    return null;
  }
}

/**
 * Format cost for display
 * 
 * @param costUsd - Cost in USD
 * @returns Formatted cost string
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(6)}`;
  } else if (costUsd < 1) {
    return `$${costUsd.toFixed(4)}`;
  } else {
    return `$${costUsd.toFixed(2)}`;
  }
}

/**
 * Format token count for display
 * 
 * @param tokens - Number of tokens
 * @returns Formatted token string
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  } else {
    return tokens.toString();
  }
}

