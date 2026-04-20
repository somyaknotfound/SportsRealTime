# SportRealTime — LLM deployment context

**Purpose:** Copy this entire file into another LLM (e.g. Claude) and ask for a **step-by-step deployment procedure** tailored to your target (VPS, Railway, Render, Docker, AWS, etc.). This document describes the real stack and constraints of this repository.

---

## 1. What this project is

- **Backend:** Node.js (ESM), **Express 5**, HTTP server in `src/index.js`.
- **Real-time:** **WebSockets** (`ws`) on the **same HTTP server**, path **`/ws`** (upgrade handler). JWT can be passed as **`?token=<jwt>`** on the WebSocket URL for authenticated features (subscription restore).
- **Database:** **MySQL 8+** (or compatible), accessed with **`mysql2/promise`** and **Drizzle ORM** (`drizzle-orm/mysql2`, schemas in `src/db/schema.js`).
- **Migrations:** **Drizzle Kit** — `drizzle.config.js` uses dialect **`mysql`** and reads **`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`** from environment (strict: variables must be **set**; empty string for `DB_PASSWORD` is allowed if explicitly in `.env`).
- **Frontend:** **React + Vite** in `client/` — dev server proxies some API paths to the API origin (see `client/vite.config.js`). Production is typically **`npm run build`** in `client/` then serve `client/dist` behind nginx or host separately with CORS/proxy.
- **Auth:** JWT in **`Authorization: Bearer`**; client stores token in **`localStorage`** key **`srt_token`**.

---

## 2. Repository layout (deploy-relevant)

| Path | Role |
|------|------|
| `src/index.js` | Express app, mounts routers, attaches WebSocket to `http.Server` |
| `src/ws/server.js` | WebSocket upgrade on `/ws`, match subscriptions, broadcasts |
| `src/db/db.js` | MySQL pool + Drizzle instance |
| `src/db/schema.js` | Drizzle MySQL schema (users, matches, commentary, subscriptions, notifications, …) |
| `drizzle.config.js` | Drizzle Kit MySQL credentials (must match `.env`) |
| `drizzle/` | Generated SQL migrations (after `db:generate`) |
| `client/` | Vite React app |
| `src/seed/seed.js` | Seeds via **HTTP** using `API_URL` (server must be running) |
| `.env.example` | Template for required variables |

**NPM scripts (root `package.json`):**

- `npm install` — install dependencies  
- `npm run dev` — API + WS with `node --watch src/index.js`  
- `npm start` — `node src/index.js` (production-style)  
- `npm run db:generate` — generate migrations from schema  
- `npm run db:migrate` — apply migrations (needs DB + `drizzle.config.js` env)  
- `npm run seed` — HTTP seed (needs `API_URL` + running API)  
- `npm test` — Node test runner  

---

## 3. Environment variables

Create **`.env`** at the **repository root** (same level as `package.json`). Reference **`.env.example`**.

**Required for a working app (typical):**

| Variable | Purpose |
|----------|---------|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL; used by app **and** Drizzle Kit |
| `JWT_SECRET` | Signing JWTs (**required** by `src/middleware/auth.js` at startup**) |
| `PORT` | HTTP port (default often `8000`) |
| `HOST` | Bind address (e.g. `0.0.0.0` in production) |

**Strongly recommended / feature-dependent:**

| Variable | Purpose |
|----------|---------|
| `JWT_EXPIRES_IN` | JWT lifetime (default `7d` in auth) |
| `ARCJET_KEY`, `ARCJET_ENV` | Arcjet (WS upgrade may use Arcjet if configured) |
| `APM_LICENSE_KEY`, `APM_APP_NAME`, `APM_PORT` | Optional APM (`apminsight`) |

**Seeding:**

| Variable | Purpose |
|----------|---------|
| `API_URL` | Base URL for seed HTTP calls, e.g. `http://localhost:8000` |
| `DELAY_MS`, `BROADCAST`, etc. | Seed tuning (see `.env.example`) |

**Important:** `drizzle.config.js` fails fast if any of `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` is **undefined**. For Drizzle CLI, ensure `DB_PASSWORD=` exists in `.env` if you use an empty password (key present, value empty).

**Generate a strong `JWT_SECRET` (example):**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 4. HTTP API surface (for reverse-proxy / firewall rules)

Routers are mounted from `src/index.js` (prefixes approximate):

- `/auth` — register, login, logout, me, profile update  
- `/matches` — list (query: `limit`, `status`, `sport`, `search`), get by id, create, patch score, patch status  
- `/matches/:id/commentary` — list/create commentary  
- `/matches/:id/events` — match events  
- `/subscriptions` — authenticated subscription CRUD  
- `/notifications` — notifications  

