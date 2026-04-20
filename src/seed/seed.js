import "dotenv/config";
import fs from "fs/promises";

const DELAY_MS = Number.parseInt(process.env.DELAY_MS || "250", 10);
const NEW_MATCH_DELAY_MIN_MS = 2000;
const NEW_MATCH_DELAY_MAX_MS = 3000;
const DEFAULT_MATCH_DURATION_MINUTES = Number.parseInt(
  process.env.SEED_MATCH_DURATION_MINUTES || "120",
  10,
);
const FORCE_LIVE =
  process.env.SEED_FORCE_LIVE !== "0" &&
  process.env.SEED_FORCE_LIVE !== "false";
const API_URL = process.env.API_URL || 'http://localhost:8000' ;
if (!API_URL) {
  throw new Error("API_URL is required to seed via REST endpoints.");
}

const SEED_ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@seed.local';
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'SeedAdmin123!';

const DEFAULT_DATA_FILE = new URL("../data/data.json", import.meta.url);

// ── Auth helpers ─────────────────────────────────────────────────────────────
let adminToken = null;

/**
 * Log in as the seed admin and store the JWT.
 * Falls back to registering the account if it doesn't exist yet.
 */
async function loginAsAdmin() {
  // Try login first
  let res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD }),
  });

  // Auto-register if account doesn't exist
  if (res.status === 401) {
    console.log('🔑 Seed admin not found — registering...');
    res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'seed_admin',
        email: SEED_ADMIN_EMAIL,
        password: SEED_ADMIN_PASSWORD,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to register seed admin: ${res.status} ${text}`);
    }
    // Newly registered users have role='viewer'; upgrade must be done in DB.
    // If the user already exists as admin in DB this won't run.
    const regData = await res.json();
    adminToken = regData.data?.token ?? null;
    console.warn('⚠️  Seed admin registered as viewer — role must be set to admin/commentator in DB for events to post.');
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to login as seed admin: ${res.status} ${text}`);
  }

  const data = await res.json();
  adminToken = data.data?.token ?? null;
  const role = data.data?.user?.role ?? 'unknown';
  console.log(`🔑 Logged in as seed admin (role: ${role})`);
}

// Structured event types that should also be posted to /matches/:id/events
const STRUCTURED_EVENT_TYPES = new Set([
  'goal', 'yellow_card', 'red_card', 'substitution',
  'foul', 'penalty', 'corner', 'offside', 'injury',
]);

/**
 * Post a structured match event to /matches/:id/events.
 * Silently skips if no admin token is available or role insufficient.
 */
