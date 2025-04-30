import {message} from "antd";
import {t} from "i18next";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {path} from "@tauri-apps/api";
import {emit} from "@tauri-apps/api/event";
import {ConfigApi} from "@/apis/ConfigApi.ts";
import {ModioApi} from "@/apis/ModioApi.ts";
import {ModConfigConverter} from "./converter/ModConfigConverter.ts";
import {ModList, ModListItem} from "./config/ModList.ts";
import {
    ProfileList,
    ProfileTree,
    ProfileTreeGroupType,
    ProfileTreeItem,
    ProfileTreeType
} from "./config/ProfileList.ts";
import {ModUpdateApi} from "@/apis/ModUpdateApi.ts";


export class HomeViewModel {

    private static instance: HomeViewModel;

    private converter: ModConfigConverter = new ModConfigConverter();

    private updateTreeViewCallback?: () => void;

    private updateSelectCallback?: () => void;

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

        this.updateTreeViewCallback?.call(this);
        ConfigApi.saveProfileData(this.converter.profileList.toJson()).then();
    }

    private constructor() {
    }

    private async addModDependencies(modList: ModList, modId: number, groupId: number): Promise<void> {
        await emit("status-bar-log", t("Fetch Mod Dependencies"));

        const depends = await ModioApi.getDependencies(modId);
        for (const depend of depends) {
            const modItem = new ModListItem(depend);
            if (modList.getByModId(modItem.modId)) {
                continue;
            }

            const addedModItem = this.ModList.add(modItem);
            this.ActiveProfile.addMod(addedModItem.id, groupId);
            this.updateTreeViewCallback?.call(this);
            await ModUpdateApi.updateMod(addedModItem);
        }
    }

    public async addModFromUrl(url: string, groupId: number): Promise<boolean> {
        await emit("status-bar-log", t("Fetch Mod Info"));

        const resp = await ModioApi.getModInfoByLink(url);
        if (resp === undefined) {
            return false;
        }

        const modItem = new ModListItem(resp);
        const subModList = this.ActiveProfile.getModList(this.ModList);
        if (subModList.getByModId(modItem.modId)) {
            message.warning(`${t("Mod Already Exists")} ${modItem.nameId}`);
            return true;
        }

        const addedModItem = this.ModList.add(modItem);
        this.ActiveProfile.addMod(addedModItem.id, groupId);
        this.updateTreeViewCallback?.call(this);
        await ModUpdateApi.updateMod(addedModItem);

        if (resp.dependencies) {
            await this.addModDependencies(subModList, resp.id, groupId);
        }

        await ConfigApi.saveModListData(this.ModList.toJson());
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile);

        return true;
    }

    public async addModFromPath(modPath: string, groupId: number): Promise<boolean> {
        let modListItem = new ModListItem();
        modListItem.displayName = await path.basename(modPath);
        modListItem.url = modPath;
        modListItem.cachePath = modPath;
        if (!await exists(modPath)) {
            message.warning(t("Mod Path No Exists" + modPath));
            return true;
        }

        const subModList = this.ActiveProfile.getModList(this.ModList);
        if (subModList.getByUrl(modPath)) {
            message.error(t("Mod Already Exists"));
            return false;
        }

        const fileInfo = await stat(modPath);
        modListItem.lastUpdateDate = fileInfo.mtime.getTime();

        const foundItem = this.ModList.getByUrl(modPath);
        let addedModItem: ModListItem;
        if (foundItem) {
            addedModItem = foundItem;
        } else {
            addedModItem = this.ModList.add(modListItem);
        }
        this.ActiveProfile.addMod(addedModItem.id, groupId);

        this.updateTreeViewCallback?.call(this);
        await ConfigApi.saveModListData(this.ModList.toJson());
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile);

        return true;
    }

    private sortNode(modItem: ProfileTreeItem, order: string): ProfileTreeItem[] {
        return modItem.children.sort((a, b) => {
            if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.ITEM) {
                const modA = this.ModList.get(a.id);
                const modB = this.ModList.get(b.id);
                if (order === "asc") {
                    return modA.displayName.localeCompare(modB.displayName);
                } else if (order === "desc") {
                    return modA.displayName.localeCompare(modB.displayName) * -1;
                } else if (order === "time") {
                    return modA.lastUpdateDate > modB.lastUpdateDate ? 1 : -1;
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
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile);
    }

    public async removeMod(id: number): Promise<void> {
        this.ActiveProfile.removeMod(id);
        this.updateTreeViewCallback?.call(this);
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile);
    }

    public async addProfile(name: string, data: string): Promise<void> {
        const profileTree = ProfileTree.fromJson(data);
        profileTree.name = name;

        this.converter.profileList.add(name);
        this.converter.profileTreeList.push(profileTree);

        this.updateSelectCallback?.call(this);
        await ConfigApi.saveProfileData(this.converter.profileList.toJson());
        await ConfigApi.saveProfileDetails(name, profileTree);
    }

    public async removeProfile(name: string): Promise<void> {
        if (this.converter.profileList.Profiles.length <= 1) {
            message.error(t("Profile must have at least one profile"));
            return;
        }
        this.converter.profileList.remove(name);

        await ConfigApi.deleteProfileDetails(name);
        await ConfigApi.saveProfileData(this.converter.profileList.toJson());

        this.updateSelectCallback?.call(this);
        this.updateTreeViewCallback?.call(this);
    }

    public async renameProfile(oldName: string, newName: string): Promise<void> {
        this.converter.profileList.rename(oldName, newName);
        await ConfigApi.saveProfileData(this.converter.profileList.toJson());

        const profileTree = this.converter.profileTreeList.find(p => p.name === oldName);
        profileTree.name = newName;

        this.updateSelectCallback?.call(this);

        await ConfigApi.saveProfileDetails(newName, profileTree);
        await ConfigApi.renameProfileDetails(oldName, newName);
    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.displayName = name;
        }

        this.updateTreeViewCallback?.call(this);
        await ConfigApi.saveModListData(this.ModList.toJson());
    }

    public async setModEnabled(id: number, enable: boolean): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.enabled = enable;
        }
        await ConfigApi.saveModListData(this.ModList.toJson());
        //this.updateTreeViewCallback?.call(this);

        // update edit time
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile);
    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.usedVersion = version;
        }
        // this.updateTreeViewCallback?.call(this);

        await ConfigApi.saveModListData(this.ModList.toJson());
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        this.ActiveProfile.setGroupName(id, name);

        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile);
        this.updateTreeViewCallback?.call(this);
    }

    public async setProfileData(root: ProfileTreeItem): Promise<void> {
        this.ActiveProfile.root = root;
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile);
    }

    public async addGroup(parentGroupId: number, groupName: string): Promise<void> {
        this.ActiveProfile.addGroup(groupName, parentGroupId);

        this.updateTreeViewCallback?.call(this);
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile);
    }

    public async removeGroup(groupId: number): Promise<void> {
        if (groupId === ProfileTreeGroupType.MODIO || groupId === ProfileTreeGroupType.LOCAL) {
            message.error(t("Can't Remove Default Group"));
            return;
        }

        this.ActiveProfile.removeGroup(groupId);

        this.updateTreeViewCallback?.call(this);
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile);
    }

    public async updateUI() {
        await emit("home-page-update-tree-view");
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
            this.converter.createDefault();
            await ConfigApi.saveProfileData(this.converter.profileList.toJson());
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
                    this.converter.profileTreeList.find(p => p.name === profile));
            }
        } catch (e) {
            this.converter.createDefault();
            await ConfigApi.saveProfileData(this.converter.profileList.toJson());
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

