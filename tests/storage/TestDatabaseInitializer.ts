import { testDbClient, getTestDb } from './TestClient';
import { sql } from 'drizzle-orm';
import { 
    games, users, oauths, mods, modVersions, modDownloads, modStatus,
    profiles, profileFolders, profileMods, settings
} from './Schema';

/**
 * 测试环境数据库初始化工具
 * 基于 sql.js 提供内存数据库的初始化和管理功能
 */
export class TestDatabaseInitializer {
    
    /**
     * 初始化测试数据库
     * 创建所有必要的表结构和索引
     */
    public static async initializeDatabase(): Promise<boolean> {
        try {
            console.log('开始初始化测试数据库...');
            
            // 初始化 sql.js 客户端
            await testDbClient.initialize();
            
            // 启用外键约束
            await this.enableForeignKeys();
            
            // 创建表结构
            await this.createTables();
            
            // 插入初始数据
            await this.insertInitialData();
            
            console.log('测试数据库初始化完成');
            return true;
        } catch (error) {
            console.error('测试数据库初始化失败:', error);
            return false;
        }
    }
    
    /**
     * 启用外键约束
     */
    private static async enableForeignKeys(): Promise<void> {
        const db = await getTestDb();
        await db.run(sql`PRAGMA foreign_keys = ON`);
        console.log('外键约束已启用');
    }
    
    /**
     * 创建数据库表
     * 使用原生 SQL 创建表结构，确保与 Schema.ts 定义一致
     */
    private static async createTables(): Promise<void> {
        console.log('创建测试数据库表...');
        
        const rawDb = testDbClient.getRawDb();
        
        // 创建 games 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                install_path TEXT NOT NULL DEFAULT '',
                version TEXT NOT NULL DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 games 表索引
        rawDb.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS games_name_unique ON games(name);
            CREATE INDEX IF NOT EXISTS games_active_idx ON games(is_active);
        `);
        
        // 创建 users 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT NOT NULL DEFAULT '',
                avatar_url TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 oauths 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS oauths (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid INTEGER NOT NULL DEFAULT 0,
                oauth TEXT NOT NULL DEFAULT '',
                platform TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 mods 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS mods (
                mod_id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform_id INTEGER NOT NULL DEFAULT 0,
                game_id INTEGER NOT NULL REFERENCES games(id),
                name_id TEXT NOT NULL DEFAULT '',
                display_name TEXT NOT NULL,
                url TEXT NOT NULL DEFAULT '',
                source_type TEXT NOT NULL DEFAULT 'Unknown',
                tags TEXT NOT NULL DEFAULT '[]',
                approval_status TEXT NOT NULL DEFAULT 'Sandbox',
                depend_mod_id INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 mods 表索引
        rawDb.exec(`
            CREATE INDEX IF NOT EXISTS mods_name_idx ON mods(name_id);
            CREATE UNIQUE INDEX IF NOT EXISTS mods_platform_id_unique ON mods(platform_id);
            CREATE UNIQUE INDEX IF NOT EXISTS mods_url_unique ON mods(url);
        `);
        
        // 创建 mod_versions 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS mod_versions (
                mod_id INTEGER PRIMARY KEY REFERENCES mods(mod_id) ON DELETE CASCADE,
                current_version TEXT NOT NULL DEFAULT '-',
                available_versions TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 mod_downloads 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS mod_downloads (
                mod_id INTEGER PRIMARY KEY REFERENCES mods(mod_id) ON DELETE CASCADE,
                download_url TEXT NOT NULL DEFAULT '',
                cache_path TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                download_progress INTEGER NOT NULL DEFAULT 100,
                download_status TEXT NOT NULL DEFAULT 'completed',
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 mod_downloads 表索引
        rawDb.exec(`
            CREATE INDEX IF NOT EXISTS mod_downloads_status_idx ON mod_downloads(download_status);
        `);
        
        // 创建 mod_approvals 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS mod_approvals (
                mod_id INTEGER PRIMARY KEY REFERENCES mods(mod_id) ON DELETE CASCADE,
                last_update_date INTEGER NOT NULL DEFAULT 0,
                online_update_date INTEGER NOT NULL DEFAULT 0,
                is_online_available INTEGER NOT NULL DEFAULT 1,
                is_local_not_found INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 mod_approvals 表索引
        rawDb.exec(`
            CREATE INDEX IF NOT EXISTS mod_approvals_status_idx ON mod_approvals(is_local_not_found);
            CREATE INDEX IF NOT EXISTS mod_approvals_online_idx ON mod_approvals(is_online_available);
        `);
        
        // 重新创建正确的 profiles 表（配置文件表）
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                game_id INTEGER NOT NULL REFERENCES games(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                is_active INTEGER NOT NULL DEFAULT 0,
                description TEXT NOT NULL DEFAULT '',
                last_used_at INTEGER NOT NULL DEFAULT (unixepoch()),
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 user_profiles 表索引
        rawDb.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS profiles_name_game_user_unique ON profiles(name, game_id, user_id);
            CREATE INDEX IF NOT EXISTS profiles_active_idx ON profiles(is_active);
            CREATE INDEX IF NOT EXISTS profiles_user_game_idx ON profiles(user_id, game_id);
        `);
        
