import { Router } from 'express';
import { db } from '../db/db.js';
import { subscriptions, matches } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { createSubscriptionSchema, subscriptionMatchParamSchema } from '../validation/subscriptions.js';

export const subscriptionsRouter = Router();

// All subscription routes require authentication
subscriptionsRouter.use(authenticate);

// ── GET /subscriptions ───────────────────────────────────────────────────────
subscriptionsRouter.get('/', async (req, res) => {
  try {
    const rows = await db
      .select({
        id:             subscriptions.id,
        matchId:        subscriptions.matchId,
        isActive:       subscriptions.isActive,
        subscribedAt:   subscriptions.subscribedAt,
        unsubscribedAt: subscriptions.unsubscribedAt,
        match: {
          id:        matches.id,
          sport:     matches.sport,
          homeTeam:  matches.homeTeam,
          awayTeam:  matches.awayTeam,
          status:    matches.status,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
          startTime: matches.startTime,
        },
      })
      .from(subscriptions)
      .innerJoin(matches, eq(subscriptions.matchId, matches.id))
      .where(
        and(
          eq(subscriptions.userId, req.user.id),
          eq(subscriptions.isActive, true)
        )
      );

    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('List subscriptions error:', err);
    return res.status(500).json({ error: 'Failed to list subscriptions.' });
  }
});

// ── POST /subscriptions ──────────────────────────────────────────────────────
subscriptionsRouter.post('/', async (req, res) => {
  const parsed = createSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed.', details: parsed.error.issues });
  }

  const { match_id: matchId } = parsed.data;

  try {
    // Upsert: if row exists set is_active=true + clear unsubscribed_at, else insert
    await db
      .insert(subscriptions)
      .values({
        userId:  req.user.id,
        matchId,
        isActive: true,
      })
      .onDuplicateKeyUpdate({
        set: {
          isActive:       true,
          unsubscribedAt: null,
          subscribedAt:   new Date(),
        },
      });

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, req.user.id),
          eq(subscriptions.matchId, matchId)
        )
      )
      .limit(1);

    return res.status(201).json({ data: sub });
  } catch (err) {
    console.error('Create subscription error:', err);
    return res.status(500).json({ error: 'Failed to create subscription.' });
  }
});

// ── DELETE /subscriptions/:matchId ───────────────────────────────────────────
subscriptionsRouter.delete('/:matchId', async (req, res) => {
  const parsed = subscriptionMatchParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid matchId param.', details: parsed.error.issues });
  }

  const { matchId } = parsed.data;

  try {
    // Soft-delete: preserve the row for audit trail
    await db
      .update(subscriptions)
      .set({ isActive: false, unsubscribedAt: new Date() })
      .where(
        and(
          eq(subscriptions.userId, req.user.id),
          eq(subscriptions.matchId, matchId)
        )
      );

    return res.status(204).send();
  } catch (err) {
    console.error('Delete subscription error:', err);
    return res.status(500).json({ error: 'Failed to unsubscribe.' });
  }
});
