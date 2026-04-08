import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WsContext = createContext(null);

export function WsProvider({ children }) {
  const ws        = useRef(null);
  const listeners = useRef({});   // { [matchId]: Set of callbacks }
  const globalCbs = useRef(new Set());
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (ws.current && ws.current.readyState < 2) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // During development Vite runs on 5173, backend on 8000
    const host = import.meta.env.DEV ? 'localhost:8000' : window.location.host;
    const socket = new WebSocket(`${proto}://${host}/ws`);

    socket.onopen = () => setConnected(true);
    socket.onclose = () => {
      setConnected(false);
      // Reconnect after 3s
      setTimeout(connect, 3000);
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        // Dispatch to per-match listeners
        const matchId = msg.data?.matchId ?? msg.data?.match_id;
        if (matchId && listeners.current[matchId]) {
          listeners.current[matchId].forEach(cb => cb(msg));
        }
        // Dispatch to global listeners
        globalCbs.current.forEach(cb => cb(msg));
      } catch {}
    };

    ws.current = socket;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [connect]);

  const subscribe = useCallback((matchId) => {
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({ type: 'subscribe', matchId }));
    }
  }, []);

  const unsubscribe = useCallback((matchId) => {
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({ type: 'unsubscribe', matchId }));
    }
  }, []);

  const onMatchMessage = useCallback((matchId, cb) => {
    if (!listeners.current[matchId]) listeners.current[matchId] = new Set();
    listeners.current[matchId].add(cb);
    return () => listeners.current[matchId]?.delete(cb);
  }, []);

  const onMessage = useCallback((cb) => {
    globalCbs.current.add(cb);
    return () => globalCbs.current.delete(cb);
  }, []);

  return (
    <WsContext.Provider value={{ connected, subscribe, unsubscribe, onMatchMessage, onMessage }}>
      {children}
    </WsContext.Provider>
  );
}

export const useWs = () => useContext(WsContext);
