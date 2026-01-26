import { remove } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { MigrationBase } from "@/storage/migration";

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
}
