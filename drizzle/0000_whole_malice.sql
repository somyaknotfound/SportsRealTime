CREATE TABLE `commentary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`match_id` int NOT NULL,
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
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `commentary` ADD CONSTRAINT `commentary_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE no action ON UPDATE no action;