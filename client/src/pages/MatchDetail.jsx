import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useWs } from '../contexts/WsContext';
import { useToast } from '../contexts/ToastContext';
import { sportEmoji, formatDateTime, eventTypeColor } from '../utils';
import { StatusBadge } from '../components/StatusBadge';

const EVENT_TYPES = ['goal', 'yellow_card', 'red_card', 'substitution', 'foul', 'penalty', 'corner', 'offside', 'injury', 'other'];

export default function MatchDetail({ match: initialMatch, onBack }) {
  const [match, setMatch]       = useState(initialMatch);
  const [tab, setTab]           = useState('commentary');
  const [commentary, setCommentary] = useState([]);
  const [events, setEvents]     = useState([]);
  const [loadingC, setLoadingC] = useState(true);
  const [loadingE, setLoadingE] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const feedRef = useRef(null);

  const { user } = useAuth();
  const { subscribe, unsubscribe, onMatchMessage } = useWs();
  const toast = useToast();

  // Fetch commentary & events on mount
  useEffect(() => {
    api.commentary.list(match.id)
      .then(r => setCommentary(r.data ?? []))
      .catch(() => toast.error('Failed to load commentary'))
      .finally(() => setLoadingC(false));

    if (user) {
      api.events.list(match.id)
        .then(r => setEvents(r.data ?? []))
        .catch(() => {})
        .finally(() => setLoadingE(false));
    } else {
      setLoadingE(false);
    }
  }, [match.id, user]);

  // Check subscription status
  useEffect(() => {
    if (!user) return;
    api.subscriptions.list().then(r => {
      setSubscribed(r.data?.some(s => s.matchId === match.id) ?? false);
    }).catch(() => {});
  }, [match.id, user]);

  // WebSocket subscribe/dispatch
  useEffect(() => {
    if (!user) return;
    subscribe(match.id);
    const unsub = onMatchMessage(match.id, (msg) => {
      if (msg.type === 'commentary') {
        setCommentary(prev => [msg.data, ...prev]);
      }
      if (msg.type === 'match_event') {
        setEvents(prev => [msg.data, ...prev]);
      }
    });
    return () => {
      unsubscribe(match.id);
      unsub();
    };
  }, [match.id, user, subscribe, unsubscribe, onMatchMessage]);

  const handleSubscribe = async () => {
    if (!user) { toast.info('Sign in to subscribe'); return; }
    setSubLoading(true);
    try {
      if (subscribed) {
        await api.subscriptions.unsubscribe(match.id);
        setSubscribed(false);
        toast.success('Unsubscribed');
      } else {
        await api.subscriptions.subscribe(match.id);
        setSubscribed(true);
        toast.success('Subscribed! You\'ll get real-time updates.');
      }
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setSubLoading(false);
    }
  };

  const canComment = user?.role === 'commentator' || user?.role === 'admin';

  return (
    <div className="page">
      {/* Back */}
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>
        ← Back to Matches
      </button>

      {/* Hero scoreboard */}
      <div className="match-detail-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--c-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {sportEmoji(match.sport)} {match.sport}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={match.status} />
            <button
              className={`btn btn-sm ${subscribed ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleSubscribe}
              disabled={subLoading}
            >
              {subLoading ? <span className="spinner spinner-sm" /> : (subscribed ? '🔔 Subscribed' : '🔔 Subscribe')}
            </button>
          </div>
        </div>

        <div className="match-scoreboard">
          <div className="team-block">
            <div className="name">{match.homeTeam}</div>
            <div className="scoreboard-score">{match.homeScore}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text3)', marginTop: 4 }}>Home</div>
          </div>

          <div className="vs-divider">
            <span style={{ fontSize: '1.5rem' }}>VS</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--c-text3)' }}>{formatDateTime(match.startTime)}</span>
          </div>

          <div className="team-block">
            <div className="name">{match.awayTeam}</div>
            <div className="scoreboard-score">{match.awayScore}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text3)', marginTop: 4 }}>Away</div>
          </div>
        </div>
      </div>

      {/* Tabs & content */}
      <div className="match-layout">
        <div>
          <div className="tab-bar">
            <button className={`tab ${tab === 'commentary' ? 'active' : ''}`} onClick={() => setTab('commentary')}>
              💬 Commentary
            </button>
            {user && (
              <button className={`tab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
                ⚡ Match Events
              </button>
            )}
          </div>

          {tab === 'commentary' && (
            <CommentaryTab
              matchId={match.id}
              commentary={commentary}
              loading={loadingC}
              canComment={canComment}
              onAdded={(c) => setCommentary(prev => [c, ...prev])}
            />
          )}

          {tab === 'events' && user && (
            <EventsTab
              matchId={match.id}
              events={events}
              loading={loadingE}
              canCreate={canComment}
              onAdded={(ev) => setEvents(prev => [ev, ...prev])}
            />
          )}
        </div>

        {/* Sidebar: post commentary form (always visible for commentators) */}
        {canComment && tab === 'commentary' && (
          <CommentaryForm matchId={match.id} onAdded={(c) => setCommentary(prev => [c, ...prev])} />
        )}
      </div>
    </div>
  );
}

