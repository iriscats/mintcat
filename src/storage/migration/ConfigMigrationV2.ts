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
 * v0.2.0 配置迁移类
 * 将旧版JSON配置迁移到SQLite数据库
 */
export class ConfigMigrationV2 {

    private version = '0.2.0';
    private gameId: number = 0;
    private userId: number = 0;

    /**
     * 检查是否存在v0.2.0配置
     */
    public async checkConfig(): Promise<ConfigDataType> {
        try {
            const configPath = await path.join(await configDir(), 'drg-mod-integration', 'config');
            
            if (await exists(configPath)) {
                const { stat } = await import('@tauri-apps/plugin-fs');
                const dirInfo = await stat(configPath);
                
                // 检查必要的配置文件是否存在
                const configFile = await path.join(configPath, 'config.json');
                const modDataFile = await path.join(configPath, 'mod_data.json');
                
                const hasConfig = await exists(configFile);
                const hasModData = await exists(modDataFile);
                
                if (hasConfig || hasModData) {
                    return {
                        version: this.version,
                        saveTime: new Date(dirInfo.mtime).toISOString(),
                        path: configPath
                    };
                }
            }
            
            return undefined;
        } catch (error) {
            console.error('检查v0.2.0配置失败:', error);
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

            // 迁移模组和配置文件
            await this.migrateModData();

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
            const configPath = await path.join(await configDir(), 'drg-mod-integration', 'config', 'config.json');
            
            if (await exists(configPath)) {
                const configContent = await readTextFile(configPath);
                const oldConfig = MigrationUtils.safeParseJson(configContent, {});

                // 提取设置数据
                const settings = {
                    version: this.version,
                    guiTheme: 'Light',
                    language: 'en',
                    cachePath: '',
                    configPath: '',
                    ue4ssVersion: 'UE4SS-Lite',
                    autoCheckUpdates: true,
                    downloadParallelCount: 3
                };

                // 从旧配置中提取mod.io OAuth
                if (oldConfig.provider_parameters?.modio?.oauth) {
                    await OAuthDAO.createOAuth({
                        uid: this.userId,
                        oauth: oldConfig.provider_parameters.modio.oauth,
                        platform: 'mod.io'
                    });
                }

                await SettingDAO.createSettings(settings);
            }
        } catch (error) {
            console.error('迁移设置数据失败:', error);
            // 创建默认设置
            await SettingDAO.createSettings({
                version: this.version,
                guiTheme: 'Light',
                language: 'en',
                cachePath: '',
                configPath: '',
                ue4ssVersion: 'UE4SS-Lite',
                autoCheckUpdates: true,
                downloadParallelCount: 3
            });
        }
    }

    /**
     * 迁移模组数据
     */
    private async migrateModData(): Promise<void> {
        try {
            const modDataPath = await path.join(await configDir(), 'drg-mod-integration', 'config', 'mod_data.json');
            
            if (await exists(modDataPath)) {
                const modDataContent = await readTextFile(modDataPath);
                const oldModData = MigrationUtils.safeParseJson(modDataContent, { profiles: {} });

                // 处理每个配置文件
                for (const [profileName, profileData] of Object.entries(oldModData.profiles || {})) {
                    await this.migrateProfile(profileName, profileData as any);
                }
            }
        } catch (error) {
            console.error('迁移模组数据失败:', error);
            // 创建默认配置文件
            await this.createDefaultProfile();
        }
    }

    /**
     * 迁移单个配置文件
     */
    private async migrateProfile(profileName: string, profileData: any): Promise<void> {
        try {
            // 创建配置文件
            const profile = await ProfileDAO.createProfile({
                name: profileName.toLowerCase().replace(/\s+/g, '_'),
                displayName: profileName,
                gameId: this.gameId,
                userId: this.userId,
                isActive: profileName === 'default',
                description: `Migrated from v${this.version}`,
                lastUsedAt: new Date()
            });

            if (!profile) {
                console.error(`创建配置文件失败: ${profileName}`);
                return;
            }

            const profileId = profile.id!;

            // 创建默认文件夹
            const modioFolder = await ProfileDAO.createFolder({
                profileId,
                name: 'mod.io',
                folderType: 'modio',
                sortOrder: 0,
                isExpanded: true
            });

            const localFolder = await ProfileDAO.createFolder({
                profileId,
                name: 'Local',
                folderType: 'local',
                sortOrder: 1,
                isExpanded: true
            });

            // 迁移模组
            const mods = profileData.mods || [];
            for (let i = 0; i < mods.length; i++) {
                const oldMod = mods[i];
                await this.migrateMod(oldMod, profileId, modioFolder?.id, localFolder?.id, i);
            }
        } catch (error) {
            console.error(`迁移配置文件失败: ${profileName}`, error);
        }
    }

    /**
     * 迁移单个模组
     */
    private async migrateMod(oldMod: any, profileId: number, modioFolderId?: number, localFolderId?: number, sortOrder: number = 0): Promise<void> {
        try {
            const url = oldMod.spec?.url || '';
            const isHttpUrl = url.startsWith('http');

            let platformId = 0;
            let nameId = '';
            let displayName = '';

            if (isHttpUrl) {
                // 从URL提取mod.io ID
                const match = url.match(/\/mods\/(\d+)/);
                platformId = match ? parseInt(match[1]) : 0;
                nameId = `mod_${platformId}`;
                displayName = `Mod ${platformId}`;
            } else {
                // 本地模组
                nameId = url.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || 'local_mod';
                displayName = nameId;
            }

            // 创建模组
            const mod = await ModDAO.createMod({
                platformId,
                gameId: this.gameId,
                nameId,
                displayName,
                url,
                sourceType: isHttpUrl ? 'Modio' : 'Local',
                tags: [],
                approvalStatus: 'Sandbox',
                dependModId: 0
            });

            if (!mod) {
                console.error('创建模组失败:', nameId);
                return;
            }

            const modId = mod.modId!;

            // 设置模组版本信息
            await ModDAO.upsertModVersion({
                modId,
                currentVersion: '-',
                availableVersions: []
            });

            // 设置模组下载信息
            await ModDAO.upsertModDownload({
                modId,
                downloadUrl: isHttpUrl ? url : '',
                cachePath: !isHttpUrl ? url : '',
                fileSize: 0,
                downloadProgress: 100,
                downloadStatus: 'completed'
            });

            // 设置模组状态
            await ModDAO.upsertModStatus({
                modId,
                lastUpdateDate: 0,
                onlineUpdateDate: 0,
                isOnlineAvailable: isHttpUrl,
                isLocalNotFound: false
            });

            // 将模组添加到配置文件
            const parentFolderId = isHttpUrl ? modioFolderId : localFolderId;
            await ProfileDAO.addModToProfile({
                profileId,
                modId,
                parentFolderId: parentFolderId || null,
                sortOrder,
                isEnabled: oldMod.enabled !== false,
                usedVersion: '-'
            });

        } catch (error) {
            console.error('迁移模组失败:', error);
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