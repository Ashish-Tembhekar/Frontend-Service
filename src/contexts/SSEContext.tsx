"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useSSE, UseSSEReturn, SSEEvent } from '../hooks/useSSE';
import { useAuth } from './AuthContext';

/**
 * SSE Context for providing SSE connection across the application.
 * 
 * This context replaces the WebSocketContext for one-way real-time updates
 * from the backend to the frontend.
 */
const SSEContext = createContext<UseSSEReturn | undefined>(undefined);

interface SSEProviderProps {
    children: ReactNode;
}

/**
 * SSE Provider component.
 * 
 * Wraps the application and provides SSE connection state to all child components.
 * Automatically connects to the SSE endpoint using the authenticated user's ID.
 */
export const SSEProvider: React.FC<SSEProviderProps> = ({ children }) => {
    const { user } = useAuth();

    // Connect to SSE using the user's UID
    // If user is not authenticated, userId will be empty and SSE won't connect
    const sse = useSSE(user?.uid || '');

    return (
        <SSEContext.Provider value={sse}>
            {children}
        </SSEContext.Provider>
    );
};

/**
 * Hook to access SSE context.
 * 
 * @throws Error if used outside of SSEProvider
 * @returns SSE connection state and methods
 */
export function useSSEContext(): UseSSEReturn {
    const context = useContext(SSEContext);
    if (context === undefined) {
        throw new Error('useSSEContext must be used within an SSEProvider');
    }
    return context;
}

// Re-export SSEEvent type for convenience
export type { SSEEvent };
