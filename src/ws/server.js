import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { db } from '../db/db.js';
import { subscriptions, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { wsArcjet } from '../arcjet.js';

// ── In-memory subscription map: matchId → Set<WebSocket> ─────────────────────
const matchSubscribers = new Map();

function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;
  subscribers.delete(socket);
  if (subscribers.size === 0) matchSubscribers.delete(matchId);
}

function cleanupSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;
  const message = JSON.stringify(payload);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

// ── JWT verification (non-throwing) ──────────────────────────────────────────
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// ── Restore persisted subscriptions for an authenticated user ─────────────────
async function restoreSubscriptions(socket) {
  if (!socket.user) return;

  try {
    const rows = await db
      .select({ matchId: subscriptions.matchId })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, socket.user.id),
          eq(subscriptions.isActive, true)
        )
      );

    for (const { matchId } of rows) {
      subscribe(matchId, socket);
      socket.subscriptions.add(matchId);
    }

    if (rows.length > 0) {
      sendJson(socket, {
        type:    'subscriptions_restored',
        matchIds: rows.map((r) => r.matchId),
      });
    }
  } catch (err) {
    console.error('Failed to restore subscriptions for user', socket.user?.id, err);
  }
}

// ── WebSocket message handler ─────────────────────────────────────────────────
async function handleMessage(socket, data) {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch {
    sendJson(socket, { type: 'error', message: 'Invalid JSON' });
    return;
  }

  // ── subscribe ──────────────────────────────────────────────────────────────
  if (message?.type === 'subscribe' && Number.isInteger(message.matchId)) {
    const matchId = message.matchId;
    subscribe(matchId, socket);
    socket.subscriptions.add(matchId);

    // Persist to DB if user is authenticated
    if (socket.user) {
      try {
        await db
          .insert(subscriptions)
          .values({ userId: socket.user.id, matchId, isActive: true })
          .onDuplicateKeyUpdate({
            set: { isActive: true, unsubscribedAt: null, subscribedAt: new Date() },
          });
      } catch (err) {
        console.error('WS subscribe DB persist error:', err);
      }
    }

    sendJson(socket, { type: 'subscribed', matchId });
    return;
  }

  // ── unsubscribe ────────────────────────────────────────────────────────────
  if (message?.type === 'unsubscribe' && Number.isInteger(message.matchId)) {
    const matchId = message.matchId;
    unsubscribe(matchId, socket);
    socket.subscriptions.delete(matchId);

    // Soft-delete in DB if authenticated
    if (socket.user) {
      try {
        await db
          .update(subscriptions)
          .set({ isActive: false, unsubscribedAt: new Date() })
          .where(
            and(
              eq(subscriptions.userId, socket.user.id),
              eq(subscriptions.matchId, matchId)
            )
          );
      } catch (err) {
        console.error('WS unsubscribe DB persist error:', err);
      }
    }

    sendJson(socket, { type: 'unsubscribed', matchId });
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    // ── Arcjet rate-limit / bot check ──────────────────────────────────────
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);
        if (decision.isDenied()) {
          const status = decision.reason.isRateLimit() ? '429 Too Many Requests' : '403 Forbidden';
          socket.write(`HTTP/1.1 ${status}\r\n\r\n`);
          socket.destroy();
          return;
        }
      } catch (e) {
        console.error('WS upgrade protection error:', e);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    // ── Optional JWT auth from query param ─────────────────────────────────
    // Attach token payload to the upgrade request so we can read it on connection
    const rawToken = url.searchParams.get('token');
    req._wsUser  = null;
    req._wsToken = rawToken;

    if (rawToken) {
      const payload = verifyToken(rawToken);
      if (payload) {
        try {
          // Fetch user to confirm account is still active
          const [user] = await db
            .select({
              id:        users.id,
              username:  users.username,
              email:     users.email,
              role:      users.role,
              avatarUrl: users.avatarUrl,
              isActive:  users.isActive,
            })
            .from(users)
            .where(eq(users.id, payload.sub))
            .limit(1);

          if (user && user.isActive) {
            req._wsUser = user;
          }
        } catch (err) {
          console.error('WS user lookup error:', err);
        }
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', async (socket, req) => {
    console.log('New WebSocket connection');

    socket.isAlive      = true;
    socket.subscriptions = new Set();
    socket.user          = req._wsUser ?? null; // null for anonymous users

    socket.on('pong', () => { socket.isAlive = true; });

    sendJson(socket, {
      type:          'welcome',
      authenticated: !!socket.user,
      username:      socket.user?.username ?? null,
    });

    // Auto-restore persisted subscriptions for authenticated users
    await restoreSubscriptions(socket);

    socket.on('message', (data) => handleMessage(socket, data));

    socket.on('close', () => {
      console.log('WebSocket closed');
      cleanupSubscriptions(socket);
    });

    socket.on('error', (err) => {
      console.error('WebSocket error:', err);
      socket.terminate();
    });
  });

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  // ── Broadcast helpers (returned to index.js via app.locals) ───────────────

  /** Broadcast a new match to ALL connected clients (unchanged behaviour) */
  function broadcastMatchCreated(match) {
    broadcastToAll(wss, { type: 'match_created', data: match });
  }

  /**
   * Broadcast a commentary entry to all in-memory subscribers of a match.
   * Enriched with author info when the commentary has a userId.
   * Backwards-compatible: type is still 'commentary'.
   */
  function broadcastCommentary(matchId, comment, author = null) {
    broadcastToMatch(matchId, {
      type: 'commentary',
      data: author ? { ...comment, author } : comment,
    });
  }

  /**
   * NEW — broadcast a structured match event (type: 'match_event').
   * Distinct from 'commentary' so existing clients aren't broken.
   */
  function broadcastMatchEvent(matchId, event) {
    broadcastToMatch(matchId, { type: 'match_event', data: event });
  }

  /** Full match row after status change — all clients can refresh listing/detail badges */
  function broadcastMatchStatus(match) {
    broadcastToAll(wss, { type: 'match_status', data: match });
  }

  return { broadcastMatchCreated, broadcastCommentary, broadcastMatchEvent, broadcastMatchStatus };
}