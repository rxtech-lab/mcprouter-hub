ALTER TABLE `scheduled_tasks` ADD `cron_expression` text;--> statement-breakpoint
ALTER TABLE `scheduled_tasks` ADD `time_zone` text DEFAULT 'UTC' NOT NULL;
--> statement-breakpoint
UPDATE scheduled_tasks SET cron_expression =
  CASE interval_minutes
    WHEN 60 THEN strftime('%M', next_run_at / 1000, 'unixepoch') || ' * * * *'
    WHEN 1440 THEN strftime('%M %H', next_run_at / 1000, 'unixepoch') || ' * * *'
    WHEN 10080 THEN strftime('%M %H', next_run_at / 1000, 'unixepoch') || ' * * ' || strftime('%w', next_run_at / 1000, 'unixepoch')
  END,
  interval_minutes = NULL
WHERE interval_minutes IN (60, 1440, 10080);
