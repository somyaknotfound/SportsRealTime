import { mysqlEnum, mysqlTable, int, varchar, datetime, json, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// Matches table
export const matches = mysqlTable('matches', {
  id: int('id').autoincrement().primaryKey(), // SERIAL -> INT AUTO_INCREMENT
  sport: varchar('sport', { length: 255 }).notNull(), // text -> varchar
  homeTeam: varchar('home_team', { length: 255 }).notNull(), // text -> varchar
  awayTeam: varchar('away_team', { length: 255 }).notNull(), // text -> varchar
  status: mysqlEnum('match_status', ['scheduled', 'live', 'finished'])
    .notNull()
    .default('scheduled'),
  startTime: datetime('start_time'),
  endTime: datetime('end_time'),
  homeScore: int('home_score').notNull().default(0),
  awayScore: int('away_score').notNull().default(0),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Commentary table
export const commentary = mysqlTable('commentary', {
  id: int('id').autoincrement().primaryKey(),
  matchId: int('match_id').notNull().references(() => matches.id),
  minute: int('minute'),
  sequence: int('sequence'),
  period: varchar('period', { length: 255 }),
  eventType: varchar('event_type', { length: 255 }),
  actor: varchar('actor', { length: 255 }),
  team: varchar('team', { length: 255 }),
  message: varchar('message', { length: 1024 }).notNull(),
  metadata: json('metadata'), // JSONB -> JSON
  tags: json('tags'),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('commentary_match_id_created_at_idx').on(table.matchId, table.createdAt)
]);
