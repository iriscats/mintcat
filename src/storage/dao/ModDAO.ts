import {mods, modVersions, modDownloads, modStatus} from '@/storage/db/Schema';
import {eq, and, desc, asc, like, inArray} from 'drizzle-orm';
import {getDb} from "@/storage/db/Client.ts";

/**
 * 模组数据访问层
 * 负责模组相关的数据库操作，包括模组基础信息、版本、下载、状态等
 */

export interface ModData {
    modId?: number;
    platformId: number;
    gameId: number;
    nameId: string;
    displayName: string;
    url?: string;
    sourceType?: string;
    tags?: string[];
    approvalStatus?: string;
    dependModId?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ModVersionData {
    modId: number;
    currentVersion?: string;
    availableVersions?: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ModDownloadData {
    modId: number;
    downloadUrl?: string;
    cachePath?: string;
    fileSize?: number;
    downloadProgress?: number;
    downloadStatus?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ModStatusData {
    modId: number;
    lastUpdateDate?: number;
    onlineUpdateDate?: number;
    isOnlineAvailable?: boolean;
    isLocalNotFound?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface CompleteModData extends ModData {
    version?: ModVersionData;
    download?: ModDownloadData;
    status?: ModStatusData;
}

export class ModDAO {

    /**
     * =============================
     * 模组基础信息操作
     * =============================
     */

    /**
     * 获取所有模组
     */
    public async getAllMods(): Promise<ModData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(mods).orderBy(desc(mods.createdAt));
            return result.map(this.mapToModData);
        } catch (error) {
            console.error('获取所有模组失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID获取模组
     */
    public async getModById(modId: number): Promise<ModData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(mods).where(eq(mods.modId, modId)).limit(1);
            return result.length > 0 ? this.mapToModData(result[0]) : null;
        } catch (error) {
            console.error(`获取模组失败 [ID: ${modId}]:`, error);
            throw error;
        }
    }

    /**
     * 根据平台ID获取模组
     */
    public async getModByPlatformId(platformId: number): Promise<ModData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(mods).where(eq(mods.platformId, platformId)).limit(1);
            return result.length > 0 ? this.mapToModData(result[0]) : null;
        } catch (error) {
            console.error(`根据平台ID获取模组失败 [平台ID: ${platformId}]:`, error);
            throw error;
        }
    }

    /**
     * 根据游戏ID获取模组
     */
    public async getModsByGameId(gameId: number): Promise<ModData[]> {
        try {
            const db = await getDb();
            const result = await db.select().from(mods)
                .where(eq(mods.gameId, gameId))
                .orderBy(desc(mods.createdAt));
            return result.map(this.mapToModData);
        } catch (error) {
            console.error(`根据游戏ID获取模组失败 [游戏ID: ${gameId}]:`, error);
            throw error;
        }
    }

    /**
     * 搜索模组
     */
    public async searchMods(keyword: string, gameId?: number, sourceType?: string, limit: number = 50): Promise<ModData[]> {
        try {
            const db = await getDb();
            let query = db.select().from(mods);

            const conditions = [
                like(mods.displayName, `%${keyword}%`),
                like(mods.nameId, `%${keyword}%`)
            ];

            if (gameId) {
                conditions.push(eq(mods.gameId, gameId));
            }

            if (sourceType) {
                conditions.push(eq(mods.sourceType, sourceType));
            }

            const result = await query
                .where(and(...conditions))
                .orderBy(desc(mods.createdAt))
                .limit(limit);

            return result.map(this.mapToModData);
        } catch (error) {
            console.error(`搜索模组失败 [关键词: ${keyword}]:`, error);
            throw error;
        }
    }


    /**
     * 添加模组
     */
    public async addMod(modData: ModData): Promise<ModData | null> {
        try {
            const db = await getDb();
            const result = await db.insert(mods).values(modData).returning();
            return result.length > 0 ? this.mapToModData(result[0]) : null;
        } catch (error) {
            console.error('添加模组失败:', error);
            throw error;
        }
    }


    /**
     * 创建模组
     */
    public async createMod(modData: Omit<ModData, 'modId' | 'createdAt' | 'updatedAt'>): Promise<ModData | null> {
        try {
            const db = await getDb();
            const result = await db.insert(mods).values({
                platformId: modData.platformId,
                gameId: modData.gameId,
                nameId: modData.nameId,
                displayName: modData.displayName,
                url: modData.url || "",
                sourceType: modData.sourceType || "Unknown",
                tags: JSON.stringify(modData.tags || []),
                approvalStatus: modData.approvalStatus || "Sandbox",
                dependModId: modData.dependModId || 0,
            }).returning();

            return result.length > 0 ? this.mapToModData(result[0]) : null;
        } catch (error) {
            console.error('创建模组失败:', error);
            throw error;
        }
    }

    /**
     * 更新模组
     */
    public async updateMod(modId: number, modData: Partial<Omit<ModData, 'modId' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
        try {
            const db = await getDb();
            const updateData: any = {};

            if (modData.platformId !== undefined) updateData.platformId = modData.platformId;
            if (modData.gameId !== undefined) updateData.gameId = modData.gameId;
            if (modData.nameId !== undefined) updateData.nameId = modData.nameId;
            if (modData.displayName !== undefined) updateData.displayName = modData.displayName;
            if (modData.url !== undefined) updateData.url = modData.url;
            if (modData.sourceType !== undefined) updateData.sourceType = modData.sourceType;
            if (modData.tags !== undefined) updateData.tags = JSON.stringify(modData.tags);
            if (modData.approvalStatus !== undefined) updateData.approvalStatus = modData.approvalStatus;
            if (modData.dependModId !== undefined) updateData.dependModId = modData.dependModId;

            updateData.updatedAt = new Date();

            await db.update(mods)
                .set(updateData)
                .where(eq(mods.modId, modId));

            return true;
        } catch (error) {
            console.error(`更新模组失败 [ID: ${modId}]:`, error);
            return false;
        }
    }

    /**
     * 删除模组（级联删除相关数据）
     */
    public async deleteMod(modId: number): Promise<boolean> {
        try {
            const db = await getDb();

            // 由于外键约束设置了CASCADE，删除模组时会自动删除相关的版本、下载、状态数据
            await db.delete(mods).where(eq(mods.modId, modId));

            return true;
        } catch (error) {
            console.error(`删除模组失败 [ID: ${modId}]:`, error);
            return false;
        }
    }

    /**
     * =============================
     * 模组版本操作
     * =============================
     */

    /**
     * 获取模组版本信息
     */
    public async getModVersion(modId: number): Promise<ModVersionData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(modVersions).where(eq(modVersions.modId, modId)).limit(1);
            return result.length > 0 ? this.mapToModVersionData(result[0]) : null;
        } catch (error) {
            console.error(`获取模组版本信息失败 [ID: ${modId}]:`, error);
            throw error;
        }
    }

    /**
     * 创建或更新模组版本信息
     */
    public async upsertModVersion(versionData: ModVersionData): Promise<boolean> {
        try {
            const db = await getDb();
            const existing = await this.getModVersion(versionData.modId);

            if (existing) {
                // 更新
                await db.update(modVersions)
                    .set({
                        currentVersion: versionData.currentVersion || "-",
                        availableVersions: JSON.stringify(versionData.availableVersions || []),
                        updatedAt: new Date(),
                    })
                    .where(eq(modVersions.modId, versionData.modId));
            } else {
                // 创建
                await db.insert(modVersions).values({
                    modId: versionData.modId,
                    currentVersion: versionData.currentVersion || "-",
                    availableVersions: JSON.stringify(versionData.availableVersions || []),
                });
            }

            return true;
        } catch (error) {
            console.error(`创建或更新模组版本信息失败 [ID: ${versionData.modId}]:`, error);
            return false;
        }
    }

    /**
     * =============================
     * 模组下载操作
     * =============================
     */

    /**
     * 获取模组下载信息
     */
    public async getModDownload(modId: number): Promise<ModDownloadData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(modDownloads).where(eq(modDownloads.modId, modId)).limit(1);
            return result.length > 0 ? this.mapToModDownloadData(result[0]) : null;
        } catch (error) {
            console.error(`获取模组下载信息失败 [ID: ${modId}]:`, error);
            throw error;
        }
    }

    /**
     * 创建或更新模组下载信息
     */
    public async upsertModDownload(downloadData: ModDownloadData): Promise<boolean> {
        try {
            const db = await getDb();
            const existing = await this.getModDownload(downloadData.modId);

            if (existing) {
                // 更新
                const updateData: any = {};
                if (downloadData.downloadUrl !== undefined) updateData.downloadUrl = downloadData.downloadUrl;
                if (downloadData.cachePath !== undefined) updateData.cachePath = downloadData.cachePath;
                if (downloadData.fileSize !== undefined) updateData.fileSize = downloadData.fileSize;
                if (downloadData.downloadProgress !== undefined) updateData.downloadProgress = downloadData.downloadProgress;
                if (downloadData.downloadStatus !== undefined) updateData.downloadStatus = downloadData.downloadStatus;
                updateData.updatedAt = new Date();

                await db.update(modDownloads)
                    .set(updateData)
                    .where(eq(modDownloads.modId, downloadData.modId));
            } else {
                // 创建
                await db.insert(modDownloads).values({
                    modId: downloadData.modId,
                    downloadUrl: downloadData.downloadUrl || "",
                    cachePath: downloadData.cachePath || "",
                    fileSize: downloadData.fileSize || 0,
                    downloadProgress: downloadData.downloadProgress || 100,
                    downloadStatus: downloadData.downloadStatus || "completed",
                });
            }

            return true;
        } catch (error) {
            console.error(`创建或更新模组下载信息失败 [ID: ${downloadData.modId}]:`, error);
            return false;
        }
    }

    /**
     * 更新下载进度
     */
    public async updateDownloadProgress(modId: number, progress: number, status?: string): Promise<boolean> {
        try {
            const updateData: Partial<ModDownloadData> = {downloadProgress: progress};
            if (status) updateData.downloadStatus = status;

            return await this.upsertModDownload({modId, ...updateData});
        } catch (error) {
            console.error(`更新下载进度失败 [ID: ${modId}]:`, error);
            return false;
        }
    }

    /**
     * =============================
     * 模组状态操作
     * =============================
     */

    /**
     * 获取模组状态信息
     */
    public async getModStatus(modId: number): Promise<ModStatusData | null> {
        try {
            const db = await getDb();
            const result = await db.select().from(modStatus).where(eq(modStatus.modId, modId)).limit(1);
            return result.length > 0 ? this.mapToModStatusData(result[0]) : null;
        } catch (error) {
            console.error(`获取模组状态信息失败 [ID: ${modId}]:`, error);
            throw error;
        }
    }

    /**
     * 创建或更新模组状态信息
     */
    public async upsertModStatus(statusData: ModStatusData): Promise<boolean> {
        try {
            const db = await getDb();
            const existing = await this.getModStatus(statusData.modId);

            if (existing) {
                // 更新
                const updateData: any = {};
                if (statusData.lastUpdateDate !== undefined) updateData.lastUpdateDate = statusData.lastUpdateDate;
                if (statusData.onlineUpdateDate !== undefined) updateData.onlineUpdateDate = statusData.onlineUpdateDate;
                if (statusData.isOnlineAvailable !== undefined) updateData.isOnlineAvailable = statusData.isOnlineAvailable;
                if (statusData.isLocalNotFound !== undefined) updateData.isLocalNotFound = statusData.isLocalNotFound;
                updateData.updatedAt = new Date();

                await db.update(modStatus)
                    .set(updateData)
                    .where(eq(modStatus.modId, statusData.modId));
            } else {
                // 创建
                await db.insert(modStatus).values({
                    modId: statusData.modId,
                    lastUpdateDate: statusData.lastUpdateDate || 0,
                    onlineUpdateDate: statusData.onlineUpdateDate || 0,
                    isOnlineAvailable: statusData.isOnlineAvailable ?? true,
                    isLocalNotFound: statusData.isLocalNotFound ?? false,
                });
            }

            return true;
        } catch (error) {
            console.error(`创建或更新模组状态信息失败 [ID: ${statusData.modId}]:`, error);
            return false;
        }
    }

    /**
     * =============================
     * 综合操作
     * =============================
     */

    /**
     * 获取完整的模组信息（包含版本、下载、状态）
     */
    public async getCompleteModData(modId: number): Promise<CompleteModData | null> {
        try {
            const mod = await this.getModById(modId);
            if (!mod) return null;

            const [version, download, status] = await Promise.all([
                this.getModVersion(modId),
                this.getModDownload(modId),
                this.getModStatus(modId)
            ]);

            return {
                ...mod,
                version: version || undefined,
                download: download || undefined,
                status: status || undefined
            };
        } catch (error) {
            console.error(`获取完整模组信息失败 [ID: ${modId}]:`, error);
            return null;
        }
    }

    /**
     * 批量获取完整的模组信息
     */
    public async getBatchCompleteModData(modIds: number[]): Promise<CompleteModData[]> {
        try {
            const results = await Promise.all(
                modIds.map(modId => this.getCompleteModData(modId))
            );

            return results.filter(result => result !== null) as CompleteModData[];
        } catch (error) {
            console.error('批量获取完整模组信息失败:', error);
            return [];
        }
    }

    /**
     * 获取模组统计信息
     */
    public async getModStats(): Promise<{
        total: number;
        bySourceType: Record<string, number>;
        byApprovalStatus: Record<string, number>;
        byGame: Record<number, number>;
    }> {
        try {
            const db = await getDb();
            const allMods = await db.select().from(mods);

            const bySourceType: Record<string, number> = {};
            const byApprovalStatus: Record<string, number> = {};
            const byGame: Record<number, number> = {};

            allMods.forEach(mod => {
                bySourceType[mod.sourceType] = (bySourceType[mod.sourceType] || 0) + 1;
                byApprovalStatus[mod.approvalStatus] = (byApprovalStatus[mod.approvalStatus] || 0) + 1;
                byGame[mod.gameId] = (byGame[mod.gameId] || 0) + 1;
            });

            return {
                total: allMods.length,
                bySourceType,
                byApprovalStatus,
                byGame
            };
        } catch (error) {
            console.error('获取模组统计信息失败:', error);
            return {total: 0, bySourceType: {}, byApprovalStatus: {}, byGame: {}};
        }
    }

    /**
     * =============================
     * 私有映射方法
     * =============================
     */

    private mapToModData(record: any): ModData {
        return {
            modId: record.modId,
            platformId: record.platformId,
            gameId: record.gameId,
            nameId: record.nameId,
            displayName: record.displayName,
            url: record.url,
            sourceType: record.sourceType,
            tags: typeof record.tags === 'string' ? JSON.parse(record.tags) : record.tags,
            approvalStatus: record.approvalStatus,
            dependModId: record.dependModId,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    private mapToModVersionData(record: any): ModVersionData {
        return {
            modId: record.modId,
            currentVersion: record.currentVersion,
            availableVersions: typeof record.availableVersions === 'string'
                ? JSON.parse(record.availableVersions)
                : record.availableVersions,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    private mapToModDownloadData(record: any): ModDownloadData {
        return {
            modId: record.modId,
            downloadUrl: record.downloadUrl,
            cachePath: record.cachePath,
            fileSize: record.fileSize,
            downloadProgress: record.downloadProgress,
            downloadStatus: record.downloadStatus,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    private mapToModStatusData(record: any): ModStatusData {
        return {
            modId: record.modId,
            lastUpdateDate: record.lastUpdateDate,
            onlineUpdateDate: record.onlineUpdateDate,
            isOnlineAvailable: record.isOnlineAvailable,
            isLocalNotFound: record.isLocalNotFound,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}