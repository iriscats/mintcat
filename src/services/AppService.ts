import { StorageAPI } from "@/storage";
import { CacheApi } from "@/apis/CacheApi";

export class AppService {
    /**
     * 获取当前活跃用户指定平台的 OAuth
     * @param platform 平台名称 (如 'mod.io', 'mintcat' 等)
     */
    public async getOAuthByPlatform(platform: string) {
        const auths = await StorageAPI.getOAuths();
        return await auths.getActiveUserOAuthByPlatform(platform);
    }

    /**
     * 设置指定用户指定平台的 OAuth
     * @param userId 用户ID
     * @param platform 平台名称
     * @param oauth OAuth令牌
     */
    public async setOAuth(userId: number, platform: string, oauth: string): Promise<void> {
        const oauths = await StorageAPI.getOAuths();
        await oauths.upsertOAuth(userId, platform, oauth);
    }

    public async getCachePath(): Promise<string> {
        const settings = await StorageAPI.getSettings();
        return await settings.getCachePath();
    }

    public async setCachePath(path: string): Promise<void> {
        const settings = await StorageAPI.getSettings();
        await settings.setCachePath(path);
        CacheApi.clearCache();
    }

    public async getConfigPath(): Promise<string> {
        const settings = await StorageAPI.getSettings();
        return await settings.getConfigPath();
    }

    public async setConfigPath(path: string): Promise<void> {
        const settings = await StorageAPI.getSettings();
        await settings.setConfigPath(path);
    }

    public async getLanguage(): Promise<string> {
        const settings = await StorageAPI.getSettings();
        return await settings.getLanguage();
    }

    public async setLanguage(language: string): Promise<void> {
        const settings = await StorageAPI.getSettings();
        await settings.setLanguage(language);
    }

    public async getGuiTheme(): Promise<string> {
        const settings = await StorageAPI.getSettings();
        return await settings.getGuiTheme();
    }

    public async setGuiTheme(guiTheme: string): Promise<void> {
        const settings = await StorageAPI.getSettings();
        await settings.setGuiTheme(guiTheme);
    }

    public async getActiveThemePackageId(): Promise<string> {
        const settings = await StorageAPI.getSettings();
        return await settings.getActiveThemePackageId();
    }

    public async setActiveThemePackageId(themePackageId: string): Promise<void> {
        const settings = await StorageAPI.getSettings();
        await settings.setActiveThemePackageId(themePackageId);
    }

    public async getAppVersion(): Promise<string> {
        const settings = await StorageAPI.getSettings();
        return await settings.getAppVersion();
    }

    public async setAppVersion(version: string): Promise<void> {
        const settings = await StorageAPI.getSettings();
        await settings.setAppVersion(version);
    }

    public async getActiveUser() {
        const user = await StorageAPI.getUsers();
        return await user.getActiveUser();
    }

    public async getActiveGame() {
        const game = await StorageAPI.getGames();
        return await game.getActiveGame();
    }
}
