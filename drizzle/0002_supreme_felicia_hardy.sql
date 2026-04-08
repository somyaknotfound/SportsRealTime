CREATE TABLE `commentary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`match_id` int NOT NULL,
	`user_id` int,
	`minute` int,
	`sequence` int,
	`period` varchar(255),
	`event_type` varchar(255),
	`actor` varchar(255),
	`team` varchar(255),
	`message` varchar(1024) NOT NULL,
	`metadata` json,
	`tags` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `commentary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `match_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`match_id` int NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`payload` json NOT NULL,
	`minute` int,
	`period` varchar(20),
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `match_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sport` varchar(255) NOT NULL,
	`home_team` varchar(255) NOT NULL,
	`away_team` varchar(255) NOT NULL,
	`match_status` enum('scheduled','live','finished') NOT NULL DEFAULT 'scheduled',
	`start_time` datetime,
	`end_time` datetime,
	`home_score` int NOT NULL DEFAULT 0,
	`away_score` int NOT NULL DEFAULT 0,
	`created_by` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`match_id` int NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`message` text NOT NULL,
	`source_id` int,
	`source_type` enum('commentary','match_event'),
	`read_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`match_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`subscribed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`unsubscribed_at` timestamp,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_user_match_idx` UNIQUE(`user_id`,`match_id`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`ip_address` varchar(45),
	`user_agent` text,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(50) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`avatar_url` varchar(500),
	`role` enum('viewer','commentator','admin') NOT NULL DEFAULT 'viewer',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_email_idx` UNIQUE(`email`),
	CONSTRAINT `users_username_idx` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `commentary` ADD CONSTRAINT `commentary_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commentary` ADD CONSTRAINT `commentary_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_events` ADD CONSTRAINT `match_events_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_events` ADD CONSTRAINT `match_events_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `commentary_match_id_created_at_idx` ON `commentary` (`match_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `commentary_user_id_idx` ON `commentary` (`user_id`);--> statement-breakpoint
CREATE INDEX `match_events_match_id_idx` ON `match_events` (`match_id`);--> statement-breakpoint
CREATE INDEX `match_events_match_type_idx` ON `match_events` (`match_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `match_events_match_created_at_idx` ON `match_events` (`match_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_user_id_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_at_idx` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
CREATE INDEX `notifications_user_match_idx` ON `notifications` (`user_id`,`match_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_user_id_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_match_id_idx` ON `subscriptions` (`match_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_match_active_idx` ON `subscriptions` (`match_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_token_idx` ON `user_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `user_sessions` (`expires_at`);