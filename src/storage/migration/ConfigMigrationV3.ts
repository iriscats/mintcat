import {GameDAO} from '@/storage/dao/GameDAO';
import {ModDAO} from '@/storage/dao/ModDAO';
import {ProfileDAO} from '@/storage/dao/ProfileDAO';
import {UserDAO} from '@/storage/dao/UserDAO';
import {OAuthDAO} from '@/storage/dao/OAuthDAO';
import {SettingDAO} from '@/storage/dao/SettingDAO';
import {MigrationUtils} from './MigrationUtils';
import {ConfigDataType} from '@/storage/DataType';
import {exists, readTextFile} from '@tauri-apps/plugin-fs';
import {path} from '@tauri-apps/api';
import {configDir} from '@tauri-apps/api/path';

/**
 * v0.3.0 配置迁移类
 * 将v0.3.0 JSON配置迁移到SQLite数据库
 */
export class ConfigMigrationV3 {

    private version = '0.3.0';
    private gameId: number = 0;
    private userId: number = 0;

    /**
     * 检查是否存在v0.3.0配置
     */
    public async checkConfig(): Promise<ConfigDataType> {
        try {
            const configPath = await path.join(await configDir(), 'mint', 'config');

            if (await exists(configPath)) {
                const {stat} = await import('@tauri-apps/plugin-fs');
                const dirInfo = await stat(configPath);

                // 检查必要的配置文件是否存在
                const configFile = await path.join(configPath, 'config.json');
                const modDataFile = await path.join(configPath, 'mod_data.json');
                const profileFile = await path.join(configPath, 'profile_data.json');

                const hasConfig = await exists(configFile);
                const hasModData = await exists(modDataFile);
                const hasProfile = await exists(profileFile);

                if (hasConfig || hasModData || hasProfile) {
                    return {
                        version: this.version,
                        saveTime: new Date(dirInfo.mtime).toISOString(),
                        path: configPath
                    };
                }
            }

            return undefined;
        } catch (error) {
            console.error('检查v0.3.0配置失败:', error);
            return undefined;
        }
    }

    /**
     * 执行配置迁移
     */
    public async migrate(): Promise<boolean> {
        try {
            return true;
        } catch (error) {
            console.error(`迁移v${this.version}配置失败:`, error);
            return false;
        }
    }
}