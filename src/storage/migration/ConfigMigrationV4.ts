import { GameDAO } from '@/storage/dao/GameDAO';
import { ModDAO } from '@/storage/dao/ModDAO';
import { ProfileDAO } from '@/storage/dao/ProfileDAO';
import { UserDAO } from '@/storage/dao/UserDAO';
import { OAuthDAO } from '@/storage/dao/OAuthDAO';
import { SettingDAO } from '@/storage/dao/SettingDAO';
import { MigrationUtils } from './MigrationUtils';
import { ConfigDataType } from '@/storage/DataType';
import { exists, readTextFile } from '@tauri-apps/plugin-fs';
import { path } from '@tauri-apps/api';
import { configDir } from '@tauri-apps/api/path';

/**
 * v0.4.0 配置迁移类
 * 将v0.4.0 JSON配置迁移到SQLite数据库
 * v0.4.0使用与v0.5.0相同的目录结构，但使用JSON文件存储
 */
export class ConfigMigrationV4 {

    private version = '0.4.0';
    private gameId: number = 0;
    private userId: number = 0;

    /**
     * 检查是否存在v0.4.0配置
     */
    public async checkConfig(): Promise<ConfigDataType> {
        try {
            const configPath = await path.join(await configDir(), 'com.mint.cat');
            
            if (await exists(configPath)) {
                const { stat } = await import('@tauri-apps/plugin-fs');
                const dirInfo = await stat(configPath);
                
                // 检查必要的配置文件是否存在
                const settingsFile = await path.join(configPath, 'settings.json');
                const modListFile = await path.join(configPath, 'mod_list.json');
                const profileFile = await path.join(configPath, 'profile_list.json');
                
                const hasSettings = await exists(settingsFile);
                const hasModList = await exists(modListFile);
                const hasProfile = await exists(profileFile);
                
                if (hasSettings || hasModList || hasProfile) {
                    return {
                        version: this.version,
                        saveTime: new Date(dirInfo.mtime).toISOString(),
                        path: configPath
                    };
                }
            }
            
            return undefined;
        } catch (error) {
            console.error('检查v0.4.0配置失败:', error);
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
            this.gameId = await MigrationUtils.createDefaultGame();
            this.userId = await MigrationUtils.createDefaultUser();

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
                const oldSettings = MigrationUtils.safeParseJson(settingsContent, {});

                const settings = MigrationUtils.convertOldSettingsData(oldSettings);
                await SettingDAO.createSettings(settings);

                // 迁移OAuth信息
                if (oldSettings.modioOAuth) {
                    await OAuthDAO.createOAuth({
                        uid: this.userId,
                        oauth: oldSettings.modioOAuth,
                        platform: 'mod.io'
                    });
                }
            } else {
                // 创建默认设置
                await SettingDAO.createSettings(MigrationUtils.convertOldSettingsData({}));
            }
        } catch (error) {
            console.error('迁移设置数据失败:', error);
            await SettingDAO.createSettings(MigrationUtils.convertOldSettingsData({}));
        }
    }

    /**
     * 迁移模组列表
     */
    private async migrateModList(): Promise<void> {
        try {
            const modListPath = await path.join(await configDir(), 'com.mint.cat', 'mod_list.json');
            
            if (await exists(modListPath)) {
                const modListContent = await readTextFile(modListPath);
                const oldModList = MigrationUtils.safeParseJson(modListContent, { mods: [] });

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
            // 提取模组数据
            const platformId = oldMod.platformId || oldMod.id || 0;
            const nameId = oldMod.nameId || oldMod.name || `mod_${platformId}`;
            const displayName = oldMod.displayName || oldMod.name || nameId;
            const url = oldMod.url || '';
            const sourceType = url.startsWith('http') ? 'Modio' : 'Local';
            const tags = oldMod.tags || [];
            const approvalStatus = oldMod.approvalStatus || 'Sandbox';

            // 检查模组是否已存在
            const existingMod = await ModDAO.getModByPlatformId(platformId);
            if (existingMod) {
                return; // 跳过已存在的模组
            }

            // 创建模组
            const mod = await ModDAO.createMod({
                platformId,
                gameId: this.gameId,
                nameId,
                displayName,
                url,
                sourceType,
                tags,
                approvalStatus,
                dependModId: oldMod.dependModId || 0
            });

            if (!mod) return;

            const modId = mod.modId!;

            // 设置版本信息
            await ModDAO.upsertModVersion({
                modId,
                currentVersion: oldMod.currentVersion || '-',
                availableVersions: oldMod.availableVersions || []
            });

            // 设置下载信息
            await ModDAO.upsertModDownload({
                modId,
                downloadUrl: oldMod.downloadUrl || '',
                cachePath: oldMod.cachePath || '',
                fileSize: oldMod.fileSize || 0,
                downloadProgress: oldMod.downloadProgress || 100,
                downloadStatus: oldMod.downloadStatus || 'completed'
            });

            // 设置状态信息
            await ModDAO.upsertModStatus({
                modId,
                lastUpdateDate: oldMod.lastUpdateDate || 0,
                onlineUpdateDate: oldMod.onlineUpdateDate || 0,
                isOnlineAvailable: oldMod.isOnlineAvailable !== false,
                isLocalNotFound: oldMod.isLocalNotFound || false
            });

        } catch (error) {
            console.error('迁移单个模组失败:', error);
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
            await this.createDefaultProfile();
        }
    }

    /**
     * 迁移配置文件列表
     */
    private async migrateProfileList(): Promise<void> {
        try {
            const profileListPath = await path.join(await configDir(), 'com.mint.cat', 'profile_list.json');
            
            if (await exists(profileListPath)) {
                const profileListContent = await readTextFile(profileListPath);
                const oldProfileList = MigrationUtils.safeParseJson(profileListContent, { profiles: [], activeProfile: 'default' });

                const profiles = oldProfileList.profiles || [];
                const activeProfile = oldProfileList.activeProfile || 'default';

                for (const profileName of profiles) {
                    await this.createProfileFromName(profileName, profileName === activeProfile);
                }
            } else {
                // 创建默认配置文件
                await this.createDefaultProfile();
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
            const profiles = await ProfileDAO.getProfilesByUserAndGame(this.userId, this.gameId);
            
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
                `profile_${profile.name}.json`
            );

            if (!await exists(profileDetailPath)) {
                // 创建默认文件夹结构
                await this.createDefaultFolders(profile.id!);
                return;
            }

            const detailContent = await readTextFile(profileDetailPath);
            const oldDetail = MigrationUtils.safeParseJson(detailContent, { 
                name: profile.name,
                folders: [], 
                mods: [],
                LocalFolder: {},
                ModioFolder: {}
            });

            // 创建文件夹结构
            const folderMap = new Map();
            
            // 处理标准文件夹
            for (const oldFolder of oldDetail.folders || []) {
                const folder = await ProfileDAO.createFolder({
                    profileId: profile.id!,
                    name: oldFolder.name || 'Folder',
                    folderType: oldFolder.folderType || oldFolder.type || 'custom',
                    sortOrder: oldFolder.sortOrder || 0,
                    isExpanded: oldFolder.isExpanded !== false,
                    parentFolderId: oldFolder.parentFolderId || oldFolder.parentId || null
                });
                
                if (folder) {
                    folderMap.set(oldFolder.id || oldFolder.name, folder.id);
                }
            }

            // 处理特殊文件夹（LocalFolder, ModioFolder）
            if (oldDetail.LocalFolder) {
                const localFolder = await ProfileDAO.createFolder({
                    profileId: profile.id!,
                    name: 'Local',
                    folderType: 'local',
                    sortOrder: 1,
                    isExpanded: true
                });
                folderMap.set('Local', localFolder!.id);
            }

            if (oldDetail.ModioFolder) {
                const modioFolder = await ProfileDAO.createFolder({
                    profileId: profile.id!,
                    name: 'mod.io',
                    folderType: 'modio',
                    sortOrder: 0,
                    isExpanded: true
                });
                folderMap.set('mod.io', modioFolder!.id);
            }

            // 添加模组到配置文件
            const mods = oldDetail.mods || [];
            for (let i = 0; i < mods.length; i++) {
                const oldMod = mods[i];
                await this.addModToProfile(oldMod, profile.id!, folderMap, i);
            }

        } catch (error) {
            console.error(`迁移配置文件详细信息失败: ${profile.name}`, error);
        }
    }

    /**
     * 添加模组到配置文件
     */
    private async addModToProfile(oldMod: any, profileId: number, folderMap: Map<string, number>, sortOrder: number): Promise<void> {
        try {
            // 查找对应的模组
            let mod = null;
            
            if (oldMod.id) {
                mod = await ModDAO.getModById(oldMod.id);
            } else if (oldMod.platformId) {
                mod = await ModDAO.getModByPlatformId(oldMod.platformId);
            } else if (oldMod.url) {
                const allMods = await ModDAO.getAllMods();
                mod = allMods.find(m => m.url === oldMod.url);
            }

            if (!mod) {
                // 如果找不到模组，创建新的
                const platformId = oldMod.platformId || oldMod.id || 0;
                const nameId = oldMod.nameId || oldMod.name || `mod_${platformId}`;
                const displayName = oldMod.displayName || oldMod.name || nameId;
                const url = oldMod.url || '';

                const modData = MigrationUtils.convertOldModData({
                    ...oldMod,
                    platformId,
                    nameId,
                    displayName,
                    url
                }, this.gameId);

                mod = await ModDAO.createMod(modData);
            }

            if (!mod) return;

            // 添加到配置文件
            let parentFolderId = null;
            
            // 确定文件夹
            if (oldMod.folderId) {
                parentFolderId = folderMap.get(oldMod.folderId);
            } else if (oldMod.sourceType === 'Local') {
                parentFolderId = folderMap.get('Local');
            } else if (oldMod.sourceType === 'Modio') {
                parentFolderId = folderMap.get('mod.io');
            }

            await ProfileDAO.addModToProfile({
                profileId,
                modId: mod.modId!,
                parentFolderId,
                sortOrder,
                isEnabled: oldMod.enabled !== false,
                usedVersion: oldMod.usedVersion || '-'
            });

        } catch (error) {
            console.error('添加模组到配置文件失败:', error);
        }
    }

    /**
     * 从名称创建配置文件
     */
    private async createProfileFromName(name: string, isActive: boolean): Promise<void> {
        try {
            await ProfileDAO.createProfile({
                name: name.toLowerCase().replace(/\s+/g, '_'),
                displayName: name,
                gameId: this.gameId,
                userId: this.userId,
                isActive,
                description: `Migrated from v${this.version}`,
                lastUsedAt: new Date()
            });
        } catch (error) {
            console.error('创建配置文件失败:', error);
        }
    }

    /**
     * 创建默认文件夹
     */
    private async createDefaultFolders(profileId: number): Promise<void> {
        try {
            await ProfileDAO.createFolder({
                profileId,
                name: 'mod.io',
                folderType: 'modio',
                sortOrder: 0,
                isExpanded: true
            });

            await ProfileDAO.createFolder({
                profileId,
                name: 'Local',
                folderType: 'local',
                sortOrder: 1,
                isExpanded: true
            });
        } catch (error) {
            console.error('创建默认文件夹失败:', error);
        }
    }

    /**
     * 创建默认配置文件
     */
    private async createDefaultProfile(): Promise<void> {
        try {
            await ProfileDAO.createProfile({
                name: 'default',
                displayName: 'Default',
                gameId: this.gameId,
                userId: this.userId,
                isActive: true,
                description: 'Default profile created during migration',
                lastUsedAt: new Date()
            });
        } catch (error) {
            console.error('创建默认配置文件失败:', error);
        }
    }
}