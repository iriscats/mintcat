import { remove } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { MigrationBase } from "@/storage/migration";
import { ConfigMigrationV2 } from "@/storage/migration/ConfigMigrationV2";
import { ConfigMigrationV3 } from "@/storage/migration/ConfigMigrationV3";
import { ConfigMigrationV4 } from "@/storage/migration/ConfigMigrationV4";
import type { ConfigDataType } from "@/storage/DataType";
import { getDb } from "@/storage/db/Client";
import { mods, modVersions, modDownloads, modStatus, profiles, profileFolders, profileMods, oauths } from "@/storage/db/Schema";

export class DialogConfigService {
    public async getExistingConfigList() {
        return await MigrationBase.getExistingConfigList();
    }

    public async deleteConfigPath(path: string): Promise<void> {
        await remove(path, { recursive: true });
    }

    public async openPath(path: string): Promise<void> {
        await openPath(path);
    }

    public async importConfig(config: ConfigDataType): Promise<boolean> {
        if (!config) 
            return false;
        
        let success = false;
        
        try {
            if (config.version === "0.4") {
                const v4 = new ConfigMigrationV4();
                success = await v4.migrate();
            } else if (config.version === "0.3") {
                const v3 = new ConfigMigrationV3();
                success = await v3.migrate();
            } else if (config.version === "0.2") {
                const v2 = new ConfigMigrationV2();
                success = await v2.migrate();
            } else {
                success = await MigrationBase.migrateConfig();
            }
        } catch (error) {
            console.error('[DialogConfigService] 导入配置时发生错误:', error);
            success = false;
        }
        
        // 如果导入失败，清理部分写入的数据，避免数据不一致
        if (!success) {
            console.log('[DialogConfigService] 导入失败，清理部分数据...');
            await this.cleanupPartialData();
        }
        
        return success;
    }

    /**
     * 清理导入失败后的部分数据
     * 删除 profile 相关数据和 mod 相关数据，避免出现空的分组
     */
    private async cleanupPartialData(): Promise<void> {
        try {
            const db = await getDb();
            console.log('[DialogConfigService] 开始清理部分导入的数据...');

            // 按外键依赖顺序删除：先删除依赖表，再删除被依赖表
            // 1. 删除 profile 相关数据
            await db.delete(profileMods);
            console.log('[DialogConfigService] 已清空 profileMods 表');

            await db.delete(profileFolders);
            console.log('[DialogConfigService] 已清空 profileFolders 表');

            await db.delete(profiles);
            console.log('[DialogConfigService] 已清空 profiles 表');

            // 2. 删除 mod 相关数据
            await db.delete(modStatus);
            console.log('[DialogConfigService] 已清空 modStatus 表');

            await db.delete(modDownloads);
            console.log('[DialogConfigService] 已清空 modDownloads 表');

            await db.delete(modVersions);
            console.log('[DialogConfigService] 已清空 modVersions 表');

            await db.delete(mods);
            console.log('[DialogConfigService] 已清空 mods 表');

            // 3. 删除 oauth 数据
            await db.delete(oauths);
            console.log('[DialogConfigService] 已清空 oauths 表');

            console.log('[DialogConfigService] 部分数据清理完成');
        } catch (error) {
            console.error('[DialogConfigService] 清理部分数据失败:', error);
        }
    }
}
