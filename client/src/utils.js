// Small utility helpers shared across components

export function formatTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function statusLabel(status) {
  return { live: 'Live', scheduled: 'Scheduled', finished: 'FT' }[status] ?? status;
}

export function sportEmoji(sport) {
  const map = {
    football: '⚽', soccer: '⚽',
    basketball: '🏀',
    baseball: '⚾',
    tennis: '🎾',
    cricket: '🏏',
    hockey: '🏒',
    rugby: '🏉',
    volleyball: '🏐',
    golf: '⛳',
  };
  return map[sport?.toLowerCase()] ?? '🏆';
}

export function eventTypeColor(type) {
  const map = {
    goal:        { bg: 'rgba(0,229,160,0.12)',  color: '#00e5a0' },
    red_card:    { bg: 'rgba(255,59,92,0.12)',  color: '#ff3b5c' },
    yellow_card: { bg: 'rgba(245,166,35,0.12)', color: '#f5a623' },
    substitution:{ bg: 'rgba(124,156,255,0.12)',color: '#7c9cff' },
    foul:        { bg: 'rgba(200,100,255,0.12)',color: '#c864ff' },
    penalty:     { bg: 'rgba(255,165,0,0.12)',  color: '#ffa500' },
  };
  return map[type?.toLowerCase()] ?? { bg: 'rgba(124,156,255,0.12)', color: '#7c9cff' };
}
