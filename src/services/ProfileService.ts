import { StorageAPI } from '@/storage';
import type { ProfileDAO, ProfileData } from '@/storage/dao/ProfileDAO';
import { ProfileTreeService } from './ProfileTreeService';
import { ProfileTreeItem } from '@/models/profile/ProfileTreeItem';

type ProfileRuntimeState = {
    lastUpdate?: number;
    editTime?: number;
    installTime?: number;
};

/**
 * ProfileService
 * 负责 Profile 的业务逻辑（不涉及树结构细节）
 * 处理 Profile CRUD 和状态管理
 */
export class ProfileService {
    private runtimeState = new Map<number, ProfileRuntimeState>();
    private treeService: ProfileTreeService;

    constructor() {
        this.treeService = new ProfileTreeService();
    }

    // ====================================
    // Profile 查询和状态管理
    // ====================================

    /**
     * 确保有活跃的 profile，如果没有则创建
     * Migrated from ProfileViewModel.ensureActiveProfile
     */
    public async ensureActiveProfile(profileDAO?: ProfileDAO): Promise<ProfileData> {
        const dao = profileDAO ?? await StorageAPI.getProfiles();
        const games = await StorageAPI.getGames();
        const users = await StorageAPI.getUsers();

        const activeGame = await games.getActiveGame();
        const activeUser = await users.getActiveUser();

        if (!activeGame || !activeUser) {
            throw new Error("[ProfileService] No active game or user");
        }

        // 只获取当前游戏和用户的 profile
        let profileList = await dao.getProfilesByUserAndGame(activeUser.id!, activeGame.id!);

        if (profileList.length === 0) {
            const created = await this.createDefaultProfile(dao, activeGame.id!, activeUser.id!);
            if (created) {
                profileList = [created];
            }
        }

        let activeProfile = profileList.find(p => p.isActive);
        if (!activeProfile && profileList.length > 0) {
            const first = profileList[0];
            await dao.updateProfile(first.id!, { isActive: true });
            activeProfile = { ...first, isActive: true };
        }

        if (!activeProfile) {
            throw new Error("[ProfileService] No profile available");
        }

        return activeProfile;
    }

    /**
     * 获取当前活跃游戏的所有 profile 的名称列表
     */
    public async getProfileList(): Promise<string[]> {
        const profiles = await StorageAPI.getProfiles();
        const games = await StorageAPI.getGames();
        const users = await StorageAPI.getUsers();

        const activeGame = await games.getActiveGame();
        const activeUser = await users.getActiveUser();

        if (!activeGame || !activeUser) {
            return [];
        }

        // 只获取当前游戏和用户的 profile
        const profileData = await profiles.getProfilesByUserAndGame(activeUser.id!, activeGame.id!);

        if (profileData.length === 0) {
            const created = await this.createDefaultProfile(profiles, activeGame.id!, activeUser.id!);
            return created ? [created.name] : [];
        }

        return profileData.map(p => p.name);
    }

    /**
     * 获取活跃 profile 的名称
     */
    public async getActiveProfileName(): Promise<string> {
        const activeProfile = await this.ensureActiveProfile();
        return activeProfile.name;
    }

    /**
     * 获取活跃 profile 的数据
     */
    public async getActiveProfileData(): Promise<ProfileData> {
        return this.ensureActiveProfile();
    }

    /**
     * 获取活跃 profile 的树结构根节点
     */
    public async getActiveProfileTreeRoot(): Promise<ProfileTreeItem> {
        const activeProfile = await this.ensureActiveProfile();
        return await this.treeService.loadProfileTreeRoot(activeProfile);
    }

    /**
     * 设置活跃的 profile
     */
    public async setActiveProfile(profileName: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const games = await StorageAPI.getGames();
        const users = await StorageAPI.getUsers();

        const activeGame = await games.getActiveGame();
        const activeUser = await users.getActiveUser();

        if (!activeGame || !activeUser) {
            console.warn(`[ProfileService] No active game or user`);
            return;
        }

        // 只获取当前游戏和用户的 profile
        const profileData = await profiles.getProfilesByUserAndGame(activeUser.id!, activeGame.id!);

        if (profileData.length === 0) {
            await this.createDefaultProfile(profiles, activeGame.id!, activeUser.id!);
            return;
        }

        const targetProfile = profileData.find(p => p.name === profileName);
        if (!targetProfile) {
            console.warn(`[ProfileService] Unable to set active profile, not found: ${profileName}`);
            return;
        }

        for (const profile of profileData) {
            const isTarget = profile.id === targetProfile.id;
            if (profile.isActive !== isTarget) {
                await profiles.updateProfile(profile.id!, { isActive: isTarget });
            }
        }
    }

    /**
     * 获取当前活跃 profile 指定类型的文件夹 ID
     * @param folderType 文件夹类型 ('modio' | 'local')
     * @returns 文件夹 ID，如果未找到返回 null
     */
    public async getActiveProfileFolderId(folderType: 'modio' | 'local'): Promise<number | null> {
        const profiles = await StorageAPI.getProfiles();
        const activeProfile = await this.ensureActiveProfile(profiles);

        if (!activeProfile?.id) {
            console.warn(`[ProfileService] No active profile found`);
            return null;
        }

        const folderId = await profiles.getProfileFolderIdByType(activeProfile.id, folderType);
        if (folderId) {
            return folderId;
        }

        await this.treeService.createDefaultFolders(activeProfile.id);
        return await profiles.getProfileFolderIdByType(activeProfile.id, folderType);
    }

