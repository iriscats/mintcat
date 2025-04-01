import {message} from "antd";
import {exists} from "@tauri-apps/plugin-fs";
import {path} from "@tauri-apps/api";
import {ConfigApi} from "../apis/ConfigApi.ts";
import {ModioApi} from "../apis/ModioApi.ts";
import {ModConfigConverter} from "./converter/ModConfigConverter.ts";
import {MOD_INVALID_ID, ModList, ModListItem} from "./config/ModList.ts";
import {ProfileList, ProfileTree, ProfileTreeItem, ProfileTreeType} from "./config/ProfileList.ts";
import {emit} from "@tauri-apps/api/event";


export class HomeViewModel {

    private static instance: HomeViewModel;

    private converter: ModConfigConverter = new ModConfigConverter();

    private updateViewCallback?: () => void;

    public get ModList(): ModList {
        return this.converter.modList;
    }

    public get ProfileList(): string[] {
        return this.converter.profileList.Profiles;
    }

    public get ActiveProfileName(): string {
        return this.converter.profileList.activeProfile;
    }

    public get ActiveProfile(): ProfileTree {
        return this.converter.profileTreeList.find(p => p.name === this.converter.profileList.activeProfile)!;
    }

    public set ActiveProfile(activeProfile: string) {
        this.converter.profileList.activeProfile = activeProfile;
        ConfigApi.saveProfileData(this.converter.profileList.toJson()).then(_ => {
        });
        this.updateViewCallback?.call(this);
    }

    private constructor() {
    }

    public setUpdateViewCallback(callback: () => void) {
        this.updateViewCallback = callback;
    }

    public async addModFromUrl(url: string, groupId: number): Promise<void> {
        await emit("status-bar-log", "Fetch mod info...");

        const resp = await ModioApi.getModInfoByLink(url);
        const modItem = new ModListItem(resp);
        if (this.ModList.checkIsExist(modItem)) {
            message.error("Mod already exists");
            return;
        }

        const addedModItem = this.ModList.add(modItem);
        this.ActiveProfile.addMod(addedModItem.id, groupId);

        await ConfigApi.saveModListData(this.ModList.toJson());
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
        this.updateViewCallback?.call(this);

        await this.updateMod(addedModItem);
    }

    public async addModFromPath(modPath: string, groupId: number): Promise<void> {
        let modListItem = new ModListItem();
        modListItem.displayName = await path.basename(modPath);
        modListItem.url = modPath;
        modListItem.cachePath = modPath;
        if (this.ModList.checkIsExist(modListItem)) {
            message.error("Mod already exists");
            return;
        }

        const addedModItem = this.ModList.add(modListItem);
        this.ActiveProfile.addMod(addedModItem.id, groupId);

        await ConfigApi.saveModListData(this.ModList.toJson());
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
        this.updateViewCallback?.call(this);
    }

