import {games} from '@/storage/db/Schema';
import {eq, and, desc, asc} from 'drizzle-orm';
import {getDb} from "@/storage/db/Client.ts";

/**
 * 游戏信息数据访问层
 * 负责游戏相关的数据库操作
 */

export interface GameData {
    id?: number;
    name: string;
    displayName: string;
    icon?: string;
    installPath?: string;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export class GameDAO {

    /**
     * 获取所有游戏
     */
    public async getAllGames(): Promise<GameData[]> {
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
    public async getGameById(id: number): Promise<GameData | null> {
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
    public async getGameByName(name: string): Promise<GameData | null> {
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
    public async getActiveGame(): Promise<GameData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(games)
                .where(eq(games.isActive, true))
                .orderBy(asc(games.id))
                .limit(1);
            return result.length > 0 ? this.mapToGameData(result[0]) : null;
        } catch (error) {
            console.error('获取活跃游戏失败:', error);
            throw error;
        }
    }

    /**
     * 创建游戏
     */
    public async createGame(gameData: Omit<GameData, 'id' | 'createdAt' | 'updatedAt'>): Promise<GameData | null> {
        try {
            const db = await getDb();
            const result = await db.insert(games).values({
                name: gameData.name,
                displayName: gameData.displayName,
                icon: gameData.icon || "",
                installPath: gameData.installPath || "",
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
    public async updateGame(id: number, gameData: Partial<Omit<GameData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            const db = await getDb();
            const updateData: any = {};

            if (gameData.name !== undefined) updateData.name = gameData.name;
            if (gameData.displayName !== undefined) updateData.displayName = gameData.displayName;
            if (gameData.icon !== undefined) updateData.icon = gameData.icon;
            if (gameData.installPath !== undefined) updateData.installPath = gameData.installPath;
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
    public async deleteGame(id: number): Promise<boolean> {
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
    public async setGameActive(id: number, isActive: boolean): Promise<boolean> {
        try {
            return await this.updateGame(id, {isActive});
        } catch (error) {
            console.error(`设置游戏激活状态失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 将数据库记录映射为GameData对象
     */
    private mapToGameData(record: any): GameData {
        return {
            id: record.id,
            name: record.name,
            displayName: record.displayName,
            icon: record.icon,
            installPath: record.installPath,
            isActive: record.isActive,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}