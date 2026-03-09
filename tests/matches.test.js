import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';

// Setup environment variables before importing code that requires them
process.env.DATABASE_URL_DIRECT = 'postgres://dummy:5432/dummy';

const { matchRouter } = await import('../src/routes/matches.js');
const { db } = await import('../src/db/db.js');

// Create the express app for testing
const app = express();
app.use(express.json());

// We'll define the mock broadcast later, but attach it to the app here
let lastBroadcastEvent = null;
app.locals.broadcastMatchCreated = (event) => {
    lastBroadcastEvent = event;
};

app.use('/matches', matchRouter);

// Set up some global state for mocking
let mockInsertResult = [];
let mockInsertShouldThrow = false;
let insertCallCount = 0;
let lastInsertValues = null;

// Mock db.insert
db.insert = (table) => {
    insertCallCount++;
    return {
        values: (data) => {
            lastInsertValues = data;
            return {
                returning: async () => {
                    if (mockInsertShouldThrow) {
                        throw new Error('Database insertion failed');
                    }
                    return mockInsertResult;
                }
            };
        }
    };
};

test('POST /matches', async (t) => {
    // Reset mocks before each test manually since test.beforeEach doesn't run reliably inside suites in this node version sometimes,
    // or just run it as a setup step for each test.
    const resetMocks = () => {
        mockInsertResult = [];
        mockInsertShouldThrow = false;
        insertCallCount = 0;
        lastInsertValues = null;
        lastBroadcastEvent = null;
    };

    await t.test('Happy path: Valid payload returns 201 and creates match', async () => {
        resetMocks();
        const payload = {
            sport: 'soccer',
            homeTeam: 'Team A',
            awayTeam: 'Team B',
            startTime: new Date('2024-01-01T12:00:00Z').toISOString(),
            endTime: new Date('2024-01-01T14:00:00Z').toISOString(),
            homeScore: 0,
            awayScore: 0
        };

        const expectedMockResult = {
            id: 1,
            ...payload,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };

        mockInsertResult = [expectedMockResult];

        const response = await request(app)
            .post('/matches')
            .send(payload);

        assert.strictEqual(response.status, 201);
        assert.deepStrictEqual(response.body.data, expectedMockResult);
        assert.strictEqual(insertCallCount, 1);

        // Assert broadcast
        assert.deepStrictEqual(lastBroadcastEvent, expectedMockResult);

        // Assert data passed to insert
        assert.strictEqual(lastInsertValues.sport, payload.sport);
        assert.strictEqual(lastInsertValues.homeTeam, payload.homeTeam);
        assert.strictEqual(lastInsertValues.awayTeam, payload.awayTeam);
        assert.ok(lastInsertValues.startTime instanceof Date);
        assert.ok(lastInsertValues.endTime instanceof Date);
    });

    await t.test('Validation Error condition: Invalid payload (missing fields)', async () => {
        resetMocks();
        const payload = {
            sport: 'soccer'
            // missing homeTeam, awayTeam, startTime, endTime
        };

        const response = await request(app)
            .post('/matches')
            .send(payload);

        assert.strictEqual(response.status, 400);
        assert.strictEqual(response.body.error, 'invalid payload');
        assert.ok(Array.isArray(response.body.details));
        assert.strictEqual(insertCallCount, 0);
        assert.strictEqual(lastBroadcastEvent, null);
    });

    await t.test('Validation Error condition: endTime before startTime', async () => {
        resetMocks();
        const payload = {
            sport: 'soccer',
            homeTeam: 'Team A',
            awayTeam: 'Team B',
            startTime: new Date('2024-01-01T14:00:00Z').toISOString(), // After end time
            endTime: new Date('2024-01-01T12:00:00Z').toISOString()
        };

        const response = await request(app)
            .post('/matches')
            .send(payload);

        assert.strictEqual(response.status, 400);
        assert.strictEqual(response.body.error, 'invalid payload');
        assert.ok(response.body.details.some(issue => issue.message === 'endTime must be chronologically after startTime'));
        assert.strictEqual(insertCallCount, 0);
        assert.strictEqual(lastBroadcastEvent, null);
    });

    await t.test('DB Error condition: Database error during insert', async () => {
        resetMocks();
        const payload = {
            sport: 'soccer',
            homeTeam: 'Team A',
            awayTeam: 'Team B',
            startTime: new Date('2024-01-01T12:00:00Z').toISOString(),
            endTime: new Date('2024-01-01T14:00:00Z').toISOString()
        };

        mockInsertShouldThrow = true;

        const response = await request(app)
            .post('/matches')
            .send(payload);

        assert.strictEqual(response.status, 500);
        assert.strictEqual(response.body.error, 'Failed to create Match');
        assert.strictEqual(response.body.details, 'Database insertion failed');
        assert.strictEqual(insertCallCount, 1);
        assert.strictEqual(lastBroadcastEvent, null); // should not broadcast
    });
});
