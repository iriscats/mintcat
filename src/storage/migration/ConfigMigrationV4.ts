import {GameDAO} from '@/storage/dao/GameDAO';
import {ModDAO} from '@/storage/dao/ModDAO';
import {ProfileDAO} from '@/storage/dao/ProfileDAO';
import {UserDAO} from '@/storage/dao/UserDAO';
import {OAuthDAO} from '@/storage/dao/OAuthDAO';
import {SettingDAO} from '@/storage/dao/SettingDAO';
import {MigrationUtils} from './MigrationUtils';
import {ConfigDataType} from '@/storage/DataType';
import {exists, readTextFile, stat} from '@tauri-apps/plugin-fs';
import {path} from '@tauri-apps/api';
import {configDir} from '@tauri-apps/api/path';

/**
 * v0.2.0 配置迁移类
 * 将v0.2.0 JSON配置迁移到SQLite数据库
 * v0.2.0使用与v0.5.0相同的目录结构，但使用JSON文件存储
 */
export class ConfigMigrationV4 {

    private version = '0.2.0';
    private gameId: number = 0;
    private userId: number = 0;

    // DAO实例
    private modDAO = new ModDAO();
    private profileDAO = new ProfileDAO();
    private settingDAO = new SettingDAO();
    private oauthDAO = new OAuthDAO();
    private gameDAO = new GameDAO();
    private userDAO = new UserDAO();

    /**
     * 检查是否存在v0.2.0配置
     */
    public async checkConfig(): Promise<ConfigDataType> {
        try {
            const configPath = await path.join(await configDir(), 'com.mint.cat');

            if (await exists(configPath)) {

                const dirInfo = await stat(configPath);

                // 检查必要的配置文件是否存在 - 修正为实际文件名
                const settingsFile = await path.join(configPath, 'settings.json');
                const modListFile = await path.join(configPath, 'mods.json');
                const profileFile = await path.join(configPath, 'profile.json');

                const hasSettings = await exists(settingsFile);
                const hasModList = await exists(modListFile);
                const hasProfile = await exists(profileFile);

                if (hasSettings || hasModList || hasProfile) {
                    return {
                        version: '0.4.0',
                        saveTime: new Date(dirInfo.mtime).toISOString(),
                        path: configPath
                    };
                }
            }

            return undefined;
        } catch (error) {
            console.error('检查 v0.2.0 配置失败:', error);
            return undefined;
        }
    }

    /**
     * 执行配置迁移
     */
    public async migrate(): Promise<boolean> {
        try {
            console.log(`开始迁移v${this.version}配置...`);

            // 创建默认游戏和用户
            const existingGame = await this.gameDAO.getGameByName('drg');
            if (existingGame) {
                this.gameId = existingGame.id!;
            } else {
                const game = await this.gameDAO.createGame({
                    name: 'drg',
                    displayName: 'Deep Rock Galactic',
                    installPath: '',
                    isActive: true
                });
                this.gameId = game!.id!;
            }

            const users = await this.userDAO.getAllUsers();
            if (users.length > 0) {
                this.userId = users[0].id!;
            } else {
                const user = await this.userDAO.createUser({
                    username: 'default_user',
                    email: '',
                    avatarUrl: ''
                });
                this.userId = user!.id!;
            }

            // 迁移设置
            await this.migrateSettings();

            // 迁移模组列表
            await this.migrateModList();

            // 迁移配置文件
            await this.migrateProfiles();

            console.log(`v${this.version}配置迁移完成`);
            return true;
        } catch (error) {
            console.error(`迁移v${this.version}配置失败:`, error);
            return false;
        }
    }

    /**
     * 迁移设置数据
     */
    private async migrateSettings(): Promise<void> {
        try {
            const settingsPath = await path.join(await configDir(), 'com.mint.cat', 'settings.json');
            if (await exists(settingsPath)) {
                const settingsContent = await readTextFile(settingsPath);
                const settings = MigrationUtils.safeParseJson(settingsContent, {});

                // 逐个设置配置项
                if (settings.guiTheme !== undefined)
                    await this.settingDAO.setValue('guiTheme', settings.guiTheme);
                if (settings.language !== undefined)
                    await this.settingDAO.setValue('language', settings.language);
                if (settings.cachePath !== undefined)
                    await this.settingDAO.setValue('cachePath', settings.cachePath);
                if (settings.configPath !== undefined)
                    await this.settingDAO.setValue('configPath', settings.configPath);
                if (settings.ue4ss !== undefined)
                    await this.settingDAO.setValue('ue4ssVersion', settings.ue4ss);

                // 迁移OAuth信息
                if (settings.modio_oauth) {
                    await this.oauthDAO.createOAuth({
                        uid: this.userId,
                        oauth: settings.modio_oauth,
                        platform: 'mod.io'
                    });
                }

                // 迁移 DRG 安装路径
                if(settings.drg_pak_path){
                    await this.gameDAO.updateGame(this.gameId, {
                        installPath: settings.drg_pak_path
                    });
                }

            }
        } catch (error) {
            console.error('迁移设置数据失败:', error);
        }
    }

