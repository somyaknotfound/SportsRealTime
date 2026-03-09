import { describe, it, expect } from 'vitest';
import { createCommentarySchema, listCommentaryQuerySchema } from './commentary.js';

describe('createCommentarySchema', () => {
  it('validates a correct payload', () => {
    const payload = {
      minute: 45,
      message: 'Goal for Team A!',
      eventType: 'goal',
    };
    const result = createCommentarySchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('fails if minute is missing', () => {
    const payload = {
      message: 'Goal for Team A!',
    };
    const result = createCommentarySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('fails if minute is negative', () => {
    const payload = {
      minute: -5,
      message: 'Goal for Team A!',
    };
    const result = createCommentarySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('fails if message is empty', () => {
    const payload = {
      minute: 45,
      message: '',
    };
    const result = createCommentarySchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe('listCommentaryQuerySchema', () => {
  it('validates correct limit', () => {
    const result = listCommentaryQuerySchema.safeParse({ limit: 10 });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(10);
  });

  it('fails if limit is negative', () => {
    const result = listCommentaryQuerySchema.safeParse({ limit: -10 });
    expect(result.success).toBe(false);
  });

  it('fails if limit is greater than 100', () => {
    const result = listCommentaryQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});