async function insertEvent(matchId, entry) {
  if (!adminToken) return;
  const payload = {
    event_type: entry.eventType,
    payload: {
      player: entry.actor  ?? null,
      team:   entry.team   ?? null,
      ...(entry.metadata ?? {}),
    },
    minute: entry.minute ?? undefined,
    period: entry.period ?? undefined,
  };

  const res = await fetch(`${API_URL}/matches/${matchId}/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.status);
    console.warn(`⚠️  Event insert failed for match ${matchId} (${entry.eventType}): ${text}`);
  } else {
    console.log(`⚡ [Match ${matchId}] Event logged: ${entry.eventType}`);
  }
}

async function readJsonFile(fileUrl) {
  const raw = await fs.readFile(fileUrl, "utf8");
  return JSON.parse(raw);
}

async function loadSeedData() {
  const parsed = await readJsonFile(DEFAULT_DATA_FILE);

  if (Array.isArray(parsed)) {
    return { feed: parsed, matches: [] };
  }

  if (Array.isArray(parsed.commentary)) {
    return { feed: parsed.commentary, matches: parsed.matches ?? [] };
  }

  if (Array.isArray(parsed.feed)) {
    return { feed: parsed.feed, matches: parsed.matches ?? [] };
  }

  throw new Error(
    "Seed data must be an array or contain a commentary/feed array.",
  );
}

async function fetchMatches(limit = 100) {
  const response = await fetch(`${API_URL}/matches?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch matches: ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isLiveMatch(match) {
  const start = parseDate(match.startTime);
  const end = parseDate(match.endTime);
  if (!start || !end) {
    return false;
  }
  const now = new Date();
  return now >= start && now < end;
}

function buildMatchTimes(seedMatch) {
  const now = new Date();
  const durationMs = DEFAULT_MATCH_DURATION_MINUTES * 60 * 1000;

  let start = parseDate(seedMatch.startTime);
  let end = parseDate(seedMatch.endTime);

  if (!start && !end) {
    start = new Date(now.getTime() - 5 * 60 * 1000);
    end = new Date(start.getTime() + durationMs);
  } else {
    if (start && !end) {
      end = new Date(start.getTime() + durationMs);
    }
    if (!start && end) {
      start = new Date(end.getTime() - durationMs);
    }
  }

  if (FORCE_LIVE && start && end) {
    if (!(now >= start && now < end)) {
      start = new Date(now.getTime() - 5 * 60 * 1000);
      end = new Date(start.getTime() + durationMs);
    }
  }

  if (!start || !end) {
    throw new Error("Seed match must include valid startTime and endTime.");
  }

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

async function createMatch(seedMatch) {
  const { startTime, endTime } = buildMatchTimes(seedMatch);

  const response = await fetch(`${API_URL}/matches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sport: seedMatch.sport,
      homeTeam: seedMatch.homeTeam,
      awayTeam: seedMatch.awayTeam,
      startTime,
      endTime,
      homeScore: seedMatch.homeScore ?? 0,
      awayScore: seedMatch.awayScore ?? 0,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create match: ${response.status}`);
  }
  const responsePayload = await response.json();
  return responsePayload.data;
}

async function insertCommentary(matchId, entry) {
  const payload = {
    message: entry.message ?? "Update",
  };
  if (entry.minute !== undefined && entry.minute !== null) {
    payload.minute = entry.minute;
  }
  if (entry.sequence !== undefined && entry.sequence !== null) {
    payload.sequence = entry.sequence;
  }
  if (entry.period !== undefined && entry.period !== null) {
    payload.period = entry.period;
  }
  if (entry.eventType !== undefined && entry.eventType !== null) {
    payload.eventType = entry.eventType;
  }
  if (entry.actor !== undefined && entry.actor !== null) {
    payload.actor = entry.actor;
  }
  if (entry.team !== undefined && entry.team !== null) {
    payload.team = entry.team;
  }
  if (entry.metadata !== undefined && entry.metadata !== null) {
    payload.metadata = entry.metadata;
  }
  if (entry.tags !== undefined && entry.tags !== null) {
    payload.tags = entry.tags;
  }

  const response = await fetch(`${API_URL}/matches/${matchId}/commentary`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // NOTE: Avoid sending nulls; the API expects missing optional fields.
    // body: JSON.stringify({
    //   minute: entry.minute ?? null,
    //   sequence: entry.sequence ?? null,
    //   period: entry.period ?? null,
    //   eventType: entry.eventType ?? null,
    //   actor: entry.actor ?? null,
    //   team: entry.team ?? null,
    //   message: entry.message ?? "Update",
    //   metadata: entry.metadata ?? null,
    //   tags: entry.tags ?? null,
    // }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to create commentary: ${response.status}`);
  }
  const responsePayload = await response.json();
  return responsePayload.data;
}

function extractRuns(entry) {
  if (Number.isFinite(entry.runs)) return entry.runs;
  if (entry.metadata && Number.isFinite(entry.metadata.runs)) return entry.metadata.runs;
  if (entry.eventType === "four") return 4;
  if (entry.eventType === "six")  return 6;
  if (entry.eventType === "run")  return 1;
  return null;
}

function scoreDeltaFromEntry(entry, match) {
  // Prefer explicit scoreDelta from data.json
  if (entry.scoreDelta && typeof entry.scoreDelta === "object") {
    return {
      home: Number(entry.scoreDelta.home || 0),
      away: Number(entry.scoreDelta.away || 0),
    };
  }
  // Football / basketball: goal event → +1 for the scoring team
  if (entry.eventType === "goal" || entry.eventType === "basket") {
    if (entry.team === match.homeTeam) return { home: 1, away: 0 };
    if (entry.team === match.awayTeam) return { home: 0, away: 1 };
  }
  // Cricket: runs from the batting team
  const runs = extractRuns(entry);
  if (runs !== null) {
    if (entry.team === match.homeTeam) return { home: runs, away: 0 };
    if (entry.team === match.awayTeam) return { home: 0, away: runs };
  }
  return null;
}

function fakeScoreDelta(matchState) {
  const nextSide = matchState.fakeNext === "home" ? "away" : "home";
  matchState.fakeNext = nextSide;
  // Basketball: 2pts per basket; others: 1 point
  const sport = matchState.match?.sport?.toLowerCase() ?? "";
  const pts = sport === "basketball" ? 2 : 1;
  return nextSide === "home" ? { home: pts, away: 0 } : { home: 0, away: pts };
}

function inningsRank(period) {
  if (!period) {
    return 0;
  }
  const lower = String(period).toLowerCase();
  const match = lower.match(/(\d+)(st|nd|rd|th)/);
  if (match) {
    return Number(match[1]) || 0;
  }
  if (lower.includes("first")) {
    return 1;
  }
  if (lower.includes("second")) {
    return 2;
  }
  if (lower.includes("third")) {
    return 3;
  }
  if (lower.includes("fourth")) {
    return 4;
  }
  return 0;
}

function cricketBattingTeam(entry, match) {
  const rank = inningsRank(entry.period);
  if (rank === 1) {
    return match.homeTeam;
  }
  if (rank === 2) {
    return match.awayTeam;
  }
  return null;
}

function cricketScoreDelta(entry, match, target) {
  const battingTeam = cricketBattingTeam(entry, match);
  let delta = scoreDeltaFromEntry(entry, match);
  if (!delta) {
    if (!battingTeam) return null;
    const points = 1;
    return battingTeam === match.homeTeam
      ? { home: points, away: 0 }
      : { home: 0, away: points };
  }
  if (!battingTeam) return delta;
  if (battingTeam === match.homeTeam) return { home: delta.home + delta.away, away: 0 };
  return { home: 0, away: delta.home + delta.away };
}

function normalizeCricketFeed(entries, match) {
  const sorted = [...entries].sort((a, b) => {
    const inningsDiff = inningsRank(a.period) - inningsRank(b.period);
    if (inningsDiff !== 0) {
      return inningsDiff;
    }
    const seqA = Number.isFinite(a.sequence)
      ? a.sequence
      : Number.MAX_SAFE_INTEGER;
    const seqB = Number.isFinite(b.sequence)
      ? b.sequence
      : Number.MAX_SAFE_INTEGER;
    if (seqA !== seqB) {
      return seqA - seqB;
    }
    const minA = Number.isFinite(a.minute) ? a.minute : Number.MAX_SAFE_INTEGER;
    const minB = Number.isFinite(b.minute) ? b.minute : Number.MAX_SAFE_INTEGER;
    return minA - minB;
  });

  const grouped = new Map();
  for (const entry of sorted) {
    const key = inningsRank(entry.period);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(entry);
  }

  const ordered = [];
  const inningsKeys = Array.from(grouped.keys()).sort((a, b) => a - b);

  for (const key of inningsKeys) {
    const inningsEntries = grouped.get(key) || [];
    const primaryTeam = inningsEntries.find(
      (entry) => entry.team === match.homeTeam || entry.team === match.awayTeam,
    )?.team;
    const secondaryTeam =
      primaryTeam === match.homeTeam ? match.awayTeam : match.homeTeam;

    const neutral = inningsEntries.filter(
      (entry) => !entry.team || entry.team === "neutral",
    );
    const primary = inningsEntries.filter(
      (entry) => entry.team === primaryTeam,
    );
    const secondary = inningsEntries.filter(
      (entry) => entry.team === secondaryTeam,
    );
    const other = inningsEntries.filter(
      (entry) =>
        entry.team &&
        entry.team !== "neutral" &&
        entry.team !== primaryTeam &&
        entry.team !== secondaryTeam,
    );

    ordered.push(...neutral, ...primary, ...secondary, ...other);
  }

  return ordered;
}

function replaceTrailingTeam(message, replacements) {
  if (typeof message !== "string") {
    return message;
  }
  const match = message.match(/\(([^)]+)\)\s*$/);
  if (!match) {
    return message;
  }
  const nextTeam = replacements.get(match[1]);
  if (!nextTeam) {
    return message;
  }
  return message.replace(/\([^)]+\)\s*$/, `(${nextTeam})`);
}

