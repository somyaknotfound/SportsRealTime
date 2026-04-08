import { z } from 'zod';

export const createEventSchema = z.object({
  event_type: z.string().min(1, 'event_type is required.').max(50),
  payload:    z.record(z.string(), z.any()),          // arbitrary JSON object
  minute:     z.number().int().min(0).max(120).optional(),
  period:     z.string().max(20).optional(),
});

export const listEventsQuerySchema = z.object({
  limit:      z.coerce.number().int().positive().max(100).default(50),
  event_type: z.string().optional(),
  before_id:  z.coerce.number().int().positive().optional(), // cursor pagination
});
