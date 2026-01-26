import { remove } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { MigrationBase } from "@/storage/migration";
import { ConfigMigrationV2 } from "@/storage/migration/ConfigMigrationV2";
import { ConfigMigrationV3 } from "@/storage/migration/ConfigMigrationV3";
import { ConfigMigrationV4 } from "@/storage/migration/ConfigMigrationV4";
import type { ConfigDataType } from "@/storage/DataType";

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
        if (!config) return false;
        if (config.version === "0.4.0" || config.version === "0.4") {
            const v4 = new ConfigMigrationV4();
            return await v4.migrate();
        }
        if (config.version === "0.3") {
            const v3 = new ConfigMigrationV3();
            return await v3.migrate();
        }
        if (config.version === "0.2") {
            const v2 = new ConfigMigrationV2();
            return await v2.migrate();
        }
        return await MigrationBase.migrateConfig();
    }
}