function cloneCommentaryEntries(entries, templateMatch, targetMatch) {
  const replacements = new Map([
    [templateMatch.homeTeam, targetMatch.homeTeam],
    [templateMatch.awayTeam, targetMatch.awayTeam],
  ]);

  return entries.map((entry) => {
    const next = { ...entry, matchId: targetMatch.id };
    if (entry.team === templateMatch.homeTeam) {
      next.team = targetMatch.homeTeam;
    } else if (entry.team === templateMatch.awayTeam) {
      next.team = targetMatch.awayTeam;
    }
    next.message = replaceTrailingTeam(entry.message, replacements);
    return next;
  });
}

function expandFeedForMatches(feed, seedMatches) {
  if (!Array.isArray(seedMatches) || seedMatches.length === 0) {
    return feed;
  }

  const byMatchId = new Map();
  for (const entry of feed) {
    if (!Number.isInteger(entry.matchId)) {
      continue;
    }
    if (!byMatchId.has(entry.matchId)) {
      byMatchId.set(entry.matchId, []);
    }
    byMatchId.get(entry.matchId).push(entry);
  }

  const matchById = new Map();
  const templateBySport = new Map();
  for (const match of seedMatches) {
    matchById.set(match.id, match);
    if (!templateBySport.has(match.sport) && byMatchId.has(match.id)) {
      templateBySport.set(match.sport, match);
    }
  }

  const expanded = [...feed];
  for (const match of seedMatches) {
    if (byMatchId.has(match.id)) {
      continue;
    }
    const templateMatch = templateBySport.get(match.sport);
    if (!templateMatch) {
      continue;
    }
    const templateEntries = byMatchId.get(templateMatch.id) || [];
    expanded.push(
      ...cloneCommentaryEntries(templateEntries, templateMatch, match),
    );
  }

  return expanded;
}

