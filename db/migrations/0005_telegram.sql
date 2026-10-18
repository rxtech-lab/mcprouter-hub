CREATE TABLE `telegram_links` (
	`telegram_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text DEFAULT '' NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `telegram_links_user_idx` ON `telegram_links` (`user_id`);