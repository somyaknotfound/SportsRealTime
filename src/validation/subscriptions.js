import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  match_id: z.coerce.number().int().positive('match_id must be a positive integer.'),
});

export const subscriptionMatchParamSchema = z.object({
  matchId: z.coerce.number().int().positive(),
});
