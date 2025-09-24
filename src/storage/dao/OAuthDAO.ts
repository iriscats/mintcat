import {oauths} from '@/storage/db/Schema';
import {eq, and, desc, asc} from 'drizzle-orm';
import {getDb} from "@/storage/db/Client.ts";

/**
 * OAuth信息数据访问层
 * 负责OAuth认证相关的数据库操作
 */

export interface OAuthData {
    id?: number;
    uid: number;
    oauth: string;
    platform: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export class OAuthDAO {

    /**
     * 获取所有OAuth记录
     */
    public async getAllOAuths(): Promise<OAuthData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(oauths).orderBy(desc(oauths.createdAt));
            return result.map(this.mapToOAuthData);
        } catch (error) {
            console.error('获取所有OAuth记录失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID获取OAuth记录
     */
    public async getOAuthById(id: number): Promise<OAuthData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(oauths).where(eq(oauths.id, id)).limit(1);
            return result.length > 0 ? this.mapToOAuthData(result[0]) : null;
        } catch (error) {
            console.error(`获取OAuth记录失败 [ID: ${id}]:`, error);
            throw error;
        }
    }

    /**
     * 根据UID获取OAuth记录
     */
    public async getOAuthByUid(uid: number): Promise<OAuthData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(oauths).where(eq(oauths.uid, uid)).limit(1);
            return result.length > 0 ? this.mapToOAuthData(result[0]) : null;
        } catch (error) {
            console.error(`根据UID获取OAuth记录失败 [UID: ${uid}]:`, error);
            throw error;
        }
    }

    /**
     * 根据平台获取OAuth记录
     */
    public async getOAuthsByPlatform(platform: string): Promise<OAuthData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(oauths)
                .where(eq(oauths.platform, platform))
                .orderBy(desc(oauths.createdAt));
            return result.map(this.mapToOAuthData);
        } catch (error) {
            console.error(`根据平台获取OAuth记录失败 [平台: ${platform}]:`, error);
            throw error;
        }
    }

    /**
     * 根据UID和平台获取OAuth记录
     */
    public async getOAuthByUidAndPlatform(uid: number, platform: string): Promise<OAuthData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(oauths)
                .where(and(eq(oauths.uid, uid), eq(oauths.platform, platform)))
                .limit(1);
            return result.length > 0 ? this.mapToOAuthData(result[0]) : null;
        } catch (error) {
            console.error(`根据UID和平台获取OAuth记录失败 [UID: ${uid}, 平台: ${platform}]:`, error);
            throw error;
        }
    }

    /**
     * 创建OAuth记录
     */
    public async createOAuth(oauthData: Omit<OAuthData, 'id' | 'createdAt' | 'updatedAt'>): Promise<OAuthData | null> {
        try {
            const db = await getDb();
            const result = await db.insert(oauths).values({
                uid: oauthData.uid,
                oauth: oauthData.oauth,
                platform: oauthData.platform,
            }).returning();

            return result.length > 0 ? this.mapToOAuthData(result[0]) : null;
        } catch (error) {
            console.error('创建OAuth记录失败:', error);
            throw error;
        }
    }

    /**
     * 更新OAuth记录
     */
    public async updateOAuth(id: number, oauthData: Partial<Omit<OAuthData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            const db = await getDb();
            const updateData: any = {};

            if (oauthData.uid !== undefined) updateData.uid = oauthData.uid;
            if (oauthData.oauth !== undefined) updateData.oauth = oauthData.oauth;
            if (oauthData.platform !== undefined) updateData.platform = oauthData.platform;

            updateData.updatedAt = new Date();

            await db.update(oauths)
                .set(updateData)
                .where(eq(oauths.id, id));

            return true;
        } catch (error) {
            console.error(`更新OAuth记录失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 更新或创建OAuth记录（Upsert）
     */
    public async upsertOAuth(uid: number, platform: string, oauth: string): Promise<OAuthData | null> {
        try {
            // 先尝试获取现有记录
            const existing = await this.getOAuthByUidAndPlatform(uid, platform);

            if (existing) {
                // 更新现有记录
                const success = await this.updateOAuth(existing.id!, {oauth});
                return success ? await this.getOAuthById(existing.id!) : null;
            } else {
                // 创建新记录
                return await this.createOAuth({uid, platform, oauth});
            }
        } catch (error) {
            console.error(`更新或创建OAuth记录失败 [UID: ${uid}, 平台: ${platform}]:`, error);
            return null;
        }
    }

    /**
     * 删除OAuth记录
     */
    public async deleteOAuth(id: number): Promise<boolean> {
        try {
            const db = await getDb();
            await db.delete(oauths).where(eq(oauths.id, id));
            return true;
        } catch (error) {
            console.error(`删除OAuth记录失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 根据UID删除OAuth记录
     */
    public async deleteOAuthByUid(uid: number): Promise<boolean> {
        try {
            const db = await getDb();
            await db.delete(oauths).where(eq(oauths.uid, uid));
            return true;
        } catch (error) {
            console.error(`根据UID删除OAuth记录失败 [UID: ${uid}]:`, error);
            return false;
        }
    }

    /**
     * 根据平台删除OAuth记录
     */
    public async deleteOAuthByPlatform(platform: string): Promise<boolean> {
        try {
            const db = await getDb();
            await db.delete(oauths).where(eq(oauths.platform, platform));
            return true;
        } catch (error) {
            console.error(`根据平台删除OAuth记录失败 [平台: ${platform}]:`, error);
            return false;
        }
    }

    /**
     * 根据UID和平台删除OAuth记录
     */
    public async deleteOAuthByUidAndPlatform(uid: number, platform: string): Promise<boolean> {
        try {
            const db = await getDb();
            await db.delete(oauths).where(and(eq(oauths.uid, uid), eq(oauths.platform, platform)));
            return true;
        } catch (error) {
            console.error(`根据UID和平台删除OAuth记录失败 [UID: ${uid}, 平台: ${platform}]:`, error);
            return false;
        }
    }

    /**
     * 验证OAuth令牌是否有效（基本检查）
     */
    public async isOAuthValid(oauth: string): Promise<boolean> {
        try {
            // 确保返回的是布尔值
            return Boolean(oauth && oauth.trim().length > 0);
        } catch (error) {
            console.error('验证OAuth令牌失败:', error);
            return false;
        }
    }

    /**
     * 获取mod.io平台的OAuth记录
     */
    public async getModioOAuth(): Promise<OAuthData | null> {
        try {
            const result = await this.getOAuthsByPlatform('mod.io');
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('获取mod.io OAuth记录失败:', error);
            return null;
        }
    }

    /**
     * 设置mod.io OAuth令牌
     */
    public async setModioOAuth(uid: number, oauth: string): Promise<OAuthData | null> {
        try {
            return await this.upsertOAuth(uid, 'mod.io', oauth);
        } catch (error) {
            console.error('设置mod.io OAuth令牌失败:', error);
            return null;
        }
    }

    /**
     * 获取OAuth统计信息
     */
    public async getOAuthStats(): Promise<{ total: number, byPlatform: Record<string, number> }> {
        try {
            const db = await getDb();
            const all = await db.select().from(oauths);

            const byPlatform: Record<string, number> = {};
            all.forEach(record => {
                byPlatform[record.platform] = (byPlatform[record.platform] || 0) + 1;
            });

            return {
                total: all.length,
                byPlatform
            };
        } catch (error) {
            console.error('获取OAuth统计信息失败:', error);
            return {total: 0, byPlatform: {}};
        }
    }

    /**
     * 将数据库记录映射为OAuthData对象
     */
    private mapToOAuthData(record: any): OAuthData {
        return {
            id: record.id,
            uid: record.uid,
            oauth: record.oauth,
            platform: record.platform,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}