**WebSocket:** `ws://<host>:<port>/ws` or `wss://` behind TLS. Proxies must support **HTTP Upgrade** and pass **`Connection: Upgrade`** / **`Upgrade: websocket`**.

---

## 5. Local deployment procedure (canonical order)

Use this as the “ground truth” sequence; an LLM can expand it for Docker/cloud.

1. **Install Node.js** (LTS, e.g. 20.x or 22.x) and **npm**.  
2. **Install MySQL**, create database: e.g. `CREATE DATABASE sportrealtime CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`  
3. **Create user** (or use root in dev only) with rights on that database.  
4. **Clone repo**, `cd` to project root, run **`npm install`**.  
5. **Copy `.env.example` → `.env`**, fill MySQL + `JWT_SECRET` + `PORT`/`HOST` + `API_URL` for seeding.  
6. **Run migrations:** `npm run db:generate` (if schema changed and no migration exists) then **`npm run db:migrate`**.  
7. **Start API:** `npm run dev` or `npm start`.  
8. **Frontend dev:** `cd client && npm install && npm run dev` (Vite default port is often 5173; proxy targets API — ensure **`client/vite.config.js`** proxies every REST prefix the app calls, e.g. `/auth`, `/matches`, `/subscriptions`, `/notifications`, and any nested routes).  
9. **Seed (optional):** with API running, from root **`npm run seed`** (uses `API_URL`).  
10. **Open app:** browser to Vite URL; WebSocket in dev often targets **`ws://localhost:8000/ws`** (see `client/src/contexts/WsContext.jsx` for dev host logic).

---

## 6. Production deployment — what to tell the LLM to decide

Ask your LLM to pick one pattern and spell out steps:

**A. Single VPS (nginx + Node)**  
- Node runs `npm start` (systemd or PM2).  
- nginx terminates TLS, reverse-proxies `/` to Vite **static** `client/dist` or to a static file server, and **`/auth`, `/matches`, …`** to `http://127.0.0.1:PORT`.  
- **WebSocket:** separate `location /ws` with `proxy_http_version 1.1`, `Upgrade` and `Connection` headers to the same Node upstream.  

**B. Split hosting (static frontend + API subdomain)**  
- Configure **CORS** on Express if not already allowed for the frontend origin.  
- Client must use **absolute API base URL** and **wss://** for WebSocket (today `WsContext` uses `localhost:8000` in dev — production builds need the correct host, often via `import.meta.env.VITE_API_URL` / `VITE_WS_URL` if you add them).  

**C. Container (Docker)**  
- One image for Node API or split services; MySQL as managed DB or container; document ports `PORT` and `3306`, env file or secrets manager.

**Security checklist for production:**  
- Strong `JWT_SECRET`, never commit `.env`.  
- TLS (`https` / `wss`).  
- MySQL user with least privilege (not root).  
- Firewall: only 443 (and 22 for SSH) public; DB private network if possible.  
- Set `NODE_ENV=production` if you add production optimizations later.

---

## 7. Common failures (for LLM troubleshooting sections)

| Symptom | Likely cause |
|---------|----------------|
| `JWT_SECRET environment variable is required` | Missing `JWT_SECRET` in `.env` before starting Node |
| Drizzle `ER_ACCESS_DENIED` / `1698` | Wrong MySQL user/password or MySQL auth plugin (e.g. socket auth for root on Linux) |
| `drizzle-kit: missing required environment variables` | `DB_*` not loaded — run CLI from repo root with `.env` present; keys must exist (use `DB_PASSWORD=` if empty) |
| Migrations out of sync | Run `db:generate` after schema edits, then `db:migrate` |
| Seed fails | `API_URL` wrong or API not listening; Arcjet blocking — check logs |
| WebSocket never connects | Proxy missing Upgrade headers, or wrong host/port in client build |
| Frontend 404 on `/matches/...` in dev | Add missing path to Vite `server.proxy` or call API with full base URL |

---

## 8. Prompt you can paste after this file

Use something like:

> Using the attached **LLM_DEPLOYMENT_CONTEXT.md** for the SportRealTime repo, produce a **numbered step-by-step deployment guide** for **[your target: e.g. Ubuntu 24.04 VPS + nginx + Let’s Encrypt + PM2]**. Include prerequisites, exact commands, `.env` contents (with placeholders), MySQL setup, migrations, building the React client, nginx snippets for **REST + WebSocket `/ws`**, systemd or PM2 unit, and a short verification checklist (health endpoint, login, WS connect). Assume the reader clones the repo to `/opt/sportrealtime`.

---

*End of context. Update this file when architecture or env requirements change.*
