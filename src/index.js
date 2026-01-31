import express from 'express';
import http from 'http';
import { matchRouter } from './routes/matches.js'; // ADD .js
import { attachWebSocketServer } from './ws/server.js';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
const app = express();
app.use(express.json());
const server = http.createServer(app);


// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});


// express is a frame work built on top of nodejs http  module 
// create the http server to put on ws

// 



app.use('/matches', matchRouter);

// initialize ws
const { broadcastMatchCreated } = attachWebSocketServer(server);

app.locals.broadcastMatchCreated = broadcastMatchCreated;

// Start server
server.listen(PORT, HOST , () => {
    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server listening  ${baseUrl}`);
  console.log(`WebSocket Server is running on ${baseUrl.replace('http' , 'ws')}/ws`);
});