/* ─── Commentary Tab ─────────────────────────────────────────── */
function CommentaryTab({ matchId, commentary, loading, canComment, onAdded }) {
  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner"/></div>;
  if (!commentary.length) return (
    <div className="empty-state"><span className="icon">💬</span><p>No commentary yet. Be the first!</p></div>
  );
  return (
    <div className="commentary-feed" ref={null}>
      {commentary.map((c, i) => (
        <div key={c.id} className={`commentary-item ${i === 0 ? 'realtime' : ''}`}>
          <span className="commentary-minute">{c.minute != null ? `${c.minute}'` : '—'}</span>
          <div className="commentary-body">
            <div className="commentary-message">{c.message}</div>
            <div className="commentary-meta">
              {c.actor && <span>{c.actor} · </span>}
              {c.period && <span>{c.period} · </span>}
              {c.eventType && <span>{c.eventType} · </span>}
              <span>{formatDateTime(c.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentaryForm({ matchId, onAdded }) {
  const toast = useToast();
  const [form, setForm] = useState({ message: '', minute: '', period: '', eventType: '', actor: '', team: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { message: form.message };
      if (form.minute) payload.minute = Number(form.minute);
      if (form.period) payload.period = form.period;
      if (form.eventType) payload.eventType = form.eventType;
      if (form.actor) payload.actor = form.actor;
      if (form.team) payload.team = form.team;

      const res = await api.commentary.create(matchId, payload);
      onAdded(res.data);
      setForm({ message: '', minute: '', period: '', eventType: '', actor: '', team: '' });
      toast.success('Commentary posted!');
    } catch (err) {
      toast.error(err.message || 'Failed to post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <p className="panel-title">Post Commentary</p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Message *</label>
          <textarea
            className="input"
            rows={3}
            style={{ resize: 'vertical' }}
            placeholder="Describe the action..."
            value={form.message}
            onChange={set('message')}
            required
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Minute</label>
            <input className="input" type="number" min={0} max={200} placeholder="45" value={form.minute} onChange={set('minute')} />
          </div>
          <div className="form-group">
            <label className="form-label">Period</label>
            <input className="input" placeholder="1st half" value={form.period} onChange={set('period')} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Event Type</label>
            <input className="input" placeholder="goal, foul..." value={form.eventType} onChange={set('eventType')} />
          </div>
          <div className="form-group">
            <label className="form-label">Actor</label>
            <input className="input" placeholder="Player name" value={form.actor} onChange={set('actor')} />
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? <><span className="spinner spinner-sm" />&nbsp;Posting…</> : 'Post'}
        </button>
      </form>
    </div>
  );
}

/* ─── Events Tab ─────────────────────────────────────────────── */
function EventsTab({ matchId, events, loading, canCreate, onAdded }) {
  const [showForm, setShowForm] = useState(false);

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner"/></div>;

  return (
    <div>
      {canCreate && (
        <div className="section-heading">
          <span className="section-title">Match Events</span>
          <button className="btn btn-sm btn-primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ Log Event'}
          </button>
        </div>
      )}

      {canCreate && showForm && <EventForm matchId={matchId} onAdded={(ev) => { onAdded(ev); setShowForm(false); }} />}

      {!events.length ? (
        <div className="empty-state"><span className="icon">⚡</span><p>No events logged yet.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map((ev, i) => <EventItem key={ev.id} event={ev} isNew={i === 0} />)}
        </div>
      )}
    </div>
  );
}

function EventItem({ event, isNew }) {
  const { bg, color } = eventTypeColor(event.eventType);
  return (
    <div className="event-item" style={{ borderColor: isNew ? `${color}33` : undefined }}>
      <div style={{ flexShrink: 0 }}>
        <span className="event-type-badge" style={{ background: bg, color, borderColor: `${color}44` }}>
          {event.eventType}
        </span>
        {event.minute != null && (
          <div style={{ fontSize: '0.75rem', color: 'var(--c-text3)', marginTop: 4, textAlign: 'center' }}>
            {event.minute}'
          </div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div className="event-payload">
          {JSON.stringify(event.payload, null, 2)}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--c-text3)', marginTop: 6, display: 'flex', gap: 8 }}>
          {event.period && <span>{event.period}</span>}
          {event.createdBy?.username && <span>by @{event.createdBy.username}</span>}
          <span>{formatDateTime(event.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function EventForm({ matchId, onAdded }) {
  const toast = useToast();
  const [form, setForm] = useState({ event_type: 'goal', payload: '{"player":"","team":""}', minute: '', period: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    let payload;
    try { payload = JSON.parse(form.payload); }
    catch { toast.error('Payload must be valid JSON'); return; }

    setLoading(true);
    try {
      const res = await api.events.create(matchId, {
        event_type: form.event_type,
        payload,
        minute: form.minute ? Number(form.minute) : undefined,
        period: form.period || undefined,
      });
      onAdded(res.data);
      toast.success('Event logged!');
    } catch (err) {
      toast.error(err.message || 'Failed to log event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Event Type *</label>
            <select className="input" value={form.event_type} onChange={set('event_type')}>
              {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Minute</label>
            <input className="input" type="number" min={0} placeholder="45" value={form.minute} onChange={set('minute')} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Period</label>
          <input className="input" placeholder="1st half / 2nd innings…" value={form.period} onChange={set('period')} />
        </div>

        <div className="form-group">
          <label className="form-label">Payload (JSON) *</label>
          <textarea
            className="input mono"
            rows={4}
            style={{ resize: 'vertical', fontFamily: 'JetBrains Mono,monospace', fontSize:'0.82rem' }}
            value={form.payload}
            onChange={set('payload')}
            required
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? <><span className="spinner spinner-sm" />&nbsp;Logging…</> : 'Log Event'}
        </button>
      </form>
    </div>
  );
}
