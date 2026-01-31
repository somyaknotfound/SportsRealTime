# SportRealTime — Real-time Sports Commentary App ⚽🏀🏈

A lightweight Node.js + Express app that demonstrates live sports match management and real-time commentary using WebSockets, Drizzle ORM (Postgres / Neon), Zod validation, and simple observability integration.

---

## ✨ Key Features

- **Express REST API** for matches and commentary (JSON middleware)
- **WebSocket server** (via `ws`) for real-time broadcasts (/ws)
- **Drizzle ORM** with `node-postgres` (`pg`) adapter for type-safe DB access
- **Migrations** using `drizzle-kit`
- **Zod** validation schemas for requests
- **APM (apminsight)** integration via environment variable (`APM_LICENSE_KEY`) (optional)
- **Arcjet** middleware used for request protection/rate limits

---

## 📁 Project Layout (important files)

- `src/`
  - `index.js` — Express server + WebSocket attach
  - `ws/server.js` — WebSocket server + subscription management
  - `routes/`
    - `matches.js` — endpoints for creating/listing matches
    - `commentary.js` — nested routes: `/matches/:id/commentary`
  - `db/`
    - `db.js` — Drizzle + `pg` Pool client
    - `schema.js` — DB schema (`matches`, `commentary`, `match_status` enum)
  - `validation/`
    - `matches.js` — Zod schemas for match endpoints
    - `commentary.js` — Zod schemas for commentary
  - `ws/` — WebSocket handlers and broadcasting functions
  - `arcjet.js` — Arcjet protection middleware
- `drizzle.config.js` — Drizzle Kit config for migrations
- `.env` — environment variables (ignored by git)
- `apminsight.json` — removed secrets; uses `${APM_LICENSE_KEY}`

---

## 🚀 Quickstart

Prerequisites: Node.js (LTS), npm, a Postgres DB (Neon recommended)

1. Install dependencies

```bash
npm install
```

2. Add environment variables (create `.env` at project root)

```env
# DB connection strings
DATABASE_URL="postgresql://.../dbname?..."            # pooler (app)
DATABASE_URL_DIRECT="postgresql://.../dbname?..."     # direct (migrations)

# Optional APM
APM_LICENSE_KEY="your_apm_license_key"
```

> Note: Do not commit `.env` or `apminsight.json` with secrets.

3. Generate / apply migrations

```bash
npm run db:generate
npm run db:migrate
```

4. Run the server

```bash
npm run dev   # development with watcher
npm start     # production-mode
```

5. Run DB demo (quick CRUD flow)

```bash
npm run db:demo
```

---

## 📦 API Overview

- GET `/` — health/status
- GET `/matches` — list matches (query: `limit`)
- POST `/matches` — create a match (payload validated with Zod)
- GET `/matches/:id/commentary` — list commentary for a match (validated params and query)
- POST `/matches/:id/commentary` — create commentary (validated payload)

WebSocket endpoint: `ws://<host>/ws`
- Messages: `{ type: 'subscribe', matchId }`, `{ type: 'unsubscribe', matchId }`
- Server broadcasts: `match_created`, `commentary`

---

## 🔒 Security & Secrets

- **APM key rotation**: If a secret is accidentally committed, rotate it immediately, remove it from repo, and scrub git history (use `git filter-repo` or BFG). See `SECURITY.md` recommendations.
- `.gitignore` includes `.env` and `apminsight.json` to avoid committing secrets.
- Arcjet middleware is used for rate-limiting / bot protection (enabled only if `ARCJET_KEY` set).

---

## 🛠️ Troubleshooting & Notes

- Migrations failing with `ETIMEDOUT` usually indicate a **network/connectivity** issue to the DB endpoint. Verify `DATABASE_URL_DIRECT`, your network, and that Neon allows your IP.
- If `drizzle-kit` isn’t found during `npm run db:migrate`, ensure `drizzle-kit` is installed as a dev dependency.
- If imports fail (module not found), run `npm install` to update `node_modules` and commit `package.json`/`package-lock.json`.

---

## ✅ Suggested Next Steps

- Add unit/integration tests for route handlers and validation
- Add CI (GitHub Actions) to run lint/tests and migrations against a test DB
- Add pagination & cursors to commentary listing
- Add DB indexes for performance (e.g., `commentary(match_id, created_at desc)`)

---

## 📬 Contributing

PRs welcome. For security-sensitive changes (rotating keys, scrubbing secrets), coordinate changes with the team and do not push secrets to the repo.

---

If you want, I can also:
- add `SECURITY.md` with steps to rotate and scrub keys ✅
- add basic tests for your routes and validation ✅

Happy to continue — tell me which follow-up you'd like next! 💡