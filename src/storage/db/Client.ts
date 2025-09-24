import { drizzle } from "drizzle-orm/sqlite-proxy";
import Database from "@tauri-apps/plugin-sql";


let dbInstance: Awaited<ReturnType<typeof Database.load>>;

export async function initDb() {
    if (!dbInstance) {
        dbInstance = await Database.load("sqlite:/Users/bytedance/Desktop/test.db");
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
        if (method === "run") {
            await db.execute(sql, params);
            return { rows: [] };
        }

        const rows = (await db.select(sql, params)) as any[];

        if (method === "values") {
            return { rows: rows.map((row) => Object.values(row)) };
        }

        return { rows };
    };

    return drizzle(callback);
}