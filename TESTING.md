# SportRealTime — Complete Testing Guide

A comprehensive reference for **setting up**, **running**, **querying the database directly**, and **testing every API endpoint** via Postman.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Database Setup (MySQL)](#3-database-setup-mysql)
4. [Run the Server](#4-run-the-server)
5. [MySQL Client — Direct Queries](#5-mysql-client--direct-queries)
6. [WebSocket Testing](#6-websocket-testing)
7. [Postman — Full Endpoint Reference](#7-postman--full-endpoint-reference)
   - [Auth Routes](#auth-routes-auth)
   - [Match Routes](#match-routes-matches)
   - [Commentary Routes](#commentary-routes-matchesidcommentary)
   - [Match Events Routes](#match-events-routes-matchesidevents)
   - [Subscriptions Routes](#subscriptions-routes-subscriptions)
   - [Notifications Routes](#notifications-routes-notifications)
8. [Validation Error Reference](#8-validation-error-reference)
9. [Role-Based Access Quick Reference](#9-role-based-access-quick-reference)
10. [Useful SQL Diagnostic Queries](#10-useful-sql-diagnostic-queries)

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 | `node --version` |
| npm | ≥ 10 | `npm --version` |
| MySQL | 8.0+ | Local or remote |
| Postman | Any | Desktop app or web |
| wscat *(optional)* | any | `npm i -g wscat` for WS testing |

---

## 2. Environment Setup

### 2a. Copy and fill the env file

```bash
# Windows CMD
copy .env.example .env
```

Your `.env` should contain at minimum:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=student
DB_PASSWORD=newpassword123
DB_NAME=sportrealtime

# Server
PORT=8000
HOST=0.0.0.0

# JWT — generate a real secret with:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_long_random_secret_here
JWT_EXPIRES_IN=7d

# Arcjet (get a free key at arcjet.com)
ARCJET_KEY=ajkey_your_key_here
ARCJET_ENV=development
```

### 2b. Install dependencies

```bash
npm install
```

Verify `jsonwebtoken` and `bcryptjs` are present:
```bash
npm list jsonwebtoken bcryptjs
```

Expected output:
```
sportrealtime@1.0.0
├── bcryptjs@3.x.x
└── jsonwebtoken@9.x.x
```

---

## 3. Database Setup (MySQL)

### 3a. Create the database

Open the **MySQL command-line client** or **MySQL Workbench** and run:

```sql
CREATE DATABASE IF NOT EXISTS sportrealtime
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Create a dedicated user (skip if using root locally)
CREATE USER IF NOT EXISTS 'student'@'localhost' IDENTIFIED BY 'newpassword123';
GRANT ALL PRIVILEGES ON sportrealtime.* TO 'student'@'localhost';
FLUSH PRIVILEGES;

USE sportrealtime;
```

### 3b. Run Drizzle migrations

```bash
# Generate SQL (already done — creates drizzle/0002_supreme_felicia_hardy.sql)
npm run db:generate

# Apply migrations to the database
npm run db:migrate
```

### 3c. Verify tables were created

In your MySQL client:

```sql
USE sportrealtime;
SHOW TABLES;
```

Expected output — **7 tables**:

```
+-------------------------+
| Tables_in_sportrealtime |
+-------------------------+
| commentary              |
| match_events            |
| matches                 |
| notifications           |
| subscriptions           |
| user_sessions           |
| users                   |
+-------------------------+
```

Verify columns on the most critical table:

```sql
DESCRIBE users;
```

Expected:
```
+---------------+---------------------------------+------+-----+-------------------+
| Field         | Type                            | Null | Key | Default           |
+---------------+---------------------------------+------+-----+-------------------+
| id            | int                             | NO   | PRI | NULL              |
| username      | varchar(50)                     | NO   | UNI | NULL              |
| email         | varchar(255)                    | NO   | UNI | NULL              |
| password_hash | varchar(255)                    | NO   |     | NULL              |
| avatar_url    | varchar(500)                    | YES  |     | NULL              |
| role          | enum('viewer','commentator'...) | NO   |     | viewer            |
| is_active     | tinyint(1)                      | NO   |     | 1                 |
| created_at    | timestamp                       | NO   |     | CURRENT_TIMESTAMP |
| updated_at    | timestamp                       | NO   |     | CURRENT_TIMESTAMP |
+---------------+---------------------------------+------+-----+-------------------+
```

### 3d. Manually promote a user to admin (MySQL client)

After registering a user via the API, run this to make them an admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
-- or commentator:
UPDATE users SET role = 'commentator' WHERE email = 'your@email.com';
```

---

## 4. Run the Server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

**Expected startup output:**
```
APM Agent configured.   (or: APM_LICENSE_KEY not set; APM agent disabled.)
Server listening at http://localhost:8000
WebSocket Server is running on ws://localhost:8000/ws
```

**Quick health check:**
```bash
curl http://localhost:8000/
# → {"message":"Server is running"}
```

---

## 5. MySQL Client — Direct Queries

Connect to the database:
```bash
mysql -u student -p sportrealtime
# enter password: newpassword123
```

### 5a. Inspect users and sessions

```sql
-- View all users (no password hashes shown)
SELECT id, username, email, role, is_active, created_at FROM users;

-- View active sessions
SELECT s.id, u.username, s.ip_address, s.expires_at
FROM user_sessions s
JOIN users u ON u.id = s.user_id
WHERE s.expires_at > NOW();

-- Count sessions per user
SELECT u.username, COUNT(s.id) AS active_sessions
FROM users u
LEFT JOIN user_sessions s ON s.user_id = u.id AND s.expires_at > NOW()
GROUP BY u.id;
```

### 5b. Inspect matches and events

```sql
-- All matches with scores
SELECT id, sport, home_team, away_team, match_status, home_score, away_score, start_time
FROM matches
ORDER BY created_at DESC;

-- Events for a specific match (replace 1 with your match id)
SELECT id, event_type, minute, period, payload, created_at
FROM match_events
WHERE match_id = 1
ORDER BY created_at DESC;
```

### 5c. Inspect subscriptions

```sql
-- Who is subscribed to what
SELECT u.username, m.home_team, m.away_team, s.is_active, s.subscribed_at
FROM subscriptions s
JOIN users u ON u.id = s.user_id
JOIN matches m ON m.id = s.match_id
ORDER BY s.subscribed_at DESC;

-- Count active subscribers per match
SELECT m.id, m.home_team, m.away_team, COUNT(s.id) AS subscriber_count
FROM matches m
LEFT JOIN subscriptions s ON s.match_id = m.id AND s.is_active = 1
GROUP BY m.id;
```

### 5d. Inspect notifications

```sql
-- All unread notifications for a user
SELECT n.id, n.event_type, n.message, n.source_type, n.created_at
FROM notifications n
JOIN users u ON u.id = n.user_id
WHERE u.username = 'alice' AND n.read_at IS NULL
ORDER BY n.created_at DESC;

-- Unread notification counts per user
SELECT u.username, COUNT(n.id) AS unread_count
FROM users u
LEFT JOIN notifications n ON n.user_id = u.id AND n.read_at IS NULL
GROUP BY u.id;
```

### 5e. Cleanup queries (testing resets)

```sql
-- Wipe all sessions (force everyone to re-login)
TRUNCATE user_sessions;

-- Delete a specific user's test data
DELETE FROM users WHERE email = 'test@example.com';

-- Reset all notification read status
UPDATE notifications SET read_at = NULL;

-- Delete all events for a specific match
DELETE FROM match_events WHERE match_id = 1;
```

---

## 6. WebSocket Testing

### Using wscat (recommended)

```bash
npm i -g wscat

# Anonymous connection
wscat -c ws://localhost:8000/ws

# Authenticated connection (replace TOKEN with a real JWT from /auth/login)
wscat -c "ws://localhost:8000/ws?token=YOUR_JWT_TOKEN_HERE"
```

After connecting you'll see:
```json
{"type":"welcome","authenticated":true,"username":"alice"}
{"type":"subscriptions_restored","matchIds":[1,3]}
```

### WebSocket messages to send

Paste these in the wscat prompt:

```json
// Subscribe to match 1
{"type":"subscribe","matchId":1}

// Unsubscribe from match 1
{"type":"unsubscribe","matchId":1}
```

### Expected server responses

| Message sent | Response |
|---|---|
| `subscribe` | `{"type":"subscribed","matchId":1}` |
| `unsubscribe` | `{"type":"unsubscribed","matchId":1}` |
| invalid JSON | `{"type":"error","message":"Invalid JSON"}` |

### Broadcast events (trigger from Postman)

When you POST to `/matches/1/commentary` or `/matches/1/events`, connected wscat sessions subscribed to match 1 will receive:

```json
// Commentary broadcast
{"type":"commentary","data":{"id":5,"matchId":1,"message":"Goal by Salah!","createdAt":"..."}}

// Match event broadcast (new type)
{"type":"match_event","data":{"id":1,"eventType":"goal","payload":{"player":"Salah","team":"home"},"author":{"id":2,"username":"alice","avatarUrl":null}}}
```

---

## 7. Postman — Full Endpoint Reference

**Base URL:** `http://localhost:8000`

> **How to set up Bearer token in Postman:**
> After login/register, copy the `token` value from the response.
> In Postman → Authorization tab → Type = **Bearer Token** → paste the token.

---

### Auth Routes (`/auth`)

---

#### `POST /auth/register`

**Purpose:** Create a new account. Returns a token immediately — no separate login needed.

- **Tab:** Body → raw → JSON
- **No auth required**

**Request body:**
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "securepass123"
}
```

**Expected response `201 Created`:**
```json
{
  "data": {
    "user": {
      "id": 1,
      "username": "alice",
      "email": "alice@example.com",
      "avatarUrl": null,
      "role": "viewer",
      "isActive": true,
      "createdAt": "2026-04-05T13:00:00.000Z",
      "updatedAt": "2026-04-05T13:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Validation error cases:**

| Bad input | Error |
|-----------|-------|
| `username` < 3 chars | `"Username must be at least 3 characters."` |
| Invalid email format | `"Must be a valid email address."` |
| `password` < 8 chars | `"Password must be at least 8 characters."` |
| Duplicate email/username | `409` `"Email or username already taken."` |

---

#### `POST /auth/login`

- **Tab:** Body → raw → JSON
- **No auth required**

**Request body:**
```json
{
  "email": "alice@example.com",
  "password": "securepass123"
}
```

**Expected response `200 OK`:**
```json
{
  "data": {
    "user": { "id": 1, "username": "alice", "role": "viewer", ... },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Validation error cases:**

| Bad input | Status | Error |
|-----------|--------|-------|
| Wrong password | `401` | `"Invalid email or password."` |
| Email not found | `401` | `"Invalid email or password."` *(timing-safe)* |
| Missing email | `400` | Zod validation detail |

---

#### `POST /auth/logout`

- **Auth:** Bearer token required
- **Body:** None

**Expected response:** `204 No Content`

**Error cases:**

| Case | Status | Error |
|------|--------|-------|
| No Authorization header | `401` | `"Missing or malformed Authorization header."` |
| Expired/invalid token | `401` | `"Invalid or expired token."` |

---

#### `GET /auth/me`

- **Auth:** Bearer token required
- **Body:** None

**Expected response `200 OK`:**
```json
{
  "data": {
    "user": {
      "id": 1,
      "username": "alice",
      "email": "alice@example.com",
      "role": "viewer",
      "avatarUrl": null,
      "isActive": true
    }
  }
}
```

---

### Match Routes (`/matches`)

---

#### `GET /matches`

- **No auth required**
- **Query Params:** `limit` (int 1–100, default 50)

**URL Examples:**
```
GET http://localhost:8000/matches
GET http://localhost:8000/matches?limit=10
```

**Expected response `200 OK`:**
```json
{
  "data": [
    {
      "id": 1,
      "sport": "football",
      "homeTeam": "Liverpool",
      "awayTeam": "Arsenal",
      "status": "live",
      "homeScore": 2,
      "awayScore": 1,
      "startTime": "2026-04-05T15:00:00.000Z"
    }
  ]
}
```

---

#### `POST /matches`

- **No auth required** *(public endpoint — existing behaviour preserved)*
- **Tab:** Body → raw → JSON

**Request body:**
```json
{
  "sport": "football",
  "homeTeam": "Liverpool",
  "awayTeam": "Arsenal",
  "startTime": "2026-04-05T15:00:00.000Z",
  "endTime": "2026-04-05T17:00:00.000Z"
}
```

**Expected response `201 Created`:**
```json
{
  "data": {
    "id": 1,
    "sport": "football",
    "homeTeam": "Liverpool",
    "awayTeam": "Arsenal",
    "status": "scheduled",
    "homeScore": 0,
    "awayScore": 0,
    "startTime": "2026-04-05T15:00:00.000Z",
    "endTime": "2026-04-05T17:00:00.000Z"
  }
}
```

**Validation error cases:**

| Bad input | Error |
|-----------|-------|
| `endTime` before `startTime` | `"endTime must be chronologically after startTime"` |
| `sport` missing | Zod validation error |
| Invalid ISO 8601 datetime | Zod validation error |

This also broadcasts `{"type":"match_created","data":{...}}` to all connected WebSocket clients.

---

### Commentary Routes (`/matches/:id/commentary`)

---

#### `GET /matches/1/commentary`

- **No auth required**
- **Query Params:** `limit` (default 100, max 100)

```
GET http://localhost:8000/matches/1/commentary
GET http://localhost:8000/matches/1/commentary?limit=20
```

---

#### `POST /matches/1/commentary`

- **No auth required** *(existing endpoint, preserved)*
- **Tab:** Body → raw → JSON

**Request body:**
```json
{
  "message": "Salah shoots from outside the box!",
  "minute": 34,
  "eventType": "shot",
  "actor": "Salah",
  "team": "home",
  "period": "1st half",
  "tags": ["shot", "on-target"]
}
```

**Expected response `201 Created`:**
```json
{
  "data": {
    "id": 5,
    "matchId": 1,
    "message": "Salah shoots from outside the box!",
    "minute": 34,
    "eventType": "shot",
    "actor": "Salah",
    "createdAt": "2026-04-05T13:00:00.000Z"
  }
}
```

Also broadcasts `{"type":"commentary","data":{...}}` to match subscribers.

---

### Match Events Routes (`/matches/:id/events`)

> ⚠️ **Requires auth.** POST additionally requires role `commentator` or `admin`.
> Promote a user in MySQL first: `UPDATE users SET role = 'admin' WHERE email = 'alice@example.com';`

---

#### `GET /matches/1/events`

- **Auth:** Bearer token required
- **Query Params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int 1–100 | `50` | Number of results |
| `event_type` | string | none | Filter by event type |
| `before_id` | int | none | Cursor pagination — get events older than this id |

**URL Examples:**
```
GET http://localhost:8000/matches/1/events
GET http://localhost:8000/matches/1/events?limit=10&event_type=goal
GET http://localhost:8000/matches/1/events?before_id=20&limit=10
```

**Expected response `200 OK`:**
```json
{
  "data": [
    {
      "id": 3,
      "matchId": 1,
      "eventType": "goal",
      "payload": { "player": "Salah", "team": "home", "assist": "Robertson" },
      "minute": 67,
      "period": "2nd half",
      "createdAt": "2026-04-05T13:30:00.000Z",
      "createdBy": {
        "id": 2,
        "username": "alice",
        "avatarUrl": null
      }
    }
  ]
}
```

---

#### `POST /matches/1/events`

- **Auth:** Bearer token required
- **Role:** `commentator` or `admin` only
- **Tab:** Body → raw → JSON

**Request body:**
```json
{
  "event_type": "goal",
  "payload": {
    "player": "Salah",
    "team": "home",
    "assist": "Robertson"
  },
  "minute": 67,
  "period": "2nd half"
}
```

**Expected response `201 Created`:**
```json
{
  "data": {
    "id": 1,
    "matchId": 1,
    "eventType": "goal",
    "payload": { "player": "Salah", "team": "home", "assist": "Robertson" },
    "minute": 67,
    "period": "2nd half",
    "createdBy": 2,
    "createdAt": "2026-04-05T13:30:00.000Z"
  }
}
```

**Side effects:**
- Broadcasts `{"type":"match_event","data":{...}}` to all in-memory match subscribers
- Inserts one `notifications` row per active subscriber (inside a DB transaction)

**Validation error cases:**

| Bad input | Status | Error |
|-----------|--------|-------|
| `event_type` missing | `400` | Zod validation error |
| `payload` is not an object | `400` | Zod validation error |
| `minute` < 0 or > 120 | `400` | Zod validation error |
| User is `viewer` role | `403` | `"Forbidden. Required role: commentator or admin."` |
| No token | `401` | `"Missing or malformed Authorization header."` |

**Other event_type examples to test:**
```json
{ "event_type": "substitution", "payload": { "playerOff": "Firmino", "playerOn": "Nunez", "team": "home" }, "minute": 72 }
{ "event_type": "yellow_card", "payload": { "player": "Partey", "team": "away" }, "minute": 45 }
{ "event_type": "timeout", "payload": { "team": "away", "reason": "tactical" }, "minute": 80, "period": "2nd half" }
{ "event_type": "wicket", "payload": { "batsman": "Root", "bowler": "Bumrah", "type": "lbw" }, "minute": null, "period": "2nd innings" }
```

---

### Subscriptions Routes (`/subscriptions`)

> ⚠️ **All routes require auth.**

---

#### `GET /subscriptions`

- **Auth:** Bearer token required
- **Body:** None

**Expected response `200 OK`:**
```json
{
  "data": [
    {
      "id": 1,
      "matchId": 1,
      "isActive": true,
      "subscribedAt": "2026-04-05T13:00:00.000Z",
      "unsubscribedAt": null,
      "match": {
        "id": 1,
        "sport": "football",
        "homeTeam": "Liverpool",
        "awayTeam": "Arsenal",
        "status": "live",
        "homeScore": 2,
        "awayScore": 1,
        "startTime": "2026-04-05T15:00:00.000Z"
      }
    }
  ]
}
```

---

#### `POST /subscriptions`

- **Auth:** Bearer token required
- **Tab:** Body → raw → JSON
- **Behaviour:** Upsert — safe to call multiple times for the same match

**Request body:**
```json
{
  "match_id": 1
}
```

**Expected response `201 Created`:**
```json
{
  "data": {
    "id": 1,
    "userId": 1,
    "matchId": 1,
    "isActive": true,
    "subscribedAt": "2026-04-05T13:00:00.000Z",
    "unsubscribedAt": null
  }
}
```

**Validation error cases:**

| Bad input | Status | Error |
|-----------|--------|-------|
| `match_id` is string | `400` | `"match_id must be a positive integer."` |
| `match_id` missing | `400` | Zod validation error |
| `match_id` is 0 or negative | `400` | Zod validation error |

---

#### `DELETE /subscriptions/1`

- **Auth:** Bearer token required
- **Body:** None
- **URL:** `DELETE http://localhost:8000/subscriptions/1` (where `1` is the `match_id`)
- **Behaviour:** Soft-delete — sets `is_active=false`, records `unsubscribed_at`

**Expected response:** `204 No Content`

**Verify in MySQL:**
```sql
SELECT user_id, match_id, is_active, unsubscribed_at
FROM subscriptions
WHERE match_id = 1;
```

---

### Notifications Routes (`/notifications`)

> ⚠️ **All routes require auth.**

---

#### `GET /notifications`

- **Auth:** Bearer token required
- **Query Params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `unread_only` | `true`/`false` or `1`/`0` | none | Filter to unread only |
| `limit` | int 1–100 | `20` | Number of results |

**URL Examples:**
```
GET http://localhost:8000/notifications
GET http://localhost:8000/notifications?unread_only=true
GET http://localhost:8000/notifications?unread_only=1&limit=50
```

**Expected response `200 OK`:**
```json
{
  "data": [
    {
      "id": 1,
      "userId": 1,
      "matchId": 1,
      "eventType": "goal",
      "message": "[goal] {\"player\":\"Salah\",\"team\":\"home\"}",
      "sourceId": 1,
      "sourceType": "match_event",
      "readAt": null,
      "createdAt": "2026-04-05T13:30:00.000Z"
    }
  ]
}
```

> **Note:** Notifications are only created for users who have an active subscription to the match when a `match_event` is posted.

---

#### `PATCH /notifications/read-all`

- **Auth:** Bearer token required
- **Body:** None

**Expected response `200 OK`:**
```json
{
  "data": {
    "updated": 5
  }
}
```

`updated` = number of previously-unread notifications now marked as read.

**Verify in MySQL:**
```sql
SELECT id, event_type, read_at FROM notifications WHERE user_id = 1;
```

---

## 8. Validation Error Reference

All validation errors return `400` with this shape:
```json
{
  "error": "Validation failed.",
  "details": [
    {
      "code": "too_small",
      "minimum": 8,
      "type": "string",
      "path": ["password"],
      "message": "Password must be at least 8 characters."
    }
  ]
}
```

### Common Zod validation triggers

| Endpoint | Field | Rule |
|----------|-------|------|
| `POST /auth/register` | `username` | Min length 3, max 50 |
| `POST /auth/register` | `email` | Valid email format |
| `POST /auth/register` | `password` | Min length 8 |
| `POST /matches` | `startTime` / `endTime` | ISO 8601 datetime |
| `POST /matches` | `endTime` | Must be after `startTime` |
| `POST /matches/:id/events` | `event_type` | Required, non-empty string |
| `POST /matches/:id/events` | `payload` | Must be a JSON object |
| `POST /matches/:id/events` | `minute` | Integer 0–120 |
| `POST /subscriptions` | `match_id` | Positive integer |

---

## 9. Role-Based Access Quick Reference

| Endpoint | `viewer` | `commentator` | `admin` |
|----------|----------|---------------|---------|
| `POST /auth/*` | ✅ | ✅ | ✅ |
| `GET /auth/me` | ✅ | ✅ | ✅ |
| `GET /matches` | ✅ (no auth) | ✅ | ✅ |
| `POST /matches` | ✅ (no auth) | ✅ | ✅ |
| `GET /matches/:id/commentary` | ✅ (no auth) | ✅ | ✅ |
| `POST /matches/:id/commentary` | ✅ (no auth) | ✅ | ✅ |
| `GET /matches/:id/events` | Auth required ✅ | ✅ | ✅ |
| **`POST /matches/:id/events`** | ❌ `403` | ✅ | ✅ |
| `GET /subscriptions` | ✅ | ✅ | ✅ |
| `POST /subscriptions` | ✅ | ✅ | ✅ |
| `DELETE /subscriptions/:id` | ✅ | ✅ | ✅ |
| `GET /notifications` | ✅ | ✅ | ✅ |
| `PATCH /notifications/read-all` | ✅ | ✅ | ✅ |

**Promote a user's role via MySQL:**
```sql
UPDATE users SET role = 'commentator' WHERE email = 'alice@example.com';
UPDATE users SET role = 'admin'       WHERE email = 'bob@example.com';
```

---

## 10. Useful SQL Diagnostic Queries

```sql
-- Check all foreign keys are intact
SELECT
  TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA = 'sportrealtime'
ORDER BY TABLE_NAME;

-- Full audit: user → sessions → subscriptions → notifications
SELECT
  u.username,
  u.role,
  COUNT(DISTINCT sess.id)  AS active_sessions,
  COUNT(DISTINCT sub.id)   AS active_subscriptions,
  COUNT(DISTINCT notif.id) AS unread_notifications
FROM users u
LEFT JOIN user_sessions  sess  ON sess.user_id  = u.id AND sess.expires_at > NOW()
LEFT JOIN subscriptions  sub   ON sub.user_id   = u.id AND sub.is_active = 1
LEFT JOIN notifications  notif ON notif.user_id = u.id AND notif.read_at IS NULL
GROUP BY u.id;

-- Fanout check: how many notifications per match event
SELECT
  me.id AS event_id,
  me.event_type,
  me.created_at,
  COUNT(n.id) AS notifications_created
FROM match_events me
LEFT JOIN notifications n ON n.source_id = me.id AND n.source_type = 'match_event'
GROUP BY me.id
ORDER BY me.created_at DESC;

-- Find orphaned sessions (token present but user inactive)
SELECT s.id, u.username, u.is_active, s.expires_at
FROM user_sessions s
JOIN users u ON u.id = s.user_id
WHERE u.is_active = 0;

-- Expired sessions (can be safely deleted)
SELECT COUNT(*) AS expired_sessions FROM user_sessions WHERE expires_at < NOW();
DELETE FROM user_sessions WHERE expires_at < NOW();
```

---

## End-to-End Test Flow (Postman sequence)

Follow this order to test the full system in one sitting:

```
1.  POST /auth/register         → save token as "admin_token"
2.  MySQL: UPDATE users SET role = 'admin' WHERE email = ...
3.  POST /auth/login            → confirm admin_token still works
4.  GET  /auth/me               → verify role = admin
5.  POST /matches               → save match id (e.g. 1)
6.  POST /auth/register         → register 2nd user "viewer", save "viewer_token"
7.  POST /subscriptions         → viewer subscribes to match 1
8.  GET  /subscriptions         → verify subscription returned
9.  wscat connect (viewer_token) → should see subscriptions_restored: [1]
10. POST /matches/1/events      → as admin: post a "goal" event
    → wscat should receive {"type":"match_event",...}
    → notifications row created for viewer
11. GET  /notifications          → as viewer: see the new notification
12. PATCH /notifications/read-all → mark all read, check updated count
13. POST /matches/1/events      → as viewer (403 expected)
14. DELETE /subscriptions/1     → viewer unsubscribes
15. GET  /subscriptions         → empty list
16. POST /auth/logout           → admin logs out (204)
17. GET  /auth/me               → with old token → 401
```
