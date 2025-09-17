import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: 'status_update' | 'processing_event' | 'file_deleted' | 'job_status_update' | 'pdf_processing_complete' | 'pdf_processing_failed' | 'heartbeat' | 'pong' | 'user_connected' | 'user_disconnected';
  file_uuid?: string;
  document_uuid?: string;
  file_name?: string;
  status?: string;
  progress_percentage?: number;
  progress_percent?: number;
  chunks_created?: number;
  event_type?: string;
  event_message?: string;
  message?: string;
  job_id?: string;
  user_id?: string;
  session_id?: string;
  timestamp: string;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: string) => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  userId: string;
  sessionId: string;
  clearUserSession: () => void;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  // Persistent user_id across pages/refreshes, stored in localStorage
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      const existingUserId = localStorage.getItem('chatbot_user_id');
      if (existingUserId) {
        console.log('👤 Loaded existing user ID from localStorage:', existingUserId.slice(-8));
        return existingUserId;
      }
    }
    
    const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatbot_user_id', newUserId);
      console.log('👤 Created new user ID and saved to localStorage:', newUserId.slice(-8));
    }
    
    return newUserId;
  });
  
  // New session_id for each WebSocket connection (page visit/refresh)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualClose = useRef(false);
  const lastHeartbeatRef = useRef<number>(Date.now());
  
  // Configuration constants
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // Start with 1 second
  const maxReconnectDelay = 30000; // Max 30 seconds
  const heartbeatInterval = 30000; // 30 seconds
  const heartbeatTimeout = 60000; // 60 seconds timeout

  const clearTimeouts = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const getReconnectDelay = useCallback(() => {
    // Exponential backoff with jitter
    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
      maxReconnectDelay
    );
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return delay + jitter;
  }, []);

  const startHeartbeat = useCallback(() => {
    clearTimeouts();
    
    const sendHeartbeat = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const now = Date.now();
        
        // Check if we haven't received a heartbeat response in too long
        if (now - lastHeartbeatRef.current > heartbeatTimeout) {
          console.warn('💔 Heartbeat timeout - connection appears dead');
          wsRef.current.close();
          return;
        }
        
        wsRef.current.send(JSON.stringify({ 
          type: 'ping', 
          user_id: userId,
          session_id: sessionId,
          timestamp: now.toString()
        }));
        
        // Schedule next heartbeat
        heartbeatTimeoutRef.current = setTimeout(sendHeartbeat, heartbeatInterval);
      }
    };
    
    // Start heartbeat cycle
    heartbeatTimeoutRef.current = setTimeout(sendHeartbeat, heartbeatInterval);
  }, [userId, sessionId, clearTimeouts]);

  const connectWebSocket = useCallback(() => {
    if (isManualClose.current) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      console.log(`🔌 Attempting WebSocket connection (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
      
      // Add user identification to WebSocket URL
      const wsUrl = `${url}?user_id=${encodeURIComponent(userId)}&session_id=${encodeURIComponent(sessionId)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log('🔌 WebSocket connection timeout');
          ws.close();
        }
      }, 10000); // 10 second connection timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('🔌 WebSocket connected successfully');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
        lastHeartbeatRef.current = Date.now();
        startHeartbeat(); // Start heartbeat
        
        // Send initial user registration
        ws.send(JSON.stringify({
          type: 'user_register',
          user_id: userId,
          session_id: sessionId,
          timestamp: Date.now().toString()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          
          // Handle heartbeat response
          if (data.type === 'heartbeat' || data.type === 'pong') {
            lastHeartbeatRef.current = Date.now();
            console.log('💓 WebSocket heartbeat received');
            return;
          }
          
          // Only process messages intended for this user or broadcast messages
          if (data.user_id && data.user_id !== userId && data.type !== 'user_connected' && data.type !== 'user_disconnected') {
            return; // Skip messages for other users
          }
          
          console.log('📨 WebSocket message received:', data);
          setLastMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          console.error('Raw message:', event.data);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        clearTimeouts();
        setIsConnected(false);
        
        console.log(`🔌 WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
        
        if (isManualClose.current) {
          setConnectionStatus('disconnected');
          return;
        }

        // Only attempt reconnection if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          setConnectionStatus('reconnecting');
          const delay = getReconnectDelay();
          console.log(`🔄 Scheduling reconnection in ${Math.round(delay)}ms`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectWebSocket();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached. WebSocket connection failed permanently.');
          setConnectionStatus('disconnected');
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  }, [url, userId, sessionId, getReconnectDelay, startHeartbeat, clearTimeouts]);

  // Initialize connection
  useEffect(() => {
    isManualClose.current = false;
    connectWebSocket();

    return () => {
      isManualClose.current = true;
      clearTimeouts();
      if (wsRef.current) {
        // Send disconnect message before closing
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'user_disconnect',
            user_id: userId,
            session_id: sessionId,
            timestamp: Date.now().toString()
          }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url, connectWebSocket, clearTimeouts, userId, sessionId]);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Add user identification to all messages
      try {
        const messageObj = JSON.parse(message);
        messageObj.user_id = userId;
        messageObj.session_id = sessionId;
        wsRef.current.send(JSON.stringify(messageObj));
        return true;
      } catch {
        // If not JSON, send as is with user info
        wsRef.current.send(JSON.stringify({
          type: 'message',
          message: message,
          user_id: userId,
          session_id: sessionId,
          timestamp: Date.now().toString()
        }));
        return true;
      }
    } else {
      console.warn('⚠️ WebSocket is not connected. Message not sent:', message);
      return false;
    }
  }, [userId, sessionId]);

  const clearUserSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chatbot_user_id');
      console.log('🗑️ User session cleared from localStorage');
    }
  }, []);

  return { 
    isConnected, 
    lastMessage, 
    sendMessage, 
    connectionStatus,
    userId,
    sessionId,
    clearUserSession
  };
} 