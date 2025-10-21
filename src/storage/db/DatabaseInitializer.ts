import {getDb} from './Client';
import {sql} from 'drizzle-orm';
import * as schema from './Schema';
import {ALL_SQL_CONTENT} from "@/storage/db/SQL.ts";

export class DatabaseInitializer {

    /**
     * 初始化数据库
     * 创建所有必要的表结构和索引
     */
    public static async initializeDatabase(): Promise<boolean> {
        try {
            console.log('开始初始化数据库...');
            if (!await this.checkTableExists("games")) {
                await this.enableForeignKeys();
                await this.createTables();
                await this.setDefaultValues();
            }
            console.log('数据库初始化完成');
            return true;
        } catch (error) {
            console.error('数据库初始化失败:', error);
            return false;
        }
    }

    /**
     * 启用外键约束
     */
    private static async enableForeignKeys(): Promise<void> {
        const db = await getDb();
        await db.run(sql`PRAGMA
        foreign_keys = ON`);
        console.log('外键约束已启用');
    }

    /**
     * 检查数据库表是否存在
     */
    public static async checkTableExists(tableName: string): Promise<boolean> {
        try {
            const db = await getDb();
            const result: any = await db.get(sql`SELECT name
                                                 FROM sqlite_master
                                                 WHERE type = 'table'
                                                   AND name = ${tableName}`);
            return result.length > 0;
        } catch (error) {
            console.error(`检查表 ${tableName} 存在性时出错:`, error);
            return false;
        }
    }

    /**
     * 设置默认值, 比如游戏列表，默认配置
     */
    public static async setDefaultValues() {
        const db = await getDb();

        // 插入默认游戏 - 深岩银河
        await db.run(sql`INSERT
        OR IGNORE INTO games (name, display_name, install_path, is_active)
                          VALUES ('drg', 'Deep Rock Galactic', '/Users/bytedance/Project/DRG', true)`);

        // 插入默认用户
        await db.run(sql`INSERT
        OR IGNORE INTO users (username, email, avatar_url)
                          VALUES ('default_user', '', '')`);
    }

    /**
     * 创建数据库表
     */
    private static async createTables() {
        const db = await getDb();
        const tables = Object.values(schema);

        const queries = ALL_SQL_CONTENT
            .split('--> statement-breakpoint')
            .map(q => q.trim())
            .filter(q => q.length > 0);

        for (const query of queries) {
            console.log(`执行 SQL: ${query}`);
            await db.run(sql.raw(query));
        }
    }
}