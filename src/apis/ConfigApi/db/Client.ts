import Database from '@tauri-apps/plugin-sql';
import {drizzle} from "drizzle-orm/better-sqlite3";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
    if (!dbInstance) {
        const db = await Database.load('sqlite:test.db');
        dbInstance = drizzle(db);
    }
    return dbInstance;
}

