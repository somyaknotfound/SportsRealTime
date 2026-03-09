import { describe, it, expect } from 'vitest';
import { createMatchSchema, updateScoreSchema } from './matches.js';

describe('createMatchSchema', () => {
  it('validates a correct payload', () => {
    const payload = {
      sport: 'football',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      endTime: new Date('2024-01-01T12:00:00Z').toISOString(),
      homeScore: 0,
      awayScore: 0,
    };
    const result = createMatchSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('fails if endTime is before startTime', () => {
    const payload = {
      sport: 'football',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      startTime: new Date('2024-01-01T12:00:00Z').toISOString(),
      endTime: new Date('2024-01-01T10:00:00Z').toISOString(),
    };
    const result = createMatchSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe("endTime must be chronologically after startTime");
  });

  it('fails if sport or teams are empty strings', () => {
    const payload = {
      sport: '',
      homeTeam: '',
      awayTeam: '',
      startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      endTime: new Date('2024-01-01T12:00:00Z').toISOString(),
    };
    const result = createMatchSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe('updateScoreSchema', () => {
  it('validates correct scores', () => {
    const payload = { homeScore: 2, awayScore: 1 };
    const result = updateScoreSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('fails if scores are negative', () => {
    const payload = { homeScore: -1, awayScore: 1 };
    const result = updateScoreSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