    /**
     * 迁移模组列表
     */
    private async migrateModList(): Promise<void> {
        try {
            const modListPath = await path.join(await configDir(), 'com.mint.cat', 'mods.json');

            if (await exists(modListPath)) {
                const modListContent = await readTextFile(modListPath);
                const oldModList = MigrationUtils.safeParseJson(modListContent, {mods: []});

                const mods = oldModList.mods || [];
                for (const oldMod of mods) {
                    await this.migrateSingleMod(oldMod);
                }
            }
        } catch (error) {
            console.error('迁移模组列表失败:', error);
        }
    }

    /**
     * 迁移单个模组
     */
    private async migrateSingleMod(oldMod: any): Promise<void> {
        try {
            // 提取模组数据 - 修正字段映射
            const platformId = oldMod.mod_id || oldMod.id || 0;
            const nameId = oldMod.name_id || `mod_${platformId}`;
            const displayName = oldMod.display_name || nameId;
            const url = oldMod.url || '';
            const sourceType = oldMod.source_type || (url.startsWith('http') ? 'Modio' : 'Local');
            const tags = oldMod.tags || [];
            const approvalStatus = oldMod.approval || 'Sandbox';

            // 检查模组是否已存在 - 通过URL和platform ID双重检查
            const existingMod = await this.modDAO.getModByPlatformId(platformId);
            if (existingMod) {
                console.log(`模组 ${displayName} (ID: ${platformId}) 已存在，跳过迁移`);
                return; // 跳过已存在的模组
            }

            // 检查URL重复
            const existingModByUrl = await this.modDAO.getModByUrl(url);
            if (existingModByUrl) {
                console.log(`模组 ${displayName} URL已存在，跳过迁移`);
                return; // 跳过URL重复的模组
            }

            // 创建模组
            const mod = await this.modDAO.createMod({
                platformId,
                gameId: this.gameId,
                nameId,
                displayName,
                url,
                sourceType,
                tags,
                approvalStatus,
                dependModId: 0  // TODO: 处理依赖关系，这里存在一个坑，配置中没有依赖关系
            });

            if (!mod) {
                console.error(`创建模组失败: ${displayName}`);
                return;
            }

            const modId = mod.modId!;

            // 设置版本信息 - 修正字段名
            await this.modDAO.upsertModVersion({
                modId,
                currentVersion: oldMod.file_version || oldMod.used_version || '-',
                availableVersions: oldMod.versions || []
            });

            // 设置下载信息 - 修正字段名
            await this.modDAO.upsertModDownload({
                modId,
                downloadUrl: oldMod.download_url || '',
                cachePath: oldMod.cache_path || '',
                fileSize: oldMod.file_size || 0,
                downloadProgress: oldMod.download_progress || 100,
                downloadStatus: 'completed'
            });

            // 设置状态信息 - 修正字段名
            await this.modDAO.upsertModStatus({
                modId,
                lastUpdateDate: oldMod.last_update_date || 0,
                onlineUpdateDate: oldMod.online_update_date || 0,
                isOnlineAvailable: oldMod.online_available !== false,
                isLocalNotFound: oldMod.local_no_found || false
            });

        } catch (error) {
            console.error('迁移单个模组失败:', {
                modData: oldMod,
                error: error.message || error
            });
        }
    }

    /**
     * 迁移配置文件
     */
    private async migrateProfiles(): Promise<void> {
        try {
            // 迁移配置文件列表
            await this.migrateProfileList();

            // 迁移配置文件详细信息
            await this.migrateProfileDetails();
        } catch (error) {
            console.error('迁移配置文件失败:', error);
        }
    }

    /**
     * 迁移配置文件列表
     */
    private async migrateProfileList(): Promise<void> {
        try {
            const profileListPath = await path.join(await configDir(), 'com.mint.cat', 'profile.json');
            if (await exists(profileListPath)) {
                const profileListContent = await readTextFile(profileListPath);
                const oldProfileList = MigrationUtils.safeParseJson(profileListContent, {
                    profiles: [],
                    active_profile: 'default'
                });

                const profiles = oldProfileList.profiles || [];
                const activeProfile = oldProfileList.active_profile || 'default';

                for (const profileName of profiles) {
                    await this.createProfileFromName(profileName, profileName === activeProfile);
                }
            }
        } catch (error) {
            console.error('迁移配置文件列表失败:', error);
        }
    }

    /**
     * 迁移配置文件详细信息
     */
    private async migrateProfileDetails(): Promise<void> {
        try {
            // 获取所有配置文件
            const profiles = await this.profileDAO.getProfilesByUserAndGame(this.userId, this.gameId);

            for (const profile of profiles) {
                await this.migrateSingleProfileDetails(profile);
            }
        } catch (error) {
            console.error('迁移配置文件详细信息失败:', error);
        }
    }

