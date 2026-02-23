import { GameDAO } from '@/storage/dao/GameDAO';
import { ModDAO } from '@/storage/dao/ModDAO';
import { ProfileDAO } from '@/storage/dao/ProfileDAO';
import { UserDAO } from '@/storage/dao/UserDAO';
import { OAuthDAO } from '@/storage/dao/OAuthDAO';
import { SettingDAO } from '@/storage/dao/SettingDAO';
import { MigrationUtils } from './MigrationUtils';
import { ConfigDataType } from '@/storage/DataType';
import { exists, readTextFile, stat } from '@tauri-apps/plugin-fs';
import { path } from '@tauri-apps/api';
import { configDir } from '@tauri-apps/api/path';

/**
 * mod.io URL 解析结果
 */
interface ModioUrlParseResult {
    type: 'modio';
    nameId: string;
    versionId: string | null;
}

/**
 * 本地文件路径解析结果
 */
interface LocalFileParseResult {
    type: 'local';
    fileName: string;
    displayName: string;
}

/**
 * URL 解析结果联合类型
 */
type UrlParseResult = ModioUrlParseResult | LocalFileParseResult;

/**
 * V2 配置中的模组数据结构
 */
interface V2ModSpec {
    spec: {
        url: string;
    };
    required: boolean;
    enabled: boolean;
}

/**
 * V2 配置中的 Profile 数据结构
 */
interface V2Profile {
    mods: V2ModSpec[];
}

/**
 * V2 config.json 数据结构
 */
interface V2Config {
    version: string;
    provider_parameters?: {
        modio?: {
            oauth?: string;
        };
    };
    drg_pak_path?: string;
    gui_theme?: string | null;
    sorting_config?: {
        sort_category?: string;
        is_ascending?: boolean;
    };
}

/**
 * V2 mod_data.json 数据结构
 */
interface V2ModData {
    version: string;
    active_profile: string;
    profiles: Record<string, V2Profile>;
    groups?: Record<string, V2Profile>;
}

/**
 * v0.2.0 配置迁移类
 * 将旧版 drg-mod-integration JSON 配置迁移到 MintCat SQLite 数据库
 */
export class ConfigMigrationV2 {

    private version = '0.2';
    private gameId: number = 0;
    private userId: number = 0;

    // DAO 实例
    private modDAO = new ModDAO();
    private profileDAO = new ProfileDAO();
    private settingDAO = new SettingDAO();
    private oauthDAO = new OAuthDAO();
    private gameDAO = new GameDAO();
    private userDAO = new UserDAO();

    // URL 到 modId 的映射（去重用）
    private modUrlToDbId = new Map<string, number>();

