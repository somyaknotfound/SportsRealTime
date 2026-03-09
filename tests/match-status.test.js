import test, { describe } from 'node:test';
import assert from 'node:assert';
import { syncMatchStatus } from '../src/utils/match-status.js';
import { MATCH_STATUS } from '../src/validation/matches.js';

describe('syncMatchStatus', () => {
    test('returns current status and does not call updateStatus if dates are invalid', async (t) => {
        let updateCalled = false;
        const mockUpdateStatus = async (status) => {
            updateCalled = true;
        };

        const match = {
            status: MATCH_STATUS.SCHEDULED,
            startTime: 'invalid-date',
            endTime: 'invalid-date',
        };

        const result = await syncMatchStatus(match, mockUpdateStatus);

        assert.strictEqual(result, MATCH_STATUS.SCHEDULED);
        assert.strictEqual(updateCalled, false);
    });

    test('returns current status and does not call updateStatus if nextStatus matches current status', async (t) => {
        let updateCalled = false;
        const mockUpdateStatus = async (status) => {
            updateCalled = true;
        };

        const now = new Date();
        const past = new Date(now.getTime() - 10000).toISOString();
        const future = new Date(now.getTime() + 10000).toISOString();

        // If startTime is past and endTime is future, nextStatus is LIVE
        const match = {
            status: MATCH_STATUS.LIVE,
            startTime: past,
            endTime: future,
        };

        const result = await syncMatchStatus(match, mockUpdateStatus);

        assert.strictEqual(result, MATCH_STATUS.LIVE);
        assert.strictEqual(updateCalled, false);
    });

    test('calls updateStatus, updates match status, and returns nextStatus if it differs', async (t) => {
        let updateCalledWith = null;
        const mockUpdateStatus = async (status) => {
            updateCalledWith = status;
        };

        const now = new Date();
        const pastStart = new Date(now.getTime() - 20000).toISOString();
        const pastEnd = new Date(now.getTime() - 10000).toISOString();

        // If both times are in the past, nextStatus is FINISHED
        const match = {
            status: MATCH_STATUS.LIVE,
            startTime: pastStart,
            endTime: pastEnd,
        };

        const result = await syncMatchStatus(match, mockUpdateStatus);

        assert.strictEqual(result, MATCH_STATUS.FINISHED);
        assert.strictEqual(match.status, MATCH_STATUS.FINISHED);
        assert.strictEqual(updateCalledWith, MATCH_STATUS.FINISHED);
    });
});
