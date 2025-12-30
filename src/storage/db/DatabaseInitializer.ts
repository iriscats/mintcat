import {getDb} from './Client';
import {sql} from 'drizzle-orm';
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
     * 创建默认profile（仅在迁移后且没有profile时调用）
     */
    public static async ensureDefaultProfile(): Promise<void> {
        try {
            const db = await getDb();

            // 使用 all() 查询 COUNT，注意 drizzle proxy 会把结果转换为值数组
            const result: any = await db.all(sql`SELECT COUNT(*) as count FROM profiles`);

            console.log('[ensureDefaultProfile] 查询结果:', result);

            // 由于 Client.ts 第55行把结果转换成了 Object.values(row)
            // 所以 result 是 [[count_value]]，我们需要访问 result[0][0]
            const count = result && Array.isArray(result) && result.length > 0 && Array.isArray(result[0])
                ? result[0][0]
                : 0;

            console.log('[ensureDefaultProfile] Profile count:', count);

            if (count > 0) {
                console.log('已存在profile，跳过创建默认profile');
                return;
            }

            console.log('未找到profile，创建默认profile...');

            // 插入默认 profile
            await db.run(sql`INSERT
            OR IGNORE INTO profiles (name, display_name, game_id, user_id, is_active, description)
                              VALUES ('default', 'Default Profile', 1, 1, true, 'Default mod configuration profile')`);

            // 插入 Modio 文件夹
            await db.run(sql`INSERT
            OR IGNORE INTO profile_folders (profile_id, name, folder_type, sort_order, is_expanded)
                                  VALUES (1,'mod.io','modio', 1, true)`);

            // 插入 Local 文件夹
            await db.run(sql`INSERT
            OR IGNORE INTO profile_folders (profile_id, name, folder_type, sort_order, is_expanded)
                                  VALUES (1,'Local','local', 2, true)`);

            console.log('默认 profile 创建完成');
        } catch (error) {
            console.error('创建默认profile失败:', error);
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
            // db.get() may return undefined, null, or an empty array [] when no rows found
            const exists = result !== undefined && result !== null &&
                          !(Array.isArray(result) && result.length === 0);
            console.log(`检查表 ${tableName}: ${exists ? '存在' : '不存在'}`);
            return exists;
        } catch (error) {
            console.error(`检查表 ${tableName} 存在性时出错:`, error);
            return false;
        }
    }

    /**
     * 设置默认值, 比如游戏列表，默认用户
     * 注意：profile的创建在迁移后进行，见ensureDefaultProfile()
     */
    public static async setDefaultValues() {
        const db = await getDb();

        // 插入默认游戏
        await db.run(sql`INSERT
        OR IGNORE INTO games (name, display_name, install_path, is_active)
                          VALUES ('drg', 'Deep Rock Galactic', '', true)`);


        await db.run(sql`INSERT
        OR IGNORE INTO games (name, display_name, install_path, is_active)
                          VALUES ('rc', 'Deep Rock Galactic: Rogue Core', '', true)`);

        // 插入默认用户
        await db.run(sql`INSERT
        OR IGNORE INTO users (username, email, avatar_url)
                          VALUES ('default_user', '', '')`);

        console.log('默认游戏和用户插入完成');
    }

    /**
     * 创建数据库表
     */
    private static async createTables() {
        const db = await getDb();

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