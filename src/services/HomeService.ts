import { exists, stat } from "@tauri-apps/plugin-fs";
import { path } from "@tauri-apps/api";
import { ModioApi } from "@/apis/modio";
import { StorageAPI } from "@/storage";
import { ModService } from "@/services/ModService.ts";
import { ModUpdateService } from "@/services/ModUpdateService.ts";
import { ProfileService } from "@/services/ProfileService.ts";
import { IoC } from "@/core/IoC";
import type { ProfileData } from "@/storage/dao/ProfileDAO";

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
            const addedMod = await ModService.addModFromModio(depend, profileId, groupId);
            await ModUpdateService.updateMod(addedMod);
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
    }

    public async addModFromUrl(url: string, groupId: number): Promise<AddModFromUrlResult> {
        const modInfoResp = await ModioApi.getModInfoByLink(url);
        if (modInfoResp === undefined) {
            return { status: "invalid" };
        }

        const profile = await this.getActiveProfile();
        const modsApi = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        const existingMod = await modsApi.getModByPlatformId(modInfoResp.id, "Modio");
        if (existingMod) {
            const existingProfileMod = await profiles.getProfileMod(profile.id!, existingMod.modId!);
            if (existingProfileMod) {
                return { status: "exists", modName: modInfoResp.name };
            }

            const modVersion = await modsApi.getModVersion(existingMod.modId!);
            await this.addModToProfile({
                profileId: profile.id!,
                modId: existingMod.modId!,
                groupId,
                usedVersion: modVersion?.currentVersion || "",
            });

            const completeData = await modsApi.getCompleteModData(existingMod.modId!);
            if (completeData) {
                await ModUpdateService.updateMod(completeData);
            }

            if (modInfoResp.dependencies) {
                await this.addModDependencies(modInfoResp.id, groupId, profile.id!);
            }

            return { status: "added" };
        }

        const addedMod = await ModService.addModFromModio(modInfoResp, profile.id!, groupId);
        await ModUpdateService.updateMod(addedMod);

        if (modInfoResp.dependencies) {
            await this.addModDependencies(modInfoResp.id, groupId, profile.id!);
        }

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

        return { status: "added" };
    }

    public async removeModFromActiveProfile(modId: number): Promise<void> {
        const profile = await this.getActiveProfile();
        const profiles = await StorageAPI.getProfiles();
        await profiles.removeModFromProfile(profile.id!, modId);
    }

    public async updateModDisplayName(modId: number, name: string): Promise<void> {
        const modsApi = await StorageAPI.getMods();
        await modsApi.updateMod(modId, { displayName: name });
    }

    public async setModEnabled(modId: number, enable: boolean): Promise<void> {
        const profile = await this.getActiveProfile();
        const profiles = await StorageAPI.getProfiles();
        await profiles.setModEnabled(profile.id!, modId, enable);
    }

    public async setModUsedVersion(profileModId: number, version: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.updateProfileMod(profileModId, { usedVersion: version });
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
    }

    /**
     * 清理本地文件不存在的 Local 类型 mod
     * @returns 清理的 mod 数量
     */
    public async cleanMissingLocalMods(): Promise<number> {
        const profile = await this.getActiveProfile();
        const modsApi = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        // 获取所有 mod 的完整数据
        const allMods = await modsApi.getAllMods();
        const modIds = allMods.map(m => m.modId!);
        const completeMods = await modsApi.getBatchCompleteModData(modIds);

        // 筛选出 sourceType === "Local" 且 isLocalNotFound === true 的 mod
        const missingLocalMods = completeMods.filter(mod => 
            mod.sourceType === "Local" && mod.status?.isLocalNotFound === true
        );

        // 从当前 profile 中移除这些 mod
        for (const mod of missingLocalMods) {
            await profiles.removeModFromProfile(profile.id!, mod.modId!);
        }

        return missingLocalMods.length;
    }
}
