import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WsContext = createContext(null);

export function WsProvider({ children }) {
  const ws           = useRef(null);
  const reconnectTimer = useRef(null);
  const retryConnectRef = useRef(() => {});
  const listeners    = useRef({});      // { [matchId]: Set<callback> }
  const globalCbs    = useRef(new Set());
  const tokenRef     = useRef(localStorage.getItem('srt_token') ?? '');
  const [connected, setConnected]               = useState(false);
  // Reactive set of matchIds the SERVER confirmed this socket is subscribed to
  const [subscribedMatchIds, setSubscribedMatchIds] = useState(new Set());
  // Real-time score map: { [matchId]: { homeScore, awayScore } }
  const [liveScores, setLiveScores] = useState({});

  const connect = useCallback(() => {
    if (ws.current && ws.current.readyState < 2) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host  = import.meta.env.DEV ? 'localhost:8000' : window.location.host;

    // Fix 1: attach the JWT so the backend can authenticate this WS connection
    // and auto-restore the user's persisted DB subscriptions via restoreSubscriptions()
    const token = localStorage.getItem('srt_token');
    tokenRef.current = token ?? '';
    const url   = `${proto}://${host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    const socket = new WebSocket(url);

    socket.onopen = () => setConnected(true);

    socket.onclose = () => {
      setConnected(false);
      setSubscribedMatchIds(new Set()); // clear on disconnect

      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => retryConnectRef.current(), 3000);
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        // Fix 1b: when server restores persisted subscriptions, mirror them into state
        if (msg.type === 'subscriptions_restored' && Array.isArray(msg.matchIds)) {
          setSubscribedMatchIds((prev) => new Set([...prev, ...msg.matchIds]));
        }

        if (msg.type === 'match_status' && msg.data?.id != null) {
          const mid = msg.data.id;
          setLiveScores((prev) => ({
            ...prev,
            [mid]: { homeScore: msg.data.homeScore, awayScore: msg.data.awayScore },
          }));
          if (listeners.current[mid]) {
            listeners.current[mid].forEach((cb) => cb(msg));
          }
        }

        // Track subscribe/unsubscribe acks so UI stays in sync
        if (msg.type === 'subscribed' && msg.matchId != null) {
          setSubscribedMatchIds(prev => new Set([...prev, msg.matchId]));
        }
        if (msg.type === 'unsubscribed' && msg.matchId != null) {
          setSubscribedMatchIds(prev => {
            const next = new Set(prev);
            next.delete(msg.matchId);
            return next;
          });
        }

        // Score update broadcast from PATCH /matches/:id/score
        if (msg.type === 'score_update' || (msg.data?.type === 'score_update')) {
          const su = msg.type === 'score_update' ? msg : msg.data;
          const mid = su?.matchId ?? su?.data?.matchId;
          if (mid != null) {
            setLiveScores(prev => ({
              ...prev,
              [mid]: { homeScore: su.homeScore ?? su.data?.homeScore, awayScore: su.awayScore ?? su.data?.awayScore },
            }));
          }
        }

        // Dispatch to per-match listeners
        const matchId = msg.data?.matchId ?? msg.data?.match_id;
        if (matchId && listeners.current[matchId]) {
          listeners.current[matchId].forEach(cb => cb(msg));
        }

        // Dispatch to global listeners
        globalCbs.current.forEach(cb => cb(msg));
      } catch { /* ignore parse errors */ }
    };

    ws.current = socket;
  }, []);

  const reconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    if (ws.current && ws.current.readyState < 2) {
      ws.current.close();
      return;
    }
    connect();
  }, [connect]);

  useEffect(() => {
    retryConnectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [connect]);

  // Reconnect when auth token changes (login/logout/register), so handshake always carries latest JWT.
  useEffect(() => {
    const onTokenChanged = () => {
      const nextToken = localStorage.getItem('srt_token') ?? '';
      if (nextToken === tokenRef.current) return;
      tokenRef.current = nextToken;
      reconnect();
    };

    const onStorage = (e) => {
      if (e.key === 'srt_token') onTokenChanged();
    };

    window.addEventListener('srt_token_changed', onTokenChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('srt_token_changed', onTokenChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [reconnect]);

  /** Send a raw WS message (subscribe / unsubscribe) */
  const sendRaw = useCallback((payload) => {
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify(payload));
    }
  }, []);

  const subscribe = useCallback((matchId) => {
    sendRaw({ type: 'subscribe', matchId });
  }, [sendRaw]);

  const unsubscribe = useCallback((matchId) => {
    sendRaw({ type: 'unsubscribe', matchId });
  }, [sendRaw]);

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
    <WsContext.Provider value={{
      connected,
      subscribedMatchIds,
      liveScores,
      subscribe,
      unsubscribe,
      onMatchMessage,
      onMessage,
    }}>
      {children}
    </WsContext.Provider>
  );
}

export const useWs = () => useContext(WsContext);
