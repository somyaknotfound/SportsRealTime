import { useState, useEffect, useCallback, useRef } from 'react';
import { useWs } from '../contexts/WsContext';

const MAX_ITEMS = 5;   // how many entries to keep in the bar
const TTL_MS   = 8000; // how long each item stays visible

/**
 * LiveActivityBar
 * ───────────────
 * A thin sticky strip that sits right below the navbar.
 * Shows the last few real-time commentary / match-event pushes as
 * one-liner chips — never covers the match grid.
 *
 * Only rendered while there are active items (collapses to zero height otherwise).
 */
export default function LiveActivityBar() {
  const { onMessage } = useWs();
  const [items, setItems] = useState([]);
  const timers = useRef({});
  let idCounter = useRef(0);

  const remove = useCallback((id) => {
    setItems(prev => prev.filter(x => x.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const add = useCallback((item) => {
    const id = ++idCounter.current;
    const entry = { ...item, id };

    setItems(prev => {
      const next = [entry, ...prev];
      return next.slice(0, MAX_ITEMS);
    });

    timers.current[id] = setTimeout(() => remove(id), TTL_MS);
  }, [remove]);

  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === 'commentary' && msg.data?.message) {
        const d = msg.data;
        add({
          kind:    'commentary',
          badge:   d.eventType ?? 'update',
          isGoal:  d.eventType === 'goal',
          text:    d.message,
          matchId: d.matchId,
        });
      }

      if (msg.type === 'match_event' && msg.data) {
        const d = msg.data;
        const payloadStr = d.payload
          ? Object.entries(d.payload)
              .filter(([, v]) => v)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')
          : '';
        add({
          kind:    'event',
          badge:   d.eventType ?? 'event',
          isGoal:  d.eventType === 'goal',
          text:    payloadStr || d.eventType,
          matchId: d.matchId,
        });
      }

      if (msg.type === 'match_created' && msg.data) {
        add({
          kind:    'match',
          badge:   'new match',
          isGoal:  false,
          text:    `${msg.data.homeTeam} vs ${msg.data.awayTeam}`,
          matchId: msg.data.id,
        });
      }
    });
  }, [onMessage, add]);

  // Cleanup on unmount
  useEffect(() => {
    return () => Object.values(timers.current).forEach(clearTimeout);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="activity-bar" role="status" aria-live="polite">
      <span className="activity-bar-label">Live</span>

      <div className="activity-bar-feed">
        {items.map((item, i) => (
          <span key={item.id} className="activity-bar-item" style={{ opacity: 1 - i * 0.18 }}>
            <span
              className={`activity-bar-badge ${item.kind === 'event' ? 'event' : ''} ${item.isGoal ? 'goal' : ''}`}
            >
              {item.badge}
            </span>
            <span className="activity-bar-text">{item.text}</span>
            {i < items.length - 1 && (
              <span style={{ color: 'var(--c-border2)', marginLeft: 4 }}>·</span>
            )}
          </span>
        ))}
      </div>

      {/* Dismiss all button */}
      <button
        onClick={() => {
          Object.values(timers.current).forEach(clearTimeout);
          timers.current = {};
          setItems([]);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--c-text3)',
          cursor: 'pointer',
          fontSize: '0.7rem',
          padding: '0 4px',
          flexShrink: 0,
          lineHeight: 1,
        }}
        title="Clear activity"
      >
        ✕
      </button>
    </div>
  );
}