    /**
     * 迁移单个配置文件详细信息
     */
    private async migrateSingleProfileDetails(profile: any): Promise<void> {
        try {
            const profileDetailPath = await path.join(
                await configDir(),
                'com.mint.cat',
                `profile_${profile.displayName}.json`
            );

            const detailContent = await readTextFile(profileDetailPath);
            const oldDetail = MigrationUtils.safeParseJson(detailContent, {
                name: profile.name,
                root: { children: [] }
            });

            // 处理树形结构
            const folderMap = new Map();
            let sortOrder = 0;

            // 递归处理文件夹和模组
            const processTreeNode = async (node: any, parentFolderId: number | null = null): Promise<void> => {
                if (node.type === 'folder') {
                    // 创建文件夹
                    const folder = await this.profileDAO.createFolder({
                        profileId: profile.id!,
                        name: node.name || 'Folder',
                        folderType: this.getFolderTypeFromName(node.name),
                        sortOrder: sortOrder++,
                        isExpanded: true,
                        parentFolderId
                    });

                    if (folder) {
                        folderMap.set(node.id, folder.id);

                        // 处理子节点
                        if (node.children && Array.isArray(node.children)) {
                            for (const child of node.children) {
                                await processTreeNode(child, folder.id);
                            }
                        }
                    }
                } else if (node.type === 'item') {
                    // 这是模组，添加到当前文件夹
                    await this.addModToProfileById(node.id, profile.id!, parentFolderId, sortOrder++);
                }
            };

            // 处理根节点的子节点
            if (oldDetail.root && oldDetail.root.children && Array.isArray(oldDetail.root.children)) {
                for (const child of oldDetail.root.children) {
                    await processTreeNode(child);
                }
            }

        } catch (error) {
            console.error(`迁移配置文件详细信息失败: ${profile.name}`, error);
        }
    }

    /**
     * 根据文件夹名称确定文件夹类型
     */
    private getFolderTypeFromName(name: string): string {
        if (name === 'mod.io') return 'modio';
        if (name === '本地') return 'local';
        return 'custom';
    }

    /**
     * 通过原始ID查找对应的mod_id
     */
    private async findModIdByOriginalId(originalId: number): Promise<number | null> {
        try {
            const modListPath = await path.join(await configDir(), 'com.mint.cat', 'mods.json');

            if (!await exists(modListPath)) {
                return null;
            }

            const modListContent = await readTextFile(modListPath);
            const oldModList = MigrationUtils.safeParseJson(modListContent, {mods: []});

            const mods = oldModList.mods || [];
            const foundMod = mods.find((m: any) => m.id === originalId);

            return foundMod ? foundMod.mod_id : null;
        } catch (error) {
            console.error(`查找原始ID ${originalId} 对应的mod_id失败:`, error);
            return null;
        }
    }

    /**
     * 通过ID添加模组到配置文件
     */
    private async addModToProfileById(modId: number, profileId: number, parentFolderId: number | null, sortOrder: number): Promise<void> {
        try {
            // 首先尝试通过platform ID查找模组
            let mod = await this.modDAO.getModByPlatformId(modId);

            // 如果没找到，尝试通过原始mods.json中的id找到对应的mod_id
            if (!mod) {
                const originalModId = await this.findModIdByOriginalId(modId);
                if (originalModId) {
                    mod = await this.modDAO.getModByPlatformId(originalModId);
                }
            }

            if (!mod) {
                console.warn(`模组ID ${modId} 未找到，跳过`);
                return;
            }

            // 获取模组版本信息
            const modVersion = await this.modDAO.getModVersion(mod.modId!);

            // 从原mods.json中查找启用状态
            const modListPath = await path.join(await configDir(), 'com.mint.cat', 'mods.json');
            let isEnabled = true; // 默认启用

            if (await exists(modListPath)) {
                const modListContent = await readTextFile(modListPath);
                const oldModList = MigrationUtils.safeParseJson(modListContent, {mods: []});

                const originalMod = oldModList.mods?.find((m: any) => (m.id === modId || m.mod_id === modId));
                if (originalMod) {
                    isEnabled = originalMod.enabled !== false;
                }
            }

            await this.profileDAO.addModToProfile({
                profileId,
                modId: mod.modId!,
                parentFolderId,
                sortOrder,
                isEnabled,
                usedVersion: modVersion?.currentVersion || '-'
            });

        } catch (error) {
            console.error(`添加模组到配置文件失败: ${modId}`, error);
        }
    }

    
    /**
     * 从名称创建配置文件
     */
    private async createProfileFromName(name: string, isActive: boolean): Promise<void> {
        try {
            // 检查配置文件是否已存在
            const existingProfile = await this.profileDAO.getProfileByName(name.toLowerCase().replace(/\s+/g, '_'), this.gameId, this.userId);
            if (existingProfile) {
                console.log(`配置文件 ${name} 已存在，跳过创建`);
                return;
            }

            await this.profileDAO.createProfile({
                name: name.toLowerCase().replace(/\s+/g, '_'),
                displayName: name, // 使用原始名称作为显示名称
                gameId: this.gameId,
                userId: this.userId,
                isActive
            });
        } catch (error) {
            console.error('创建配置文件失败:', error);
        }
    }

}