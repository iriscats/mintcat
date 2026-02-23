import { t } from "i18next";
import i18n from "@/locales/i18n";
import { appCacheDir, appConfigDir } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { IntegrateApi } from "@/apis/IntegrateApi.ts";
import { ModUpdateService } from "@/services/ModUpdateService.ts";
import { exists } from "@tauri-apps/plugin-fs";
import { emitEvent, emitVoidEvent } from "@/events";
import { DeviceApi } from "@/apis/DeviceApi.ts";
import { BaseViewModel } from "@/core/BaseViewModel";
import { AppService } from "@/services/AppService.ts";

/**
 * AppViewModel manages application-level state and business logic
 * Handles user settings, language, theme, OAuth, and game info
 */
export class AppViewModel extends BaseViewModel {
    private appService = new AppService();

    constructor() {
        super();
    }

    public async checkOauth() {
        const modioOAuth = await this.appService.getOAuthByPlatform('mod.io');

        if (modioOAuth?.oauth !== "") {
            this.appStartAutoCheckModUpdate();
        } else {
            await emitEvent("app-error", t("mod.io OAuth No Found"));
        }
    }

    public async checkAppPath() {
        try {
            const cachePath = await this.appService.getCachePath();
            if (cachePath === "" || !(await exists(cachePath))) {
                await this.appService.setCachePath(await appCacheDir());
            }
            const configPath = await this.appService.getConfigPath();
            if (configPath === "" || !(await exists(configPath))) {
                await this.appService.setConfigPath(await appConfigDir());
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
        let language = await this.appService.getLanguage();
        if (language === "") {
            language = await DeviceApi.getLanguage();
        }
        localStorage.setItem('lang', language);
        await i18n.changeLanguage(language);
        await this.appService.setLanguage(language);
    }

    public async loadUserGuiTheme() {
        let guiTheme = await this.appService.getGuiTheme();
        if (guiTheme === "") {
            guiTheme = "Light";
            await this.appService.setGuiTheme(guiTheme);
        }
        await emitEvent("theme-change", guiTheme as 'Light' | 'Dark' | 'Pink');
    }

    public async loadUserInfo() {
        const activeUser = await this.appService.getActiveUser();
        if (activeUser) {
            await emitEvent("user-info-load-success", activeUser);
        }
    }

    public async loadGameInfo() {
        const activeGame = await this.appService.getActiveGame();
        console.log("activeGame", activeGame);
        if (activeGame) {
            await emitEvent("game-info-load-success", activeGame);
        }
    }

    private async saveAppVersion() {
        const currentVersion = await getVersion();
        await this.appService.setAppVersion(currentVersion);
    }

    /**
     * Initialize AppViewModel
     * Loads user settings, checks paths, and initializes UI state
     * Note: Data migration is handled by AppInitializer before this runs
     */
    async initialize(): Promise<void> {
        await this.loadUserLanguages();
        await this.loadUserGuiTheme();
        await this.loadUserInfo();
        await this.loadGameInfo();
        await this.checkAppPath();
        //await this.checkOauth();
        //await IntegrateApi.checkGamePath();
        await this.saveAppVersion();

        await emitVoidEvent("title-bar-load-avatar");
        // 首次启动引导（配置导入→游戏选择→用户设置）由 App 根据 getOnboardingCompleted() 统一触发

        this.initialized = true;
    }
}