    /**
     * 检查是否存在 v0.2.0 配置
     */
    public async checkConfig(): Promise<ConfigDataType> {
        try {
            const configPath = await path.join(await configDir(), 'drg-mod-integration', 'config');

            if (await exists(configPath)) {
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

            // 1. 确保游戏和用户存在
            await this.ensureGameAndUser();

            // 2. 迁移设置（config.json）
            await this.migrateSettings();

            // 3. 迁移模组和配置文件（mod_data.json）
            await this.migrateModsAndProfiles();

            console.log(`v${this.version}配置迁移完成`);
            return true;
        } catch (error) {
            console.error(`迁移v${this.version}配置失败:`, error);
            return false;
        }
    }

    /**
     * 确保游戏和用户记录存在
     */
    private async ensureGameAndUser(): Promise<void> {
        // 创建或获取 DRG 游戏记录
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

        // 创建或获取默认用户
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
    }

    /**
     * 迁移设置数据（config.json）
     */
    private async migrateSettings(): Promise<void> {
        try {
            const configPath = await path.join(
                await configDir(),
                'drg-mod-integration',
                'config',
                'config.json'
            );

            if (!await exists(configPath)) {
                console.log('config.json 不存在，跳过设置迁移');
                return;
            }

            const configContent = await readTextFile(configPath);
            const config: V2Config = MigrationUtils.safeParseJson(configContent, {});

            // 迁移 OAuth token
            if (config.provider_parameters?.modio?.oauth) {
                await this.oauthDAO.createOAuth({
                    uid: this.userId,
                    oauth: config.provider_parameters.modio.oauth,
                    platform: 'mod.io'
                });
                console.log('已迁移 mod.io OAuth token');
            }

            // 迁移 DRG 安装路径
            if (config.drg_pak_path) {
                await this.gameDAO.updateGame(this.gameId, {
                    installPath: config.drg_pak_path
                });
                console.log('已迁移 DRG 安装路径:', config.drg_pak_path);
            }

            // 迁移 GUI 主题
            if (config.gui_theme !== undefined && config.gui_theme !== null) {
                await this.settingDAO.setValue('guiTheme', config.gui_theme);
                console.log('已迁移 GUI 主题:', config.gui_theme);
            }

            console.log('设置数据迁移完成');
        } catch (error) {
            console.error('迁移设置数据失败:', error);
        }
    }

    /**
     * 迁移模组和配置文件（mod_data.json）
     */
    private async migrateModsAndProfiles(): Promise<void> {
        try {
            const modDataPath = await path.join(
                await configDir(),
                'drg-mod-integration',
                'config',
                'mod_data.json'
            );

            if (!await exists(modDataPath)) {
                console.log('mod_data.json 不存在，跳过模组和配置文件迁移');
                return;
            }

            const modDataContent = await readTextFile(modDataPath);
            const modData: V2ModData = MigrationUtils.safeParseJson(modDataContent, {
                profiles: {},
                active_profile: ''
            });

            const activeProfileName = modData.active_profile || '';
            const profiles = modData.profiles || {};

            // 收集所有唯一的 URL
            const allUrls = new Set<string>();
            for (const profileName in profiles) {
                const profile = profiles[profileName];
                if (profile.mods && Array.isArray(profile.mods)) {
                    for (const mod of profile.mods) {
                        if (mod.spec?.url) {
                            allUrls.add(mod.spec.url);
                        }
                    }
                }
            }

            console.log(`发现 ${allUrls.size} 个唯一的模组 URL`);

            // 为每个唯一 URL 创建模组记录
            for (const url of allUrls) {
                await this.createModFromUrl(url);
            }

            console.log(`已创建 ${this.modUrlToDbId.size} 个模组记录`);

            // 为每个 profile 创建记录并关联模组
            for (const profileName in profiles) {
                const profile = profiles[profileName];
                const isActive = profileName === activeProfileName;

                await this.createProfileWithMods(profileName, profile, isActive);
            }

            // 显式激活 V2 的 active_profile，确保 getActiveProfile() 返回带模组的配置
            // （否则可能仍指向已有的空 profile，导致「当前配置文件没有模组」）
            if (activeProfileName) {
                const normalizedActive = activeProfileName.toLowerCase().replace(/\s+/g, '_');
                const activeProfile = await this.profileDAO.getProfileByName(
                    normalizedActive,
                    this.gameId,
                    this.userId
                );
                if (activeProfile?.id) {
                    await this.profileDAO.activateProfile(activeProfile.id);
                    console.log(`已激活配置文件: ${activeProfileName} (ID: ${activeProfile.id})`);
                }
            }

            console.log('模组和配置文件迁移完成');
        } catch (error) {
            console.error('迁移模组和配置文件失败:', error);
        }
    }

    /**
     * 从 URL 创建模组记录
     */
    private async createModFromUrl(url: string): Promise<number | null> {
        try {
            // 检查是否已处理过
            if (this.modUrlToDbId.has(url)) {
                return this.modUrlToDbId.get(url)!;
            }

            // 检查数据库中是否已存在
            const existingMod = await this.modDAO.getModByUrl(url);
            if (existingMod) {
                this.modUrlToDbId.set(url, existingMod.modId!);
                console.log(`模组 URL 已存在，跳过: ${url}`);
                return existingMod.modId!;
            }

            // 解析 URL
            const parsed = this.parseModUrl(url);
            if (!parsed) {
                console.warn(`无法解析 URL: ${url}`);
                return null;
            }

            let platformId = 0;
            let nameId = '';
            let displayName = '';
            let sourceType = 'Unknown';

            if (parsed.type === 'modio') {
                // mod.io 模组
                platformId = 0; // 稍后刷新时更新
                nameId = parsed.nameId;
                displayName = this.nameIdToDisplayName(parsed.nameId);
                sourceType = 'Modio';
            } else {
                // 本地文件
                platformId = 0;
                nameId = parsed.fileName;
                displayName = parsed.displayName;
                sourceType = 'Local';
            }

            // 创建模组记录
            const mod = await this.modDAO.createMod({
                platformId,
                gameId: this.gameId,
                nameId,
                displayName,
                originalName: displayName,
                url,
                sourceType,
                tags: [],
                approvalStatus: '',
                dependModId: 0
            });

            if (!mod) {
                console.error(`创建模组失败: ${url}`);
                return null;
            }

            const modId = mod.modId!;
            this.modUrlToDbId.set(url, modId);

            // 创建版本信息
            await this.modDAO.upsertModVersion({
                modId,
                currentVersion: '-',
                availableVersions: []
            });

            // 创建下载信息
            await this.modDAO.upsertModDownload({
                modId,
                downloadUrl: '',
                cachePath: parsed.type === 'local' ? url : '',
                fileSize: 0,
                downloadProgress: 100,
                downloadStatus: 'completed'
            });

            // 创建状态信息（本地 mod 首次导入时检测文件是否存在）
            let isLocalNotFound = false;
            if (parsed.type === 'local') {
                try {
                    isLocalNotFound = !(await exists(url));
                    if (isLocalNotFound) {
                        console.warn(`本地模组文件不存在: ${url}`);
                    }
                } catch {
                    isLocalNotFound = true;
                }
            }
            await this.modDAO.upsertModStatus({
                modId,
                lastUpdateDate: 0,
                onlineUpdateDate: 0,
                isOnlineAvailable: parsed.type === 'modio',
                isLocalNotFound
            });

            console.log(`已创建模组: ${displayName} (${sourceType})`);
            return modId;
        } catch (error) {
            console.error(`从 URL 创建模组失败: ${url}`, error);
            return null;
        }
    }

    /**
     * 创建配置文件并关联模组
     */
    private async createProfileWithMods(
        profileName: string,
        profile: V2Profile,
        isActive: boolean
    ): Promise<void> {
        try {
            // 标准化 profile 名称
            const normalizedName = profileName.toLowerCase().replace(/\s+/g, '_');

            // 检查是否已存在
            const existingProfile = await this.profileDAO.getProfileByName(
                normalizedName,
                this.gameId,
                this.userId
            );

            if (existingProfile) {
                console.log(`配置文件 ${profileName} 已存在，将 V2 模组关联到该配置`);
                const profileId = existingProfile.id!;
                if (profile.mods && Array.isArray(profile.mods)) {
                    let sortOrder = 0;
                    for (const modSpec of profile.mods) {
                        const url = modSpec.spec?.url;
                        if (!url) continue;
                        const modId = this.modUrlToDbId.get(url);
                        if (!modId) continue;
                        await this.profileDAO.addModToProfile({
                            profileId,
                            modId,
                            parentFolderId: null,
                            sortOrder: sortOrder++,
                            isEnabled: modSpec.enabled !== false,
                            usedVersion: ''
                        });
                    }
                    console.log(`已关联 ${profile.mods.length} 个模组到已有配置文件 ${profileName}`);
                }
                if (isActive) {
                    await this.profileDAO.activateProfile(profileId);
                }
                return;
            }

            // 创建 profile
            const createdProfile = await this.profileDAO.createProfile({
                name: normalizedName,
                displayName: profileName,
                gameId: this.gameId,
                userId: this.userId,
                isActive
            });

            if (!createdProfile) {
                console.error(`创建配置文件失败: ${profileName}`);
                return;
            }

            const profileId = createdProfile.id!;
            console.log(`已创建配置文件: ${profileName}, ID: ${profileId}, 激活: ${isActive}`);

            // 关联模组到配置文件
            if (profile.mods && Array.isArray(profile.mods)) {
                let sortOrder = 0;

                for (const modSpec of profile.mods) {
                    const url = modSpec.spec?.url;
                    if (!url) continue;

                    const modId = this.modUrlToDbId.get(url);
                    if (!modId) {
                        console.warn(`未找到模组 URL 对应的记录: ${url}`);
                        continue;
                    }

                    // 添加模组到配置文件（不创建默认文件夹，直接挂到根级别）
                    await this.profileDAO.addModToProfile({
                        profileId,
                        modId,
                        parentFolderId: null,
                        sortOrder: sortOrder++,
                        isEnabled: modSpec.enabled !== false,
                        usedVersion: ''
                    });
                }

                console.log(`已关联 ${profile.mods.length} 个模组到配置文件 ${profileName}`);
            }
        } catch (error) {
            console.error(`创建配置文件失败: ${profileName}`, error);
        }
    }

    /**
     * 解析 mod.io URL
     * 格式: https://mod.io/g/drg/m/{name_id}#{version_id}
     */
    private parseModioUrl(url: string): ModioUrlParseResult | null {
        try {
            // 匹配 mod.io URL 格式
            const regex = /^https?:\/\/mod\.io\/g\/\w+\/m\/([^#?]+)(?:#(\d+))?/;
            const match = url.match(regex);

            if (!match) return null;

            return {
                type: 'modio',
                nameId: match[1],
                versionId: match[2] || null
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * 解析本地文件路径
     */
    private parseLocalFilePath(url: string): LocalFileParseResult | null {
        try {
            // 提取文件名（支持 Windows 和 Unix 路径）
            const parts = url.split(/[\\/]/);
            const fileName = parts[parts.length - 1];

            if (!fileName) return null;

            // 移除扩展名以获取显示名称
            let displayName = fileName;

            // 移除常见的模组文件后缀
            displayName = displayName.replace(/_P\.pak$/i, '');
            displayName = displayName.replace(/\.pak$/i, '');
            displayName = displayName.replace(/\.zip$/i, '');

            return {
                type: 'local',
                fileName,
                displayName
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * 解析模组 URL（统一入口）
     */
    private parseModUrl(url: string): UrlParseResult | null {
        // 先尝试解析为 mod.io URL
        const modioResult = this.parseModioUrl(url);
        if (modioResult) return modioResult;

        // 再尝试解析为本地文件路径
        const localResult = this.parseLocalFilePath(url);
        if (localResult) return localResult;

        return null;
    }

    /**
     * 判断是否为 mod.io URL
     */
    private isModioUrl(url: string): boolean {
        return url.startsWith('https://mod.io/') || url.startsWith('http://mod.io/');
    }

    /**
     * 将 nameId 转换为显示名称（Title Case）
     * 例如: "low-poly-model-enemies" -> "Low Poly Model Enemies"
     */
    private nameIdToDisplayName(nameId: string): string {
        return nameId
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}
