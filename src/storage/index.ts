import {SettingDAO} from "@/storage/dao/SettingDAO.ts";
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

    private static instance: StorageAPI = undefined;
    private games: GameDAO = new GameDAO();
    private users: UserDAO = new UserDAO();
    private profiles: ProfileDAO = new ProfileDAO();
    private mods: ModDAO = new ModDAO();
    private oauths: OAuthDAO = new OAuthDAO();
    private settings: SettingDAO = new SettingDAO();

    private constructor() {
    }

    public static async getSettings(): Promise<SettingDAO> {
        const storage = await StorageAPI.getInstance();
        return storage.settings;
    }

    public static async getOAuths(): Promise<OAuthDAO> {
        const storage = await StorageAPI.getInstance();
        return storage.oauths;
    }

    public static async getGames(): Promise<GameDAO> {
        const storage = await StorageAPI.getInstance();
        return storage.games;
    }

    public static async getUsers(): Promise<UserDAO> {
        const storage = await StorageAPI.getInstance();
        return storage.users;
    }

    public static async getProfiles(): Promise<ProfileDAO> {
        const storage = await StorageAPI.getInstance();
        return storage.profiles;
    }

    public static async getMods(): Promise<ModDAO> {
        const storage = await StorageAPI.getInstance();
        return storage.mods;
    }

    public static async getInstance(): Promise<StorageAPI> {
        if (this.instance) {
            return this.instance;
        }
        this.instance = new StorageAPI();
        await this.instance.initDB();
        return this.instance;
    }

    public async initDB() {
        const dbInitialized = await DatabaseInitializer.initializeDatabase();
        if (!dbInitialized) {
            message.error(t("Database initialization failed"));
            return;
        }
    }


}

