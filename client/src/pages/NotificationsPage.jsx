import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useWs } from '../contexts/WsContext';
import { formatDateTime, eventTypeColor } from '../utils';

export default function NotificationsPage() {
  const [notifs, setNotifs]     = useState([]);
  const [unreadOnly, setUO]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const { user } = useAuth();
  const toast = useToast();
  const { onMessage } = useWs();

  const load = (uo = unreadOnly) => {
    setLoading(true);
    api.notifications.list(uo)
      .then(r => setNotifs(r.data ?? []))
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user) load(); }, [user]);

  // Receive real-time events and surface them as pseudo-notifications
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === 'match_event') {
        // Visually inject as a fresh unread notification at top
        const pseudo = {
          id: `rt-${Date.now()}`,
          eventType: msg.data?.eventType ?? 'update',
          message: `[${msg.data?.eventType}] ${JSON.stringify(msg.data?.payload ?? {})}`,
          createdAt: new Date().toISOString(),
          readAt: null,
          _realtime: true,
        };
        setNotifs(prev => [pseudo, ...prev]);
      }
    });
  }, [onMessage]);

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
            Match events and updates from subscribed matches
            {unread > 0 && (
              <span style={{ marginLeft: 8, background: 'var(--c-live)', color:'#fff', borderRadius: 20, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }}>
                {unread} new
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setUO(u => !u); load(!unreadOnly); }}
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
          <div style={{ display:'flex', justifyContent:'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : !notifs.length ? (
          <div className="empty-state">
            <span className="icon">🔔</span>
            <h3>All clear!</h3>
            <p>No notifications yet. Subscribe to matches to receive updates.</p>
          </div>
        ) : (
          notifs.map(n => <NotifItem key={n.id} notif={n} />)
        )}
      </div>
    </div>
  );
}

function NotifItem({ notif }) {
  const { color } = eventTypeColor(notif.eventType);
  const unread = !notif.readAt;
  return (
    <div className={`notif-item ${unread ? 'unread' : ''}`}>
      {unread && <span className="notif-dot" style={{ background: color }} />}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${color}20`, color }}>
            {notif.eventType}
          </span>
          {notif._realtime && (
            <span style={{ fontSize: '0.68rem', color: 'var(--c-accent)', fontWeight: 700 }}>LIVE</span>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--c-text3)', marginLeft: 'auto' }}>
            {formatDateTime(notif.createdAt)}
          </span>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--c-text2)', lineHeight: 1.5 }}>{notif.message}</p>
      </div>
    </div>
  );
}
