import{ WebSocket,  WebSocketServer } from "ws"
import { wsArcjet } from "../arcjet.js";

function sendJson(socket , payload) {
    if (socket.readyState != WebSocket.OPEN) {
        return;
    }

    socket.send(JSON.stringify(payload));

}

function broadcast(wss , payload) {
    
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;
        client.send(JSON.stringify(payload));


    }
}

// attach websocket logic


export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({
        server,path: '/ws',maxPayload: 1024 * 1024,});
    // paths specifically to be handled by websockets
    wss.on('connection' ,  async(socket) => {
        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    const code = decision.reason.isRateLimit() ? 1013 : 1008;
                    const reason = decision.reason.isRateLimit() ? 'Rate Limit Exceeded' : 'Access Denied';
                }
                
            } catch (e) {
                console.log('WS connection error:' , e);
                socket.close(1011, 'Server Security error');
                return;
            }
        }

        sendJson(socket , {type : 'Welcome'});

        socket.on('error' , console.error );
    })
    
    function broadcastMatchCreated(match) {
        broadcast(wss , {type : 'match_created' , data:match});
    }

    return {broadcastMatchCreated}
}