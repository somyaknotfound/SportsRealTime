// Central API client — all requests go through here

const BASE = '';  // Vite proxy handles /auth, /matches, etc.

function getToken() {
  return localStorage.getItem('srt_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content
  if (res.status === 204) return null;

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || 'Request failed');
    err.status = res.status;
    err.details = json.details;
    throw err;
  }
  return json;
}

const get  = (path)        => request('GET',    path);
const post = (path, body)  => request('POST',   path, body);
const del  = (path)        => request('DELETE', path);
const patch = (path, body) => request('PATCH',  path, body);

// ── AUTH ─────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (data)  => post('/auth/register', data),
    login:    (data)  => post('/auth/login', data),
    logout:   ()      => post('/auth/logout'),
    me:       ()      => get('/auth/me'),
  },

  // ── MATCHES ──────────────────────────────────────────────────────────────
  matches: {
    list:   (limit = 50) => get(`/matches?limit=${limit}`),
    create: (data)       => post('/matches', data),
  },

  // ── COMMENTARY ───────────────────────────────────────────────────────────
  commentary: {
    list:   (matchId, limit = 100) => get(`/matches/${matchId}/commentary?limit=${limit}`),
    create: (matchId, data)        => post(`/matches/${matchId}/commentary`, data),
  },

  // ── MATCH EVENTS ─────────────────────────────────────────────────────────
  events: {
    list:   (matchId, params = {}) => {
      const q = new URLSearchParams(params).toString();
      return get(`/matches/${matchId}/events${q ? '?' + q : ''}`);
    },
    create: (matchId, data) => post(`/matches/${matchId}/events`, data),
  },

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
  subscriptions: {
    list:        ()        => get('/subscriptions'),
    subscribe:   (matchId) => post('/subscriptions', { match_id: matchId }),
    unsubscribe: (matchId) => del(`/subscriptions/${matchId}`),
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  notifications: {
    list:    (unreadOnly = false) => get(`/notifications?unread_only=${unreadOnly}`),
    readAll: ()                   => patch('/notifications/read-all'),
  },
};
