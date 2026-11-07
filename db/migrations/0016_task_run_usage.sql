ALTER TABLE `task_runs` ADD `trigger` text;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `usage_tracked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `chat_units` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `chat_charged_units` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `mcp_calls` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `mcp_units` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `premium_mcp_units` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `mcp_charged_units` real DEFAULT 0 NOT NULL;