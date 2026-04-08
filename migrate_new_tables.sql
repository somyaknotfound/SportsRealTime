-- ============================================================
-- SportRealTime — Manual Migration Script
-- Run this DIRECTLY in your MySQL client:
--   mysql -u student -p sportrealtime < migrate_new_tables.sql
-- OR paste section by section into the MySQL prompt.
--
-- This script is safe to run: it only ADDS new tables and
-- the two new columns. It does NOT touch existing table rows.
-- ============================================================

USE sportrealtime;

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Create users table FIRST (other tables reference it)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT          AUTO_INCREMENT NOT NULL,
  `username`      VARCHAR(50)  NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `avatar_url`    VARCHAR(500) NULL,
  `role`          ENUM('viewer','commentator','admin') NOT NULL DEFAULT 'viewer',
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `users_id`           PRIMARY KEY (`id`),
  CONSTRAINT `users_username_unique` UNIQUE (`username`),
  CONSTRAINT `users_email_unique`    UNIQUE (`email`)
);

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Create user_sessions table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id`          INT          AUTO_INCREMENT NOT NULL,
  `user_id`     INT          NOT NULL,
  `token`       VARCHAR(512) NOT NULL,
  `ip_address`  VARCHAR(45)  NULL,
  `user_agent`  TEXT         NULL,
  `expires_at`  TIMESTAMP    NOT NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `user_sessions_id`           PRIMARY KEY (`id`),
  CONSTRAINT `user_sessions_token_unique` UNIQUE (`token`)
);

ALTER TABLE `user_sessions`
  ADD CONSTRAINT `user_sessions_user_id_fk`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;

CREATE INDEX `sessions_user_id_idx`   ON `user_sessions` (`user_id`);
CREATE INDEX `sessions_token_idx`     ON `user_sessions` (`token`);
CREATE INDEX `sessions_expires_at_idx` ON `user_sessions` (`expires_at`);

-- ─────────────────────────────────────────────────────────────
-- STEP 3: Create subscriptions table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id`              INT       AUTO_INCREMENT NOT NULL,
  `user_id`         INT       NOT NULL,
  `match_id`        INT       NOT NULL,
  `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
  `subscribed_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unsubscribed_at` TIMESTAMP NULL,
  CONSTRAINT `subscriptions_id`             PRIMARY KEY (`id`),
  CONSTRAINT `subscriptions_user_match_idx` UNIQUE (`user_id`, `match_id`)
);

ALTER TABLE `subscriptions`
  ADD CONSTRAINT `subscriptions_user_id_fk`
  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)   ON DELETE CASCADE;

ALTER TABLE `subscriptions`
  ADD CONSTRAINT `subscriptions_match_id_fk`
  FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE CASCADE;

CREATE INDEX `subscriptions_user_id_idx`    ON `subscriptions` (`user_id`);
CREATE INDEX `subscriptions_match_id_idx`   ON `subscriptions` (`match_id`);
CREATE INDEX `subscriptions_match_active_idx` ON `subscriptions` (`match_id`, `is_active`);

-- ─────────────────────────────────────────────────────────────
-- STEP 4: Create match_events table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `match_events` (
  `id`         INT         AUTO_INCREMENT NOT NULL,
  `match_id`   INT         NOT NULL,
  `event_type` VARCHAR(50) NOT NULL,
  `payload`    JSON        NOT NULL,
  `minute`     INT         NULL,
  `period`     VARCHAR(20) NULL,
  `created_by` INT         NULL,
  `created_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `match_events_id` PRIMARY KEY (`id`)
);

ALTER TABLE `match_events`
  ADD CONSTRAINT `match_events_match_id_fk`
  FOREIGN KEY (`match_id`)   REFERENCES `matches`(`id`) ON DELETE CASCADE;

ALTER TABLE `match_events`
  ADD CONSTRAINT `match_events_created_by_fk`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)   ON DELETE SET NULL;

CREATE INDEX `match_events_match_id_idx`         ON `match_events` (`match_id`);
CREATE INDEX `match_events_match_type_idx`        ON `match_events` (`match_id`, `event_type`);
CREATE INDEX `match_events_match_created_at_idx`  ON `match_events` (`match_id`, `created_at`);

-- ─────────────────────────────────────────────────────────────
-- STEP 5: Create notifications table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`          INT         AUTO_INCREMENT NOT NULL,
  `user_id`     INT         NOT NULL,
  `match_id`    INT         NOT NULL,
  `event_type`  VARCHAR(50) NOT NULL,
  `message`     TEXT        NOT NULL,
  `source_id`   INT         NULL,
  `source_type` ENUM('commentary','match_event') NULL,
  `read_at`     TIMESTAMP   NULL,
  `created_at`  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `notifications_id` PRIMARY KEY (`id`)
);

ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_user_id_fk`
  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)   ON DELETE CASCADE;

ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_match_id_fk`
  FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE CASCADE;

CREATE INDEX `notifications_user_id_idx`    ON `notifications` (`user_id`);
CREATE INDEX `notifications_user_read_at_idx` ON `notifications` (`user_id`, `read_at`);
CREATE INDEX `notifications_user_match_idx` ON `notifications` (`user_id`, `match_id`);

-- ─────────────────────────────────────────────────────────────
-- STEP 6: Alter existing tables — add new columns
-- (IF NOT EXISTS guard avoids error if run twice)
-- ─────────────────────────────────────────────────────────────

-- Add created_by to matches
ALTER TABLE `matches`
  ADD COLUMN IF NOT EXISTS `created_by` INT NULL;

ALTER TABLE `matches`
  ADD CONSTRAINT `matches_created_by_fk`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL;

-- Add user_id to commentary
ALTER TABLE `commentary`
  ADD COLUMN IF NOT EXISTS `user_id` INT NULL;

ALTER TABLE `commentary`
  ADD CONSTRAINT `commentary_user_id_fk`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS `commentary_user_id_idx` ON `commentary` (`user_id`);

-- ─────────────────────────────────────────────────────────────
-- STEP 7: Also fix the old broken PostgreSQL index from 0001
-- (It was never applied — the MySQL equivalent is:)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS `commentary_match_id_created_at_idx`
  ON `commentary` (`match_id`, `created_at`);

-- ─────────────────────────────────────────────────────────────
-- VERIFY: run this to confirm all 7 tables exist
-- ─────────────────────────────────────────────────────────────
SHOW TABLES;
