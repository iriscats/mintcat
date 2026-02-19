import { exists, stat } from "@tauri-apps/plugin-fs";
import { path } from "@tauri-apps/api";
import { ModioApi } from "@/apis/modio";
import { ModcatApi, MODCAT_PLATFORM } from "@/apis/modcat";
import { StorageAPI } from "@/storage";
import { ModService } from "@/services/ModService.ts";
import { ProfileService } from "@/services/ProfileService.ts";
import { IoC } from "@/core/IoC";
import type { ProfileData } from "@/storage/dao/ProfileDAO";
import { TimeUtils } from "@/utils/TimeUtils";

export type AddModFromUrlResult = {
    status: "invalid" | "exists" | "added";
    modName?: string;
};

export type AddModFromPathResult = {
    status: "missing" | "exists" | "added";
    modPath?: string;
};

export class HomeService {
    private _profileService: ProfileService | null = null;

    private async getProfileService(): Promise<ProfileService> {
        if (!this._profileService) {
            this._profileService = await IoC.get(ProfileService);
        }
        return this._profileService;
    }

    private async getActiveProfile(): Promise<ProfileData> {
        const profileService = await this.getProfileService();
        return profileService.ensureActiveProfile();
    }

    private async addModDependencies(modId: number, groupId: number, profileId: number): Promise<void> {
        const depends = await ModioApi.getDependencies(modId);
        if (!depends) {
            return;
        }

        for (const depend of depends) {
            await ModService.addModFromModio(depend, profileId, groupId);
        }
    }

    private async addModToProfile(options: {
        profileId: number;
        modId: number;
        groupId: number;
        usedVersion: string;
    }): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const profileMods = await profiles.getProfileMods(options.profileId);
        const maxSortOrder = profileMods.reduce((max, pm) => Math.max(max, pm.sortOrder ?? 0), -1);

        await profiles.addModToProfile({
            profileId: options.profileId,
            modId: options.modId,
            parentFolderId: options.groupId,
            sortOrder: maxSortOrder + 1,
            isEnabled: true,
            usedVersion: options.usedVersion,
        });

