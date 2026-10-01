CREATE TABLE `article` (
	`slug` text PRIMARY KEY NOT NULL,
	`kind_ar` text NOT NULL,
	`kind_en` text DEFAULT '' NOT NULL,
	`date_ar` text NOT NULL,
	`date_en` text DEFAULT '' NOT NULL,
	`read_time_ar` text NOT NULL,
	`read_time_en` text DEFAULT '' NOT NULL,
	`image_id` text,
	`title_ar` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`lede_ar` text NOT NULL,
	`lede_en` text DEFAULT '' NOT NULL,
	`blocks` text NOT NULL,
	`quote_ar` text DEFAULT '' NOT NULL,
	`quote_en` text DEFAULT '' NOT NULL,
	`quote_by_ar` text DEFAULT '' NOT NULL,
	`quote_by_en` text DEFAULT '' NOT NULL,
	`tags` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `article_order_idx` ON `article` (`order`);--> statement-breakpoint
CREATE TABLE `event` (
	`slug` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`month_ar` text NOT NULL,
	`month_en` text DEFAULT '' NOT NULL,
	`title_ar` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`description_ar` text NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`href` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `event_order_idx` ON `event` (`order`);--> statement-breakpoint
CREATE TABLE `member` (
	`slug` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`logo_id` text,
	`initials` text NOT NULL,
	`role_ar` text NOT NULL,
	`role_en` text DEFAULT '' NOT NULL,
	`sector_ar` text NOT NULL,
	`sector_en` text DEFAULT '' NOT NULL,
	`since` text NOT NULL,
	`bio_ar` text NOT NULL,
	`bio_en` text DEFAULT '' NOT NULL,
	`lat` real,
	`lng` real,
	`city_ar` text DEFAULT '' NOT NULL,
	`city_en` text DEFAULT '' NOT NULL,
	`country_ar` text DEFAULT '' NOT NULL,
	`country_en` text DEFAULT '' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `member_order_idx` ON `member` (`order`);--> statement-breakpoint
CREATE TABLE `working_group` (
	`slug` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`challenge` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`scope_ar` text NOT NULL,
	`scope_en` text DEFAULT '' NOT NULL,
	`image_id` text,
	`order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `working_group_order_idx` ON `working_group` (`order`);