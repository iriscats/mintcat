import {users} from '@/storage/db/Schema';
import {eq, and, desc, asc, like} from 'drizzle-orm';
import {getDb} from "@/storage/db/Client.ts";

/**
 * 用户信息数据访问层
 * 负责用户相关的数据库操作
 */

export interface UserData {
    id?: number;
    username: string;
    email?: string;
    avatarUrl?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export class UserDAO {

    /**
     * 获取所有用户
     */
    public  async getAllUsers(): Promise<UserData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(users).orderBy(asc(users.id));
            return result.map(this.mapToUserData);
        } catch (error) {
            console.error('获取所有用户失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID获取用户
     */
    public  async getUserById(id: number): Promise<UserData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
            return result.length > 0 ? this.mapToUserData(result[0]) : null;
        } catch (error) {
            console.error(`获取用户失败 [ID: ${id}]:`, error);
            throw error;
        }
    }

    /**
     * 根据用户名获取用户
     */
    public  async getUserByUsername(username: string): Promise<UserData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
            return result.length > 0 ? this.mapToUserData(result[0]) : null;
        } catch (error) {
            console.error(`根据用户名获取用户失败 [用户名: ${username}]:`, error);
            throw error;
        }
    }

    /**
     * 根据邮箱获取用户
     */
    public  async getUserByEmail(email: string): Promise<UserData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
            return result.length > 0 ? this.mapToUserData(result[0]) : null;
        } catch (error) {
            console.error(`根据邮箱获取用户失败 [邮箱: ${email}]:`, error);
            throw error;
        }
    }

    /**
     * 搜索用户（根据用户名或邮箱模糊搜索）
     */
    public  async searchUsers(keyword: string, limit: number = 50): Promise<UserData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(users)
                .where(
                    and(
                        like(users.username, `%${keyword}%`),
                        like(users.email, `%${keyword}%`)
                    )
                )
                .orderBy(asc(users.username))
                .limit(limit);
            return result.map(this.mapToUserData);
        } catch (error) {
            console.error(`搜索用户失败 [关键词: ${keyword}]:`, error);
            throw error;
        }
    }

    /**
     * 创建用户
     */
    public  async createUser(userData: Omit<UserData, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserData | null> {
        try {
            const db = await getDb();
            const result = await db.insert(users).values({
                username: userData.username,
                email: userData.email || "",
                avatarUrl: userData.avatarUrl || "",
            }).returning();

            return result.length > 0 ? this.mapToUserData(result[0]) : null;
        } catch (error) {
            console.error('创建用户失败:', error);
            throw error;
        }
    }

    /**
     * 更新用户信息
     */
    public  async updateUser(id: number, userData: Partial<Omit<UserData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            const db = await getDb();
            const updateData: any = {};

            if (userData.username !== undefined) updateData.username = userData.username;
            if (userData.email !== undefined) updateData.email = userData.email;
            if (userData.avatarUrl !== undefined) updateData.avatarUrl = userData.avatarUrl;

            updateData.updatedAt = new Date();

            await db.update(users)
                .set(updateData)
                .where(eq(users.id, id));

            return true;
        } catch (error) {
            console.error(`更新用户失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 删除用户
     */
    public  async deleteUser(id: number): Promise<boolean> {
        try {
            const db = await getDb();
            await db.delete(users).where(eq(users.id, id));
            return true;
        } catch (error) {
            console.error(`删除用户失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 检查用户名是否已存在
     */
    public  async isUsernameExists(username: string, excludeId?: number): Promise<boolean> {
        try {
            const db = await getDb();
            let query = db.select().from(users).where(eq(users.username, username));

            if (excludeId) {
                query = query.where(and(eq(users.username, username), eq(users.id, excludeId)));
            }

            const result = await query.limit(1);
            return result.length > 0;
        } catch (error) {
            console.error(`检查用户名是否存在失败 [用户名: ${username}]:`, error);
            return false;
        }
    }

    /**
     * 检查邮箱是否已存在
     */
    public  async isEmailExists(email: string, excludeId?: number): Promise<boolean> {
        try {
            const db = await getDb();
            let query = db.select().from(users).where(eq(users.email, email));

            if (excludeId) {
                query = query.where(and(eq(users.email, email), eq(users.id, excludeId)));
            }

            const result = await query.limit(1);
            return result.length > 0;
        } catch (error) {
            console.error(`检查邮箱是否存在失败 [邮箱: ${email}]:`, error);
            return false;
        }
    }

    /**
     * 获取用户统计信息
     */
    public  async getUserStats(): Promise<{ total: number, recentWeek: number }> {
        try {
            const db = await getDb();
            const total = await db.select().from(users);

            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            // 注意：这里需要根据实际的时间戳格式调整
            const recentWeek = await db.select().from(users)
                .where(and(
                    eq(users.createdAt, oneWeekAgo) // 这里需要使用正确的时间比较
                ));

            return {
                total: total.length,
                recentWeek: recentWeek.length
            };
        } catch (error) {
            console.error('获取用户统计信息失败:', error);
            return {total: 0, recentWeek: 0};
        }
    }

    /**
     * 批量删除用户
     */
    public  async batchDeleteUsers(userIds: number[]): Promise<boolean> {
        try {
            const db = await getDb();

            for (const id of userIds) {
                await db.delete(users).where(eq(users.id, id));
            }

            return true;
        } catch (error) {
            console.error('批量删除用户失败:', error);
            return false;
        }
    }

    /**
     * 更新用户头像
     */
    public  async updateUserAvatar(id: number, avatarUrl: string): Promise<boolean> {
        try {
            return await this.updateUser(id, {avatarUrl});
        } catch (error) {
            console.error(`更新用户头像失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 获取默认用户（ID为1的用户）
     */
    public  async getDefaultUser(): Promise<UserData | null> {
        try {
            return await this.getUserById(1);
        } catch (error) {
            console.error('获取默认用户失败:', error);
            return null;
        }
    }

    /**
     * 将数据库记录映射为UserData对象
     */
    private  mapToUserData(record: any): UserData {
        return {
            id: record.id,
            username: record.username,
            email: record.email,
            avatarUrl: record.avatarUrl,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}