        // 创建 profile_folders 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS profile_folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                parent_folder_id INTEGER REFERENCES profile_folders(id),
                name TEXT NOT NULL,
                folder_type TEXT NOT NULL DEFAULT 'custom',
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_expanded INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 profile_folders 表索引
        rawDb.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS profile_folders_profile_name_unique ON profile_folders(profile_id, name, parent_folder_id);
            CREATE INDEX IF NOT EXISTS profile_folders_profile_sort_idx ON profile_folders(profile_id, sort_order);
            CREATE INDEX IF NOT EXISTS profile_folders_parent_idx ON profile_folders(parent_folder_id);
        `);
        
        // 创建 profile_mods 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS profile_mods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                mod_id INTEGER NOT NULL REFERENCES mods(mod_id) ON DELETE CASCADE,
                parent_folder_id INTEGER REFERENCES profile_folders(id),
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                used_version TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        // 创建 profile_mods 表索引
        rawDb.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS profile_mods_profile_mod_unique ON profile_mods(profile_id, mod_id);
            CREATE INDEX IF NOT EXISTS profile_mods_profile_sort_idx ON profile_mods(profile_id, sort_order);
            CREATE INDEX IF NOT EXISTS profile_mods_folder_idx ON profile_mods(parent_folder_id);
        `);
        
        // 创建 settings 表
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL DEFAULT '0.5.0',
                gui_theme TEXT NOT NULL DEFAULT 'Light',
                language TEXT NOT NULL DEFAULT 'en',
                cache_path TEXT NOT NULL DEFAULT '',
                config_path TEXT NOT NULL DEFAULT '',
                ue4ss_version TEXT NOT NULL DEFAULT 'UE4SS-Lite',
                auto_check_updates INTEGER NOT NULL DEFAULT 1,
                download_parallel_count INTEGER NOT NULL DEFAULT 3,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        
        console.log('测试数据库表创建完成');
    }
    
    /**
     * 插入初始数据
     */
    private static async insertInitialData(): Promise<void> {
        const db = await getTestDb();
        
        console.log('插入测试初始数据...');
        
        try {
            // 插入默认游戏（Deep Rock Galactic）
            await db.insert(games).values({
                id: 1,
                name: 'deep_rock_galactic',
                displayName: 'Deep Rock Galactic',
                isActive: true
            }).onConflictDoNothing();
            
            // 插入默认用户
            await db.insert(users).values({
                id: 1,
                username: 'default_user'
            }).onConflictDoNothing();
            
            // 插入默认应用设置
            await db.insert(settings).values({
                id: 1
            }).onConflictDoNothing();
            
        } catch (error) {
            console.warn('测试初始数据插入时发生冲突，这是正常现象:', error);
        }
        
        console.log('测试初始数据插入完成');
    }
    
    /**
     * 检查数据库连接
     */
    public static async checkDatabaseConnection(): Promise<boolean> {
        try {
            const db = await getTestDb();
            // 执行一个简单的查询来测试连接
            await db.run(sql`SELECT 1`);
            console.log('测试数据库连接正常');
            return true;
        } catch (error) {
            console.error('测试数据库连接失败:', error);
            return false;
        }
    }
    
    /**
     * 重置数据库（危险操作，仅用于测试环境）
     */
    public static async resetDatabase(): Promise<boolean> {
        try {
            console.log('正在重置测试数据库...');
            
            // 重置 sql.js 客户端
            await testDbClient.reset();
            
            console.log('测试数据库重置完成');
            return true;
        } catch (error) {
            console.error('测试数据库重置失败:', error);
            return false;
        }
    }
    
    /**
     * 获取数据库统计信息
     */
    public static async getDatabaseStats(): Promise<any> {
        try {
            const db = await getTestDb();
            
            const stats = {
                games: await db.run(sql`SELECT COUNT(*) as count FROM games`),
                users: await db.run(sql`SELECT COUNT(*) as count FROM users`),
                mods: await db.run(sql`SELECT COUNT(*) as count FROM mods`),
                profiles: await db.run(sql`SELECT COUNT(*) as count FROM profiles`),
                settings: await db.run(sql`SELECT COUNT(*) as count FROM settings`),
            };
            
            return stats;
        } catch (error) {
            console.error('获取测试数据库统计信息失败:', error);
            return null;
        }
    }
}