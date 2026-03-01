import {ConfigMigrationV2} from './ConfigMigrationV2';
import {path} from '@tauri-apps/api';
import {configDir} from '@tauri-apps/api/path';

/**
 * v0.3.0 配置迁移类
 * 数据格式与 v0.2.0 一致，仅配置目录路径不同。
 */
export class ConfigMigrationV3 extends ConfigMigrationV2 {
    protected version = '0.3';

    protected async getLegacyConfigPath(): Promise<string> {
        return await path.join(await configDir(), 'mint', 'config');
    }
}
