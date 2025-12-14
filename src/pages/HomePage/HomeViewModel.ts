import {message} from "antd";
import {t} from "i18next";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {path} from "@tauri-apps/api";
import {ModioApi} from "@/apis/modio";
import {
    ModSourceType,
    MOD_INVALID_ID,
    ModListItem,
    ProfileTreeGroupType
} from "@/storage/db/Schema.ts";
import {ModUpdateApi} from "@/apis/ModUpdateApi.ts";
import {StorageAPI} from "@/storage";
import StatusBar from "@/components/StatusBar.tsx";
import {TreeViewModel} from "./TreeViewModel.ts";
import {emit} from "@tauri-apps/api/event";
import {BaseViewModel} from "@/core/BaseViewModel";

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
        emit("home-page-update-profile-select");
    }

    private async addModDependencies(modId: number, groupId: number): Promise<void> {
        await StatusBar.log(t("Fetch Mod Dependencies"));

        const depends = await ModioApi.getDependencies(modId);
        if (!depends) {
            return;
        }

        // Get current mods from database
        const modsApi = await StorageAPI.getMods();
        const currentMods = await modsApi.getAllMods();

        for (const depend of depends) {
            const modItem = this.createModListItemFromModInfo(depend);
            if (!modItem) continue;

            // Check if mod already exists
            const existingMod = currentMods.find(m => m.platformId === depend.id);
            if (existingMod) {
                continue;
            }

            // Add mod to database and profile
            const addedModItem = await this.addModToDatabaseAndProfile(modItem, groupId);
            if (!addedModItem) {
                continue;
            }

            // Also add to in-memory structure for immediate UI update
            const treeViewModel = await TreeViewModel.getInstance();
            treeViewModel.ActiveProfile.addMod(addedModItem.id, groupId);
            treeViewModel.updateTreeView?.call(treeViewModel);

            await ModUpdateApi.updateMod(addedModItem);
        }
    }

    public async addModFromUrl(url: string, groupId: number): Promise<boolean> {
        await StatusBar.log(t("Fetch Mod Info"));
        const modInfoResp = await ModioApi.getModInfoByLink(url);
        if (modInfoResp === undefined) {
            return false;
        }

        const profiles = await StorageAPI.getProfiles();

        if (await profiles.checkModExits(modInfoResp)) {
            message.warning(`${t("Mod Already Exists")} ${modInfoResp.name}`);
            return true;
        }

        const modItem = this.createModListItemFromModInfo(modInfoResp);
        if (!modItem) {
            message.error(t("Failed to create mod item"));
            return false;
        }

        // Use helper function to add mod to database and profile
        const addedModItem = await this.addModToDatabaseAndProfile(modItem, groupId);
        if (!addedModItem) {
            message.error(t("Failed to add mod to database"));
            return false;
        }

        // Add to in-memory structure for immediate UI update
        const treeViewModel = await TreeViewModel.getInstance();
        treeViewModel.ActiveProfile.addMod(addedModItem.id, groupId);

        await ModUpdateApi.updateMod(addedModItem);

        if (modInfoResp.dependencies) {
            await this.addModDependencies(modInfoResp.id, groupId);
        }

        TreeViewModel.updateTreeView();
        TreeViewModel.updateTreeViewCountLabel();

        return true;
    }

    public async addModFromPath(modPath: string, groupId: number): Promise<boolean> {
        let modListItem: ModListItem = {
            id: MOD_INVALID_ID,
            modId: MOD_INVALID_ID,
            url: modPath,
            nameId: "",
            displayName: await path.basename(modPath),
            required: false,
            enabled: true,
            fileVersion: "-",
            tags: [],
            usedVersion: "",
            versions: [],
            approval: "Sandbox",
            sourceType: ModSourceType.Local,
            downloadUrl: "",
            cachePath: modPath,
            downloadProgress: 100,
            fileSize: 0,
            lastUpdateDate: 0,
            onlineUpdateDate: 0,
            onlineAvailable: true,
            localNoFound: false
        };

        console.log(`[addModFromPath] Adding local mod: ${modPath}, groupId: ${groupId}`);

        if (!await exists(modPath)) {
            console.log(`[addModFromPath] File does not exist: ${modPath}`);
            message.warning(t("Mod Path No Exists" + modPath));
            return true;
        }

        const modsApi = await StorageAPI.getMods();
        const existingMod = await modsApi.getModByUrl(modPath);
        if (existingMod) {
            console.log(`[addModFromPath] Mod already exists: ${modPath}`);
            message.error(t("Mod Already Exists"));
            return false;
        }

        const fileInfo = await stat(modPath);
        modListItem.lastUpdateDate = fileInfo.mtime.getTime();

        console.log(`[addModFromPath] Created modListItem:`, modListItem);

        // FIX: Save mod to database just like addModFromUrl does
        const addedModItem = await this.addModToDatabaseAndProfile(modListItem, groupId);
        if (!addedModItem) {
            console.error(`[addModFromPath] Failed to add mod to database: ${modPath}`);
            message.error(t("Failed to add mod to database"));
            return false;
        }

        console.log(`[addModFromPath] Successfully added mod to database:`, addedModItem);

        // Add to in-memory structure for immediate UI update
        const treeViewModel = await TreeViewModel.getInstance();
        treeViewModel.ActiveProfile.addMod(addedModItem.id, groupId);

        TreeViewModel.updateTreeView();
        TreeViewModel.updateTreeViewCountLabel();

        return true;
    }

    public async removeMod(id: number): Promise<void> {
        const treeViewModel = await TreeViewModel.getInstance();
        treeViewModel.ActiveProfile.removeMod(id);

        TreeViewModel.updateTreeView();
        TreeViewModel.updateTreeViewCountLabel();
    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setDisplayName(id, name);

        TreeViewModel.updateTreeView();
    }

    public async setModEnabled(modId: number, enable: boolean): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            console.error("No active profile found");
            return;
        }
        await profiles.setModEnabled(activeProfile.id!, modId, enable);
    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            console.error("No active profile found");
            return;
        }

        // Update the used version in the profile_mods table
        await profiles.updateProfileMod(id, { usedVersion: version });
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        const treeViewModel = await TreeViewModel.getInstance();
        await treeViewModel.setGroupName(id, name);
    }

    public async getGroupName(id: number): Promise<string | undefined> {
        const treeViewModel = await TreeViewModel.getInstance();
        return treeViewModel.getGroupName(id);
    }

    /**
     * Create ModListItem from mod.io ModInfo
     */
    private createModListItemFromModInfo(modInfo: any): ModListItem | null {
        if (!modInfo) return null;

        const modItem: ModListItem = {
            id: MOD_INVALID_ID,
            modId: modInfo.id,
            url: modInfo.profile_url || "",
            nameId: modInfo.name_id || "",
            displayName: modInfo.name || "",
            required: false,
            enabled: true,
            fileVersion: modInfo.modfile?.version || modInfo.modfile?.filename || "-",
            usedVersion: modInfo.modfile?.version || modInfo.modfile?.filename || "-",
            tags: modInfo.tags ? modInfo.tags.map((tag: any) => tag.name) : [],
            versions: [],
            approval: "Sandbox",
            sourceType: ModSourceType.Modio,
            downloadUrl: modInfo.modfile?.download?.binary_url || "",
            cachePath: "",
            downloadProgress: 0,
            fileSize: modInfo.modfile?.filesize || 0,
            lastUpdateDate: Date.now(),
            onlineUpdateDate: Date.now(),
            onlineAvailable: true,
            localNoFound: false
        };

        // Process tags to extract versions, approval, and required status
        this.convertModVersion(modItem);
        this.convertModApprovalType(modItem);
        this.convertModRequired(modItem);

        return modItem;
    }

    /**
     * Extract version information from tags
     */
    private convertModVersion(modItem: ModListItem) {
        const tags = [];
        for (let tag of modItem.tags) {
            if (tag.startsWith("1.")) {
                modItem.versions.push(tag);
            } else {
                tags.push(tag);
            }
        }
        modItem.versions.reverse();
        modItem.tags = tags;
    }

    /**
     * Extract approval status from tags
     */
    private convertModApprovalType(modItem: ModListItem) {
        const tags = [];
        for (const tag of modItem.tags) {
            if (tag === "Verified" || tag === "Auto-Verified") {
                modItem.approval = "Verified";
            } else if (tag === "Approved") {
                modItem.approval = "Approved";
            } else if (tag === "Sandbox") {
                modItem.approval = "Sandbox";
            } else {
                tags.push(tag);
            }
        }
        modItem.tags = tags;
    }

    /**
     * Extract required status from tags
     */
    private convertModRequired(modItem: ModListItem) {
        const tags = [];
        for (let tag of modItem.tags) {
            if (tag === "RequiredByAll") {
                modItem.required = true;
            } else if (tag === "Optional") {
                modItem.required = false;
            } else {
                tags.push(tag);
            }
        }
        modItem.tags = tags;
    }

    /**
     * Helper function to convert ModListItem to ModData for database storage
     */
    private modItemToModData(modItem: ModListItem): any {
        // For local mods, generate a unique platformId based on file path
        // This ensures each local mod has a unique platformId to avoid UNIQUE constraint failures
        const platformId = modItem.sourceType === ModSourceType.Local
            ? this.generateLocalModId(modItem.url)  // Generate unique ID for local mods
            : modItem.modId;  // Use actual mod.io ID for Modio mods

        return {
            platformId: platformId,
            gameId: 1, // DRG game ID in our database (not mod.io's game ID)
            nameId: modItem.nameId,
            displayName: modItem.displayName,
            url: modItem.url,
            sourceType: modItem.sourceType,
            tags: modItem.tags || [],
            approvalStatus: modItem.approval || "Sandbox"
        };
    }

    /**
     * Generate a unique platform ID for local mods based on file path
     * Uses a simple hash of the file path to ensure consistency and uniqueness
     */
    private generateLocalModId(filePath: string): number {
        // Simple hash function to convert file path to a positive integer
        let hash = 0;
        for (let i = 0; i < filePath.length; i++) {
            const char = filePath.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        // Ensure the result is positive and within a safe range for local mods
        // Use a range that's unlikely to conflict with mod.io IDs (which are typically small positive numbers)
        return Math.abs(hash) + 1000000; // Offset by 1,000,000 to avoid mod.io ID range
    }

    /**
     * Helper function to add a mod to both database and in-memory structure
     */
    private async addModToDatabaseAndProfile(modItem: ModListItem, groupId: number): Promise<ModListItem | null> {
        const mods = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        // Convert to ModData for database storage
        const modData = this.modItemToModData(modItem);

        // Add mod to database
        const addedModData = await mods.addMod(modData);
        if (!addedModData) {
            return null;
        }

        // Get active profile
        const activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            console.error("No active profile found");
            return null;
        }

        // Add mod to profile database with proper parameters
        await profiles.addModToProfile({
            profileId: activeProfile.id!,
            modId: addedModData.modId!,
            parentFolderId: groupId,
            sortOrder: 0,
            isEnabled: true,
            usedVersion: modItem.usedVersion || ""
        });

        // Create ModListItem for UI operations with proper database ID
        const resultModItem: ModListItem = {
            ...modItem,
            id: addedModData.modId!,
            modId: addedModData.modId!
        };

        return resultModItem;
    }

    public async addGroup(parentGroupId: number, groupName: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.addGroup(groupName, parentGroupId);

        // Also update in-memory structure for immediate UI update
        const treeViewModel = await TreeViewModel.getInstance();
        treeViewModel.ActiveProfile.addGroup(groupName, parentGroupId);

        TreeViewModel.updateTreeView();
    }

    public async removeGroup(groupId: number): Promise<void> {
        console.log(`[HomeViewModel] removeGroup called with groupId=${groupId}`);

        if (groupId === ProfileTreeGroupType.MODIO || groupId === ProfileTreeGroupType.LOCAL) {
            console.log(`[HomeViewModel] Cannot remove default group (id=${groupId})`);
            message.error(t("Can't Remove Default Group"));
            return;
        }

        try {
            console.log(`[HomeViewModel] Starting to remove group from database, groupId=${groupId}`);
            const profiles = await StorageAPI.getProfiles();
            await profiles.removeGroup(groupId);
            console.log(`[HomeViewModel] Removed group from database, groupId=${groupId}`);

            // Also update in-memory structure for immediate UI update
            console.log(`[HomeViewModel] Removing group from memory structure, groupId=${groupId}`);
            const treeViewModel = await TreeViewModel.getInstance();
            treeViewModel.ActiveProfile.removeGroup(groupId);
            console.log(`[HomeViewModel] Removed group from memory structure, groupId=${groupId}`);

            console.log(`[HomeViewModel] Triggering UI update`);
            TreeViewModel.updateTreeView();
            TreeViewModel.updateTreeViewCountLabel();
            console.log(`[HomeViewModel] UI update triggered`);
        } catch (error) {
            console.error(`[HomeViewModel] Error removing group ${groupId}:`, error);
            throw error;
        }
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
