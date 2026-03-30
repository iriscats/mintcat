import {settings} from '@/storage/db/Schema';
import {eq, and, desc, asc} from 'drizzle-orm';
import {getDb} from "@/storage/db/Client.ts";
import {
    clampBackgroundOpacity,
    DEFAULT_BACKGROUND_OPACITY,
    type BackgroundSourceType,
} from "@/types/ThemePackage.ts";


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

    public async getActiveThemePackageId(): Promise<string> {
        return this.getValue('ui.activeThemePackageId');
    }

    public async setActiveThemePackageId(value: string): Promise<void> {
        await this.setValue('ui.activeThemePackageId', value);
    }

    public async getBackgroundSourceType(): Promise<BackgroundSourceType> {
        const value = await this.getValue('ui.background.sourceType');
        if (value === '') {
            return 'none';
        }
        return value as BackgroundSourceType;
    }

    public async setBackgroundSourceType(value: BackgroundSourceType): Promise<void> {
        await this.setValue('ui.background.sourceType', value);
    }

    public async getBackgroundSourceValue(): Promise<string> {
        return this.getValue('ui.background.sourceValue');
    }

    public async setBackgroundSourceValue(value: string): Promise<void> {
        await this.setValue('ui.background.sourceValue', value);
    }

    public async getBackgroundOpacity(): Promise<number> {
        const value = await this.getValue('ui.background.opacity');
        if (value === '') {
            return DEFAULT_BACKGROUND_OPACITY;
        }

        return clampBackgroundOpacity(Number(value));
    }

    public async setBackgroundOpacity(value: number): Promise<void> {
        await this.setValue('ui.background.opacity', String(clampBackgroundOpacity(value)));
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
