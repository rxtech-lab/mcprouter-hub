CREATE TABLE `whatsapp_links` (
	`phone_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text DEFAULT '' NOT NULL,
	`phone_hint` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `whatsapp_links_user_idx` ON `whatsapp_links` (`user_id`);