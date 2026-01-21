import {message} from "antd";
import {t} from "i18next";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {path} from "@tauri-apps/api";
import {ModioApi} from "@/apis/modio";
import {ProfileTreeGroupType} from "@/storage/db/Schema.ts";
import {ModUpdateService} from "@/services/ModUpdateService.ts";
import {StorageAPI} from "@/storage";
import StatusBar from "@/components/StatusBar.tsx";
import {TreeViewModel} from "./TreeViewModel.ts";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {emitVoidEvent} from "@/events";
import {BaseViewModel} from "@/core/BaseViewModel";
import {ModService} from "@/services/ModService.ts";
import {ProfileService} from "@/services/ProfileService.ts";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";

/**
 * HomeViewModel handles mod operations and business logic
 * Manages mod adding, removing, updating, and dependency resolution
 */
export class HomeViewModel extends BaseViewModel {

    private static instance: HomeViewModel;

    private constructor() {
        super();
    }

    public static updateProfileSelect() {
        emitVoidEvent("home-page-update-profile-select");
    }

    private async addModDependencies(modId: number, groupId: number): Promise<void> {
        await StatusBar.log(t("Fetch Mod Dependencies"), 'info');

        const depends = await ModioApi.getDependencies(modId);
        if (!depends) {
            return;
        }

        // Get active profile
        const profiles = await StorageAPI.getProfiles();
        let activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            const profileVM = await IoC.get(ProfileViewModel);
            activeProfile = await profileVM.getActiveProfileData();
        }