    /**
     * 获取活跃 profile 中所有 mod.io 类型的 mod URL 列表
     * @returns mod.io mod 的 URL 数组
     */
    public async getActiveProfileModioUrls(): Promise<string[]> {
        const profilesApi = await StorageAPI.getProfiles();
        const activeProfile = await profilesApi.getActiveProfile();

        if (!activeProfile?.id) {
            return [];
        }

        return await this.getProfileModioUrls(activeProfile.id);
    }

    /**
     * 获取指定 profile 中所有 mod.io 类型的 mod URL 列表
     * @param profileId Profile ID
     * @returns mod.io mod 的 URL 数组
     */
    public async getProfileModioUrls(profileId: number): Promise<string[]> {
        const profilesApi = await StorageAPI.getProfiles();
        const modsApi = await StorageAPI.getMods();

        // Get all mod associations for this profile
        const profileMods = await profilesApi.getProfileMods(profileId);

        if (profileMods.length === 0) {
            return [];
        }

        // Get mod IDs and fetch mod information
        const modIds = profileMods.map(pm => pm.modId);
        const modDataList = await modsApi.getBatchCompleteModData(modIds);

        // Filter and collect URLs
        const urls: string[] = [];
        for (const mod of modDataList) {
            if (mod.sourceType === 'Modio' && mod.url) {
                urls.push(mod.url);
            }
        }

        return urls;
    }

    // ====================================
    // Profile CRUD 操作
    // ====================================

    /**
     * 创建新 profile（包含默认文件夹）
     */
    public async createProfile(data: Omit<ProfileData, 'id' | 'createdAt' | 'updatedAt'>, createDefaultFolders: boolean = true): Promise<ProfileData | null> {
        const profiles = await StorageAPI.getProfiles();

        // Create profile
        const newProfile = await profiles.createProfile(data);

        // Create default folders
        if (newProfile?.id && createDefaultFolders) {
            await this.treeService.createDefaultFolders(newProfile.id);
        }

        return newProfile;
    }

    public async getAllProfiles(): Promise<ProfileData[]> {
        const profiles = await StorageAPI.getProfiles();
        return await profiles.getAllProfiles();
    }

    public async getProfileByName(name: string): Promise<ProfileData | undefined> {
        const profiles = await this.getAllProfiles();
        return profiles.find(profile => profile.name === name);
    }

    /**
     * 删除 profile
     */
    public async deleteProfile(profileId: number): Promise<boolean> {
        const profiles = await StorageAPI.getProfiles();
        return await profiles.deleteProfile(profileId);
    }

    /**
     * 重命名 profile
     */
    public async renameProfile(profileId: number, newName: string): Promise<boolean> {
        const profiles = await StorageAPI.getProfiles();
        return await profiles.updateProfile(profileId, { name: newName });
    }

    public async updateFolderName(id: number, name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.updateFolder(id, { name });
    }

    // ====================================
    // Runtime State 管理
    // ====================================

    /**
     * 更新运行时状态
     */
    private updateRuntimeState(profileId: number, patch: Partial<ProfileRuntimeState>): void {
        const current = this.runtimeState.get(profileId) || {};
        this.runtimeState.set(profileId, { ...current, ...patch });
    }

    public async getActiveProfileLastUpdate(): Promise<number> {
        const activeProfile = await this.ensureActiveProfile();
        const state = this.runtimeState.get(activeProfile.id!);
        return state?.lastUpdate ?? 0;
    }

    public async setActiveProfileLastUpdate(timestamp: number): Promise<void> {
        const activeProfile = await this.ensureActiveProfile();
        this.updateRuntimeState(activeProfile.id!, { lastUpdate: timestamp });
    }

    public async getActiveProfileEditTime(): Promise<number> {
        const activeProfile = await this.ensureActiveProfile();
        const state = this.runtimeState.get(activeProfile.id!);
        return state?.editTime ?? 0;
    }

    public async setActiveProfileEditTime(timestamp: number): Promise<void> {
        const activeProfile = await this.ensureActiveProfile();
        this.updateRuntimeState(activeProfile.id!, { editTime: timestamp });
    }

    public async getActiveProfileInstallTime(): Promise<number> {
        const activeProfile = await this.ensureActiveProfile();
        const state = this.runtimeState.get(activeProfile.id!);
        return state?.installTime ?? 0;
    }

    public async setActiveProfileInstallTime(timestamp: number): Promise<void> {
        const activeProfile = await this.ensureActiveProfile();
        this.updateRuntimeState(activeProfile.id!, { installTime: timestamp });
    }

    // ====================================
    // Private 辅助方法
    // ====================================

    /**
     * 创建默认 profile
     */
    private async createDefaultProfile(profileDAO: ProfileDAO, gameId: number, userId: number): Promise<ProfileData | null> {
        const defaultProfile = await profileDAO.createProfile({
            name: "default",
            displayName: "default",
            gameId: gameId,
            userId: userId,
            isActive: true
        });

        if (defaultProfile?.id) {
            await this.treeService.createDefaultFolders(defaultProfile.id);
        }

        return defaultProfile;
    }

    /**
     * 加载 profiles 从数据库
     */
    public async loadProfilesFromDatabase(): Promise<void> {
        try {
            const profiles = await StorageAPI.getProfiles();
            await this.ensureActiveProfile(profiles);
        } catch (error) {
            console.error('[ProfileService] Failed to load profiles from database:', error);
        }
    }

    /**
     * 获取 ProfileTreeService 实例（供 ViewModel 使用）
     */
    public getTreeService(): ProfileTreeService {
        return this.treeService;
    }
}
