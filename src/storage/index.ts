import {path} from "@tauri-apps/api";
import {appConfigDir, configDir} from "@tauri-apps/api/path";
import {BaseDirectory, exists, readTextFile, writeTextFile, mkdir} from '@tauri-apps/plugin-fs';
import {ConfigDataType} from "@/storage/DataType.ts";
import {ConfigV4} from "@/storage/model/ConfigV4.ts";
import {ConfigV2} from "@/storage/model/ConfigV2.ts";
import {ConfigV3} from "@/storage/model/ConfigV3.ts";
import {ConfigV5} from "@/storage/model/ConfigV5.ts";
import {setting} from "@/storage/dao/SettingDAO.ts";
import {GameDAO} from "@/storage/dao/GameDAO.ts";
import {UserDAO} from "@/storage/dao/UserDAO.ts";
import {ProfileDAO} from "@/storage/dao/ProfileDAO.ts";
import {ModDAO} from "@/storage/dao/ModDAO.ts";
import {OAuthDAO} from "@/storage/dao/OAuthDAO.ts";
import {DatabaseInitializer} from "@/storage/db/DatabaseInitializer.ts";
import {message} from "antd";
import {t} from "i18next";

/**
 * 存储层 API
 * 提供对配置、游戏、用户、配置文件、模组和OAuth的访问
 */

export class StorageAPI {

    private static instance: StorageAPI;
    public settings: any = setting;
    public games: GameDAO = new GameDAO();
    public users: UserDAO = new UserDAO();
    public profiles: ProfileDAO = new ProfileDAO();
    public mods: ModDAO = new ModDAO();
    public oauths: OAuthDAO = new OAuthDAO();

    private constructor() {
    }

    public static getInstance(): StorageAPI {
        return this.instance;
    }

    public async initDB(){
        // 首先初始化数据库
        const dbInitialized = await DatabaseInitializer.initializeDatabase();
        if (!dbInitialized) {
            message.error(t("Database initialization failed"));
            return;
        }

        // 检查数据库连接
        const dbConnected = await DatabaseInitializer.checkDatabaseConnection();
        if (!dbConnected) {
            message.error(t("Database connection failed"));
            return;
        }
    }

    public async getConfigPath() {
        return await appConfigDir();
    }

    public async readDataToFile(fileName: string): Promise<string> {
        try {
            return await readTextFile(fileName, {
                baseDir: BaseDirectory.AppConfig,
            });
        } catch (error) {
            console.error(`Failed to read file ${fileName}: ${error}`);
            return undefined;
        }
    }

    public async saveDataToFile(fileName: string, data: string): Promise<boolean> {
        try {
            const configDir = await Index.getConfigPath();
            if (!await exists(configDir)) {
                await mkdir(configDir)
            }
            await writeTextFile(fileName, data, {
                baseDir: BaseDirectory.AppConfig,
            });
            return true;
        } catch (error) {
            console.error(`Failed to write file ${fileName}: ${error}`);
        }
        return false;
    }

    private async getModListDataV1Path(): Promise<string> {
        let oldFilePath = await path.join(await configDir(), "drg-mod-integration", "config", "mod_data.json"); // 0.2
        if (!await exists(oldFilePath)) {
            oldFilePath = await path.join(await configDir(), "mint", "config", "mod_data.json"); // 0.3
        }
        return oldFilePath;
    }

    private async getSettingV1Path(): Promise<string> {
        let oldFilePath = await path.join(await configDir(), "drg-mod-integration", "config", "config.json"); // 0.2
        if (!await exists(oldFilePath)) {
            oldFilePath = await path.join(await configDir(), "mint", "config", "config.json"); // 0.3
        }
        return oldFilePath;
    }

    public async readTextFile(path: string): Promise<string> {
        try {
            return await readTextFile(path);
        } catch (error) {
            console.error(error);
        }
    }

    public async loadSettingV1(): Promise<string> {
        try {
            return await readTextFile(await this.getSettingV1Path());
        } catch (error) {
            console.error(error);
        }
    }

    public async importConfig(configData: ConfigDataType) {
        let config: IConfig;
        switch (configData.version) {
            case "0.2.0":
                config = new ConfigV2();
                break;
            case "0.3.0":
                config = new ConfigV3();
                break;
            case "0.4.0":
                config = new ConfigV4();
                break;
            case "0.5.0":
            default:
                config = new ConfigV5();
                break;
        }
        await config.loadConfig();
    }

    public async loadModioUserData(): Promise<string> {
        const fileName = "user.json";
        const oldFilePath = "C:\\Users\\-\\AppData\\Local\\mod.io\\2475\\S-1-5-21-1688096665-3863216114-603340213-1000\\user.json";

        return await this.readDataToFile(fileName);
    }

}

