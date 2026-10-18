CREATE TABLE `mcp_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`regions` text DEFAULT '[]' NOT NULL,
	`services` text DEFAULT '[]' NOT NULL,
	`hidden_tools` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL
);
