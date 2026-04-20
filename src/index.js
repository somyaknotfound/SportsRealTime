import 'dotenv/config'; // Load env vars before anything else
import AgentAPI from 'apminsight';

// Configure APM from environment variable
const apmKey = process.env.APM_LICENSE_KEY;
if (apmKey) {
  try {
    AgentAPI.config({
      licenseKey: apmKey,
      appName: process.env.APM_APP_NAME || 'SportRealTime',
      port: Number(process.env.APM_PORT || 10000),
    });
    console.log('APM Agent configured.');
  } catch (e) {
    console.error('Failed to configure APM Agent:', e);
  }
} else {
  console.warn('APM_LICENSE_KEY not set; APM agent disabled.');
}

import express from 'express';
import http from 'http';

// Existing routers
import { matchRouter }     from './routes/matches.js';
import { commentaryRouter } from './routes/commentary.js';

// New routers
import { authRouter }          from './routes/auth.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { eventsRouter }        from './routes/events.js';
import { notificationsRouter } from './routes/notifications.js';

import { attachWebSocketServer } from './ws/server.js';
import { securityMiddleware }    from './arcjet.js';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

const app    = express();
const server = http.createServer(app);

app.use(express.json());

// Root health-check
app.get('/', (_req, res) => res.json({ message: 'Server is running' }));

// Optional security middleware (uncomment to enable globally)
// app.use(securityMiddleware());

// ── WebSocket server (must init before routes use broadcast functions) ────────
const { broadcastMatchCreated, broadcastCommentary, broadcastMatchEvent, broadcastMatchStatus } =
  attachWebSocketServer(server);

app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary   = broadcastCommentary;
app.locals.broadcastMatchEvent   = broadcastMatchEvent;
app.locals.broadcastMatchStatus  = broadcastMatchStatus;

// ── Routes ────────────────────────────────────────────────────────────────────

// Auth
app.use('/auth', authRouter);

// Existing — matches and commentary (preserved, backwards-compatible)
app.use('/matches', matchRouter);
app.use('/matches/:id/commentary', commentaryRouter);

// New — match events (mergeParams lets :id flow into eventsRouter)
app.use('/matches/:id/events', eventsRouter);

// Subscriptions
app.use('/subscriptions', subscriptionsRouter);

// Notifications
app.use('/notifications', notificationsRouter);

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server listening at ${baseUrl}`);
  console.log(`WebSocket Server is running on ${baseUrl.replace('http', 'ws')}/ws`);
});