function buildRandomizedFeed(feed, matchMap) {
  const buckets = new Map();
  for (const entry of feed) {
    const key = Number.isInteger(entry.matchId) ? entry.matchId : null;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(entry);
  }

  for (const [matchId, entries] of buckets) {
    if (!Number.isInteger(matchId)) {
      continue;
    }
    const target = matchMap.get(matchId);
    const sport = target?.match?.sport?.toLowerCase();
    if (sport === "cricket" && target?.match) {
      buckets.set(matchId, normalizeCricketFeed(entries, target.match));
    }
  }

  const matchIds = Array.from(buckets.keys());
  const randomized = [];
  let lastMatchId = null;

  while (randomized.length < feed.length) {
    const candidates = matchIds.filter(
      (id) => (buckets.get(id) || []).length > 0,
    );
    if (candidates.length === 0) {
      break;
    }

    let selectable = candidates;
    if (lastMatchId !== null && candidates.length > 1) {
      const withoutLast = candidates.filter((id) => id !== lastMatchId);
      if (withoutLast.length > 0) {
        selectable = withoutLast;
      }
    }

    const choice = selectable[Math.floor(Math.random() * selectable.length)];
    const nextEntry = buckets.get(choice).shift();
    randomized.push(nextEntry);
    lastMatchId = choice;
  }

  return randomized;
}

function getMatchEntry(entry, matchMap) {
  if (!Number.isInteger(entry.matchId)) {
    return null;
  }
  return matchMap.get(entry.matchId) ?? null;
}

async function updateMatchScore(matchId, homeScore, awayScore) {
  const response = await fetch(`${API_URL}/matches/${matchId}/score`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ homeScore, awayScore }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.status);
    console.warn(`Score update failed for match ${matchId}: ${text}`);
  }
}

function randomMatchDelay() {
  const range = NEW_MATCH_DELAY_MAX_MS - NEW_MATCH_DELAY_MIN_MS;
  return NEW_MATCH_DELAY_MIN_MS + Math.floor(Math.random() * (range + 1));
}

// NOTE: Match status updates are not part of this codebase yet.
// async function endMatch(matchId) {
//   const response = await fetch(`${API_URL}/matches/${matchId}/end`, {
//     method: "PATCH",
//     headers: { "content-type": "application/json" },
//   });
//   if (!response.ok) {
//     throw new Error(`Failed to end match: ${response.status}`);
//   }
// }

