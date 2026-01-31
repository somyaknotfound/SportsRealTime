import { WebSocket, WebSocketServer } from "ws";

function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) {
        return;
    }
    socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;
        client.send(JSON.stringify(payload));
    }
}

// Attach websocket logic
export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024,
    });

    // Handle connections
    wss.on('connection', (socket) => {
        socket.isAlive = true;
        
        // Send welcome message
        sendJson(socket, { type: 'welcome', message: 'Connected to WebSocket server' });

        // Handle pong responses
        socket.on('pong', () => {
            socket.isAlive = true;
        });

        socket.on('error', console.error);

        socket.on('close', () => {
            console.log('Client disconnected');
        });
    });

    // Heartbeat mechanism - ping clients every 30 seconds
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    // Clean up interval when server closes
    wss.on('close', () => {
        clearInterval(interval);
    });

    // Return broadcast functions
    return {
        broadcastMatchCreated(match) {
            broadcast(wss, { type: 'match_created', data: match });
        },
        broadcastMatchUpdated(match) {
            broadcast(wss, { type: 'match_updated', data: match });
        },
        broadcastCommentary(commentary) {
            broadcast(wss, { type: 'commentary', data: commentary });
        }
    };
}