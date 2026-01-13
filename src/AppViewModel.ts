import {t} from "i18next";
import i18n from "@/locales/i18n";
import {appCacheDir, appConfigDir} from '@tauri-apps/api/path';
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {ModUpdateService} from "@/services/ModUpdateService.ts";
import {exists} from "@tauri-apps/plugin-fs";
import {emitEvent, emitVoidEvent} from "@/events";
import {DeviceApi} from "@/apis/DeviceApi.ts";
import {StorageAPI} from "@/storage";
import {BaseViewModel} from "@/core/BaseViewModel";

/**
 * AppViewModel manages application-level state and business logic
 * Handles user settings, language, theme, OAuth, and game info
 */
export class AppViewModel extends BaseViewModel {

    private static instance: AppViewModel;

    /**
     * Shared lock instance for thread-safe singleton initialization
     */
    private static lockInstance = new class extends BaseViewModel {}();

    private constructor() {
        super();
    }

    public async checkOauth() {
        const auths = await StorageAPI.getOAuths();
        const modioOAuth = await auths.getModioOAuth();

        if (modioOAuth?.oauth !== "") {
            this.appStartAutoCheckModUpdate();
        } else {
            await emitEvent("app-error", t("mod.io OAuth No Found"));
        }
    }

    public async checkAppPath() {
        const settings = await StorageAPI.getSettings();
        try {
            const cachePath = await settings.getCachePath();
            console.log(cachePath)
            if (cachePath === "" || !await exists(cachePath)) {
                await settings.setCachePath(await appCacheDir());
            }
            const configPath = await settings.getConfigPath();
            if (configPath === "" || !await exists(configPath)) {
                await settings.setConfigPath(await appConfigDir());
            }
        } catch (err) {
            console.warn(err);
            await emitEvent("app-error", t("No Permission To Access the Config Folder"));
        }
    }

    public appStartAutoCheckModUpdate() {
        setTimeout(async () => {
            await ModUpdateService.checkModUpdate();
        }, 1000 * 120);
    }

    public async loadUserLanguages() {
        const settings = await StorageAPI.getSettings();
        let language = await settings.getLanguage();
        if (language === "") {
            language = await DeviceApi.getLanguage();
        }
        localStorage.setItem('lang', language);
        await i18n.changeLanguage(language);
        await settings.setLanguage(language);
    }

    public async loadUserGuiTheme() {
        const settings = await StorageAPI.getSettings();
        let guiTheme = await settings.getGuiTheme();
        if (guiTheme === "") {
            guiTheme = "Light";
            await settings.setGuiTheme(guiTheme);
        }
        await emitEvent("theme-change", guiTheme as 'Light' | 'Dark' | 'Pink');
    }

    public async loadUserInfo() {
        const user = await StorageAPI.getUsers();
        const activeUser = await user.getActiveUser();
        if (activeUser) {
            await emitEvent("user-info-load-success", activeUser);
        }
    }

    public async loadGameInfo() {
        const game = await StorageAPI.getGames();
        const activeGame = await game.getActiveGame();
        console.log("activeGame", activeGame);
        if (activeGame) {
            await emitEvent("game-info-load-success", activeGame);
        }
    }

    /**
     * Initialize AppViewModel
     * Loads user settings, checks paths, and initializes UI state
     * Note: Data migration is handled by AppInitializer before this runs
     */
    protected async initialize(): Promise<void> {
        await this.loadUserLanguages();
        await this.loadUserGuiTheme();
        await this.loadUserInfo();
        await this.loadGameInfo();
        await this.checkAppPath();
        await this.checkOauth();
        await IntegrateApi.checkGamePath();

        await emitVoidEvent("title-bar-load-avatar");
        if (await DeviceApi.isFirstRun()) {
            await emitVoidEvent("config-manage-dialog-open");
        }

        this.initialized = true;
    }

    /**
     * @deprecated Use getInstance() which calls initialize() automatically
     * Kept for backward compatibility during migration
     */
    public async initAppViewModel(): Promise<void> {
        await this.initialize();
    }

    /**
     * Get singleton instance of AppViewModel
     * Thread-safe with initialization lock
     *
     * @returns AppViewModel instance
     */
    public static async getInstance(): Promise<AppViewModel> {
        const release = await this.lockInstance.acquireLock();
        try {
            if (!AppViewModel.instance) {
                const appViewModel = new AppViewModel();
                await appViewModel.initialize();
                AppViewModel.instance = appViewModel;
            }
            return AppViewModel.instance;
        } finally {
            release();
        }
    }

}