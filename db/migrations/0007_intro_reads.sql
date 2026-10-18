CREATE TABLE `intro_reads` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`)
);
