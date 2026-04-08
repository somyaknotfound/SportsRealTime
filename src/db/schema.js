import {
  mysqlEnum,
  mysqlTable,
  int,
  varchar,
  datetime,
  json,
  index,
  boolean,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';

// ──────────────────────────────────────────────
// USERS
// ──────────────────────────────────────────────
export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  role: mysqlEnum('role', ['viewer', 'commentator', 'admin']).notNull().default('viewer'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
}, (t) => [
  uniqueIndex('users_email_idx').on(t.email),
  uniqueIndex('users_username_idx').on(t.username),
]);

// ──────────────────────────────────────────────
// USER SESSIONS  (one row per active session)
// ──────────────────────────────────────────────
export const userSessions = mysqlTable('user_sessions', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Store a SHA-256 hash of the JWT jti claim — never the raw token
  token: varchar('token', { length: 512 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 45 }),      // IPv6-safe
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('sessions_user_id_idx').on(t.userId),
  index('sessions_token_idx').on(t.token),
  index('sessions_expires_at_idx').on(t.expiresAt),      // cleanup jobs
]);

// ──────────────────────────────────────────────
// MATCHES  (extended — homeScore/awayScore already existed)
// ──────────────────────────────────────────────
export const matches = mysqlTable('matches', {
  id: int('id').autoincrement().primaryKey(),
  sport: varchar('sport', { length: 255 }).notNull(),
  homeTeam: varchar('home_team', { length: 255 }).notNull(),
  awayTeam: varchar('away_team', { length: 255 }).notNull(),
  status: mysqlEnum('match_status', ['scheduled', 'live', 'finished']).notNull().default('scheduled'),
  startTime: datetime('start_time'),
  endTime: datetime('end_time'),
  homeScore: int('home_score').notNull().default(0),
  awayScore: int('away_score').notNull().default(0),
  // NEW: who created this match (commentator/admin)
  // createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ──────────────────────────────────────────────
// COMMENTARY  (extended — added userId attribution)
// ──────────────────────────────────────────────
export const commentary = mysqlTable('commentary', {
  id: int('id').autoincrement().primaryKey(),
  matchId: int('match_id').notNull().references(() => matches.id),
  // NEW: optional user attribution
  userId: int('user_id').references(() => users.id, { onDelete: 'set null' }),
  minute: int('minute'),
  sequence: int('sequence'),
  period: varchar('period', { length: 255 }),
  eventType: varchar('event_type', { length: 255 }),
  actor: varchar('actor', { length: 255 }),
  team: varchar('team', { length: 255 }),
  message: varchar('message', { length: 1024 }).notNull(),
  metadata: json('metadata'),
  tags: json('tags'),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  index('commentary_match_id_created_at_idx').on(t.matchId, t.createdAt),
  index('commentary_user_id_idx').on(t.userId),
]);

// ──────────────────────────────────────────────
// SUBSCRIPTIONS  (persistent, soft-deleted on unsubscribe)
// ──────────────────────────────────────────────
export const subscriptions = mysqlTable('subscriptions', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId: int('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').notNull().default(true),
  subscribedAt: timestamp('subscribed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  unsubscribedAt: timestamp('unsubscribed_at'),
}, (t) => [
  uniqueIndex('subscriptions_user_match_idx').on(t.userId, t.matchId),
  index('subscriptions_user_id_idx').on(t.userId),
  index('subscriptions_match_id_idx').on(t.matchId),
  index('subscriptions_match_active_idx').on(t.matchId, t.isActive),
]);

// ──────────────────────────────────────────────
// MATCH EVENTS  (typed, structured event log)
// ──────────────────────────────────────────────
export const matchEvents = mysqlTable('match_events', {
  id: int('id').autoincrement().primaryKey(),
  matchId: int('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  payload: json('payload').notNull(),            // e.g. { player, team, assist }
  minute: int('minute'),
  period: varchar('period', { length: 20 }),    // e.g. '1st half', '2nd innings'
  createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('match_events_match_id_idx').on(t.matchId),
  index('match_events_match_type_idx').on(t.matchId, t.eventType),
  index('match_events_match_created_at_idx').on(t.matchId, t.createdAt),
]);

// ──────────────────────────────────────────────
// NOTIFICATIONS  (fanout queue — one row per subscriber per event)
// ──────────────────────────────────────────────
export const notifications = mysqlTable('notifications', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId: int('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  message: text('message').notNull(),
  // Polymorphic FK: points to commentary.id or match_events.id
  sourceId: int('source_id'),
  sourceType: mysqlEnum('source_type', ['commentary', 'match_event']),
  readAt: timestamp('read_at'),                // null = unread
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('notifications_user_id_idx').on(t.userId),
  index('notifications_user_read_at_idx').on(t.userId, t.readAt),
  index('notifications_user_match_idx').on(t.userId, t.matchId),
]);

// ──────────────────────────────────────────────
// RELATIONS  (for Drizzle query builder joins)
// ──────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSessions),
  subscriptions: many(subscriptions),
  matchEvents: many(matchEvents),
  notifications: many(notifications),
  commentary: many(commentary),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));

export const matchesRelations = relations(matches, ({ many, one }) => ({
  commentary: many(commentary),
  subscriptions: many(subscriptions),
  matchEvents: many(matchEvents),
  notifications: many(notifications),
  createdBy: one(users, { fields: [matches.createdBy], references: [users.id] }),
}));

export const commentaryRelations = relations(commentary, ({ one }) => ({
  match: one(matches, { fields: [commentary.matchId], references: [matches.id] }),
  user: one(users, { fields: [commentary.userId], references: [users.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  match: one(matches, { fields: [subscriptions.matchId], references: [matches.id] }),
}));

export const matchEventsRelations = relations(matchEvents, ({ one }) => ({
  match: one(matches, { fields: [matchEvents.matchId], references: [matches.id] }),
  createdBy: one(users, { fields: [matchEvents.createdBy], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  match: one(matches, { fields: [notifications.matchId], references: [matches.id] }),
}));
