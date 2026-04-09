import {settings} from '@/storage/db/Schema';
import {eq, and, desc, asc} from 'drizzle-orm';
import {getDb} from "@/storage/db/Client.ts";
import {
    DEFAULT_RELEASE_CHANNEL,
    normalizeReleaseChannel,
    type ReleaseChannel,
} from '@/apis/mintcat/releaseChannel';
import {
    NETWORK_MINTCAT_PROXY_MODE_KEY,
    normalizeMintcatProxyMode,
    type MintcatProxyMode,
} from '@/services/network';


export interface SettingData {
    id?: number;
    name: string;
    value?: string;
    createdAt?: Date;
    updatedAt?: Date;
}


export class SettingDAO {

    public async getCachePath(): Promise<string> {
        return this.getValue('cachePath');
    }

    public async setCachePath(value: string): Promise<void> {
        await this.setValue('cachePath', value);
    }

    public async getConfigPath(): Promise<string> {
        return this.getValue("configPath");
    }

    public async setConfigPath(value: string): Promise<void> {
        await this.setValue("configPath", value);
    }

    public async getLanguage(): Promise<string> {
        return this.getValue('language');
    }

    public async setLanguage(value: string): Promise<void> {
        await this.setValue('language', value);
    }

    public async getGuiTheme(): Promise<string> {
        return this.getValue('guiTheme');
    }

    public async setGuiTheme(value: string): Promise<void> {
        await this.setValue('guiTheme', value);
    }

    public async getAppVersion(): Promise<string> {
        return this.getValue('appVersion');
    }

    public async setAppVersion(value: string): Promise<void> {
        await this.setValue('appVersion', value);
    }

    public async getClipboardMonitorEnabled(): Promise<boolean> {
        const value = await this.getValue('clipboardMonitor');
        // 默认启用
        if (value === '') return true;
        return value === 'true';
    }

    public async setClipboardMonitorEnabled(enabled: boolean): Promise<void> {
        await this.setValue('clipboardMonitor', enabled ? 'true' : 'false');
    }

    public async getReleaseChannel(): Promise<ReleaseChannel> {
        const value = await this.getValue('releaseChannel');
        if (value === '') {
            return DEFAULT_RELEASE_CHANNEL;
        }
        return normalizeReleaseChannel(value);
    }

    public async setReleaseChannel(value: ReleaseChannel | string): Promise<void> {
        await this.setValue('releaseChannel', normalizeReleaseChannel(value));
    }

    public async getNetworkProxy(): Promise<string> {
        return this.getValue('network.proxy');
    }

    public async setNetworkProxy(value: string): Promise<void> {
        await this.setValue('network.proxy', value);
    }

    public async getMintcatProxyMode(): Promise<MintcatProxyMode> {
        const value = await this.getValue(NETWORK_MINTCAT_PROXY_MODE_KEY);
        return normalizeMintcatProxyMode(value);
    }

    public async setMintcatProxyMode(value: MintcatProxyMode | string): Promise<void> {
        await this.setValue(NETWORK_MINTCAT_PROXY_MODE_KEY, normalizeMintcatProxyMode(value));
    }

    public async getValue(name: string): Promise<string> {
        try {
            const db = await getDb();
            const result: any[] = await db.select()
                .from(settings)
                .where(eq(settings.name, name))
                .limit(1);

            if (result.length === 0) {
                return "";
            }
            return result[0].value;
        } catch (error) {
            console.error(`根据名称获取设置失败 [名称: ${name}]:`, error);
            throw error;
        }
    }

    public async setValue(name: string, value: string): Promise<void> {
        try {
            const db = await getDb();
            await db.insert(settings).values({
                name,
                value,
            }).onConflictDoUpdate({
                target: settings.name,
                set: {
                    value,
                    updatedAt: new Date(),
                }
            });
        } catch (error) {
            console.error(`设置值失败 [名称: ${name}]:`, error);
            throw error;
        }
    }


}


