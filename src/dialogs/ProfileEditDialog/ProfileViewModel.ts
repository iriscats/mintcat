import {message} from "antd";
import {t} from "i18next";
import {ProfileTreeItem} from "@/storage/db/Schema.ts";
import type {ProfileData} from "@/storage/dao/ProfileDAO.ts";
import { ProfileService } from "@/services/ProfileService";
import { StorageAPI } from "@/storage";

/**
 * ProfileViewModel manages profile-level operations
 * Delegates business logic to ProfileService
 * Simplified version after refactoring
 */
export class ProfileViewModel {
    public profileService: ProfileService;

    constructor() {
        this.profileService = new ProfileService();
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

    }

    public async removeProfile(name: string): Promise<void> {
        const profileList = await this.profileService.getProfileList();

        if (profileList.length <= 1) {
            message.error(t("Profile must have at least one profile"));
            return;
        }

        const profiles = await StorageAPI.getProfiles();
        const allProfiles = await profiles.getAllProfiles();
        const targetProfile = allProfiles.find(p => p.name === name);

        if (!targetProfile || !targetProfile.id) {
            message.error(t("Profile not found"));
            return;
        }

        const activeProfile = await this.profileService.getActiveProfileData();
        const wasActive = activeProfile.name === name;

        await this.profileService.deleteProfile(targetProfile.id);

        if (wasActive) {
            const remainingProfiles = profileList.filter(p => p !== name);
            if (remainingProfiles.length > 0) {
                await this.profileService.setActiveProfile(remainingProfiles[0]);
            }
        }

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

    }

    public async copyProfile(sourceName: string, newName: string): Promise<void> {
        const profileList = await this.profileService.getProfileList();

        if (profileList.some(p => p === newName)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        const profiles = await StorageAPI.getProfiles();
        const allProfiles = await profiles.getAllProfiles();
        const sourceProfile = allProfiles.find(p => p.name === sourceName);

        if (!sourceProfile || !sourceProfile.id) {
            message.error(t("Source profile not found"));
            return;
        }

        const newProfile = await this.profileService.createProfile({
            name: newName,
            displayName: newName,
            gameId: sourceProfile.gameId,
            userId: sourceProfile.userId,
            isActive: false
        }, false);

        if (!newProfile || !newProfile.id) {
            message.error(t("Failed to create new profile"));
            return;
        }

        const treeService = this.profileService.getTreeService();
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
        const profileData = await this.profileService.getActiveProfileData();
        const treeService = this.profileService.getTreeService();
        await treeService.saveProfileTree(root, profileData.id!);
    }

    /**
     * Load profiles from database
     */
    public async loadProfilesFromDatabase(): Promise<void> {
        await this.profileService.loadProfilesFromDatabase();
    }
}
