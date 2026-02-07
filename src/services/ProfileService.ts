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
 *
 * Note: 此服务通过 IoC 作为单例管理，使用 await IoC.get(ProfileService) 获取实例
 */
export class ProfileService {
    private runtimeState = new Map<number, ProfileRuntimeState>();
    private treeService: ProfileTreeService;

    // 锁机制：防止并发调用 ensureActiveProfile 导致重复创建 profile
    private ensureProfileLock: Promise<ProfileData> | null = null;

    constructor() {
        this.treeService = new ProfileTreeService();
    }

    // ====================================
    // Profile 查询和状态管理
    // ====================================

    /**
     * 确保有活跃的 profile，如果没有则创建
     * Migrated from ProfileViewModel.ensureActiveProfile
     *
     * 使用锁机制防止并发调用导致重复创建 profile
     */
    public async ensureActiveProfile(profileDAO?: ProfileDAO): Promise<ProfileData> {
        // 如果已有进行中的操作，等待它完成并返回结果
        if (this.ensureProfileLock) {
            return this.ensureProfileLock;
        }

        // 创建新的锁并执行实际逻辑
        this.ensureProfileLock = this._doEnsureActiveProfile(profileDAO);
        try {
            return await this.ensureProfileLock;
        } finally {
            this.ensureProfileLock = null;
        }
    }

    /**
     * 实际执行 ensureActiveProfile 逻辑（内部方法）
     */
    private async _doEnsureActiveProfile(profileDAO?: ProfileDAO): Promise<ProfileData> {
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
        // 先确保有活跃的 profile（使用锁机制防止并发创建）
        await this.ensureActiveProfile();

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
     * 设置活跃的 profile（优化版本）
     * 使用 ProfileDAO.activateProfile 批量更新，只需 2 次 SQL 操作
     */
    public async setActiveProfile(profileName: string): Promise<void> {
        // 先确保有活跃的 profile（使用锁机制防止并发创建）
        await this.ensureActiveProfile();

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

        const targetProfile = profileData.find(p => p.name === profileName);
        if (!targetProfile) {
            console.warn(`[ProfileService] Unable to set active profile, not found: ${profileName}`);
            return;
        }

        // 使用优化的 activateProfile 方法：只需 2 次 SQL 操作
        // 1. 批量将同一 user/game 的所有 profile 设为非活跃
        // 2. 将目标 profile 设为活跃
        await profiles.activateProfile(targetProfile.id!);
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
     * 创建新 profile
     * @param data Profile 数据
     * @param createDefaultFolder 是否创建"默认分组"文件夹，默认 true。复制 profile 时应传 false
     */
    public async createProfile(data: Omit<ProfileData, 'id' | 'createdAt' | 'updatedAt'>, createDefaultFolder: boolean = true): Promise<ProfileData | null> {
        const profiles = await StorageAPI.getProfiles();
        const newProfile = await profiles.createProfile(data);

        // 为新 profile 创建"默认分组"文件夹
        if (newProfile?.id && createDefaultFolder) {
            await profiles.createFolder({
                profileId: newProfile.id,
                name: '默认分组',
                folderType: 'custom',
                sortOrder: 0,
                isExpanded: true,
            });
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

    /**
     * 生成持久化 settings key
     */
    private settingsKey(profileId: number, field: string): string {
        return `profile_${profileId}_${field}`;
    }

    /**
     * 从 settings 表读取持久化的时间戳（仅在 runtimeState 缺失时使用）
     */
    private async getPersistedTime(profileId: number, field: string): Promise<number> {
        try {
            const settings = await StorageAPI.getSettings();
            const value = await settings.getValue(this.settingsKey(profileId, field));
            return value ? parseInt(value, 10) || 0 : 0;
        } catch {
            return 0;
        }
    }

    /**
     * 将时间戳持久化到 settings 表
     */
    private async persistTime(profileId: number, field: string, timestamp: number): Promise<void> {
        try {
            const settings = await StorageAPI.getSettings();
            await settings.setValue(this.settingsKey(profileId, field), String(timestamp));
        } catch (e) {
            console.error(`[ProfileService] Failed to persist ${field} for profile ${profileId}:`, e);
        }
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
        if (state?.editTime !== undefined) {
            return state.editTime;
        }
        // 内存中未初始化，从数据库恢复（应用重启后的首次读取）
        const persisted = await this.getPersistedTime(activeProfile.id!, 'editTime');
        this.updateRuntimeState(activeProfile.id!, { editTime: persisted });
        return persisted;
    }

    public async setActiveProfileEditTime(timestamp: number): Promise<void> {
        const activeProfile = await this.ensureActiveProfile();
        this.updateRuntimeState(activeProfile.id!, { editTime: timestamp });
        // 同步持久化到数据库，确保重启后可恢复
        await this.persistTime(activeProfile.id!, 'editTime', timestamp);
    }

    public async getActiveProfileInstallTime(): Promise<number> {
        const activeProfile = await this.ensureActiveProfile();
        const state = this.runtimeState.get(activeProfile.id!);
        if (state?.installTime !== undefined) {
            return state.installTime;
        }
        // 内存中未初始化，从数据库恢复（应用重启后的首次读取）
        const persisted = await this.getPersistedTime(activeProfile.id!, 'installTime');
        this.updateRuntimeState(activeProfile.id!, { installTime: persisted });
        return persisted;
    }

    public async setActiveProfileInstallTime(timestamp: number): Promise<void> {
        const activeProfile = await this.ensureActiveProfile();
        this.updateRuntimeState(activeProfile.id!, { installTime: timestamp });
        // 同步持久化到数据库，确保重启后可恢复
        await this.persistTime(activeProfile.id!, 'installTime', timestamp);
    }

    // ====================================
    // Private 辅助方法
    // ====================================

    /**
     * 创建默认 profile
     */
    private async createDefaultProfile(profileDAO: ProfileDAO, gameId: number, userId: number): Promise<ProfileData | null> {
        const newProfile = await profileDAO.createProfile({
            name: "default",
            displayName: "default",
            gameId: gameId,
            userId: userId,
            isActive: true
        });

        // 为默认 profile 创建"默认分组"文件夹
        if (newProfile?.id) {
            await profileDAO.createFolder({
                profileId: newProfile.id,
                name: '默认分组',
                folderType: 'custom',
                sortOrder: 0,
                isExpanded: true,
            });
        }

        return newProfile;
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
