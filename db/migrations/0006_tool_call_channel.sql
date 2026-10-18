ALTER TABLE `tool_calls` ADD `channel` text;--> statement-breakpoint
ALTER TABLE `tool_calls` ADD `oauth_client_id` text;--> statement-breakpoint
CREATE INDEX `tool_calls_user_channel_idx` ON `tool_calls` (`user_id`,`channel`,`created_at`);