CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`call_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_idx` ON `api_keys` (`hash`);--> statement-breakpoint
CREATE INDEX `api_keys_user_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `dataset_status` (
	`dataset_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`title_tc` text,
	`organization` text,
	`organization_title` text,
	`groups` text DEFAULT '[]' NOT NULL,
	`formats` text DEFAULT '[]' NOT NULL,
	`is_api` integer DEFAULT false NOT NULL,
	`url` text,
	`metadata_modified` text,
	`synced_at` integer,
	`removed_at` integer
);
--> statement-breakpoint
CREATE INDEX `datasets_org_idx` ON `datasets` (`organization`);--> statement-breakpoint
CREATE INDEX `datasets_synced_idx` ON `datasets` (`synced_at`);--> statement-breakpoint
CREATE TABLE `tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`api_key_id` text,
	`service` text NOT NULL,
	`tool` text NOT NULL,
	`status` text NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tool_calls_user_created_idx` ON `tool_calls` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tool_calls_key_idx` ON `tool_calls` (`api_key_id`);