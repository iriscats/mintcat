import {message} from "antd";
import {t} from "i18next";
import StatusBar from "@/components/StatusBar.tsx";
import {TreeViewModel} from "./TreeViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {BaseViewModel} from "@/core/BaseViewModel";
import {ProfileService} from "@/services/ProfileService.ts";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import {HomeService, type AddModFromUrlResult, type AddModFromPathResult} from "@/services/HomeService.ts";

/**
 * HomeViewModel handles mod operations and business logic
 * Manages mod adding, removing, updating, and dependency resolution
 */
export class HomeViewModel extends BaseViewModel {
    private homeService = new HomeService();

    constructor() {
        super();
    }

    public async addModFromUrl(url: string, groupId: number): Promise<AddModFromUrlResult> {
        await StatusBar.log(t("Fetch Mod Info"), 'info');
        try {
            return await this.homeService.addModFromUrl(url, groupId);
        } catch (error) {
            console.error('Failed to add mod from URL:', error);
            message.error(t("Failed to add mod to database"));
            return { status: "invalid" };
        }
    }

    public async addModFromPath(modPath: string, groupId: number): Promise<AddModFromPathResult> {
        console.log(`[addModFromPath] Adding local mod: ${modPath}, groupId: ${groupId}`);
        try {
            const result = await this.homeService.addModFromPath(modPath, groupId);
            if (result.status === "missing") {
                console.log(`[addModFromPath] File does not exist: ${modPath}`);
                message.warning(t("Mod Path No Exists") + ": " + modPath);
            }
            return result;
        } catch (error) {
            console.error(`[addModFromPath] Failed to add mod to database: ${modPath}`, error);
            message.error(t("Failed to add mod to database"));
            return { status: "missing", modPath };
        }
    }

    public async removeMod(id: number): Promise<void> {
        await this.homeService.removeModFromActiveProfile(id);
    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        await this.homeService.updateModDisplayName(id, name);
    }
    /**
     * 设置 mod 启用状态
     * @param modId mod 的 ID
     * @param enable 是否启用
     * @param profileModId 可选的 profile_mods 表主键 ID，用于避免切换 profile 时的竞态条件
     */
    public async setModEnabled(modId: number, enable: boolean, profileModId?: number): Promise<void> {
        await this.homeService.setModEnabled(modId, enable, profileModId);
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


        try {
            await this.homeService.removeGroup(groupId);
        } catch (error) {
            console.error(`[HomeViewModel] Error removing group ${groupId}:`, error);
            throw error;
        }
    }

    /**
     * 清理本地文件不存在的 Local 类型 mod
     * @returns 清理的 mod 数量
     */
    public async cleanMissingLocalMods(): Promise<number> {
        return await this.homeService.cleanMissingLocalMods();
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

        await ClipboardApi.writeText(list);
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
