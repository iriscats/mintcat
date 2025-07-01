import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";



export const modInfos = sqliteTable("mod_info", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source"),
    modId: integer("mod_id"),
    name: text("name"),
});


export const profiles = sqliteTable("profiles", {
    id: integer("id").primaryKey({ autoIncrement: true }),

});


export const profileDetails = sqliteTable("profile_details", {
    id: integer("id").primaryKey({ autoIncrement: true }),

});



