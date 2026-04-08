import { Router } from 'express';
import { db } from '../db/db.js';
import { matchEvents, subscriptions, notifications, users } from '../db/schema.js';
import { eq, and, lt, desc } from 'drizzle-orm';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createEventSchema, listEventsQuerySchema } from '../validation/events.js';
import { matchIdParamSchema } from '../validation/matches.js';

// Must be mounted with mergeParams: true (or via app.use('/matches', ...))
export const eventsRouter = Router({ mergeParams: true });

// ── GET /matches/:id/events ──────────────────────────────────────────────────
eventsRouter.get('/', authenticate, async (req, res) => {
  const paramsParsed = matchIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json({ error: 'Invalid match ID.', details: paramsParsed.error.issues });
  }

  const queryParsed = listEventsQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return res.status(400).json({ error: 'Invalid query parameters.', details: queryParsed.error.issues });
  }

  const { id: matchId } = paramsParsed.data;
  const { limit, event_type, before_id } = queryParsed.data;

  try {
    const conditions = [eq(matchEvents.matchId, matchId)];

    if (event_type) {
      conditions.push(eq(matchEvents.eventType, event_type));
    }
    // Cursor pagination — return events older than before_id
    if (before_id) {
      conditions.push(lt(matchEvents.id, before_id));
    }

    const rows = await db
      .select({
        id:        matchEvents.id,
        matchId:   matchEvents.matchId,
        eventType: matchEvents.eventType,
        payload:   matchEvents.payload,
        minute:    matchEvents.minute,
        period:    matchEvents.period,
        createdAt: matchEvents.createdAt,
        createdBy: {
          id:        users.id,
          username:  users.username,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(matchEvents)
      .leftJoin(users, eq(matchEvents.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(matchEvents.createdAt))
      .limit(limit);

    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('List events error:', err);
    return res.status(500).json({ error: 'Failed to fetch match events.' });
  }
});

// ── POST /matches/:id/events ─────────────────────────────────────────────────
eventsRouter.post(
  '/',
  authenticate,
  requireRole('commentator', 'admin'),
  async (req, res) => {
    const paramsParsed = matchIdParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: 'Invalid match ID.', details: paramsParsed.error.issues });
    }

    const bodyParsed = createEventSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: 'Validation failed.', details: bodyParsed.error.issues });
    }

    const { id: matchId } = paramsParsed.data;
    const { event_type, payload, minute, period } = bodyParsed.data;

    try {
      // ── Transaction: insert event + fanout notifications ─────────────────
      let insertedEvent;

      await db.transaction(async (tx) => {
        // 1. Insert the match event
        const insertResult = await tx.insert(matchEvents).values({
          matchId,
          eventType:  event_type,
          payload,
          minute:     minute ?? null,
          period:     period ?? null,
          createdBy:  req.user.id,
        });

        const insertId = Array.isArray(insertResult) && insertResult[0]?.insertId
          ? insertResult[0].insertId
          : insertResult.insertId;

        // 2. Fetch the newly inserted event (no RETURNING in MySQL)
        const [event] = await tx
          .select()
          .from(matchEvents)
          .where(eq(matchEvents.id, insertId))
          .limit(1);

        insertedEvent = event;

        // 3. Fanout: get all active subscribers for this match
        const activeSubscribers = await tx
          .select({ userId: subscriptions.userId })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.matchId, matchId),
              eq(subscriptions.isActive, true)
            )
          );

        // 4. Insert one notification row per subscriber (batch insert)
        if (activeSubscribers.length > 0) {
          const notifRows = activeSubscribers.map(({ userId }) => ({
            userId,
            matchId,
            eventType:  event_type,
            message:    `[${event_type}] ${JSON.stringify(payload)}`,
            sourceId:   insertId,
            sourceType: 'match_event',
          }));

          await tx.insert(notifications).values(notifRows);
        }
      });

      // ── Broadcast via WebSocket to all in-memory match subscribers ───────
      if (req.app.locals.broadcastMatchEvent) {
        const author = {
          id:        req.user.id,
          username:  req.user.username,
          avatarUrl: req.user.avatarUrl ?? null,
        };
        req.app.locals.broadcastMatchEvent(matchId, { ...insertedEvent, author });
      }

      return res.status(201).json({ data: insertedEvent });
    } catch (err) {
      console.error('Create event error:', err);
      return res.status(500).json({ error: 'Failed to create match event.' });
    }
  }
);
