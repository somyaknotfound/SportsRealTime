import { test, mock } from 'node:test';
import assert from 'node:assert';

const mockArcjetInstance = {
    protect: mock.fn(async () => {
        return {
            isDenied: () => false,
            reason: {
                isRateLimit: () => false
            }
        };
    })
};

mock.module('@arcjet/node', {
  namedExports: {
    detectBot: () => ({}),
    shield: () => ({}),
    slidingWindow: () => ({})
  },
  defaultExport: () => mockArcjetInstance
});

process.env.ARCJET_KEY = 'test';

const { securityMiddleware } = await import('../src/arcjet.js');

test('securityMiddleware allows request when Arcjet allows', async () => {
    mockArcjetInstance.protect.mock.mockImplementationOnce(async () => ({
        isDenied: () => false
    }));

    const req = {};
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const middleware = securityMiddleware();
    await middleware(req, res, next);

    assert.strictEqual(nextCalled, true);
});

test('securityMiddleware returns 429 when rate limited', async () => {
    mockArcjetInstance.protect.mock.mockImplementationOnce(async () => ({
        isDenied: () => true,
        reason: {
            isRateLimit: () => true
        }
    }));

    const req = {};
    let statusCalledWith = null;
    let jsonCalledWith = null;

    const res = {
        status: (code) => {
            statusCalledWith = code;
            return res;
        },
        json: (data) => {
            jsonCalledWith = data;
        }
    };
    const next = mock.fn();

    const middleware = securityMiddleware();
    await middleware(req, res, next);

    assert.strictEqual(statusCalledWith, 429);
    assert.deepStrictEqual(jsonCalledWith, { error: 'Too many requests.' });
    assert.strictEqual(next.mock.callCount(), 0);
});

test('securityMiddleware returns 403 when otherwise denied', async () => {
    mockArcjetInstance.protect.mock.mockImplementationOnce(async () => ({
        isDenied: () => true,
        reason: {
            isRateLimit: () => false
        }
    }));

    const req = {};
    let statusCalledWith = null;
    let jsonCalledWith = null;

    const res = {
        status: (code) => {
            statusCalledWith = code;
            return res;
        },
        json: (data) => {
            jsonCalledWith = data;
        }
    };
    const next = mock.fn();

    const middleware = securityMiddleware();
    await middleware(req, res, next);

    assert.strictEqual(statusCalledWith, 403);
    assert.deepStrictEqual(jsonCalledWith, { error: 'Forbidden.' });
    assert.strictEqual(next.mock.callCount(), 0);
});

test('securityMiddleware returns 503 when protect throws', async (t) => {
    // Suppress console.error for this specific test
    const originalConsoleError = console.error;
    console.error = () => {};

    t.after(() => {
        console.error = originalConsoleError;
    });

    mockArcjetInstance.protect.mock.mockImplementationOnce(async () => {
        throw new Error('Arcjet failure');
    });

    const req = {};
    let statusCalledWith = null;
    let jsonCalledWith = null;

    const res = {
        status: (code) => {
            statusCalledWith = code;
            return res;
        },
        json: (data) => {
            jsonCalledWith = data;
        }
    };
    const next = mock.fn();

    const middleware = securityMiddleware();
    await middleware(req, res, next);

    assert.strictEqual(statusCalledWith, 503);
    assert.deepStrictEqual(jsonCalledWith, { error: 'Service Unavailable' });
    assert.strictEqual(next.mock.callCount(), 0);
});
