CREATE TABLE `external_mcp_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`credentials` text NOT NULL,
	`connected` integer DEFAULT false NOT NULL,
	`state_hash` text,
	`state_expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `external_mcp_user_idx` ON `external_mcp_clients` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_mcp_state_idx` ON `external_mcp_clients` (`state_hash`);--> statement-breakpoint
CREATE TABLE `scheduled_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`script` text DEFAULT '[]' NOT NULL,
	`interval_minutes` integer,
	`next_run_at` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`lease_id` text,
	`lease_until` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scheduled_tasks_user_idx` ON `scheduled_tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `scheduled_tasks_due_idx` ON `scheduled_tasks` (`enabled`,`next_run_at`);--> statement-breakpoint
CREATE TABLE `task_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`chat_id` text,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `scheduled_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_runs_task_idx` ON `task_runs` (`task_id`,`created_at`);