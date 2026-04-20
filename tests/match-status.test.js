import test, { describe } from 'node:test';
import assert from 'node:assert';
import { getMatchStatus } from '../src/utils/match-status.js';
import { MATCH_STATUS } from '../src/validation/matches.js';

describe('getMatchStatus', () => {
  test('returns null when dates are invalid', () => {
    assert.strictEqual(getMatchStatus('invalid-date', 'invalid-date'), null);
  });

  test('returns scheduled before start', () => {
    const now = new Date();
    const start = new Date(now.getTime() + 60_000).toISOString();
    const end = new Date(now.getTime() + 120_000).toISOString();
    assert.strictEqual(getMatchStatus(start, end, now), MATCH_STATUS.SCHEDULED);
  });

  test('returns live between start and end', () => {
    const now = new Date();
    const start = new Date(now.getTime() - 10_000).toISOString();
    const end = new Date(now.getTime() + 10_000).toISOString();
    assert.strictEqual(getMatchStatus(start, end, now), MATCH_STATUS.LIVE);
  });

  test('returns finished at or after end', () => {
    const now = new Date();
    const start = new Date(now.getTime() - 20_000).toISOString();
    const end = new Date(now.getTime() - 10_000).toISOString();
    assert.strictEqual(getMatchStatus(start, end, now), MATCH_STATUS.FINISHED);
  });
});
