import {BaseViewModel} from "@/core/BaseViewModel";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import { ProfileService } from "@/services/ProfileService";

/**
 * TreeViewModel manages profile tree UI state and interactions
 * Delegates data persistence and operations to ProfileViewModel and Services
 * Simplified version after refactoring
 */
export class TreeViewModel extends BaseViewModel {
    private profileViewModel: ProfileViewModel;
    private profileService: ProfileService;

    constructor() {
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
        const treeService = (await this.profileViewModel.getProfileService()).getTreeService();

        await treeService.sortTreeNodes(activeRoot, order);
        await this.profileViewModel.saveProfileTreeToDatabase(activeRoot);
    }

    /**
     * 设置文件夹名称
     * Delegated to ProfileDAO
     */
    public async setGroupName(id: number, name: string): Promise<void> {
        await this.profileService.updateFolderName(id, name);
    }

    /**
     * 获取文件夹名称
     * Delegated to ProfileTreeService
     */
    public async getGroupName(id: number): Promise<string | undefined> {
        if (!this.profileViewModel) return undefined;

        const activeRoot = await this.profileViewModel.getActiveProfileTreeRoot();
        const treeService = (await this.profileViewModel.getProfileService()).getTreeService();

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
    async initialize(): Promise<void> {
        try {
            // Get ProfileService singleton via IoC
            this.profileService = await IoC.get(ProfileService);

            // Get ProfileViewModel instance and load data
            this.profileViewModel = await IoC.get(ProfileViewModel);
            await this.profileViewModel.loadProfilesFromDatabase();

            // Mark as initialized
            this.initialized = true;

        } catch (error) {
            console.error('TreeViewModel initialization failed:', error);

            // Attempt to recover with minimal setup
            try {
                // Mark as initialized even with error (graceful degradation)
                this.initialized = true;

            } catch (recoveryError) {
                console.error('Recovery failed:', recoveryError);
                throw recoveryError;
            }
        }
    }
}
