import {profiles, profileFolders, profileMods} from '@/storage/db/Schema';
import {eq, and, desc, asc, like} from 'drizzle-orm';
import {getDb} from "@/storage/db/Client.ts";
import {StorageAPI} from "@/storage";

/**
 * 配置文件数据访问层
 * 负责配置文件、文件夹结构、模组关联等数据库操作
 */

export interface ProfileData {
    id?: number;
    name: string;
    gameId: number;
    userId: number;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ProfileFolderData {
    id?: number;
    profileId: number;
    parentFolderId?: number;
    name: string;
    folderType?: string;
    sortOrder?: number;
    isExpanded?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ProfileModData {
    id?: number;
    profileId: number;
    modId: number;
    parentFolderId?: number;
    sortOrder?: number;
    isEnabled?: boolean;
    usedVersion?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ProfileTreeData extends ProfileData {
    folders: ProfileFolderTreeData[];
    mods: ProfileModData[];
}

export interface ProfileFolderTreeData extends ProfileFolderData {
    children: ProfileFolderTreeData[];
    mods: ProfileModData[];
}

export class ProfileDAO {

    /**
     * =============================
     * 配置文件基础操作
     * =============================
     */

    /**
     * 获取所有配置文件
     */
    public async getAllProfiles(): Promise<ProfileData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(profiles).orderBy(desc(profiles.lastUsedAt));
            return result.map(this.mapToProfileData);
        } catch (error) {
            console.error('获取所有配置文件失败:', error);
            throw error;
        }
    }


    /**
     * 根据ID获取配置文件
     */
    public async getProfileById(id: number): Promise<ProfileData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
            return result.length > 0 ? this.mapToProfileData(result[0]) : null;
        } catch (error) {
            console.error(`获取配置文件失败 [ID: ${id}]:`, error);
            throw error;
        }
    }

    /**
     * 根据用户和游戏获取配置文件
     */
    public async getProfilesByUserAndGame(userId: number, gameId: number): Promise<ProfileData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(profiles)
                .where(and(eq(profiles.userId, userId), eq(profiles.gameId, gameId)))
                .orderBy(desc(profiles.lastUsedAt));
            return result.map(this.mapToProfileData);
        } catch (error) {
            console.error(`根据用户和游戏获取配置文件失败 [用户ID: ${userId}, 游戏ID: ${gameId}]:`, error);
            throw error;
        }
    }

    /**
     * 获取活跃的配置文件（自动获取当前活跃用户和游戏）
     */
    public async getActiveProfile(): Promise<ProfileData | null> {
        try {
            const db = await getDb();

            // 获取当前活跃的用户和游戏
            const games = await StorageAPI.getGames();
            const users = await StorageAPI.getUsers();

            const activeGame = await games.getActiveGame();
            const activeUser = await users.getActiveUser();

            if (!activeGame || !activeUser) {
                console.warn('无法获取活跃的游戏或用户');
                return null;
            }

            const result = await db.select().from(profiles)
                .where(and(
                    eq(profiles.userId, activeUser.id!),
                    eq(profiles.gameId, activeGame.id!),
                    eq(profiles.isActive, true)
                ))
                .limit(1);
            return result.length > 0 ? this.mapToProfileData(result[0]) : null;
        } catch (error) {
            console.error('获取活跃配置文件失败:', error);
            throw error;
        }
    }

    /**
     * 获取活跃的配置文件（指定用户和游戏）
     */
    public async getActiveProfileByUserAndGame(userId: number, gameId: number): Promise<ProfileData | null> {
        try {
            const db = await getDb();

            const result = await db.select().from(profiles)
                .where(and(
                    eq(profiles.userId, userId),
                    eq(profiles.gameId, gameId),
                    eq(profiles.isActive, true)
                ))
                .limit(1);
            return result.length > 0 ? this.mapToProfileData(result[0]) : null;
        } catch (error) {
            console.error(`获取活跃配置文件失败 [用户ID: ${userId}, 游戏ID: ${gameId}]:`, error);
            throw error;
        }
    }

    /**
     * 创建配置文件
     */
    public async createProfile(profileData: Omit<ProfileData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProfileData | null> {
        try {
            const db = await getDb();
            const result = await db.insert(profiles).values({
                name: profileData.name,
                gameId: profileData.gameId,
                userId: profileData.userId,
                isActive: profileData.isActive ?? false,
            }).returning();

            const newProfile = result.length > 0 ? this.mapToProfileData(result[0]) : null;

            // 创建默认文件夹结构
            if (newProfile) {
                await this.createDefaultFolders(newProfile.id!);
            }

            return newProfile;
        } catch (error) {
            console.error('创建配置文件失败:', error);
            throw error;
        }
    }

    /**
     * 更新配置文件
     */
    public async updateProfile(id: number, profileData: Partial<Omit<ProfileData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            const db = await getDb();
            const updateData: any = {};

            if (profileData.name !== undefined) updateData.name = profileData.name;
            if (profileData.gameId !== undefined) updateData.gameId = profileData.gameId;
            if (profileData.userId !== undefined) updateData.userId = profileData.userId;
            if (profileData.isActive !== undefined) updateData.isActive = profileData.isActive;

            updateData.updatedAt = new Date();

            await db.update(profiles)
                .set(updateData)
                .where(eq(profiles.id, id));

            return true;
        } catch (error) {
            console.error(`更新配置文件失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 删除配置文件（级联删除相关数据）
     */
    public async deleteProfile(id: number): Promise<boolean> {
        try {
            const db = await getDb();

            // 由于外键约束设置了CASCADE，删除配置文件时会自动删除相关的文件夹和模组关联
            await db.delete(profiles).where(eq(profiles.id, id));

            return true;
        } catch (error) {
            console.error(`删除配置文件失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 激活配置文件（同时取消其他配置文件的激活状态）
     */
    public async activateProfile(id: number): Promise<boolean> {
        try {
            const db = await getDb();
            const profile = await this.getProfileById(id);
            if (!profile) return false;

            // 取消同一用户和游戏的其他配置文件的激活状态
            await db.update(profiles)
                .set({isActive: false, updatedAt: new Date()})
                .where(and(
                    eq(profiles.userId, profile.userId),
                    eq(profiles.gameId, profile.gameId)
                ));

            // 激活当前配置文件并更新使用时间
            await db.update(profiles)
                .set({
                    isActive: true,
                    lastUsedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(profiles.id, id));

            return true;
        } catch (error) {
            console.error(`激活配置文件失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * =============================
     * 配置文件文件夹操作
     * =============================
     */

    /**
     * 获取配置文件的所有文件夹
     */
    public async getProfileFolders(profileId: number): Promise<ProfileFolderData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(profileFolders)
                .where(eq(profileFolders.profileId, profileId))
                .orderBy(asc(profileFolders.sortOrder));
            return result.map(this.mapToProfileFolderData);
        } catch (error) {
            console.error(`获取配置文件文件夹失败 [配置ID: ${profileId}]:`, error);
            throw error;
        }
    }

    /**
     * 创建文件夹
     */
    public async createFolder(folderData: Omit<ProfileFolderData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProfileFolderData | null> {
        try {
            const db = await getDb();
            const result = await db.insert(profileFolders).values({
                profileId: folderData.profileId,
                parentFolderId: folderData.parentFolderId || null,
                name: folderData.name,
                folderType: folderData.folderType || "custom",
                sortOrder: folderData.sortOrder || 0,
                isExpanded: folderData.isExpanded ?? true,
            }).returning();

            return result.length > 0 ? this.mapToProfileFolderData(result[0]) : null;
        } catch (error) {
            console.error('创建文件夹失败:', error);
            throw error;
        }
    }

    /**
     * 更新文件夹
     */
    public async updateFolder(id: number, folderData: Partial<Omit<ProfileFolderData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            const db = await getDb();
            const updateData: any = {};

            if (folderData.parentFolderId !== undefined) updateData.parentFolderId = folderData.parentFolderId;
            if (folderData.name !== undefined) updateData.name = folderData.name;
            if (folderData.folderType !== undefined) updateData.folderType = folderData.folderType;
            if (folderData.sortOrder !== undefined) updateData.sortOrder = folderData.sortOrder;
            if (folderData.isExpanded !== undefined) updateData.isExpanded = folderData.isExpanded;

            updateData.updatedAt = new Date();

            await db.update(profileFolders)
                .set(updateData)
                .where(eq(profileFolders.id, id));

            return true;
        } catch (error) {
            console.error(`更新文件夹失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 删除文件夹
     */
    public async deleteFolder(id: number): Promise<boolean> {
        try {
            const db = await getDb();
            await db.delete(profileFolders).where(eq(profileFolders.id, id));
            return true;
        } catch (error) {
            console.error(`删除文件夹失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * =============================
     * 配置文件模组关联操作
     * =============================
     */

    public async checkModExits(modData) {


        return false;
    }

    /**
     * 获取配置文件的所有模组关联
     */
    public async getProfileMods(profileId: number): Promise<ProfileModData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(profileMods)
                .where(eq(profileMods.profileId, profileId))
                .orderBy(asc(profileMods.sortOrder));
            return result.map(this.mapToProfileModData);
        } catch (error) {
            console.error(`获取配置文件模组关联失败 [配置ID: ${profileId}]:`, error);
            throw error;
        }
    }

    /**
     * 添加模组到配置文件
     */
    public async addModToProfile(modData: Omit<ProfileModData, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProfileModData | null> {
        try {
            const db = await getDb();
            const result = await db.insert(profileMods).values({
                profileId: modData.profileId,
                modId: modData.modId,
                parentFolderId: modData.parentFolderId || null,
                sortOrder: modData.sortOrder || 0,
                isEnabled: modData.isEnabled ?? true,
                usedVersion: modData.usedVersion || "",
            }).returning();

            return result.length > 0 ? this.mapToProfileModData(result[0]) : null;
        } catch (error) {
            console.error('添加模组到配置文件失败:', error);
            throw error;
        }
    }

    /**
     * 设置配置文件中的模组启用状态
     */
    public async setModEnabled(profileId: number, modId: number, enabled: boolean): Promise<boolean> {
        try {
            const db = await getDb();
            await db.update(profileMods)
                .set({isEnabled: enabled})
                .where(and(
                    eq(profileMods.profileId, profileId),
                    eq(profileMods.modId, modId)
                ));
            return true;
        } catch (error) {
            console.error(`设置配置文件模组启用状态失败 [配置ID: ${profileId}, 模组ID: ${modId}]:`, error);
            return false;
        }
    }


    /**
     * 更新配置文件中的模组设置
     */
    public async updateProfileMod(id: number, modData: Partial<Omit<ProfileModData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            const db = await getDb();
            const updateData: any = {};

            if (modData.parentFolderId !== undefined) updateData.parentFolderId = modData.parentFolderId;
            if (modData.sortOrder !== undefined) updateData.sortOrder = modData.sortOrder;
            if (modData.isEnabled !== undefined) updateData.isEnabled = modData.isEnabled;
            if (modData.usedVersion !== undefined) updateData.usedVersion = modData.usedVersion;

            updateData.updatedAt = new Date();

            await db.update(profileMods)
                .set(updateData)
                .where(eq(profileMods.id, id));

            return true;
        } catch (error) {
            console.error(`更新配置文件模组设置失败 [ID: ${id}]:`, error);
            return false;
        }
    }

    /**
     * 从配置文件中移除模组
     */
    public async removeModFromProfile(profileId: number, modId: number): Promise<boolean> {
        try {
            const db = await getDb();
            await db.delete(profileMods)
                .where(and(
                    eq(profileMods.profileId, profileId),
                    eq(profileMods.modId, modId)
                ));
            return true;
        } catch (error) {
            console.error(`从配置文件中移除模组失败 [配置ID: ${profileId}, 模组ID: ${modId}]:`, error);
            return false;
        }
    }

    /**
     * =============================
     * 综合操作
     * =============================
     */

    /**
     * 获取配置文件的完整树结构
     */
    public async getProfileTree(profileId: number): Promise<ProfileTreeData | null> {
        try {
            const profile = await this.getProfileById(profileId);
            if (!profile) return null;

            const [folders, mods] = await Promise.all([
                this.getProfileFolders(profileId),
                this.getProfileMods(profileId)
            ]);

            // 构建文件夹树结构
            const folderTree = this.buildFolderTree(folders, mods);

            // 获取根级别的模组（没有父文件夹的模组）
            const rootMods = mods.filter(mod => !mod.parentFolderId);

            return {
                ...profile,
                folders: folderTree,
                mods: rootMods
            };
        } catch (error) {
            console.error(`获取配置文件树结构失败 [配置ID: ${profileId}]:`, error);
            return null;
        }
    }

    /**
     * 创建默认文件夹结构
     */
    private async createDefaultFolders(profileId: number): Promise<void> {
        try {
            const defaultFolders = [
                {
                    profileId,
                    name: 'mod.io',
                    folderType: 'modio',
                    sortOrder: 0
                },
                {
                    profileId,
                    name: 'Local',
                    folderType: 'local',
                    sortOrder: 1
                }
            ];

            for (const folder of defaultFolders) {
                await this.createFolder(folder);
            }
        } catch (error) {
            console.error(`创建默认文件夹结构失败 [配置ID: ${profileId}]:`, error);
        }
    }

    /**
     * 构建文件夹树结构
     */
    private buildFolderTree(folders: ProfileFolderData[], mods: ProfileModData[]): ProfileFolderTreeData[] {
        const folderMap = new Map<number, ProfileFolderTreeData>();
        const rootFolders: ProfileFolderTreeData[] = [];

        // 初始化所有文件夹
        folders.forEach(folder => {
            folderMap.set(folder.id!, {
                ...folder,
                children: [],
                mods: []
            });
        });

        // 分配模组到对应的文件夹
        mods.forEach(mod => {
            if (mod.parentFolderId && folderMap.has(mod.parentFolderId)) {
                folderMap.get(mod.parentFolderId)!.mods.push(mod);
            }
        });

        // 构建树结构
        folders.forEach(folder => {
            const treeFolder = folderMap.get(folder.id!)!;
            if (folder.parentFolderId && folderMap.has(folder.parentFolderId)) {
                folderMap.get(folder.parentFolderId)!.children.push(treeFolder);
            } else {
                rootFolders.push(treeFolder);
            }
        });

        return rootFolders.sort((a, b) => a.sortOrder! - b.sortOrder!);
    }

    /**
     * 获取配置文件统计信息
     */
    public async getProfileStats(): Promise<{
        total: number;
        byUser: Record<number, number>;
        byGame: Record<number, number>;
    }> {
        try {
            const db = await getDb();
            const allProfiles = await db.select().from(profiles);

            const byUser: Record<number, number> = {};
            const byGame: Record<number, number> = {};

            allProfiles.forEach(profile => {
                byUser[profile.userId] = (byUser[profile.userId] || 0) + 1;
                byGame[profile.gameId] = (byGame[profile.gameId] || 0) + 1;
            });

            return {
                total: allProfiles.length,
                byUser,
                byGame
            };
        } catch (error) {
            console.error('获取配置文件统计信息失败:', error);
            return {total: 0, byUser: {}, byGame: {}};
        }
    }


    /**
     * =============================
     * 私有映射方法
     * =============================
     */

    private mapToProfileData(record: any): ProfileData {
        return {
            id: record.id,
            name: record.name,
            gameId: record.gameId,
            userId: record.userId,
            isActive: record.isActive,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    private mapToProfileFolderData(record: any): ProfileFolderData {
        return {
            id: record.id,
            profileId: record.profileId,
            parentFolderId: record.parentFolderId,
            name: record.name,
            folderType: record.folderType,
            sortOrder: record.sortOrder,
            isExpanded: record.isExpanded,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    private mapToProfileModData(record: any): ProfileModData {
        return {
            id: record.id,
            profileId: record.profileId,
            modId: record.modId,
            parentFolderId: record.parentFolderId,
            sortOrder: record.sortOrder,
            isEnabled: record.isEnabled,
            usedVersion: record.usedVersion,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}