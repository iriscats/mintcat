import {message} from "antd";
import {t} from "i18next";
import {ProfileTreeItem} from "@/storage/db/Schema.ts";
import type {ProfileData} from "@/storage/dao/ProfileDAO.ts";
import { ProfileService } from "@/services/ProfileService";
import { IoC } from "@/core/IoC";

/**
 * ProfileViewModel manages profile-level operations
 * Delegates business logic to ProfileService
 * Simplified version after refactoring
 *
 * Note: ProfileService 通过 IoC 单例管理，使用懒加载获取
 */
export class ProfileViewModel {
    private _profileService: ProfileService | null = null;

    constructor() {
    }

    /**
     * 获取 ProfileService 单例（懒加载）
     */
    public async getProfileService(): Promise<ProfileService> {
        if (!this._profileService) {
            this._profileService = await IoC.get(ProfileService);
        }
        return this._profileService;
    }

    /**
     * 兼容旧代码的 profileService getter
     * @deprecated 请使用 getProfileService() 异步方法
     */
    public get profileService(): ProfileService {
        if (!this._profileService) {
            throw new Error("ProfileService not initialized. Use getProfileService() instead.");
        }
        return this._profileService;
    }

    // ====================================
    // DB-backed profile accessors
    // Delegated to ProfileService
    // ====================================

    public async getProfileList(): Promise<string[]> {
        const profileService = await this.getProfileService();
        return await profileService.getProfileList();
    }

    public async getActiveProfileName(): Promise<string> {
        const profileService = await this.getProfileService();
        return await profileService.getActiveProfileName();
    }

    public async getActiveProfileTreeRoot(): Promise<ProfileTreeItem> {
        const profileService = await this.getProfileService();
        return await profileService.getActiveProfileTreeRoot();
    }

    public async getActiveProfileData(): Promise<ProfileData> {
        const profileService = await this.getProfileService();
        return await profileService.getActiveProfileData();
    }

    public async setActiveProfile(profileName: string): Promise<void> {
        const profileService = await this.getProfileService();
        await profileService.setActiveProfile(profileName);
    }

    public async getActiveProfileLastUpdate(): Promise<number> {
        const profileService = await this.getProfileService();
        return await profileService.getActiveProfileLastUpdate();
    }

    public async setActiveProfileLastUpdate(timestamp: number): Promise<void> {
        const profileService = await this.getProfileService();
        await profileService.setActiveProfileLastUpdate(timestamp);
    }

    public async getActiveProfileInstallHash(): Promise<string> {
        const profileService = await this.getProfileService();
        return await profileService.getActiveProfileInstallHash();
    }

    public async setActiveProfileInstallHash(hash: string): Promise<void> {
        const profileService = await this.getProfileService();
        await profileService.setActiveProfileInstallHash(hash);
    }

    public async getActiveGameInstalledHash(): Promise<string> {
        const profileService = await this.getProfileService();
        return await profileService.getActiveGameInstalledHash();
    }

    public async setActiveGameInstalledHash(hash: string): Promise<void> {
        const profileService = await this.getProfileService();
        await profileService.setActiveGameInstalledHash(hash);
    }

    // ====================================
    // Profile CRUD Operations
    // Delegated to ProfileService
    // ====================================

    public async addProfile(name: string): Promise<void> {
        const profileService = await this.getProfileService();
        const profileList = await profileService.getProfileList();
        const isFirstProfile = profileList.length === 0;
        const activeProfile = await profileService.getActiveProfileData();

        if (profileList.some(p => p === name)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        await profileService.createProfile({
            name,
            displayName: name,
            gameId: activeProfile.gameId,
            userId: activeProfile.userId,
            isActive: isFirstProfile
        });

    }

    public async removeProfile(name: string): Promise<void> {
        const profileService = await this.getProfileService();
        const profileList = await profileService.getProfileList();

        if (profileList.length <= 1) {
            message.error(t("profile.mustKeepAtLeastOne"));
            return;
        }

        const targetProfile = await profileService.getProfileByName(name);

        if (!targetProfile || !targetProfile.id) {
            message.error(t("Profile not found"));
            return;
        }

        const activeProfile = await profileService.getActiveProfileData();
        const wasActive = activeProfile.name === name;

        await profileService.deleteProfile(targetProfile.id);

        if (wasActive) {
            const remainingProfiles = profileList.filter(p => p !== name);
            if (remainingProfiles.length > 0) {
                await profileService.setActiveProfile(remainingProfiles[0]);
            }
        }

    }

    public async renameProfile(oldName: string, newName: string): Promise<void> {
        const profileService = await this.getProfileService();
        const profileList = await profileService.getProfileList();

        if (profileList.some(p => p === newName)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        const profileData = await profileService.getActiveProfileData();
        if (profileData.name === oldName) {
            await profileService.renameProfile(profileData.id!, newName);
        }

    }

    public async copyProfile(sourceName: string, newName: string): Promise<void> {
        const profileService = await this.getProfileService();
        const profileList = await profileService.getProfileList();

        if (profileList.some(p => p === newName)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        const sourceProfile = await profileService.getProfileByName(sourceName);

        if (!sourceProfile || !sourceProfile.id) {
            message.error(t("Source profile not found"));
            return;
        }

        const newProfile = await profileService.createProfile({
            name: newName,
            displayName: newName,
            gameId: sourceProfile.gameId,
            userId: sourceProfile.userId,
            isActive: false
        }, false);

        if (!newProfile || !newProfile.id) {
            message.error(t("error.createProfile"));
            return;
        }

        const treeService = profileService.getTreeService();
        await treeService.duplicateProfileTree(sourceProfile.id, newProfile.id);

    }

    // ====================================
    // Profile Tree Data Persistence
    // Delegated to ProfileTreeService
    // ====================================

    /**
     * Save ProfileTree to database
     */
    public async saveProfileTreeToDatabase(root: ProfileTreeItem): Promise<void> {
        const profileService = await this.getProfileService();
        const profileData = await profileService.getActiveProfileData();
        const treeService = profileService.getTreeService();
        await treeService.saveProfileTree(root, profileData.id!);
    }

    /**
     * Load profiles from database
     */
    public async loadProfilesFromDatabase(): Promise<void> {
        const profileService = await this.getProfileService();
        await profileService.loadProfilesFromDatabase();
    }
}
