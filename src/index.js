import AgentAPI from 'apminsight';

// Configure APM from environment variable and avoid reading secrets from repo
const apmKey = process.env.APM_LICENSE_KEY;
if (apmKey) {
  try {
    // Prefer explicit config via env var to avoid embedding secrets in files
    AgentAPI.config({ licenseKey: apmKey, appName: process.env.APM_APP_NAME || 'SportRealTime', port: Number(process.env.APM_PORT || 10000) });
    console.log('APM Agent configured.');
  } catch (e) {
    console.error('Failed to configure APM Agent:', e);
  }
} else {
  console.warn('APM_LICENSE_KEY not set; APM agent disabled.');
}

import express from 'express';
import http from 'http';
import { matchRouter } from './routes/matches.js';
import { attachWebSocketServer } from './ws/server.js'; // Remove broadcastCommentary from here
import { securityMiddleware } from './arcjet.js';
import { commentaryRouter } from './routes/commentary.js';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
const app = express();
app.use(express.json());
const server = http.createServer(app);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Security middleware protecting the REST APIs
app.use(securityMiddleware());

// Initialize WebSocket FIRST (before using broadcast functions)
const { broadcastMatchCreated, broadcastCommentary } = attachWebSocketServer(server);

// Make broadcast functions available to routes
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

// Routes
app.use('/matches', matchRouter);
app.use('/matches/:id/commentary', commentaryRouter); // Use commentaryRouter, not broadcastCommentary

// Start server
server.listen(PORT, HOST, () => {
    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
    console.log(`Server listening at ${baseUrl}`);
    console.log(`WebSocket Server is running on ${baseUrl.replace('http', 'ws')}/ws`);
});