    private sortNode(modItem: ProfileTreeItem, order: string): ProfileTreeItem[] {
        return modItem.children.sort((a, b) => {
            if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.ITEM) {
                const modA = this.ModList.get(a.id);
                const modB = this.ModList.get(b.id);
                if (order === "asc") {
                    return modA.displayName.localeCompare(modB.displayName);
                } else {
                    return modA.displayName.localeCompare(modB.displayName) * -1;
                }
            } else if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.FOLDER) {
                return -1;
            } else if (a.type === ProfileTreeType.FOLDER && b.type === ProfileTreeType.ITEM) {
                return 1;
            }
        })
    }

    public async sortMods(order: string): Promise<void> {
        if (this.ActiveProfile.ModioFolder) {
            this.ActiveProfile.ModioFolder.children = this.sortNode(this.ActiveProfile.ModioFolder, order);
        }
        if (this.ActiveProfile.LocalFolder) {
            this.ActiveProfile.LocalFolder.children = this.sortNode(this.ActiveProfile.LocalFolder, order);
        }
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
    }

    public async removeMod(id: number): Promise<void> {
        this.ModList.remove(id);
        this.ActiveProfile.removeMod(id);

        await ConfigApi.saveModListData(this.ModList.toJson());
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());

        this.updateViewCallback?.call(this);
        this.updateViewCallback?.call(this);
    }

    public async addProfile(name: string): Promise<void> {
        this.converter.profileList.add(name);

        await ConfigApi.saveProfileData(this.converter.profileList.toJson());
    }

    public async removeProfile(name: string): Promise<void> {
        this.converter.profileList.remove(name);

        await ConfigApi.saveProfileData(this.converter.profileList.toJson());
        //TODO remove profile details

    }

    public async renameProfile(oldName: string, newName: string): Promise<void> {
        this.converter.profileList.rename(oldName, newName);

        await ConfigApi.saveProfileData(this.converter.profileList.toJson());
    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.displayName = name;
        }

        await ConfigApi.saveModListData(this.ModList.toJson());
        this.updateViewCallback?.call(this);
    }

    public async setModEnabled(id: number, enable: boolean): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.enabled = enable;
        }
        await ConfigApi.saveModListData(this.ModList.toJson());
        this.updateViewCallback?.call(this);
    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.usedVersion = version;
        }

        await ConfigApi.saveModListData(this.ModList.toJson());
        this.updateViewCallback?.call(this);
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        this.ActiveProfile.setGroupName(id, name);

        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
        this.updateViewCallback?.call(this);
    }

    public async setProfileData(root: ProfileTreeItem): Promise<void> {
        this.ActiveProfile.root = root;
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
    }

    public async addGroup(groupId: number, groupName: string): Promise<void> {
        this.ActiveProfile.addGroup(groupName, groupId);

        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
        this.updateViewCallback?.call(this);
    }

    public async removeGroup(groupId: number): Promise<void> {
        this.ActiveProfile.removeGroup(groupId);

        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
        this.updateViewCallback?.call(this);
    }

    public async updateMod(mod: ModListItem) {
        const resp = await ModioApi.getModInfoByLink(mod.url);
        let newItem = new ModListItem(resp);
        if (resp) {
            this.ModList.update(mod, newItem);
            this.updateViewCallback?.call(this);
        }

        await emit("status-bar-log", "Update Mod: " + mod.displayName);
        newItem = await ModioApi.downloadModFile(newItem, async (loaded: number, total: number) => {
            await emit("status-bar-log", `Download Mod: ${mod.displayName} (${loaded} / ${total})`);
            newItem.downloadProgress = (loaded / total) * 100;
            this.ModList.update(mod, newItem);
            this.updateViewCallback?.call(this);
        });

        this.ModList.update(mod, newItem);
        await ConfigApi.saveModListData(this.ModList.toJson());
        await emit("status-bar-log", "Update Finish");
    }

    public async checkLocalMod(modItem: ModListItem) {
        if (modItem.isLocal === true && modItem.enabled === true) {
            if (!await exists(modItem.cachePath)) {
                message.error("Mod 文件不存在: " + modItem.cachePath);
                return false;
            }
        }
    }

    public async updateModList(isRefresh = false): Promise<void> {
        for (const mod of this.ModList.Mods) {
            if (isRefresh) {
                if (mod.url.startsWith("http")) {
                    await this.updateMod(mod);
                } else {
                    await this.checkLocalMod(mod);
                }
            } else {
                if (mod.modId === MOD_INVALID_ID && mod.url.startsWith("http")) {
                    await this.updateMod(mod);
                }
            }
        }
    }

    public async loadConfig() {
        try {
            let config = await ConfigApi.loadModListData();
            this.converter.modList = ModList.fromJson(config);
            this.converter.profileList = ProfileList.fromJson(await ConfigApi.loadProfileData());
            for (const profile of this.converter.profileList.Profiles) {
                const profileDetailData = await ConfigApi.loadProfileDetails(profile);
                if (profileDetailData) {
                    this.converter.profileTreeList.push(ProfileTree.fromJson(profileDetailData));
                }
            }
        } catch (err) {
            message.error("初始化 Mod 列表失败");
            this.converter.createDefault()
        }
    }

    public async loadOldConfig() {
        try {
            const config = await ConfigApi.loadModListDataV1();
            await this.converter.convertTo(config);
            await ConfigApi.saveModListData(this.converter.modList.toJson());
            await ConfigApi.saveProfileData(this.converter.profileList.toJson());
            for (const profile of this.converter.profileList.Profiles) {
                await ConfigApi.saveProfileDetails(profile,
                    this.converter.profileTreeList.find(p => p.name === profile)!.toJson());
            }
        } catch (e) {
            this.converter.createDefault();
        }
    }

    public static async getInstance() {
        if (HomeViewModel.instance) {
            return HomeViewModel.instance;
        }
        HomeViewModel.instance = new HomeViewModel();
        return HomeViewModel.instance;
    }

}

