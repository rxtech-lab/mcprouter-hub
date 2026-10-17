CREATE TABLE `free_chat_usage` (
	`subject` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`subject`, `day`)
);
