import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useWs } from '../contexts/WsContext';
import { useToast } from '../contexts/ToastContext';
import { sportEmoji, formatDateTime } from '../utils';
import CreateMatchModal from '../components/CreateMatchModal';
import { StatusBadge } from '../components/StatusBadge';

/** Returns a short label for what the score number means per sport */
function scoreLabel(sport) {
  const s = sport?.toLowerCase() ?? '';
  if (s === 'cricket')    return 'Runs';
  if (s === 'basketball') return 'Pts';
  if (s === 'tennis')     return 'Sets';
  return 'Goals';
}

export default function MatchesPage({ onSelectMatch }) {
  const [matches, setMatches]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  /** '' = all matches */
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Per-match live blurb: matchId → latest commentary message text
  const [liveBlurbs, setLiveBlurbs] = useState({});
  // Per-match commentary count since page load (for activity indicator)
  const [liveCounts, setLiveCounts]  = useState({});
  // Set of matchIds whose card should flash a green outline for 2s
  const [updatedIds, setUpdatedIds]  = useState(new Set());
  const flashTimers = useRef({});

  const { user } = useAuth();
  const { onMessage, subscribedMatchIds, liveScores } = useWs();
  const toast = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Initial fetch ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const res = await api.matches.list(params);
      setMatches(res.data ?? []);
    } catch {
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, toast]);

  useEffect(() => { load(); }, [load]);

  // ── Real-time WS events ──────────────────────────────────────────────────────
  useEffect(() => {
    return onMessage((msg) => {

      // 1. New match created by seed/admin → prepend to list (deduplicate by id)
      if (msg.type === 'match_created') {
        setMatches(prev => {
          if (prev.some(m => m.id === msg.data.id)) return prev; // already there
          return [msg.data, ...prev];
        });
        toast.info(`New match: ${msg.data.homeTeam} vs ${msg.data.awayTeam}`);
      }

      if (msg.type === 'match_status' && msg.data?.id != null) {
        setMatches((prev) =>
          prev.map((m) => (m.id === msg.data.id ? { ...m, ...msg.data } : m))
        );
      }

      // 2. Commentary push for a subscribed match → update blurb + flash card
      if (msg.type === 'commentary') {
        const matchId = msg.data?.matchId ?? msg.data?.match_id;
        if (!matchId) return;

        // Update the last-commentary blurb for this match card
        setLiveBlurbs(prev => ({ ...prev, [matchId]: msg.data.message }));

        // Increment the live commentary counter for this match
        setLiveCounts(prev => ({ ...prev, [matchId]: (prev[matchId] ?? 0) + 1 }));

        // Flash the card outline for 2s
        setUpdatedIds(prev => new Set([...prev, matchId]));
        clearTimeout(flashTimers.current[matchId]);
        flashTimers.current[matchId] = setTimeout(() => {
          setUpdatedIds(prev => {
            const next = new Set(prev);
            next.delete(matchId);
            return next;
          });
        }, 2000);

        // Also merge incoming match data if the WS payload includes it
        // (some backends enrich the commentary broadcast with match context)
        if (msg.data?.homeScore != null || msg.data?.awayScore != null) {
          setMatches(prev => prev.map(m =>
            m.id === matchId
              ? {
                  ...m,
                  homeScore: msg.data.homeScore ?? m.homeScore,
                  awayScore: msg.data.awayScore ?? m.awayScore,
                  status:    msg.data.status    ?? m.status,
                }
              : m
          ));
        }
      }
    });
  }, [onMessage]);

  // ── Cleanup flash timers ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => Object.values(flashTimers.current).forEach(clearTimeout);
  }, []);

  const canCreate = user?.role === 'commentator' || user?.role === 'admin';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Live Matches</h1>
          <p style={{ color: 'var(--c-text2)', marginTop: 4, fontSize: '0.9rem' }}>
            Real-time sports data — subscribe to a match to get instant commentary
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
            {[
              { key: '', label: 'All' },
              { key: 'live', label: 'Live' },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'finished', label: 'Finished' },
            ].map(({ key, label }) => (
              <button
                key={key || 'all'}
                type="button"
                className={`btn btn-sm ${statusFilter === key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <input
              className="input"
              type="search"
              placeholder="Search team name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ maxWidth: 280, minWidth: 160 }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearchInput('')}>
              Clear search
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Create Match
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={load} title="Refresh matches">
            ↻ Refresh
          </button>
        </div>
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
          <p>
            Matches will appear here once created.{' '}
            {canCreate && 'Use the button above to add one.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {matches.map(m => (
            <MatchCard
              key={m.id}
              match={m}
              liveScore={liveScores[m.id]}
              isSubscribed={subscribedMatchIds.has(m.id)}
              liveBlurb={liveBlurbs[m.id]}
              liveCount={liveCounts[m.id] ?? 0}
              isUpdated={updatedIds.has(m.id)}
              onClick={() => onSelectMatch(m)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateMatchModal
          onClose={() => setShowCreate(false)}
          onCreated={(m) => {
            setMatches(prev => prev.some(x => x.id === m.id) ? prev : [m, ...prev]);
            setShowCreate(false);
            toast.success('Match created!');
          }}
        />
      )}
    </div>
  );
}

function MatchCard({ match, liveScore, isSubscribed, liveBlurb, liveCount, isUpdated, onClick }) {
  // Prefer live WS score if available, otherwise fall back to HTTP fetch data
  const homeScore = liveScore?.homeScore ?? match.homeScore;
  const awayScore = liveScore?.awayScore ?? match.awayScore;
  const label = scoreLabel(match.sport);
  const hasLiveScore = liveScore != null && (homeScore > 0 || awayScore > 0);
  return (
    <div
      className={`match-card status-${match.status}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        outline: isUpdated ? '2px solid rgba(52,211,153,0.6)' : '2px solid transparent',
        transition: 'outline 0.4s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Green flash overlay when a commentary push arrives */}
      {isUpdated && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(52,211,153,0.05)',
          pointerEvents: 'none',
          borderRadius: 'inherit',
          animation: 'fadeOut 2s ease forwards',
        }} />
      )}

      {/* Card header: sport + subscription badge + status */}
      <div className="match-card-header">
        <span className="match-sport">
          {sportEmoji(match.sport)} {match.sport.charAt(0).toUpperCase() + match.sport.slice(1)}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isSubscribed && (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              color: '#22c55e',
              background: 'rgba(34,197,94,0.13)',
              borderRadius: 6,
              padding: '1px 7px',
              letterSpacing: '0.03em',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}>
              🔔
              {liveCount > 0 && (
                <span style={{
                  background: '#22c55e',
                  color: '#000',
                  borderRadius: 10,
                  padding: '0 5px',
                  fontSize: '0.6rem',
                  fontWeight: 900,
                  minWidth: 16,
                  textAlign: 'center',
                }}>
                  {liveCount}
                </span>
              )}
            </span>
          )}
          <StatusBadge status={match.status} />
        </div>
      </div>

      {/* Scoreboard */}
      <div className="match-teams">
        <div className="team-info">
          <div className="team-name">{match.homeTeam}</div>
          <div className="score" style={{ color: hasLiveScore ? 'var(--c-accent)' : undefined }}>
            {homeScore}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--c-text3)', marginTop: 2 }}>{label}</div>
        </div>
        <span className="score-divider">:</span>
        <div className="team-info">
          <div className="team-name">{match.awayTeam}</div>
          <div className="score" style={{ color: hasLiveScore ? 'var(--c-accent)' : undefined }}>
            {awayScore}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--c-text3)', marginTop: 2 }}>{label}</div>
        </div>
      </div>

      {/* Live commentary blurb — only shown for subscribed matches with activity */}
      {isSubscribed && liveBlurb && (
        <div style={{
          margin: '8px 0 2px',
          padding: '6px 10px',
          background: 'rgba(52,211,153,0.07)',
          borderRadius: 7,
          borderLeft: '3px solid rgba(52,211,153,0.45)',
          fontSize: '0.75rem',
          color: 'var(--c-text2)',
          lineHeight: 1.4,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#22c55e',
            flexShrink: 0,
            animation: 'pulse 1.5s infinite',
          }} />
          {liveBlurb}
        </div>
      )}

      {/* Non-subscribed hint when there's live activity */}
      {!isSubscribed && liveCount > 0 && (
        <div style={{
          margin: '8px 0 2px',
          padding: '4px 10px',
          background: 'rgba(124,156,255,0.06)',
          borderRadius: 6,
          fontSize: '0.72rem',
          color: 'var(--c-text3)',
        }}>
          🔕 Subscribe to see live commentary
        </div>
      )}

      <div className="match-footer">
        <span>{formatDateTime(match.startTime)}</span>
        <span style={{ color: 'var(--c-accent)', fontSize: '0.78rem' }}>View →</span>
      </div>
    </div>
  );
}
