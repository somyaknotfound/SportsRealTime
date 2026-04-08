import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useWs } from '../contexts/WsContext';
import { useToast } from '../contexts/ToastContext';
import { sportEmoji, formatDateTime } from '../utils';
import CreateMatchModal from '../components/CreateMatchModal';
import { StatusBadge } from '../components/StatusBadge';

export default function MatchesPage({ onSelectMatch }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { user } = useAuth();
  const { onMessage } = useWs();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await api.matches.list(50);
      setMatches(res.data ?? []);
    } catch (err) {
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: insert newly created matches at the top
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === 'match_created') {
        setMatches(prev => [msg.data, ...prev]);
        toast.info(`New match: ${msg.data.homeTeam} vs ${msg.data.awayTeam}`);
      }
    });
  }, [onMessage]);

  const canCreate = user?.role === 'commentator' || user?.role === 'admin';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Live Matches</h1>
          <p style={{ color: 'var(--c-text2)', marginTop: 4, fontSize: '0.9rem' }}>
            Real-time sports data — subscribe to get instant commentary
          </p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Create Match
          </button>
        )}
        {!user && (
          <p style={{ color: 'var(--c-text3)', fontSize: '0.85rem', alignSelf: 'center' }}>
            Sign in to subscribe &amp; post commentary
          </p>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🏟️</span>
          <h3>No matches yet</h3>
          <p>Matches will appear here once created. {canCreate && 'Use the button above to add one.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {matches.map(m => (
            <MatchCard key={m.id} match={m} onClick={() => onSelectMatch(m)} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateMatchModal
          onClose={() => setShowCreate(false)}
          onCreated={(m) => {
            setMatches(prev => [m, ...prev]);
            setShowCreate(false);
            toast.success('Match created!');
          }}
        />
      )}
    </div>
  );
}

function MatchCard({ match, onClick }) {
  return (
    <div
      className={`match-card status-${match.status}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <div className="match-card-header">
        <span className="match-sport">
          {sportEmoji(match.sport)} {match.sport}
        </span>
        <StatusBadge status={match.status} />
      </div>

      <div className="match-teams">
        <div className="team-info">
          <div className="team-name">{match.homeTeam}</div>
          <div className="score">{match.homeScore}</div>
        </div>
        <span className="score-divider">:</span>
        <div className="team-info">
          <div className="team-name">{match.awayTeam}</div>
          <div className="score">{match.awayScore}</div>
        </div>
      </div>

      <div className="match-footer">
        <span>{formatDateTime(match.startTime)}</span>
        <span style={{ color: 'var(--c-accent)', fontSize: '0.78rem' }}>View →</span>
      </div>
    </div>
  );
}

// StatusBadge is now in components/StatusBadge.jsx
