import { getDb } from '../db/ConnectionManager';
import { games } from '../db/Schema';
import { eq, and, desc, asc } from 'drizzle-orm';

/**
 * 游戏信息数据访问层
 * 负责游戏相关的数据库操作
 */

export interface GameData {
    id?: number;
    name: string;
    displayName: string;
    installPath?: string;
    version?: string;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export class GameDAO {
    
    /**
     * 获取所有游戏
     */
    public static async getAllGames(): Promise<GameData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(games).orderBy(asc(games.id));
            return result.map(this.mapToGameData);
        } catch (error) {
            console.error('获取所有游戏失败:', error);
            throw error;
        }
    }
    
    /**
     * 根据ID获取游戏
     */
    public static async getGameById(id: number): Promise<GameData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(games).where(eq(games.id, id)).limit(1);
            return result.length > 0 ? this.mapToGameData(result[0]) : null;
        } catch (error) {
            console.error(`获取游戏失败 [ID: ${id}]:`, error);
            throw error;
        }
    }
    
    /**
     * 根据名称获取游戏
     */
    public static async getGameByName(name: string): Promise<GameData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(games).where(eq(games.name, name)).limit(1);
            return result.length > 0 ? this.mapToGameData(result[0]) : null;
        } catch (error) {
            console.error(`根据名称获取游戏失败 [名称: ${name}]:`, error);
            throw error;
        }
    }
    
    /**
     * 获取活跃游戏
     */
    public static async getActiveGames(): Promise<GameData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(games)
                .where(eq(games.isActive, true))
                .orderBy(asc(games.id));
            return result.map(this.mapToGameData);
        } catch (error) {
            console.error('获取活跃游戏失败:', error);
            throw error;
        }
    }
    
    /**
     * 创建游戏
     */
    public static async createGame(gameData: Omit<GameData, 'id' | 'createdAt' | 'updatedAt'>): Promise<GameData | null> {
        try {
            const db = await getDb();
            const result = await db.insert(games).values({
                name: gameData.name,
                displayName: gameData.displayName,
                installPath: gameData.installPath || "",
                version: gameData.version || "",
                isActive: gameData.isActive ?? true,
            }).returning();
            
            return result.length > 0 ? this.mapToGameData(result[0]) : null;
        } catch (error) {
            console.error('创建游戏失败:', error);
            throw error;
        }
    }
    
    /**
     * 更新游戏信息
     */
    public static async updateGame(id: number, gameData: Partial<Omit<GameData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            const db = await getDb();
            const updateData: any = {};
            
            if (gameData.name !== undefined) updateData.name = gameData.name;
            if (gameData.displayName !== undefined) updateData.displayName = gameData.displayName;
            if (gameData.installPath !== undefined) updateData.installPath = gameData.installPath;
            if (gameData.version !== undefined) updateData.version = gameData.version;
            if (gameData.isActive !== undefined) updateData.isActive = gameData.isActive;
            
            updateData.updatedAt = new Date();
            
            const result = await db.update(games)
                .set(updateData)
                .where(eq(games.id, id));
                
            return true;
        } catch (error) {
            console.error(`更新游戏失败 [ID: ${id}]:`, error);
            return false;
        }
    }
    
    /**
     * 删除游戏
     */
    public static async deleteGame(id: number): Promise<boolean> {
        try {
            const db = await getDb();
            await db.delete(games).where(eq(games.id, id));
            return true;
        } catch (error) {
            console.error(`删除游戏失败 [ID: ${id}]:`, error);
            return false;
        }
    }
    
    /**
     * 设置游戏激活状态
     */
    public static async setGameActive(id: number, isActive: boolean): Promise<boolean> {
        try {
            return await this.updateGame(id, { isActive });
        } catch (error) {
            console.error(`设置游戏激活状态失败 [ID: ${id}]:`, error);
            return false;
        }
    }
    
    /**
     * 检查游戏名称是否已存在
     */
    public static async isGameNameExists(name: string, excludeId?: number): Promise<boolean> {
        try {
            const db = await getDb();
            let query = db.select().from(games).where(eq(games.name, name));
            
            if (excludeId) {
                query = query.where(and(eq(games.name, name), eq(games.id, excludeId)));
            }
            
            const result = await query.limit(1);
            return result.length > 0;
        } catch (error) {
            console.error(`检查游戏名称是否存在失败 [名称: ${name}]:`, error);
            return false;
        }
    }
    
    /**
     * 获取游戏统计信息
     */
    public static async getGameStats(): Promise<{total: number, active: number}> {
        try {
            const db = await getDb();
            const total = await db.select().from(games);
            const active = await db.select().from(games).where(eq(games.isActive, true));
            
            return {
                total: total.length,
                active: active.length
            };
        } catch (error) {
            console.error('获取游戏统计信息失败:', error);
            return { total: 0, active: 0 };
        }
    }
    
    /**
     * 批量更新游戏激活状态
     */
    public static async batchUpdateActiveStatus(gameIds: number[], isActive: boolean): Promise<boolean> {
        try {
            const db = await getDb();
            
            for (const id of gameIds) {
                await db.update(games)
                    .set({ isActive, updatedAt: new Date() })
                    .where(eq(games.id, id));
            }
            
            return true;
        } catch (error) {
            console.error('批量更新游戏激活状态失败:', error);
            return false;
        }
    }
    
    /**
     * 将数据库记录映射为GameData对象
     */
    private static mapToGameData(record: any): GameData {
        return {
            id: record.id,
            name: record.name,
            displayName: record.displayName,
            installPath: record.installPath,
            version: record.version,
            isActive: record.isActive,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}