import { useState, useEffect, useRef } from 'react';
import { RequestLog } from '../types';

export function useTrafficStream() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [rps, setRps] = useState<number>(0);
  const [allowedRps, setAllowedRps] = useState<number>(0);
  const [rejectedRps, setRejectedRps] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const pausedRef = useRef<boolean>(false);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/traffic`;

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'THROUGHPUT_PULSE') {
              setRps(data.rps || 0);
              setAllowedRps(data.allowedRps || 0);
              setRejectedRps(data.rejectedRps || 0);
            } else if (data.type === 'REQUEST_EVENT' && data.data) {
              if (!pausedRef.current) {
                setLogs((prev) => [data.data, ...prev.slice(0, 99)]);
              }
            }
          } catch (err) {
            console.error('Error parsing WS event:', err);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const clearLogs = () => setLogs([]);
  const togglePause = () => setIsPaused((prev) => !prev);

  return {
    logs,
    rps,
    allowedRps,
    rejectedRps,
    isConnected,
    isPaused,
    clearLogs,
    togglePause,
  };
}
