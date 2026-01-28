import {message} from "antd";
import {t} from "i18next";
import {ProfileTreeGroupType} from "@/storage/db/Schema.ts";
import StatusBar from "@/components/StatusBar.tsx";
import {TreeViewModel} from "./TreeViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {BaseViewModel} from "@/core/BaseViewModel";
import {ProfileService} from "@/services/ProfileService.ts";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import {HomeService} from "@/services/HomeService.ts";

/**
 * HomeViewModel handles mod operations and business logic
 * Manages mod adding, removing, updating, and dependency resolution
 */
export class HomeViewModel extends BaseViewModel {
    private homeService = new HomeService();

    constructor() {
        super();
    }

    public async addModFromUrl(url: string, groupId: number): Promise<boolean> {
        await StatusBar.log(t("Fetch Mod Info"), 'info');
        try {
            const result = await this.homeService.addModFromUrl(url, groupId);
            if (result.status === "invalid") {
                return false;
            }
            if (result.status === "exists") {
                message.warning(`${t("Mod Already Exists")} ${result.modName ?? ""}`.trim());
                return true;
            }
            return true;
        } catch (error) {
            console.error('Failed to add mod from URL:', error);
            message.error(t("Failed to add mod to database"));
            return false;
        }
    }

    public async addModFromPath(modPath: string, groupId: number): Promise<boolean> {
        console.log(`[addModFromPath] Adding local mod: ${modPath}, groupId: ${groupId}`);
        try {
            const result = await this.homeService.addModFromPath(modPath, groupId);
            if (result.status === "missing") {
                console.log(`[addModFromPath] File does not exist: ${modPath}`);
                message.warning(t("Mod Path No Exists" + modPath));
                return true;
            }
            if (result.status === "exists") {
                message.warning(`${t("Mod Already Exists")}: ${modPath}`);
            }
            return true;
        } catch (error) {
            console.error(`[addModFromPath] Failed to add mod to database: ${modPath}`, error);
            message.error(t("Failed to add mod to database"));
            return false;
        }
    }

    public async removeMod(id: number): Promise<void> {
        await this.homeService.removeModFromActiveProfile(id);
    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        await this.homeService.updateModDisplayName(id, name);
    }
    public async setModEnabled(modId: number, enable: boolean): Promise<void> {
        await this.homeService.setModEnabled(modId, enable);
    }

    public async setModUsedVersion(profileModId: number, version: string): Promise<void> {
        await this.homeService.setModUsedVersion(profileModId, version);
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        const treeViewModel = await IoC.get(TreeViewModel);
        await treeViewModel.setGroupName(id, name);
    }

    public async getGroupName(id: number): Promise<string | undefined> {
        const treeViewModel = await IoC.get(TreeViewModel);
        return treeViewModel.getGroupName(id);
    }

    public async addGroup(parentGroupId: number, groupName: string): Promise<void> {
        await this.homeService.addGroup(parentGroupId, groupName);
    }

    public async removeGroup(groupId: number): Promise<void> {
        console.log(`[HomeViewModel] removeGroup called with groupId=${groupId}`);

        if (groupId === ProfileTreeGroupType.MODIO || groupId === ProfileTreeGroupType.LOCAL) {
            message.error(t("Can't Remove Default Group"));
            return;
        }

        try {
            await this.homeService.removeGroup(groupId);
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
        const profileService = await IoC.get(ProfileService);
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
     * Initialize HomeViewModel
     * No specific initialization needed for now
     */
    async initialize(): Promise<void> {
        this.initialized = true;
    }

}
