import { StorageAPI } from "@/storage";
import { CacheApi } from "@/apis/CacheApi";

export class AppService {
    public async getModioOAuth() {
        const auths = await StorageAPI.getOAuths();
        return await auths.getModioOAuth();
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

    public async setModioOAuth(userId: number, oauth: string): Promise<void> {
        const oauths = await StorageAPI.getOAuths();
        await oauths.setModioOAuth(userId, oauth);
    }

    public async getMintcatOAuth() {
        const auths = await StorageAPI.getOAuths();
        return await auths.getMintcatOAuth();
    }

    public async setMintcatOAuth(userId: number, oauth: string): Promise<void> {
        const oauths = await StorageAPI.getOAuths();
        await oauths.setMintcatOAuth(userId, oauth);
    }

    public async getActiveGame() {
        const game = await StorageAPI.getGames();
        return await game.getActiveGame();
    }
}