async function seed() {
  console.log(`📡 Seeding via API: ${API_URL}`);

  // Obtain admin JWT so we can post to role-protected /events endpoint
  await loginAsAdmin();

  const { feed, matches: seedMatches } = await loadSeedData();
  const matchesList = await fetchMatches();

  const matchMap = new Map();
  const matchKeyMap = new Map();
  for (const match of matchesList) {
    if (FORCE_LIVE && !isLiveMatch(match)) {
      continue;
    }
    const key = `${match.sport}|${match.homeTeam}|${match.awayTeam}`;
    if (!matchKeyMap.has(key)) {
      matchKeyMap.set(key, match);
    }
    matchMap.set(match.id, {
      match,
      score: { home: match.homeScore ?? 0, away: match.awayScore ?? 0 },
      fakeNext: Math.random() < 0.5 ? "home" : "away",
    });
  }

  if (Array.isArray(seedMatches) && seedMatches.length > 0) {
    for (const seedMatch of seedMatches) {
      const key = `${seedMatch.sport}|${seedMatch.homeTeam}|${seedMatch.awayTeam}`;
      let match = matchKeyMap.get(key);
      if (!match || (FORCE_LIVE && !isLiveMatch(match))) {
        match = await createMatch(seedMatch);
        matchKeyMap.set(key, match);
        const delayMs = randomMatchDelay();
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (Number.isInteger(seedMatch.id)) {
        matchMap.set(seedMatch.id, {
          match,
          score: { home: match.homeScore ?? 0, away: match.awayScore ?? 0 },
          fakeNext: Math.random() < 0.5 ? "home" : "away",
        });
      }
      matchMap.set(match.id, {
        match,
        score: { home: match.homeScore ?? 0, away: match.awayScore ?? 0 },
        fakeNext: Math.random() < 0.5 ? "home" : "away",
      });
    }
  }

  if (matchMap.size === 0) {
    throw new Error("No matches found or created in the database.");
  }

  // NOTE: Score resets are disabled because score updates are not supported.
  // const resetIds = new Set();
  // for (const entry of matchMap.values()) {
  //   const matchId = entry.match?.id;
  //   if (!Number.isInteger(matchId) || resetIds.has(matchId)) {
  //     continue;
  //   }
  //   resetIds.add(matchId);
  //   entry.score.home = 0;
  //   entry.score.away = 0;
  //   await updateMatchScore(matchId, 0, 0);
  // }

  const expandedFeed = expandFeedForMatches(feed, seedMatches);
  const randomizedFeed = buildRandomizedFeed(expandedFeed, matchMap);
  // NOTE: Remaining entry counts were used to end matches; disabled for now.
  // const remainingByMatchId = new Map();
  // for (const entry of randomizedFeed) {
  //   if (!Number.isInteger(entry.matchId)) {
  //     continue;
  //   }
  //   remainingByMatchId.set(
  //     entry.matchId,
  //     (remainingByMatchId.get(entry.matchId) || 0) + 1,
  //   );
  // }

  for (let i = 0; i < randomizedFeed.length; i += 1) {
    const entry = randomizedFeed[i];
    const target = getMatchEntry(entry, matchMap);
    if (!target) {
      console.warn(
        "⚠️  Skipping entry: matchId missing or not found:",
        entry.message,
      );
      continue;
    }
    const match = target.match;

    const row = await insertCommentary(match.id, entry);
    console.log(`📣 [Match ${match.id}] ${row.message}`);

    // Also post as a structured match event (populates match_events + notifications)
    if (entry.eventType && STRUCTURED_EVENT_TYPES.has(entry.eventType)) {
      await insertEvent(match.id, entry);
    }

    const isCricket = String(match.sport).toLowerCase() === "cricket";
    const delta = isCricket
      ? cricketScoreDelta(entry, match, target)
      : (scoreDeltaFromEntry(entry, match) ?? fakeScoreDelta(target));
    if (delta && (delta.home > 0 || delta.away > 0)) {
      target.score.home += delta.home;
      target.score.away += delta.away;
      await updateMatchScore(match.id, target.score.home, target.score.away);
      console.log(
        `📊 [Match ${match.id}] Score: ${target.score.home}-${target.score.away}`,
      );
    }

    // NOTE: Match status updates are intentionally disabled in this codebase.
    // if (Number.isInteger(entry.matchId)) {
    //   const remaining = (remainingByMatchId.get(entry.matchId) || 1) - 1;
    //   if (remaining <= 0) {
    //     remainingByMatchId.delete(entry.matchId);
    //     await endMatch(match.id);
    //     console.log(`🏁 [Match ${match.id}] Match finished.`);
    //   } else {
    //     remainingByMatchId.set(entry.matchId, remaining);
    //   }
    // }

    if (DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }
}

seed().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
