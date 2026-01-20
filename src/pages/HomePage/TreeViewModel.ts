import {emitVoidEvent} from "@/events";
import {StorageAPI} from "@/storage";
import {BaseViewModel} from "@/core/BaseViewModel";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import { IoC } from "@/core/IoC.ts";

/**
 * TreeViewModel manages profile tree UI state and interactions
 * Delegates data persistence and operations to ProfileViewModel and Services
 * Simplified version after refactoring
 */
export class TreeViewModel extends BaseViewModel {

    private static instance: TreeViewModel;
    private profileViewModel: ProfileViewModel;


    public static updateTreeView() {
        emitVoidEvent("home-page-update-tree-view");
    }

    public static updateTreeViewCountLabel() {
        emitVoidEvent("tree-view-count-label-update");
    }

    private constructor() {
        super();
    }

    /**
     * 排序 mods
     * Delegated to ProfileTreeService
     */
    public async sortMods(order: string): Promise<void> {
        if (!this.profileViewModel) 
            return;

        const activeRoot = await this.profileViewModel.getActiveProfileTreeRoot();
        const treeService = this.profileViewModel.profileService.getTreeService();

        await treeService.sortTreeNodes(activeRoot, order);
        await this.profileViewModel.saveProfileTreeToDatabase(activeRoot);

        TreeViewModel.updateTreeView();
    }

    /**
     * 设置文件夹名称
     * Delegated to ProfileDAO
     */
    public async setGroupName(id: number, name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.updateFolder(id, { name });

        TreeViewModel.updateTreeView();
    }

    /**
     * 获取文件夹名称
     * Delegated to ProfileTreeService
     */
    public async getGroupName(id: number): Promise<string | undefined> {
        if (!this.profileViewModel) return undefined;

        const activeRoot = await this.profileViewModel.getActiveProfileTreeRoot();
        const treeService = (this.profileViewModel as any).profileService.getTreeService();

        return treeService.getGroupName(activeRoot, id);
    }

    /**
     * 设置 profile 数据
     * Delegated to ProfileViewModel
     */
    public async setProfileData(root: any): Promise<void> {
        try {
            if (!this.profileViewModel) {
                throw new Error("ProfileViewModel not initialized");
            }

            // Save to database
            await this.profileViewModel.saveProfileTreeToDatabase(root);
        } catch (error) {
            console.error('[TreeViewModel] ❌ setProfileData 失败:', error);
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
            this.profileViewModel = await IoC.get(ProfileViewModel);
            await this.profileViewModel.loadProfilesFromDatabase();

            // Update UI components
            TreeViewModel.updateTreeView();
            TreeViewModel.updateTreeViewCountLabel();

            // Notify frontend components that profile data is ready
            emitVoidEvent("home-page-update-profile-select").then();

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
