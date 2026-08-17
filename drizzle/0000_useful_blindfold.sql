CREATE TABLE `holdings` (
	`portfolio_id` integer NOT NULL,
	`ticker` text NOT NULL,
	`weight` real NOT NULL,
	PRIMARY KEY(`portfolio_id`, `ticker`),
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `market` (
	`date` text PRIMARY KEY NOT NULL,
	`vix` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`commission_bps` real DEFAULT 0 NOT NULL,
	`cash` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`ticker` text NOT NULL,
	`date` text NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`close` real NOT NULL,
	PRIMARY KEY(`ticker`, `date`)
);
