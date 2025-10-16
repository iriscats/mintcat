export const ALL_SQL_CONTENT = `
    CREATE TABLE \`games\`
    (
        \`id\`           integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`name\`         text                          NOT NULL,
        \`display_name\` text                          NOT NULL,
        \`install_path\` text    DEFAULT ''            NOT NULL,
        \`is_active\`    integer DEFAULT true          NOT NULL,
        \`created_at\`   integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\`   integer DEFAULT (unixepoch()) NOT NULL
    );
--> statement-breakpoint
    CREATE UNIQUE INDEX \`games_name_unique\` ON \`games\` (\`name\`);--> statement-breakpoint
    CREATE INDEX \`games_active_idx\` ON \`games\` (\`is_active\`);--> statement-breakpoint
    CREATE TABLE \`mod_downloads\`
    (
        \`mod_id\`            integer PRIMARY KEY           NOT NULL,
        \`download_url\`      text    DEFAULT ''            NOT NULL,
        \`cache_path\`        text    DEFAULT ''            NOT NULL,
        \`file_size\`         integer DEFAULT 0             NOT NULL,
        \`download_progress\` integer DEFAULT 100           NOT NULL,
        \`download_status\`   text    DEFAULT 'completed'   NOT NULL,
        \`created_at\`        integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\`        integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (\`mod_id\`) REFERENCES \`mods\` (\`mod_id\`) ON UPDATE no action ON DELETE cascade
    );
--> statement-breakpoint
    CREATE INDEX \`mod_downloads_status_idx\` ON \`mod_downloads\` (\`download_status\`);--> statement-breakpoint
    CREATE TABLE \`mod_status\`
    (
        \`mod_id\`              integer PRIMARY KEY           NOT NULL,
        \`last_update_date\`    integer DEFAULT 0             NOT NULL,
        \`online_update_date\`  integer DEFAULT 0             NOT NULL,
        \`is_online_available\` integer DEFAULT true          NOT NULL,
        \`is_local_not_found\`  integer DEFAULT false         NOT NULL,
        \`created_at\`          integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\`          integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (\`mod_id\`) REFERENCES \`mods\` (\`mod_id\`) ON UPDATE no action ON DELETE cascade
    );
--> statement-breakpoint
    CREATE INDEX \`mod_status_status_idx\` ON \`mod_status\` (\`is_local_not_found\`);--> statement-breakpoint
    CREATE INDEX \`mod_status_online_idx\` ON \`mod_status\` (\`is_online_available\`);--> statement-breakpoint
    CREATE TABLE \`mod_versions\`
    (
        \`mod_id\`             integer PRIMARY KEY           NOT NULL,
        \`current_version\`    text    DEFAULT '-'           NOT NULL,
        \`available_versions\` text    DEFAULT '[]'          NOT NULL,
        \`created_at\`         integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\`         integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (\`mod_id\`) REFERENCES \`mods\` (\`mod_id\`) ON UPDATE no action ON DELETE cascade
    );
--> statement-breakpoint
    CREATE TABLE \`mods\`
    (
        \`mod_id\`          integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`platform_id\`     integer DEFAULT 0             NOT NULL,
        \`game_id\`         integer                       NOT NULL,
        \`name_id\`         text    DEFAULT ''            NOT NULL,
        \`display_name\`    text                          NOT NULL,
        \`url\`             text    DEFAULT ''            NOT NULL,
        \`source_type\`     text    DEFAULT 'Unknown'     NOT NULL,
        \`tags\`            text    DEFAULT '[]'          NOT NULL,
        \`approval_status\` text    DEFAULT 'Sandbox'     NOT NULL,
        \`depend_mod_id\`   integer DEFAULT 0             NOT NULL,
        \`created_at\`      integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\`      integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (\`game_id\`) REFERENCES \`games\` (\`id\`) ON UPDATE no action ON DELETE no action
    );
--> statement-breakpoint
    CREATE INDEX \`mods_name_idx\` ON \`mods\` (\`name_id\`);--> statement-breakpoint
    CREATE UNIQUE INDEX \`mods_platform_id_unique\` ON \`mods\` (\`platform_id\`);--> statement-breakpoint
    CREATE UNIQUE INDEX \`mods_url_unique\` ON \`mods\` (\`url\`);--> statement-breakpoint
    CREATE TABLE \`oauths\`
    (
        \`id\`         integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`uid\`        integer DEFAULT 0             NOT NULL,
        \`oauth\`      text    DEFAULT ''            NOT NULL,
        \`platform\`   text    DEFAULT ''            NOT NULL,
        \`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\` integer DEFAULT (unixepoch()) NOT NULL
    );
--> statement-breakpoint
    CREATE TABLE \`profile_folders\`
    (
        \`id\`               integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`profile_id\`       integer                       NOT NULL,
        \`parent_folder_id\` integer,
        \`name\`             text                          NOT NULL,
        \`folder_type\`      text    DEFAULT 'custom'      NOT NULL,
        \`sort_order\`       integer DEFAULT 0             NOT NULL,
        \`is_expanded\`      integer DEFAULT true          NOT NULL,
        \`created_at\`       integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\`       integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (\`profile_id\`) REFERENCES \`profiles\` (\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`parent_folder_id\`) REFERENCES \`profile_folders\` (\`id\`) ON UPDATE no action ON DELETE no action
    );
--> statement-breakpoint
    CREATE UNIQUE INDEX \`profile_folders_profile_name_unique\` ON \`profile_folders\` (\`profile_id\`, \`name\`, \`parent_folder_id\`);--> statement-breakpoint
    CREATE INDEX \`profile_folders_profile_sort_idx\` ON \`profile_folders\` (\`profile_id\`, \`sort_order\`);--> statement-breakpoint
    CREATE INDEX \`profile_folders_parent_idx\` ON \`profile_folders\` (\`parent_folder_id\`);--> statement-breakpoint
    CREATE TABLE \`profile_mods\`
    (
        \`id\`               integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`profile_id\`       integer                       NOT NULL,
        \`mod_id\`           integer                       NOT NULL,
        \`parent_folder_id\` integer,
        \`sort_order\`       integer DEFAULT 0             NOT NULL,
        \`is_enabled\`       integer DEFAULT true          NOT NULL,
        \`used_version\`     text    DEFAULT ''            NOT NULL,
        \`created_at\`       integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\`       integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (\`profile_id\`) REFERENCES \`profiles\` (\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`mod_id\`) REFERENCES \`mods\` (\`mod_id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`parent_folder_id\`) REFERENCES \`profile_folders\` (\`id\`) ON UPDATE no action ON DELETE no action
    );
--> statement-breakpoint
    CREATE UNIQUE INDEX \`profile_mods_profile_mod_unique\` ON \`profile_mods\` (\`profile_id\`, \`mod_id\`);--> statement-breakpoint
    CREATE INDEX \`profile_mods_profile_sort_idx\` ON \`profile_mods\` (\`profile_id\`, \`sort_order\`);--> statement-breakpoint
    CREATE INDEX \`profile_mods_folder_idx\` ON \`profile_mods\` (\`parent_folder_id\`);--> statement-breakpoint
    CREATE TABLE \`profiles\`
    (
        \`id\`           integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`name\`         text                          NOT NULL,
        \`display_name\` text                          NOT NULL,
        \`game_id\`      integer                       NOT NULL,
        \`user_id\`      integer                       NOT NULL,
        \`is_active\`    integer DEFAULT false         NOT NULL,
        \`description\`  text    DEFAULT ''            NOT NULL,
        \`last_used_at\` integer DEFAULT (unixepoch()) NOT NULL,
        \`created_at\`   integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\`   integer DEFAULT (unixepoch()) NOT NULL,
        FOREIGN KEY (\`game_id\`) REFERENCES \`games\` (\`id\`) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE no action ON DELETE no action
    );
--> statement-breakpoint
    CREATE UNIQUE INDEX \`profiles_name_game_user_unique\` ON \`profiles\` (\`name\`, \`game_id\`, \`user_id\`);--> statement-breakpoint
    CREATE INDEX \`profiles_active_idx\` ON \`profiles\` (\`is_active\`);--> statement-breakpoint
    CREATE INDEX \`profiles_user_game_idx\` ON \`profiles\` (\`user_id\`, \`game_id\`);--> statement-breakpoint
    CREATE TABLE \`settings\`
    (
        \`id\`         integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`name\`       text    DEFAULT ''            NOT NULL,
        \`value\`      text    DEFAULT ''            NOT NULL,
        \`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\` integer DEFAULT (unixepoch()) NOT NULL
    );
--> statement-breakpoint
    CREATE UNIQUE INDEX \`settings_name_unique\` ON \`settings\` (\`name\`);--> statement-breakpoint
    CREATE TABLE \`users\`
    (
        \`id\`         integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`username\`   text                          NOT NULL,
        \`email\`      text    DEFAULT ''            NOT NULL,
        \`avatar_url\` text    DEFAULT ''            NOT NULL,
        \`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
        \`updated_at\` integer DEFAULT (unixepoch()) NOT NULL
    );
`;
