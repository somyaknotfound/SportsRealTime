import { Router } from 'express';
import { db } from '../db/db.js';
import { notifications } from '../db/schema.js';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';

export const notificationsRouter = Router();

// All notification routes require authentication
notificationsRouter.use(authenticate);

const listQuerySchema = z.object({
  unread_only: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ── GET /notifications ───────────────────────────────────────────────────────
notificationsRouter.get('/', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query parameters.', details: parsed.error.issues });
  }

  const { unread_only, limit } = parsed.data;

  try {
    const conditions = [eq(notifications.userId, req.user.id)];

    if (unread_only) {
      conditions.push(isNull(notifications.readAt));
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('List notifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// ── PATCH /notifications/read-all ────────────────────────────────────────────
notificationsRouter.patch('/read-all', async (req, res) => {
  try {
    const result = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, req.user.id),
          isNull(notifications.readAt)           // only update unread rows
        )
      );

    // mysql2 gives affected rows in result[0].affectedRows
    const affectedRows = Array.isArray(result) && result[0]?.affectedRows != null
      ? result[0].affectedRows
      : result.affectedRows ?? 0;

    return res.status(200).json({ data: { updated: affectedRows } });
  } catch (err) {
    console.error('Read-all notifications error:', err);
    return res.status(500).json({ error: 'Failed to mark notifications as read.' });
  }
});
