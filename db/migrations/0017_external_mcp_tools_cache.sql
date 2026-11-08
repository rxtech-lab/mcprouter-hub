ALTER TABLE `external_mcp_clients` ADD `tools_cache` text;--> statement-breakpoint
ALTER TABLE `external_mcp_clients` ADD `tools_cache_version` integer DEFAULT 0 NOT NULL;