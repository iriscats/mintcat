import { ModMapper } from '@/mappers/ModMapper';
import { StorageAPI } from '@/storage';
import type { CompleteModData } from '@/storage/dao/ModDAO';

/**
 * ModService 服务层
 *
 * 封装模组相关的业务逻辑，提供高级操作
 * 使用 ModDAO 访问数据库，使用 ModMapper 进行转换
 */
export class ModService {

    private static async ensureProfileModAssociation(options: {
        profileId: number;
        modId: number;
        folderId: number;
        usedVersion: string;
    }): Promise<void> {
        const profilesDAO = await StorageAPI.getProfiles();

        const existing = await profilesDAO.getProfileMod(options.profileId, options.modId);
        if (existing) {
            return;
        }

        const existingMods = await profilesDAO.getProfileMods(options.profileId);
        const maxSortOrder = existingMods.reduce((max, pm) => Math.max(max, pm.sortOrder ?? 0), -1);

        await profilesDAO.addModToProfile({
            profileId: options.profileId,
            modId: options.modId,
            parentFolderId: options.folderId,
            sortOrder: maxSortOrder + 1,
            isEnabled: true,
            usedVersion: options.usedVersion,
        });
    }

    /**
     * 获取所有模组的完整数据
     */
    static async getAllMods(): Promise<CompleteModData[]> {
        const modsDAO = await StorageAPI.getMods();
        const allModsData = await modsDAO.getAllMods();

        // 批量获取完整数据
        const modIds = allModsData.map(m => m.modId!);
        return await modsDAO.getBatchCompleteModData(modIds);
    }

    /**
     * 根据数据库 ID 获取单个模组
     */
    static async getModById(modId: number): Promise<CompleteModData | null> {
        const modsDAO = await StorageAPI.getMods();
        return await modsDAO.getCompleteModData(modId);
    }

    /**
     * 从 mod.io API 响应添加模组
     */
    static async addModFromModio(
        modInfo: any,
        profileId: number,
        folderId: number
    ): Promise<CompleteModData> {
        const modsDAO = await StorageAPI.getMods();

        // 转换 API 响应到 DTO
        const dto = ModMapper.fromModioResponse(modInfo);

        let savedMod = await modsDAO.getModByPlatformId(dto.platformId);
        if (!savedMod && dto.url) {
            savedMod = await modsDAO.getModByUrl(dto.url);
        }

        if (!savedMod) {
            try {
                savedMod = await modsDAO.addMod(dto);
            } catch (error) {
                savedMod = await modsDAO.getModByPlatformId(dto.platformId);
                if (!savedMod && dto.url) {
                    savedMod = await modsDAO.getModByUrl(dto.url);
                }
                if (!savedMod) {
                    throw error;
                }
            }
        }

        if (!savedMod) {
            throw new Error("Failed to save mod to database");
        }

        await modsDAO.updateMod(savedMod.modId!, {
            platformId: dto.platformId,
            gameId: dto.gameId,
            nameId: dto.nameId,
            displayName: dto.displayName,
            url: dto.url,
            sourceType: dto.sourceType,
            tags: dto.tags,
            approvalStatus: dto.approvalStatus,
            dependModId: dto.dependModId,
        });

        await ModService.ensureProfileModAssociation({
            profileId,
            modId: savedMod.modId!,
            folderId,
            usedVersion: dto.version?.currentVersion || "",
        });

        // 保存版本、下载、状态信息
        if (dto.version) {
            await modsDAO.upsertModVersion({ ...dto.version, modId: savedMod.modId! });
        }
        if (dto.download) {
            await modsDAO.upsertModDownload({ ...dto.download, modId: savedMod.modId! });
        }
        if (dto.status) {
            await modsDAO.upsertModStatus({ ...dto.status, modId: savedMod.modId! });
        }

        // 获取并返回完整数据
        const completeData = await modsDAO.getCompleteModData(savedMod.modId!);
        if (!completeData) {
            throw new Error("Failed to fetch saved mod");
        }

        return completeData;
    }

    /**
     * 从本地文件路径添加模组
     */
    static async addModFromPath(
        filePath: string,
        fileName: string,
        profileId: number,
        folderId: number
    ): Promise<CompleteModData> {
        const modsDAO = await StorageAPI.getMods();

        // 转换文件路径到 DTO
        const dto = ModMapper.fromLocalPath(filePath, fileName);

        let savedMod = dto.url ? await modsDAO.getModByUrl(dto.url) : null;
        if (!savedMod) {
            savedMod = await modsDAO.getModByPlatformId(dto.platformId);
        }

        if (!savedMod) {
            try {
                savedMod = await modsDAO.addMod(dto);
            } catch (error) {
                savedMod = dto.url ? await modsDAO.getModByUrl(dto.url) : null;
                if (!savedMod) {
                    savedMod = await modsDAO.getModByPlatformId(dto.platformId);
                }
                if (!savedMod) {
                    throw error;
                }
            }
        }

        if (!savedMod) {
            throw new Error("Failed to save mod to database");
        }

        await modsDAO.updateMod(savedMod.modId!, {
            platformId: dto.platformId,
            gameId: dto.gameId,
            nameId: dto.nameId,
            displayName: dto.displayName,
            url: dto.url,
            sourceType: dto.sourceType,
            tags: dto.tags,
            approvalStatus: dto.approvalStatus,
            dependModId: dto.dependModId,
        });

        await ModService.ensureProfileModAssociation({
            profileId,
            modId: savedMod.modId!,
            folderId,
            usedVersion: "-",
        });

        // 保存版本、下载、状态信息
        if (dto.version) {
            await modsDAO.upsertModVersion({ ...dto.version, modId: savedMod.modId! });
        }
        if (dto.download) {
            await modsDAO.upsertModDownload({ ...dto.download, modId: savedMod.modId! });
        }
        if (dto.status) {
            await modsDAO.upsertModStatus({ ...dto.status, modId: savedMod.modId! });
        }

        // 获取并返回完整数据
        const completeData = await modsDAO.getCompleteModData(savedMod.modId!);
        if (!completeData) {
            throw new Error("Failed to fetch saved mod");
        }

        return completeData;
    }

    /**
     * 更新模组数据
     */
    static async updateMod(mod: CompleteModData): Promise<boolean> {
        const modsDAO = await StorageAPI.getMods();

        // 更新基础模组数据
        await modsDAO.updateMod(mod.modId!, mod);

        // 更新关联表
        if (mod.version) {
            await modsDAO.upsertModVersion(mod.version);
        }
        if (mod.download) {
            await modsDAO.upsertModDownload(mod.download);
        }
        if (mod.status) {
            await modsDAO.upsertModStatus(mod.status);
        }

        return true;
    }

    /**
     * 更新下载进度
     */
    static async updateDownloadProgress(
        modId: number,
        progress: number,
        status?: string
    ): Promise<boolean> {
        const modsDAO = await StorageAPI.getMods();
        return await modsDAO.updateDownloadProgress(modId, progress, status);
    }
}
