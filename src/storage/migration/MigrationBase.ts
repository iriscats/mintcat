import {ConfigMigrationV2} from './ConfigMigrationV2';
import {ConfigMigrationV3} from './ConfigMigrationV3';
import {ConfigMigrationV4} from './ConfigMigrationV4';
import {ConfigDataType} from '@/storage/DataType';
import {ModDAO} from '@/storage/dao/ModDAO';
import {DatabaseInitializer} from '@/storage/db/DatabaseInitializer';

/**
 * 配置迁移工具类
 * 负责将旧版本的JSON配置迁移到SQLite数据库
 * 使用新的DAO-based迁移方法
 */
export class MigrationBase {

    /**
     * 检查数据库是否已有数据
     */
    public static async hasExistingData(): Promise<boolean> {
        try {
            // 检查是否已有游戏、用户或模组数据
            const modDAO = new ModDAO();

            const [mods] = await Promise.all([
                modDAO.getAllMods()
            ]);

            // 如果任何表有数据，则认为不需要迁移
            console.log('检查到模组数量:', mods.length);
            return mods.length > 0;

        } catch (error) {
            console.error('检查现有数据失败:', error);
            // 出错时默认为没有数据，允许初始化继续进行
            // 这样可以避免在首次启动时因为表不存在而跳过初始化
            return false;
        }
    }

    /**
     * 检查是否需要迁移配置
     */
    public static async needsMigration(): Promise<boolean> {
        try {
            // 首先检查是否已有数据，如果有数据则不需要迁移
            if (await this.hasExistingData()) {
                console.log('数据库已有数据，跳过迁移');
                return false;
            }
            return true;
        } catch (error) {
            console.error('检查迁移需求失败:', error);
            return false;
        }
    }

    /**
     * 获取现有配置列表
     */
    public static async getExistingConfigList(): Promise<ConfigDataType[]> {
        const configs: ConfigDataType[] = [];

        try {
            // 检查各个版本的配置
            const v2Migration = new ConfigMigrationV2();
            const v2Config = await v2Migration.checkConfig();
            if (v2Config) configs.push(v2Config);

            const v3Migration = new ConfigMigrationV3();
            const v3Config = await v3Migration.checkConfig();
            if (v3Config) configs.push(v3Config);

            const v4Migration = new ConfigMigrationV4();
            const v4Config = await v4Migration.checkConfig();
            if (v4Config) configs.push(v4Config);

        } catch (error) {
            console.error('获取现有配置列表失败:', error);
        }

        return configs;
    }

    /**
     * 执行配置迁移
     */
    public static async migrateConfig(): Promise<boolean> {
        try {
            console.log('开始配置迁移...');

            // 获取所有可用的配置版本
            const existingConfigs = await this.getExistingConfigList();
            if (existingConfigs.length === 0) {
                console.log('没有找到需要迁移的配置');
                return true;
            }

            // 选择最新的配置版本进行迁移
            const latestConfig = existingConfigs.sort((a, b) => b.version.localeCompare(a.version))[0];
            console.log(`迁移配置版本: ${latestConfig.version}`);

            // 根据版本选择对应的迁移器
            let success = false;

            const normalizedVersion = latestConfig.version.startsWith('0.4') ? '0.4' : latestConfig.version;
            switch (normalizedVersion) {
                case '0.4': {
                    const v4Migration = new ConfigMigrationV4();
                    success = await v4Migration.migrate();
                    break;
                }
                case '0.3': {
                    const v3Migration = new ConfigMigrationV3();
                    success = await v3Migration.migrate();
                    break;
                }
                case '0.2': {
                    const v2Migration = new ConfigMigrationV2();
                    success = await v2Migration.migrate();
                    break;
                }
                default:
                    console.error(`不支持的配置版本: ${latestConfig.version}`);
                    return false;
            }

            if (success) {
                console.log('配置迁移完成');
            } else {
                console.error('配置迁移失败');
            }

            return success;
        } catch (error) {
            console.error('配置迁移失败:', error);
            return false;
        }
    }

    /**
     * 自动迁移 - 在应用启动时调用
     */
    public static async autoMigrate(): Promise<void> {
        try {
            const needsMigration = await this.needsMigration();

            if (needsMigration) {
                console.log('检测到需要迁移的配置，开始自动迁移...');
                const success = await this.migrateConfig();

                if (success) {
                    console.log('自动迁移成功');
                } else {
                    console.error('自动迁移失败');
                }
            } else {
                console.log('无需迁移配置');
            }

            // 迁移完成后，确保存在默认profile（如果没有profile的话）
            await DatabaseInitializer.ensureDefaultProfile();
        } catch (error) {
            console.error('自动迁移过程出错:', error);
            // 即使迁移出错，也尝试创建默认profile
            await DatabaseInitializer.ensureDefaultProfile();
        }
    }


}
