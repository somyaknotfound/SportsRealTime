import { Router } from "express";
import {
    createMatchSchema,
    listMatchesQuerySchema,
    patchMatchStatusSchema,
} from "../validation/matches.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";
import { db } from "../db/db.js";
import { desc, eq, and, or, like } from "drizzle-orm";
import { authenticate, requireRole } from "../middleware/auth.js";

export const matchRouter = Router();
const MAX_LIMIT = 50;
matchRouter.get('/', async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query', details: JSON.stringify(parsed.error) });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);
    const { status, sport, search } = parsed.data;

    try {
        const conditions = [];
        if (status) conditions.push(eq(matches.status, status));
        if (sport) conditions.push(eq(matches.sport, sport));
        if (search) {
            // Strip LIKE metacharacters from user input to avoid accidental pattern expansion
            const safe = search.replace(/[%_]/g, '').trim();
            if (safe.length > 0) {
                const term = `%${safe}%`;
                conditions.push(
                    or(like(matches.homeTeam, term), like(matches.awayTeam, term))
                );
            }
        }

        const whereClause = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

        let q = db.select().from(matches);
        if (whereClause) q = q.where(whereClause);

        const data = await q.orderBy(desc(matches.createdAt)).limit(limit);

        res.json({ data });

    } catch (e) {
        process.stdout.write('MATCH ERROR: ' + e.message + '\n');
        process.stdout.write('MATCH ERROR CODE: ' + e.code + '\n');
        res.status(500).json({ error: 'Failed to list matches.', details: e.message, code: e.code });
    }
});

matchRouter.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid match ID.' });
    try {
        const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
        if (!match) return res.status(404).json({ error: 'Match not found.' });
        res.json({ data: match });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch match.', details: e.message });
    }
});

matchRouter.post('/', async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: 'invalid payload',
            details: parsed.error.issues
        });
    }

    const { startTime, endTime, homeScore, awayScore } = parsed.data;

    try {
        // MySQL does not support RETURNING; perform insert then fetch by insertId
        const insertResult = await db.insert(matches).values({
            ...parsed.data,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime),
        });

        const insertId = Array.isArray(insertResult) && insertResult[0]?.insertId
            ? insertResult[0].insertId
            : insertResult.insertId; // driver-specific shape fallback

        const [event] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, insertId));

        // push the new event
        if (res.app.locals.broadcastMatchCreated) {
            res.app.locals.broadcastMatchCreated(event);
        }

        res.status(201).json({ data: event });
    } catch (e) {
        console.error('Error listing matches:', e);
        res.status(500).json({ error: 'Failed to list matches.', details: e.message });
    }
});

// ── PATCH /matches/:id/score ──────────────────────────────────────────────────
// Used by the seed script and future tooling to update live scores.
// Broadcasts a 'score_update' WS event to all in-memory match subscribers.
matchRouter.patch('/:id/score', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid match ID.' });

    const { homeScore, awayScore } = req.body;
    if (homeScore == null && awayScore == null) {
        return res.status(400).json({ error: 'Provide at least homeScore or awayScore.' });
    }

    try {
        const updateData = {};
        if (homeScore != null) updateData.homeScore = Number(homeScore);
        if (awayScore != null) updateData.awayScore = Number(awayScore);

        await db.update(matches).set(updateData).where(eq(matches.id, id));

        const [updated] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
        if (!updated) return res.status(404).json({ error: 'Match not found.' });

        // Broadcast score update to in-memory subscribers via the commentary channel
        if (res.app.locals.broadcastCommentary) {
            res.app.locals.broadcastCommentary(id, {
                type: 'score_update',
                matchId: id,
                homeScore: updated.homeScore,
                awayScore: updated.awayScore,
            });
        }

        res.json({ data: updated });
    } catch (e) {
        console.error('Score update error:', e);
        res.status(500).json({ error: 'Failed to update score.', details: e.message });
    }
});

// ── PATCH /matches/:id/status ─────────────────────────────────────────────────
// Commentators/admins can move a match between scheduled / live / finished.
// Broadcasts `match_status` over WS so listing + detail UIs update without reload.
matchRouter.patch('/:id/status', authenticate, requireRole('commentator', 'admin'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid match ID.' });

    const parsed = patchMatchStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues });
    }

    try {
        const [existing] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
        if (!existing) return res.status(404).json({ error: 'Match not found.' });

        await db.update(matches).set({ status: parsed.data.status }).where(eq(matches.id, id));

        const [updated] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);

        if (res.app.locals.broadcastMatchStatus) {
            res.app.locals.broadcastMatchStatus(updated);
        }

        return res.json({ data: updated });
    } catch (e) {
        console.error('Match status update error:', e);
        return res.status(500).json({ error: 'Failed to update match status.', details: e.message });
    }
});