"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { appConfig } from '../lib/config';

interface WebSocketContextType {
    isConnected: boolean;
    lastMessage: any;
    sendMessage: (message: string) => void;
    connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
    userId: string;
    sessionId: string;
    clearUserSession: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Single WebSocket connection for the entire app - using /ws/updates endpoint
    const wsUrl = appConfig.fastApiBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/updates';
    const websocket = useWebSocket(wsUrl);

    return (
        <WebSocketContext.Provider value={websocket}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocketContext = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocketContext must be used within a WebSocketProvider');
    }
    return context;
};

// Also export the dashboard-specific hook for components that need the dashboard endpoint
export const useDashboardWebSocket = () => {
    const wsUrl = appConfig.fastApiBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/dashboard';
    return useWebSocket(wsUrl);
};
