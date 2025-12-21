import {message} from "antd";
import {t} from "i18next";
import {ProfileTreeItem} from "@/storage/db/Schema.ts";
import {TreeViewModel} from "@/pages/HomePage/TreeViewModel.ts";
import {HomeViewModel} from "@/pages/HomePage/HomeViewModel.ts";
import type {ProfileData} from "@/storage/dao/ProfileDAO.ts";
import { ProfileService } from "@/services/ProfileService";

/**
 * ProfileViewModel manages profile-level operations
 * Delegates business logic to ProfileService
 * Simplified version after refactoring
 */
export class ProfileViewModel {

    private static instance: ProfileViewModel;
    public profileService: ProfileService;

    private constructor() {
        this.profileService = new ProfileService();
    }

    public static async getInstance(): Promise<ProfileViewModel> {
        if (ProfileViewModel.instance) {
            return ProfileViewModel.instance;
        }
        ProfileViewModel.instance = new ProfileViewModel();
        return ProfileViewModel.instance;
    }

    // ====================================
    // DB-backed profile accessors
    // Delegated to ProfileService
    // ====================================

    public async getProfileList(): Promise<string[]> {
        return await this.profileService.getProfileList();
    }

    public async getActiveProfileName(): Promise<string> {
        return await this.profileService.getActiveProfileName();
    }

    public async getActiveProfileTreeRoot(): Promise<ProfileTreeItem> {
        return await this.profileService.getActiveProfileTreeRoot();
    }

    public async getActiveProfileData(): Promise<ProfileData> {
        return await this.profileService.getActiveProfileData();
    }

    public async setActiveProfile(profileName: string): Promise<void> {
        await this.profileService.setActiveProfile(profileName);
    }

    public async getActiveProfileLastUpdate(): Promise<number> {
        return await this.profileService.getActiveProfileLastUpdate();
    }

    public async setActiveProfileLastUpdate(timestamp: number): Promise<void> {
        await this.profileService.setActiveProfileLastUpdate(timestamp);
    }

    public async getActiveProfileEditTime(): Promise<number> {
        return await this.profileService.getActiveProfileEditTime();
    }

    public async setActiveProfileEditTime(timestamp: number): Promise<void> {
        await this.profileService.setActiveProfileEditTime(timestamp);
    }

    public async getActiveProfileInstallTime(): Promise<number> {
        return await this.profileService.getActiveProfileInstallTime();
    }

    public async setActiveProfileInstallTime(timestamp: number): Promise<void> {
        await this.profileService.setActiveProfileInstallTime(timestamp);
    }

    // ====================================
    // Profile CRUD Operations
    // Delegated to ProfileService
    // ====================================

    public async addProfile(name: string): Promise<void> {
        const profileList = await this.profileService.getProfileList();
        const isFirstProfile = profileList.length === 0;

        if (profileList.some(p => p === name)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        await this.profileService.createProfile({
            name,
            displayName: name,
            gameId: 1,
            userId: 1,
            isActive: isFirstProfile
        });

        HomeViewModel.updateProfileSelect();
        TreeViewModel.updateTreeView();
    }

    public async removeProfile(name: string): Promise<void> {
        const profileList = await this.profileService.getProfileList();

        if (profileList.length <= 1) {
            message.error(t("Profile must have at least one profile"));
            return;
        }

        const profileData = await this.profileService.getActiveProfileData();
        if (profileData.name === name) {
            await this.profileService.deleteProfile(profileData.id!);
        }

        HomeViewModel.updateProfileSelect();
        TreeViewModel.updateTreeView();
    }

    public async renameProfile(oldName: string, newName: string): Promise<void> {
        const profileList = await this.profileService.getProfileList();

        if (profileList.some(p => p === newName)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        const profileData = await this.profileService.getActiveProfileData();
        if (profileData.name === oldName) {
            await this.profileService.renameProfile(profileData.id!, newName);
        }

        HomeViewModel.updateProfileSelect();
    }

    // ====================================
    // Profile Tree Data Persistence
    // Delegated to ProfileTreeService
    // ====================================

    /**
     * Save ProfileTree to database
     */
    public async saveProfileTreeToDatabase(root: ProfileTreeItem): Promise<void> {
        console.log(`\n========== [ProfileViewModel] saveProfileTreeToDatabase 开始 ==========`);
        console.log(`[ProfileViewModel] 传入的 root 有 ${root.children.length} 个子项`);

        const profileData = await this.profileService.getActiveProfileData();
        const treeService = this.profileService.getTreeService();

        await treeService.saveProfileTree(root, profileData.id!);

        console.log(`[ProfileViewModel] ✅ Profile tree 成功保存到数据库`);
        console.log(`========== [ProfileViewModel] saveProfileTreeToDatabase 完成 ==========\n`);
    }

    /**
     * Load profiles from database
     */
    public async loadProfilesFromDatabase(): Promise<void> {
        await this.profileService.loadProfilesFromDatabase();
    }
}
