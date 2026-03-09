import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { WebSocket } from 'ws';

// Set ARCJET_KEY BEFORE importing anything else
process.env.ARCJET_KEY = 'test_key';

test('WebSocket server handles invalid JSON gracefully', async (t) => {
    // Dynamic import to ensure process.env.ARCJET_KEY is set first
    const { attachWebSocketServer } = await import('../src/ws/server.js');
    const { wsArcjet } = await import('../src/arcjet.js');

    // Setup
    const server = http.createServer();
    const wsServer = attachWebSocketServer(server);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    // We'll collect messages received by the client
    const messages = [];

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            // resolve gracefully to allow the assertions to run
            resolve();
        }, 1000);

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            messages.push(msg);

            // First message is expected to be 'welcome'
            if (msg.type === 'welcome') {
                // Send invalid JSON
                ws.send('this is not valid json');
            }

            // Wait for the error message
            if (msg.type === 'error') {
                clearTimeout(timeout);
                resolve();
            }
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });

    // Teardown early so test completes cleanly even on assertion failure
    ws.close();
    wsServer.close();
    server.close();

    // Verify
    assert.strictEqual(messages.length, 2, 'Should have received two messages: welcome and error');
    assert.deepStrictEqual(messages[0], { type: 'welcome' });
    assert.deepStrictEqual(messages[1], { type: 'error', message: 'Invalid JSON' });

});