        for (const depend of depends) {
            // Add mod using ModService
            try {
                const addedMod = await ModService.addModFromModio(depend, activeProfile.id!, groupId);

                TreeViewModel.updateTreeView();

                await ModUpdateService.updateMod(addedMod);
            } catch (error) {
                console.error('Failed to add dependency:', error);
                continue;
            }
        }
    }

    public async addModFromUrl(url: string, groupId: number): Promise<boolean> {
        await StatusBar.log(t("Fetch Mod Info"), 'info');
        const modInfoResp = await ModioApi.getModInfoByLink(url);
        if (modInfoResp === undefined) {
            return false;
        }

        // Get active profile
        const modsApi = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();
        let activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            const profileVM = await IoC.get(ProfileViewModel);
            activeProfile = await profileVM.getActiveProfileData();
        }

        const existingMod = await modsApi.getModByPlatformId(modInfoResp.id, 'Modio');
        if (existingMod) {
            const existingProfileMod = await profiles.getProfileMod(activeProfile.id!, existingMod.modId!);
            if (existingProfileMod) {
                message.warning(`${t("Mod Already Exists")} ${modInfoResp.name}`);
                return true;
            }

            const profileMods = await profiles.getProfileMods(activeProfile.id!);
            const maxSortOrder = profileMods.reduce((max, pm) => Math.max(max, pm.sortOrder ?? 0), -1);
            const modVersion = await modsApi.getModVersion(existingMod.modId!);

            await profiles.addModToProfile({
                profileId: activeProfile.id!,
                modId: existingMod.modId!,
                parentFolderId: groupId,
                sortOrder: maxSortOrder + 1,
                isEnabled: true,
                usedVersion: modVersion?.currentVersion || "",
            });

            const completeData = await modsApi.getCompleteModData(existingMod.modId!);
            if (completeData) {
                await ModUpdateService.updateMod(completeData);
            }

            if (modInfoResp.dependencies) {
                await this.addModDependencies(modInfoResp.id, groupId);
            }

            TreeViewModel.updateTreeView();
            TreeViewModel.updateTreeViewCountLabel();

            return true;
        }

        // Add mod using ModService
        try {
            const addedMod = await ModService.addModFromModio(modInfoResp, activeProfile.id!, groupId);

            await ModUpdateService.updateMod(addedMod);

            if (modInfoResp.dependencies) {
                await this.addModDependencies(modInfoResp.id, groupId);
            }

            TreeViewModel.updateTreeView();
            TreeViewModel.updateTreeViewCountLabel();

            return true;
        } catch (error) {
            console.error('Failed to add mod from URL:', error);
            message.error(t("Failed to add mod to database"));
            return false;
        }
    }

    public async addModFromPath(modPath: string, groupId: number): Promise<boolean> {
        console.log(`[addModFromPath] Adding local mod: ${modPath}, groupId: ${groupId}`);

        if (!await exists(modPath)) {
            console.log(`[addModFromPath] File does not exist: ${modPath}`);
            message.warning(t("Mod Path No Exists" + modPath));
            return true;
        }

        // Get active profile
        const modsApi = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();
        let activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            const profileVM = await IoC.get(ProfileViewModel);
            activeProfile = await profileVM.getActiveProfileData();
        }

        const existingMod = await modsApi.getModByUrl(modPath);
        if (existingMod) {
            const existingProfileMod = await profiles.getProfileMod(activeProfile.id!, existingMod.modId!);
            if (existingProfileMod) {
                message.warning(`${t("Mod Already Exists")}: ${modPath}`);
                return true;
            }

            const profileMods = await profiles.getProfileMods(activeProfile.id!);
            const maxSortOrder = profileMods.reduce((max, pm) => Math.max(max, pm.sortOrder ?? 0), -1);

            await profiles.addModToProfile({
                profileId: activeProfile.id!,
                modId: existingMod.modId!,
                parentFolderId: groupId,
                sortOrder: maxSortOrder + 1,
                isEnabled: true,
                usedVersion: "-",
            });

            TreeViewModel.updateTreeView();
            TreeViewModel.updateTreeViewCountLabel();

            return true;
        }

        // Add mod using ModService
        try {
            const fileName = await path.basename(modPath);
            const addedMod = await ModService.addModFromPath(modPath, fileName, activeProfile.id!, groupId);

            // Update last update date based on file modification time
            const fileInfo = await stat(modPath);
            if (addedMod.status) {
                // fileInfo.mtime.getTime() returns milliseconds (JavaScript standard)
                addedMod.status.lastUpdateDate = fileInfo.mtime.getTime();
                await modsApi.upsertModStatus(addedMod.status);
            }

            console.log(`[addModFromPath] Successfully added mod to database:`, addedMod);

            TreeViewModel.updateTreeView();
            TreeViewModel.updateTreeViewCountLabel();

            return true;
        } catch (error) {
            console.error(`[addModFromPath] Failed to add mod to database: ${modPath}`, error);
            message.error(t("Failed to add mod to database"));
            return false;
        }
    }

    public async removeMod(id: number): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        let activeProfile = await profiles.getActiveProfile();

        if (!activeProfile) {
            const profileVM = await IoC.get(ProfileViewModel);
            activeProfile = await profileVM.getActiveProfileData();
        }

        await profiles.removeModFromProfile(activeProfile.id!, id);

        TreeViewModel.updateTreeView();
        TreeViewModel.updateTreeViewCountLabel();
    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        // Set mod display name - this should update the mod's display name in the mods table
        const modsApi = await StorageAPI.getMods();
        await modsApi.updateMod(id, { displayName: name });

        TreeViewModel.updateTreeView();
    }

    public async setModEnabled(modId: number, enable: boolean): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        let activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            const profileVM = await IoC.get(ProfileViewModel);
            activeProfile = await profileVM.getActiveProfileData();
        }
        await profiles.setModEnabled(activeProfile.id!, modId, enable);

        //局部刷新可以不更新树
    }

    public async setModUsedVersion(profileModId: number, version: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();

        await profiles.updateProfileMod(profileModId, { usedVersion: version });

        TreeViewModel.updateTreeView();
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        const treeViewModel = await TreeViewModel.getInstance();
        await treeViewModel.setGroupName(id, name);
    }

    public async getGroupName(id: number): Promise<string | undefined> {
        const treeViewModel = await TreeViewModel.getInstance();
        return treeViewModel.getGroupName(id);
    }

    public async addGroup(parentGroupId: number, groupName: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const activeProfile = await profiles.getActiveProfile();

        if (activeProfile) {
            await profiles.createFolder({
                profileId: activeProfile.id!,
                name: groupName,
                parentFolderId: parentGroupId || null,
                folderType: 'custom'
            });
        }

        TreeViewModel.updateTreeView();
    }

    public async removeGroup(groupId: number): Promise<void> {
        console.log(`[HomeViewModel] removeGroup called with groupId=${groupId}`);

        if (groupId === ProfileTreeGroupType.MODIO || groupId === ProfileTreeGroupType.LOCAL) {
            message.error(t("Can't Remove Default Group"));
            return;
        }

        try {
            const profiles = await StorageAPI.getProfiles();
            await profiles.deleteFolder(groupId);

            TreeViewModel.updateTreeView();
            TreeViewModel.updateTreeViewCountLabel();
        } catch (error) {
            console.error(`[HomeViewModel] Error removing group ${groupId}:`, error);
            throw error;
        }
    }

    /**
     * 导出当前 profile 的 mod.io URL 列表到剪贴板
     * @returns 是否成功导出
     */
    public async exportModioUrlsToClipboard(): Promise<boolean> {
        const profileService = new ProfileService();
        const urls = await profileService.getActiveProfileModioUrls();

        if (urls.length === 0) {
            message.warning(t("No mod.io mods found in current profile"));
            return false;
        }

        const list = urls.join("\n") + "\n";

        ClipboardApi.setLastClipboardText(list);
        await navigator.clipboard.writeText(list);
        message.success(t("Copied To Clipboard"));

        return true;
    }

    /**
     * Shared lock instance for thread-safe singleton initialization
     */
    private static lockInstance = new class extends BaseViewModel {}();

    /**
     * Get singleton instance of HomeViewModel
     * Thread-safe with initialization lock
     *
     * @returns HomeViewModel instance
     *
     * @example
     * ```typescript
     * const homeViewModel = await HomeViewModel.getInstance();
     * ```
     */
    public static async getInstance(): Promise<HomeViewModel> {
        const release = await this.lockInstance.acquireLock();
        try {
            if (!HomeViewModel.instance) {
                HomeViewModel.instance = new HomeViewModel();
                await HomeViewModel.instance.initialize();
            }
            return HomeViewModel.instance;
        } finally {
            release();
        }
    }

    /**
     * Initialize HomeViewModel
     * No specific initialization needed for now
     */
    protected async initialize(): Promise<void> {
        this.initialized = true;
    }

}
