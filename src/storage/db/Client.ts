import {drizzle} from "drizzle-orm/sqlite-proxy";
import Database from "@tauri-apps/plugin-sql";
import {path} from "@tauri-apps/api";
import {configDir} from "@tauri-apps/api/path";


let dbInstance: Awaited<ReturnType<typeof Database.load>>;

export async function initDb() {
    if (!dbInstance) {
        const configPath = await path.join(await configDir(), 'com.mint.cat', 'mintcat.sqlite');
        dbInstance = await Database.load(`sqlite:${configPath}`);
    }
    return dbInstance;
}

export async function getDb() {
    const db = await initDb();

    // 定义 proxy 回调：Drizzle 调用时会传入 SQL、参数和方法
    const callback = async (
        sql: string,
        params: any[],
        method: "run" | "all" | "values" | "get",
    ) => {
        //console.trace(sql, params, method);

        if (method === "run") {
            await db.execute(sql, params);
            return {rows: []};
        }

        const rows = (await db.select(sql, params)) as any[];
        //console.trace(rows);

        return {rows: rows.map((row) => Object.values(row))};
    };

    return drizzle(callback);
}