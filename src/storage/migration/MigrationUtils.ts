import { GameDAO } from '@/storage/dao/GameDAO';
import { ModDAO } from '@/storage/dao/ModDAO';
import { ProfileDAO } from '@/storage/dao/ProfileDAO';
import { UserDAO } from '@/storage/dao/UserDAO';
import { OAuthDAO } from '@/storage/dao/OAuthDAO';
const { join } = await import('@tauri-apps/api/path');
const { configDir } = await import('@tauri-apps/api/path');

/**
 * 迁移工具类
 * 提供JSON配置到数据库的映射和转换功能
 */
export class MigrationUtils {

    /**
     * 创建默认游戏记录
     */
    public static async createDefaultGame(): Promise<number> {
        const existingGame = await GameDAO.getGameByName('drg');
        if (existingGame) {
            return existingGame.id!;
        }

        const game = await GameDAO.createGame({
            name: 'drg',
            displayName: 'Deep Rock Galactic',
            installPath: '',
            isActive: true
        });

        return game!.id!;
    }

    /**
     * 创建默认用户记录
     */
    public static async createDefaultUser(): Promise<number> {
        const users = await UserDAO.getAllUsers();
        if (users.length > 0) {
            return users[0].id!;
        }

        const user = await UserDAO.createUser({
            username: 'default_user',
            email: '',
            avatarUrl: ''
        });

        return user!.id!;
    }

    /**
     * 转换旧版JSON模组数据到新格式
     */
    public static convertOldModData(oldMod: any, gameId: number) {
        const isUrl = (str: string) => str.startsWith('http');
        
        let sourceType = 'Unknown';
        let platformId = 0;
        let nameId = '';
        let displayName = '';
        let url = '';

        if (isUrl(oldMod.url || '')) {
            sourceType = 'Modio';
            url = oldMod.url;
            
            // 从URL提取平台ID
            const match = url.match(/\/mods\/(\d+)/);
            if (match) {
                platformId = parseInt(match[1]);
            }
            
            nameId = oldMod.nameId || `mod_${platformId}`;
            displayName = oldMod.displayName || oldMod.name || `Mod ${platformId}`;
        } else {
            sourceType = 'Local';
            url = oldMod.url || oldMod.cachePath || '';
            nameId = oldMod.nameId || oldMod.displayName || 'local_mod';
            displayName = oldMod.displayName || oldMod.name || 'Local Mod';
        }

        return {
            platformId,
            gameId,
            nameId,
            displayName,
            url,
            sourceType,
            tags: oldMod.tags || [],
            approvalStatus: oldMod.approvalStatus || 'Sandbox',
            dependModId: oldMod.dependModId || 0
        };
    }

    /**
     * 转换旧版JSON配置文件数据到新格式
     */
    public static convertOldProfileData(oldProfile: any, gameId: number, userId: number) {
        return {
            name: oldProfile.name || 'default',
            displayName: oldProfile.displayName || oldProfile.name || 'Default',
            gameId,
            userId,
            isActive: oldProfile.isActive || false,
            description: oldProfile.description || '',
            lastUsedAt: new Date()
        };
    }

    /**
     * 转换旧版JSON设置数据到新格式
     */
    public static convertOldSettingsData(oldSettings: any) {
        return {
            version: oldSettings.version || '0.5.0',
            guiTheme: oldSettings.guiTheme || oldSettings.gui_theme || 'Light',
            language: oldSettings.language || 'en',
            cachePath: oldSettings.cachePath || oldSettings.cache_path || '',
            configPath: oldSettings.configPath || oldSettings.config_path || '',
            ue4ssVersion: oldSettings.ue4ssVersion || oldSettings.ue4ss || 'UE4SS-Lite',
            autoCheckUpdates: oldSettings.autoCheckUpdates !== false,
            downloadParallelCount: oldSettings.downloadParallelCount || 3
        };
    }

    /**
     * 转换旧版JSON文件夹结构到新格式
     */
    public static convertOldFolderStructure(oldFolders: any[], profileId: number) {
        const folderMap = new Map();
        const newFolders: any[] = [];

        // 创建默认文件夹
        newFolders.push(
            {
                profileId,
                name: 'mod.io',
                folderType: 'modio',
                sortOrder: 0,
                isExpanded: true
            },
            {
                profileId,
                name: 'Local',
                folderType: 'local',
                sortOrder: 1,
                isExpanded: true
            }
        );

        return newFolders;
    }

    /**
     * 安全解析JSON字符串
     */
    public static safeParseJson(jsonString: string, defaultValue: any = {}) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Failed to parse JSON:', error);
            return defaultValue;
        }
    }

    /**
     * 获取文件路径
     */
    public static async getConfigFilePath(version: string, fileName: string): Promise<string> {

        let basePath = '';
        
        switch (version) {
            case '0.2.0':
                basePath = await join(await configDir(), 'drg-mod-integration', 'config');
                break;
            case '0.3.0':
                basePath = await join(await configDir(), 'mint', 'config');
                break;
            case '0.4.0':
                basePath = await join(await configDir(), 'com.mint.cat');
                break;
            default:
                basePath = await configDir();
        }
        
        return await join(basePath, fileName);
    }
}