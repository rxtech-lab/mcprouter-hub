CREATE TABLE `news_content` (
	`url` text PRIMARY KEY NOT NULL,
	`markdown` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
