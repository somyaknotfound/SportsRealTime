import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useWs } from '../contexts/WsContext';
import { formatDateTime, eventTypeColor } from '../utils';

export default function NotificationsPage() {
  const [notifs, setNotifs]   = useState([]);
  const [unreadOnly, setUO]   = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const toast = useToast();
  // subscribedMatchIds comes from WsContext — populated from the server's
  // subscriptions_restored message so it reflects the user's real DB subscriptions.
  const { onMessage, subscribedMatchIds } = useWs();
  // Keep a stable ref so the WS effect only registers once, but always
  // reads the freshest subscription set (avoids variable-size deps array).
  const subIdsRef = useRef(subscribedMatchIds);
  useEffect(() => { subIdsRef.current = subscribedMatchIds; }, [subscribedMatchIds]);

  const load = useCallback((uo = unreadOnly) => {
    setLoading(true);
    api.notifications.list(uo)
      .then(r => setNotifs(r.data ?? []))
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  }, [unreadOnly]);

  useEffect(() => { if (user) load(); }, [user, load]);

  // Fix 4: Only surface real-time WS events as notifications when they are
  // for a match the user is SUBSCRIBED to. The server only sends 'commentary'
  // pushes to in-memory subscribers, but we double-check on the client side
  // using subscribedMatchIds for clarity and safety.
  useEffect(() => {
    return onMessage((msg) => {
      // 'commentary' events are server-side filtered to subscribers already,
      // but we gate here too so Notifications only shows relevant matches.
      if (msg.type === 'commentary') {
        const matchId = msg.data?.matchId ?? msg.data?.match_id;
        if (!matchId) return;

        // Read latest subscriptions from ref (no stale closure issues)
        if (!subIdsRef.current.has(matchId)) return;

        const pseudo = {
          id: `rt-${Date.now()}-${matchId}`,
          matchId,
          eventType: msg.data?.eventType ?? 'commentary',
          message: msg.data?.message ?? 'New commentary update',
          // Enrich with actor / minute / period if available
          actor:  msg.data?.actor  ?? null,
          minute: msg.data?.minute ?? null,
          period: msg.data?.period ?? null,
          createdAt: new Date().toISOString(),
          readAt: null,
          _realtime: true,
          _matchInfo: {
            homeTeam: msg.data?.homeTeam ?? null,
            awayTeam: msg.data?.awayTeam ?? null,
            sport:    msg.data?.sport    ?? null,
          },
        };
        setNotifs(prev => [pseudo, ...prev]);
      }

      // 'match_event' (goal, card etc.) — also gated by subscription
      if (msg.type === 'match_event') {
        const matchId = msg.data?.matchId ?? msg.data?.match_id;
        if (!matchId) return;
        if (!subIdsRef.current.has(matchId)) return;

        const pseudo = {
          id: `rt-evt-${Date.now()}-${matchId}`,
          matchId,
          eventType: msg.data?.eventType ?? 'update',
          message: formatEventMessage(msg.data),
          createdAt: new Date().toISOString(),
          readAt: null,
          _realtime: true,
          _isEvent: true,
        };
        setNotifs(prev => [pseudo, ...prev]);
      }
    });
  }, [onMessage]); // stable — subIdsRef.current is always fresh

  const readAll = async () => {
    try {
      await api.notifications.readAll();
      setNotifs(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
      toast.success('All marked as read');
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const unread = notifs.filter(n => !n.readAt).length;

  if (!user) {
    return (
      <div className="page">
        <div className="empty-state" style={{ marginTop: 60 }}>
          <span className="icon">🔒</span>
          <h3>Sign in required</h3>
          <p>You need to be logged in to view notifications.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p style={{ color: 'var(--c-text2)', marginTop: 4, fontSize: '0.9rem' }}>
            Live commentary &amp; events from your subscribed matches
            {unread > 0 && (
              <span style={{
                marginLeft: 8,
                background: 'var(--c-live)',
                color: '#fff',
                borderRadius: 20,
                padding: '1px 8px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}>
                {unread} new
              </span>
            )}
          </p>
          {subscribedMatchIds.size > 0 && (
            <p style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--c-text3)' }}>
              🔔 Subscribed to {subscribedMatchIds.size} match{subscribedMatchIds.size !== 1 ? 'es' : ''}
              {' '}— real-time updates appear instantly below.
            </p>
          )}
          {subscribedMatchIds.size === 0 && (
            <p style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--c-text3)' }}>
              You have no active subscriptions. Go to a match and click Subscribe.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className={`btn btn-sm ${unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { const next = !unreadOnly; setUO(next); load(next); }}
          >
            {unreadOnly ? 'Unread only ✓' : 'Show unread only'}
          </button>
          {unread > 0 && (
            <button className="btn btn-sm btn-secondary" onClick={readAll}>
              Mark all read
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={() => load()}>↻ Refresh</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : !notifs.length ? (
          <div className="empty-state">
            <span className="icon">🔔</span>
            <h3>All clear!</h3>
            <p>
              {subscribedMatchIds.size === 0
                ? 'Subscribe to matches to receive real-time updates here.'
                : 'No notifications yet — updates will stream in as commentary arrives.'}
            </p>
          </div>
        ) : (
          notifs.map(n => <NotifItem key={n.id} notif={n} />)
        )}
      </div>
    </div>
  );
}

function formatEventMessage(data) {
  const type    = data?.eventType ?? 'update';
  const payload = data?.payload ?? {};
  const player  = payload.player || payload.actor || '';
  const team    = payload.team   || data?.team   || '';
  if (player && team) return `${type}: ${player} (${team})`;
  if (player)         return `${type}: ${player}`;
  if (team)           return `${type} — ${team}`;
  return `Match event: ${type}`;
}

function NotifItem({ notif }) {
  const { color, bg } = eventTypeColor(notif.eventType ?? 'commentary');
  const unread = !notif.readAt;

  return (
    <div className={`notif-item ${unread ? 'unread' : ''}`} style={{
      borderLeft: notif._realtime ? `3px solid ${color}` : undefined,
      background: notif._realtime && unread ? `${bg}` : undefined,
    }}>
      {unread && <span className="notif-dot" style={{ background: color }} />}
      <div style={{ flex: 1 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 6,
            background: `${color}20`,
            color,
          }}>
            {notif.eventType ?? 'commentary'}
          </span>

          {notif._realtime && (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              color: '#22c55e',
              background: 'rgba(34,197,94,0.12)',
              padding: '1px 6px',
              borderRadius: 5,
              letterSpacing: '0.05em',
            }}>
              LIVE
            </span>
          )}

          {/* Show match info if available */}
          {notif.matchId && !notif._matchInfo?.homeTeam && (
            <span style={{ fontSize: '0.72rem', color: 'var(--c-text3)' }}>
              Match #{notif.matchId}
            </span>
          )}
          {notif._matchInfo?.homeTeam && (
            <span style={{ fontSize: '0.72rem', color: 'var(--c-text3)' }}>
              {notif._matchInfo.homeTeam} vs {notif._matchInfo.awayTeam}
            </span>
          )}

          <span style={{ fontSize: '0.72rem', color: 'var(--c-text3)', marginLeft: 'auto' }}>
            {formatDateTime(notif.createdAt)}
          </span>
        </div>

        {/* Commentary minute + message */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {notif.minute != null && (
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--c-accent)',
              whiteSpace: 'nowrap',
              paddingTop: 2,
            }}>
              {notif.minute}'
            </span>
          )}
          <p style={{ fontSize: '0.875rem', color: 'var(--c-text2)', lineHeight: 1.5, margin: 0 }}>
            {notif.message}
          </p>
        </div>

        {/* Actor / period meta */}
        {(notif.actor || notif.period) && (
          <div style={{ fontSize: '0.72rem', color: 'var(--c-text3)', marginTop: 4, display: 'flex', gap: 8 }}>
            {notif.actor  && <span>👤 {notif.actor}</span>}
            {notif.period && <span>🕐 {notif.period}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
