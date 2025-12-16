import {emit} from "@tauri-apps/api/event";
import {StorageAPI} from "@/storage";
import {ProfileTree, ProfileTreeItem, ProfileTreeType} from "@/storage/db/Schema.ts";
import {BaseViewModel} from "@/core/BaseViewModel";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";

/**
 * TreeViewModel manages profile tree UI state and interactions
 * Delegates data persistence and storage to ProfileViewModel
 * Handles tree structure UI updates and user interactions
 */
export class TreeViewModel extends BaseViewModel {

    private static instance: TreeViewModel;
    private profileViewModel?: ProfileViewModel;

    // Profile data access moved to ProfileViewModel

    // ActiveProfile setter removed; use ProfileViewModel.setActiveProfile instead

    public static updateTreeView() {
        console.log(`[TreeViewModel] updateTreeView() called - emitting event`);
        emit("home-page-update-tree-view").then(() => {
            console.log(`[TreeViewModel] home-page-update-tree-view event emitted`);
        }).catch((error) => {
            console.error(`[TreeViewModel] Failed to emit home-page-update-tree-view event:`, error);
        });
    }

    public static updateTreeViewCountLabel() {
        console.log(`[TreeViewModel] updateTreeViewCountLabel() called - emitting event`);
        emit("tree-view-count-label-update").then(() => {
            console.log(`[TreeViewModel] tree-view-count-label-update event emitted`);
        }).catch((error) => {
            console.error(`[TreeViewModel] Failed to emit tree-view-count-label-update event:`, error);
        });
    }

    private constructor() {
        super();
    }

    private async sortNode(modItem: ProfileTreeItem, order: string): Promise<ProfileTreeItem[]> {
        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();

        return modItem.children.sort((a, b) => {
            if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.ITEM) {
                const modAData = allMods.find(m => m.modId === a.id);
                const modBData = allMods.find(m => m.modId === b.id);

                // If mods not found, keep original order
                if (!modAData || !modBData) return 0;

                if (order === "asc") {
                    return modAData.displayName.localeCompare(modBData.displayName);
                } else if (order === "desc") {
                    return modAData.displayName.localeCompare(modBData.displayName) * -1;
                } else if (order === "time") {
                    const modAStatus = modAData.modId ? modsApi.getModStatus(modAData.modId) : null;
                    const modBStatus = modBData.modId ? modsApi.getModStatus(modBData.modId) : null;
                    // Simple time comparison - in real implementation, you'd get the actual status
                    return 0;
                }
            } else if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.FOLDER) {
                return -1;
            } else if (a.type === ProfileTreeType.FOLDER && b.type === ProfileTreeType.ITEM) {
                return 1;
            }
            return 0;
        })
    }

    public async sortMods(order: string): Promise<void> {
        const active = this.profileViewModel?.ActiveProfile;
        if (active?.ModioFolder) {
            active.ModioFolder.children = await this.sortNode(active.ModioFolder, order);
        }
        if (active?.LocalFolder) {
            active.LocalFolder.children = await this.sortNode(active.LocalFolder, order);
        }
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setGroupName(id, name);

        // Also update in-memory structure for immediate UI update
        this.profileViewModel?.ActiveProfile.setGroupName(id, name);

        TreeViewModel.updateTreeView();
    }

    public async getGroupName(id: number): Promise<string | undefined> {
        return this.profileViewModel?.ActiveProfile.getGroupName(id);
    }

    public async setProfileData(root: ProfileTreeItem): Promise<void> {
        console.log(`\n========== [TreeViewModel] setProfileData 开始 ==========`);
        console.log(`[TreeViewModel] 传入的 ProfileTreeItem:`, {
            childrenCount: root.children.length,
            children: root.children.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                childrenCount: c.children?.length || 0
            }))
        });

        try {
            if (!this.profileViewModel) {
                throw new Error("ProfileViewModel not initialized");
            }

            // Update in-memory structure first
            this.profileViewModel.updateProfileData(root);

            // Save to database
            console.log(`[TreeViewModel] 委托 ProfileViewModel 保存 profile tree 到数据库...`);
            await this.profileViewModel.saveProfileTreeToDatabase(root);
            console.log(`[TreeViewModel] ✅ Profile tree 成功保存到数据库`);

            console.log(`========== [TreeViewModel] setProfileData 完成 ==========\n`);
        } catch (error) {
            console.error('[TreeViewModel] ❌ setProfileData 失败:', error);
            console.log(`========== [TreeViewModel] setProfileData 失败 ==========\n`);
            throw error;
        }
    }

    /**
     * Initialize TreeViewModel
     * Loads profile data from database via ProfileViewModel
     * Delegates all data operations to ProfileViewModel
     *
     * @throws Error if initialization fails critically
     */
    protected async initialize(): Promise<void> {
        try {
            // Get ProfileViewModel instance and load data
            this.profileViewModel = await ProfileViewModel.getInstance();
            await this.profileViewModel.loadProfilesFromDatabase();

            // Update UI components
            TreeViewModel.updateTreeView();
            TreeViewModel.updateTreeViewCountLabel();

            // Notify frontend components that profile data is ready
            emit("home-page-update-profile-select").then();

            // Mark as initialized
            this.initialized = true;

        } catch (error) {
            console.error('TreeViewModel initialization failed:', error);

            // Attempt to recover with minimal setup
            try {
                TreeViewModel.updateTreeView();
                TreeViewModel.updateTreeViewCountLabel();

                // Mark as initialized even with error (graceful degradation)
                this.initialized = true;

            } catch (recoveryError) {
                console.error('Recovery failed:', recoveryError);
                throw recoveryError;
            }
        }
    }

    /**
     * Shared lock instance for thread-safe singleton initialization
     */
    private static lockInstance = new class extends BaseViewModel {}();

    /**
     * Get singleton instance of TreeViewModel
     * Thread-safe with initialization lock
     *
     * @returns TreeViewModel instance
     *
     * @example
     * ```typescript
     * const treeViewModel = await TreeViewModel.getInstance();
     * ```
     */
    public static async getInstance(): Promise<TreeViewModel> {
        const release = await this.lockInstance.acquireLock();
        try {
            if (!TreeViewModel.instance) {
                TreeViewModel.instance = new TreeViewModel();
                await TreeViewModel.instance.initialize();
            }
            return TreeViewModel.instance;
        } finally {
            release();
        }
    }

}
