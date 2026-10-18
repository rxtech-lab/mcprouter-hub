ALTER TABLE `oauth_grants` ADD `scopes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `telegram_links` ADD `scopes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_links` ADD `scopes` text DEFAULT '[]' NOT NULL;