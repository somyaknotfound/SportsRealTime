import { Router } from "express";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js"; // ADD .js
import { matches } from "../db/schema.js"; // ADD .js
import { getMatchStatus } from "../utils/match-status.js"; // ADD .js
import { db } from "../db/db.js"; // ADD .js
import { string } from "zod";
import { desc } from "drizzle-orm";

export const matchRouter = Router();
const MAX_LIMIT = 50;
matchRouter.get('/', async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({error: 'Invalid query' , details: parsed.error.issues});

    }
    // how many matches in a single call

    const limit = Math.min(parsed.data.limit ?? 50 , MAX_LIMIT)


    try {
        // since db in another continent
        const data = await db 
                        .select()
                        .from(matches)
                        .orderBy((desc(matches.createdAt)))
                        .limit(limit)

            res.json({data});

    } catch (e) {
        res.status(500).json({error : 'Failed to list matches.'});
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
        const [event] = await db.insert(matches).values({
            ...parsed.data,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime),
        }).returning();

        res.status(201).json({ data: event });
    } catch (e) {
        console.error('Error creating match:', e);
        res.status(500).json({ 
            error: 'Failed to create Match', 
            details: e.message 
        });
    }
});