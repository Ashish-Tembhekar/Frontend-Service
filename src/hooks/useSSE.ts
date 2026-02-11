"use client";

import { useRef, useCallback, useEffect, useState } from 'react';
import { appConfig } from '../lib/config';

/**
 * Event types received from SSE stream
 */
export interface SSEEvent {
    type: 'llm_status_update' | 'file_processing_progress' | 'job_status_update' | 'pdf_processing_complete' | 'pdf_processing_failed' | 'status_update' | 'connection_established' | 'file_deleted' | 'user_connected' | 'user_disconnected';
    timestamp: string;
    // LLM status update fields
    question_id?: string;
    status?: string;
    // File/job processing fields
    job_id?: string;
    document_uuid?: string;
    file_uuid?: string;
    file_name?: string;
    progress_percent?: number;
    progress_percentage?: number;
    message?: string;
    error?: string;
    stats?: {
        total_pages?: number;
        total_chunks?: number;
        processing_time?: number;
        images?: number;
        tables?: number;
    };
    result?: Record<string, unknown>;
    user_id?: string;
}

export interface UseSSEReturn {
    isConnected: boolean;
    lastEvent: SSEEvent | null;
    connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
    reconnect: () => void;
    disconnect: () => void;
}

/**
 * Custom hook for Server-Sent Events (SSE) connection.
 * 
 * Replaces WebSocket-based communication for receiving real-time 
 * updates from the backend (LLM status, file processing progress, etc.)
 * 
 * @param userId - User ID to subscribe to updates for
 * @returns SSE connection state and methods
 */
export function useSSE(userId: string): UseSSEReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');

    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptRef = useRef(0);
    const maxReconnectAttempts = 10;
    const baseReconnectDelay = 1000; // 1 second

    const clearReconnectTimeout = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    }, []);

    const disconnect = useCallback(() => {
        clearReconnectTimeout();

        if (eventSourceRef.current) {
            console.log('📡 SSE: Disconnecting...');
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        setIsConnected(false);
        setConnectionStatus('disconnected');
        reconnectAttemptRef.current = 0;
    }, [clearReconnectTimeout]);

    const connect = useCallback(() => {
        // Don't connect if no userId is provided
        if (!userId) {
            console.log('📡 SSE: No userId provided, skipping connection');
            return;
        }

        // Don't connect if already connected or connecting
        if (eventSourceRef.current) {
            const state = eventSourceRef.current.readyState;
            if (state === EventSource.CONNECTING || state === EventSource.OPEN) {
                console.log('📡 SSE: Already connected or connecting');
                return;
            }
        }

        const sseUrl = `${appConfig.fastApiBaseUrl}/api/v1/stream-updates/${userId}`;
        console.log(`📡 SSE: Connecting to ${sseUrl}`);
        setConnectionStatus('connecting');

        try {
            const eventSource = new EventSource(sseUrl);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                console.log('📡 SSE: Connection established');
                setIsConnected(true);
                setConnectionStatus('connected');
                reconnectAttemptRef.current = 0; // Reset reconnect attempts on successful connection
            };

            eventSource.onmessage = (event) => {
                try {
                    const data: SSEEvent = JSON.parse(event.data);
                    console.log('📡 SSE: Received event:', data.type);
                    setLastEvent(data);
                } catch (error) {
                    console.error('📡 SSE: Error parsing event data:', error);
                }
            };

            eventSource.onerror = (error) => {
                console.error('📡 SSE: Connection error:', error);
                setIsConnected(false);

                // EventSource automatically tries to reconnect, but we'll manage it ourselves
                if (eventSource.readyState === EventSource.CLOSED) {
                    eventSource.close();
                    eventSourceRef.current = null;

                    // Attempt reconnection with exponential backoff
                    if (reconnectAttemptRef.current < maxReconnectAttempts) {
                        reconnectAttemptRef.current++;
                        const delay = Math.min(
                            baseReconnectDelay * Math.pow(2, reconnectAttemptRef.current - 1),
                            30000 // Max 30 seconds
                        );

                        console.log(`📡 SSE: Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
                        setConnectionStatus('reconnecting');

                        reconnectTimeoutRef.current = setTimeout(() => {
                            connect();
                        }, delay);
                    } else {
                        console.log('📡 SSE: Max reconnection attempts reached');
                        setConnectionStatus('disconnected');
                    }
                }
            };
        } catch (error) {
            console.error('📡 SSE: Failed to create EventSource:', error);
            setConnectionStatus('disconnected');
        }
    }, [userId]);

    const reconnect = useCallback(() => {
        disconnect();
        reconnectAttemptRef.current = 0; // Reset attempts for manual reconnect
        connect();
    }, [disconnect, connect]);

    // Connect when userId changes
    useEffect(() => {
        if (userId) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [userId, connect, disconnect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        lastEvent,
        connectionStatus,
        reconnect,
        disconnect,
    };
}
