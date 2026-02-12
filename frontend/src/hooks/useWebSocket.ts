
import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketOptions {
  onMessage?: (event: MessageEvent) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnectInterval?: number;
  maxRetries?: number;
}

export const useWebSocket = (url: string | null, options: WebSocketOptions = {}) => {
  const {
    reconnectInterval = 3000,
    maxRetries = 10
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Event | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  // Fix Node.js namespace issue by using ReturnType
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Ref to hold the connect function to break circular dependency
  const connectRef = useRef<() => void>(() => {});

  // Use refs for callbacks to prevent effect re-triggering
  const onMessageRef = useRef(options.onMessage);
  const onOpenRef = useRef(options.onOpen);
  const onCloseRef = useRef(options.onClose);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onMessageRef.current = options.onMessage;
    onOpenRef.current = options.onOpen;
    onCloseRef.current = options.onClose;
    onErrorRef.current = options.onError;
  }, [options.onMessage, options.onOpen, options.onClose, options.onError]);

  const connect = useCallback(() => {
    if (!url) return;

    // cleanup previous connection if exists
    if (wsRef.current) {
        wsRef.current.close();
    }

    try {
      const ws = new WebSocket(url);
      
      ws.onopen = (event) => {
        console.log(`[WebSocket] Connected to ${url}`);
        setIsConnected(true);
        setError(null);
        reconnectCountRef.current = 0;
        if (onOpenRef.current) onOpenRef.current(event);
      };

      ws.onmessage = (event) => {
        if (onMessageRef.current) onMessageRef.current(event);
      };

      ws.onclose = (event) => {
        console.log(`[WebSocket] Disconnected from ${url}`, event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;
        if (onCloseRef.current) onCloseRef.current(event);

        // Attempt reconnection
        if (reconnectCountRef.current < maxRetries) {
          const timeout = Math.min(reconnectInterval * Math.pow(1.5, reconnectCountRef.current), 30000);
          console.log(`[WebSocket] Reconnecting in ${timeout}ms... (Attempt ${reconnectCountRef.current + 1})`);
          
          reconnectTimerRef.current = setTimeout(() => {
            reconnectCountRef.current += 1;
            // Use ref to call connect
            if (connectRef.current) connectRef.current();
          }, timeout);
        } else {
          console.error(`[WebSocket] Max reconnection attempts reached for ${url}`);
        }
      };

      ws.onerror = (event) => {
        console.error(`[WebSocket] Error:`, event);
        setError(event);
        if (onErrorRef.current) onErrorRef.current(event);
      };

      wsRef.current = ws;
    } catch (e) {
      console.error(`[WebSocket] Connection failed:`, e);
    }
  }, [url, reconnectInterval, maxRetries]);

  // Update connectRef whenever connect changes
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      // Unmount cleanup
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on explicit close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url, connect]);

  const sendMessage = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      console.warn('[WebSocket] Cannot send message, socket is not open');
    }
  }, []);

  return { isConnected, error, sendMessage };
};
