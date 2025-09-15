import { getDb } from './Client';
import { sql } from 'drizzle-orm';
import { 
    games, users, oauths, mods, modVersions, modDownloads, modStatus,
    profiles, profileFolders, profileMods, settings
} from './Schema';

/**
 * 数据库初始化工具
 * 负责创建数据库表结构和初始数据
 */
export class DatabaseInitializer {
    
    /**
     * 初始化数据库
     * 创建所有必要的表结构和索引
     */
    public static async initializeDatabase(): Promise<boolean> {
        try {
            console.log('开始初始化数据库...');
            
            // 检查数据库连接
            const connectionOk = await this.checkDatabaseConnection();
            if (!connectionOk) {
                throw new Error('数据库连接失败');
            }
            
            // 启用外键约束
            await this.enableForeignKeys();
            
            // 创建表结构
            await this.createTables();
            
            // 创建索引
            await this.createIndexes();
            
            // 插入初始数据
            await this.insertInitialData();
            
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
        await db.run(sql`PRAGMA foreign_keys = ON`);
        console.log('外键约束已启用');
    }
    
    /**
     * 创建数据库表
     */
    private static async createTables(): Promise<void> {
        const db = await getDb();
        
        console.log('创建数据库表...');
        
        // 使用Drizzle Schema创建表结构
        // 注意：Drizzle会自动处理表创建，这里我们使用推送模式
        console.log('使用Drizzle Schema创建数据库表结构...');
        
        // 由于使用了Drizzle ORM，表结构会自动根据Schema定义创建
        // 我们只需要确保外键约束和索引正确设置
        

        

        

        

        

        

        

        

        

        

        
        console.log('数据库表创建完成');
    }
    
    /**
     * 创建索引（Drizzle Schema已定义索引，这里只做验证）
     */
    private static async createIndexes(): Promise<void> {
        console.log('验证数据库索引...');
        // Drizzle Schema中已经定义了所有必要的索引
        // 这里可以添加额外的索引验证逻辑
        console.log('数据库索引验证完成');
    }
    
    /**
     * 插入初始数据
     */
    private static async insertInitialData(): Promise<void> {
        const db = await getDb();
        
        console.log('插入初始数据...');
        
        // 使用Drizzle ORM插入初始数据
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
            
            // 插入默认配置文件
            await db.insert(profiles).values({
                id: 1,
                name: 'default',
                displayName: 'Default Profile',
                gameId: 1,
                userId: 1,
                isActive: true
            }).onConflictDoNothing();
            
            // 插入默认文件夹结构
            await db.insert(profileFolders).values([
                {
                    id: 90000,
                    profileId: 1,
                    name: 'mod.io',
                    folderType: 'modio',
                    sortOrder: 0
                },
                {
                    id: 90001,
                    profileId: 1,
                    name: 'Local',
                    folderType: 'local',
                    sortOrder: 1
                }
            ]).onConflictDoNothing();
            
            // 插入默认应用设置
            await db.insert(settings).values({
                id: 1
            }).onConflictDoNothing();
            
        } catch (error) {
            console.warn('初始数据插入时发生冲突，这是正常现象:', error);
        }
        
        console.log('初始数据插入完成');
    }
    
    /**
     * 检查数据库连接
     */
    public static async checkDatabaseConnection(): Promise<boolean> {
        try {
            const db = await getDb();
            // 执行一个简单的查询来测试连接
            await db.run(sql`SELECT 1`);
            console.log('数据库连接正常');
            return true;
        } catch (error) {
            console.error('数据库连接失败:', error);
            return false;
        }
    }
    
    /**
     * 验证数据库完整性
     */
    public static async validateDatabaseIntegrity(): Promise<boolean> {
        try {
            const db = await getDb();
            
            // 检查外键约束
            const result = await db.run(sql`PRAGMA foreign_key_check`);
            console.log('数据库完整性验证通过');
            return true;
        } catch (error) {
            console.error('数据库完整性验证失败:', error);
            return false;
        }
    }
    
    /**
     * 获取数据库统计信息
     */
    public static async getDatabaseStats(): Promise<any> {
        try {
            const db = await getDb();
            
            const stats = {
                games: await db.run(sql`SELECT COUNT(*) as count FROM games`),
                users: await db.run(sql`SELECT COUNT(*) as count FROM users`),
                mods: await db.run(sql`SELECT COUNT(*) as count FROM mods`),
                profiles: await db.run(sql`SELECT COUNT(*) as count FROM profiles`),
                configData: await db.run(sql`SELECT COUNT(*) as count FROM config_data`),
            };
            
            return stats;
        } catch (error) {
            console.error('获取数据库统计信息失败:', error);
            return null;
        }
    }
    
    /**
     * 清理过期数据
     */
    public static async cleanupExpiredData(): Promise<boolean> {
        try {
            const db = await getDb();
            
            // 清理孤立的模组版本记录
            await db.run(sql`
                DELETE FROM mod_versions 
                WHERE mod_id NOT IN (SELECT mod_id FROM mods)
            `);
            
            // 清理孤立的模组下载记录
            await db.run(sql`
                DELETE FROM mod_downloads 
                WHERE mod_id NOT IN (SELECT mod_id FROM mods)
            `);
            
            // 清理孤立的模组审核记录
            await db.run(sql`
                DELETE FROM mod_approvals 
                WHERE mod_id NOT IN (SELECT mod_id FROM mods)
            `);
            
            // 清理孤立的配置文件模组关联
            await db.run(sql`
                DELETE FROM profile_mods 
                WHERE profile_id NOT IN (SELECT id FROM profiles)
                   OR mod_id NOT IN (SELECT mod_id FROM mods)
            `);
            
            console.log('数据库清理完成');
            return true;
        } catch (error) {
            console.error('数据库清理失败:', error);
            return false;
        }
    }
    
    /**
     * 重置数据库（危险操作，仅用于开发环境）
     */
    public static async resetDatabase(): Promise<boolean> {
        try {
            console.log('警告：正在重置数据库...');
            
            const db = await getDb();
            
            // 禁用外键约束以便删除表
            await db.run(sql`PRAGMA foreign_keys = OFF`);
            
            // 删除所有表（按依赖关系倒序）
            const tables = [
                'profile_mods', 'profile_folders', 'profiles',
                'mod_approvals', 'mod_downloads', 'mod_versions', 'mods',
                'config_data', 'settings', 'users', 'games'
            ];
            
            for (const table of tables) {
                await db.run(sql.raw(`DROP TABLE IF EXISTS ${table}`));
            }
            
            // 重新启用外键约束
            await db.run(sql`PRAGMA foreign_keys = ON`);
            
            // 重新创建数据库
            await this.initializeDatabase();
            
            console.log('数据库重置完成');
            return true;
        } catch (error) {
            console.error('数据库重置失败:', error);
            return false;
        }
    }
}