import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { sportEmoji, formatDateTime } from '../utils';
import { StatusBadge } from '../components/StatusBadge';

export default function SubscriptionsPage({ onSelectMatch }) {
  const [subs, setSubs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const toast = useToast();

  const load = () => {
    setLoading(true);
    api.subscriptions.list()
      .then(r => setSubs(r.data ?? []))
      .catch(() => toast.error('Failed to load subscriptions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user) load(); }, [user]);

  const unsub = async (matchId) => {
    try {
      await api.subscriptions.unsubscribe(matchId);
      setSubs(prev => prev.filter(s => s.matchId !== matchId));
      toast.success('Unsubscribed');
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="empty-state" style={{ marginTop: 60 }}>
          <span className="icon">🔒</span>
          <h3>Sign in required</h3>
          <p>You need to be logged in to view your subscriptions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Subscriptions</h1>
          <p style={{ color: 'var(--c-text2)', marginTop: 4, fontSize: '0.9rem' }}>
            Matches you're tracking in real-time
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : !subs.length ? (
        <div className="empty-state">
          <span className="icon">🔔</span>
          <h3>No subscriptions yet</h3>
          <p>Open a match and click Subscribe to get real-time updates and notifications.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {subs.map(s => (
            <div key={s.id} className="sub-chip">
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '1.5rem' }}>{sportEmoji(s.match?.sport)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.match?.homeTeam} vs {s.match?.awayTeam}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--c-text3)', marginTop: 2 }}>
                    {s.match?.sport} · Subscribed {formatDateTime(s.subscribedAt)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <StatusBadge status={s.match?.status} />
                <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: 'var(--c-text)' }}>
                  {s.match?.homeScore} : {s.match?.awayScore}
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => onSelectMatch(s.match)}>
                  View
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => unsub(s.matchId)}>
                  Unsub
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