        // 更新 editTime，标记 profile 配置已变更（列表新增了 mod）
        const profileService = await this.getProfileService();
        await profileService.setActiveProfileEditTime(TimeUtils.nowSeconds());
    }

    public async addModFromUrl(url: string, groupId: number): Promise<AddModFromUrlResult> {
        // 检查是否为 ModCat 链接
        if (ModcatApi.isModcatLink(url)) {
            return await this.addModFromModcatUrl(url, groupId);
        }

        // 处理 mod.io 链接
        return await this.addModFromModioUrl(url, groupId);
    }

    /**
     * 从 ModCat 链接添加 Mod
     */
    private async addModFromModcatUrl(url: string, groupId: number): Promise<AddModFromUrlResult> {
        const nameId = ModcatApi.parseModLinks(url);
        if (!nameId) {
            return { status: "invalid" };
        }

        const profile = await this.getActiveProfile();
        const modsApi = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        // 先通过 nameId 检查数据库是否已存在
        const existingModByName = await modsApi.getModByNameId(nameId, MODCAT_PLATFORM);
        if (existingModByName) {
            const existingProfileMod = await profiles.getProfileMod(profile.id!, existingModByName.modId!);
            if (existingProfileMod) {
                return { status: "exists", modName: existingModByName.displayName };
            }

            await this.addModToProfile({
                profileId: profile.id!,
                modId: existingModByName.modId!,
                groupId,
                usedVersion: "",
            });

            return { status: "added" };
        }

        // 数据库中不存在，调用 ModCat API 获取 mod 信息
        const modInfoResp = await ModcatApi.getModInfoByLink(url);
        if (!modInfoResp) {
            return { status: "invalid" };
        }

        // 通过 URL 再检查一次
        const existingMod = await modsApi.getModByUrl(url);
        if (existingMod) {
            const existingProfileMod = await profiles.getProfileMod(profile.id!, existingMod.modId!);
            if (existingProfileMod) {
                return { status: "exists", modName: modInfoResp.Name || "" };
            }

            await this.addModToProfile({
                profileId: profile.id!,
                modId: existingMod.modId!,
                groupId,
                usedVersion: "",
            });

            return { status: "added" };
        }

        // 添加新 mod（仅元数据，不下载；安装时再下载）
        await ModService.addModFromModcat(modInfoResp, profile.id!, groupId);

        await this.updateProfileEditTimeAfterAddMod();
        return { status: "added" };
    }

    /**
     * 从 mod.io 链接添加 Mod
     */
    private async addModFromModioUrl(url: string, groupId: number): Promise<AddModFromUrlResult> {
        // 先从 URL 解析 nameId，检查数据库是否已存在该 mod
        const nameId = ModioApi.parseModLinks(url);
        if (!nameId) {
            return { status: "invalid" };
        }

        const profile = await this.getActiveProfile();
        const modsApi = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        // 先通过 nameId 检查数据库是否已存在（避免不必要的网络请求）
        const existingModByName = await modsApi.getModByNameId(nameId, "Modio");
        if (existingModByName) {
            const existingProfileMod = await profiles.getProfileMod(profile.id!, existingModByName.modId!);
            if (existingProfileMod) {
                return { status: "exists", modName: existingModByName.displayName };
            }

            await this.addModToProfile({
                profileId: profile.id!,
                modId: existingModByName.modId!,
                groupId,
                usedVersion: "",
            });

            // 检查依赖：需要获取 platformId 来查询依赖
            if (existingModByName.platformId) {
                await this.addModDependencies(existingModByName.platformId, groupId, profile.id!);
            }

            return { status: "added" };
        }

        // 数据库中不存在，才调用网络 API 获取 mod 信息
        const modInfoResp = await ModioApi.getModInfoByLink(url);
        if (modInfoResp === undefined) {
            return { status: "invalid" };
        }

        // 再通过 platformId 检查一次（防止 nameId 不匹配但 platformId 匹配的情况）
        const existingMod = await modsApi.getModByPlatformId(modInfoResp.id, "Modio");
        if (existingMod) {
            const existingProfileMod = await profiles.getProfileMod(profile.id!, existingMod.modId!);
            if (existingProfileMod) {
                return { status: "exists", modName: modInfoResp.name };
            }

            await this.addModToProfile({
                profileId: profile.id!,
                modId: existingMod.modId!,
                groupId,
                usedVersion: "",
            });

            if (modInfoResp.dependencies) {
                await this.addModDependencies(modInfoResp.id, groupId, profile.id!);
            }

            return { status: "added" };
        }

        // 仅写入元数据到列表，不下载；安装时再下载
        await ModService.addModFromModio(modInfoResp, profile.id!, groupId);

        if (modInfoResp.dependencies) {
            await this.addModDependencies(modInfoResp.id, groupId, profile.id!);
        }

        await this.updateProfileEditTimeAfterAddMod();
        return { status: "added" };
    }

    public async addModFromPath(modPath: string, groupId: number): Promise<AddModFromPathResult> {
        if (!await exists(modPath)) {
            return { status: "missing", modPath };
        }

        const profile = await this.getActiveProfile();
        const modsApi = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        const existingMod = await modsApi.getModByUrl(modPath);
        if (existingMod) {
            const existingProfileMod = await profiles.getProfileMod(profile.id!, existingMod.modId!);
            if (existingProfileMod) {
                return { status: "exists", modPath };
            }

            await this.addModToProfile({
                profileId: profile.id!,
                modId: existingMod.modId!,
                groupId,
                usedVersion: "-",
            });

            return { status: "added" };
        }

        const fileName = await path.basename(modPath);
        const addedMod = await ModService.addModFromPath(modPath, fileName, profile.id!, groupId);

        const fileInfo = await stat(modPath);
        if (addedMod.status) {
            addedMod.status.lastUpdateDate = fileInfo.mtime.getTime();
            await modsApi.upsertModStatus(addedMod.status);
        }

        await this.updateProfileEditTimeAfterAddMod();
        return { status: "added" };
    }

    /** 添加 mod 后更新 profile editTime，使下次安装会重新打包而非误判为已安装 */
    private async updateProfileEditTimeAfterAddMod(): Promise<void> {
        const profileService = await this.getProfileService();
        await profileService.setActiveProfileEditTime(TimeUtils.nowSeconds());
    }

    public async removeModFromActiveProfile(modId: number): Promise<void> {
        const profile = await this.getActiveProfile();
        const profiles = await StorageAPI.getProfiles();
        await profiles.removeModFromProfile(profile.id!, modId);

        // 更新 editTime，标记 profile 配置已变更（列表删除了 mod）
        // 这样下次安装时 check_installed 不会误判为「已安装」，会重新打包
        const profileService = await this.getProfileService();
        await profileService.setActiveProfileEditTime(TimeUtils.nowSeconds());
    }

    public async updateModDisplayName(modId: number, name: string): Promise<void> {
        const modsApi = await StorageAPI.getMods();
        await modsApi.updateMod(modId, { displayName: name });
    }

    /**
     * 设置 mod 启用状态
     * @param modId mod 的 ID
     * @param enable 是否启用
     * @param profileModId 可选的 profile_mods 表主键 ID，用于避免切换 profile 时的竞态条件
     */
    public async setModEnabled(modId: number, enable: boolean, profileModId?: number): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        
        // 如果提供了 profileModId，直接通过 ID 更新（避免竞态条件）
        if (profileModId !== undefined) {
            await profiles.setModEnabledById(profileModId, enable);
        } else {
            // 兼容旧调用方式：通过 profileId + modId 更新
            const profile = await this.getActiveProfile();
            await profiles.setModEnabled(profile.id!, modId, enable);
        }

        // 更新 editTime，标记 profile 配置已变更
        // 这样下次安装时 check_installed 不会误判为 "已安装"
        const profileService = await this.getProfileService();
        await profileService.setActiveProfileEditTime(TimeUtils.nowSeconds());
    }

    public async setModUsedVersion(profileModId: number, version: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.updateProfileMod(profileModId, { usedVersion: version });

        // 更新 editTime，标记 profile 配置已变更
        // 这样下次安装时 check_installed 不会误判为 "已安装"
        const profileService = await this.getProfileService();
        await profileService.setActiveProfileEditTime(TimeUtils.nowSeconds());
    }

    public async addGroup(parentGroupId: number, groupName: string): Promise<void> {
        const profile = await this.getActiveProfile();
        const profiles = await StorageAPI.getProfiles();

        await profiles.createFolder({
            profileId: profile.id!,
            name: groupName,
            parentFolderId: parentGroupId || null,
            folderType: "custom",
        });
    }

    public async removeGroup(groupId: number): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.deleteFolder(groupId);
        const profileService = await this.getProfileService();
        await profileService.setActiveProfileEditTime(TimeUtils.nowSeconds());
    }

    /**
     * 清理本地文件不存在的 Local 类型 mod
     * @returns 清理的 mod 数量
     */
    public async cleanMissingLocalMods(): Promise<number> {
        const profile = await this.getActiveProfile();
        const modsApi = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        // 获取当前 profile 中的 mod 列表
        const profileMods = await profiles.getProfileMods(profile.id!);
        const modIds = profileMods.map(pm => pm.modId!);
        
        // 获取这些 mod 的完整数据
        const completeMods = await modsApi.getBatchCompleteModData(modIds);

        // 筛选出 sourceType === "Local" 且 isLocalNotFound === true 的 mod
        const missingLocalMods = completeMods.filter(mod => 
            mod.sourceType === "Local" && mod.status?.isLocalNotFound === true
        );

        // 从当前 profile 中移除这些 mod
        for (const mod of missingLocalMods) {
            await profiles.removeModFromProfile(profile.id!, mod.modId!);
        }
        if (missingLocalMods.length > 0) {
            const profileService = await this.getProfileService();
            await profileService.setActiveProfileEditTime(TimeUtils.nowSeconds());
        }
        return missingLocalMods.length;
    }
}
