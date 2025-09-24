import {message} from "antd";
import {t} from "i18next";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {path} from "@tauri-apps/api";
import {emit} from "@tauri-apps/api/event";
import {ModioApi} from "@/apis/modio";
import {ModList, ModListItem} from "./config/ModList.ts";
import {
    ProfileList,
    ProfileTree,
    ProfileTreeGroupType,
    ProfileTreeItem,
    ProfileTreeType
} from "./config/ProfileList.ts";
import {ModUpdateApi} from "@/apis/ModUpdateApi.ts";
import {StorageAPI} from "@/storage";
import StatusBar from "@/components/StatusBar.tsx";


export class HomeViewModel {

    private static instance: HomeViewModel;
    public profileList: ProfileList = new ProfileList();
    public profileTreeList: ProfileTree[] = [];
    public modList: ModList = new ModList();


    private updateTreeViewCallback() {
        emit("home-page-update-tree-view").then();
    }

    private updateSelectCallback() {
        emit("home-page-update-profile-select").then();
    }


    private constructor() {
    }

    private async addModDependencies(modList: ModList, modId: number, groupId: number): Promise<void> {
        await StatusBar.log(t("Fetch Mod Dependencies"));

        const mods = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        const depends = await ModioApi.getDependencies(modId);
        for (const depend of depends) {
            const modItem = new ModListItem(depend);
            if (modList.getByModId(modItem.modId)) {
                continue;
            }

            const addedModItem = await mods.addMod(modItem);
            await profiles.addModToProfile(addedModItem);

            this.updateTreeViewCallback?.call(this);
            await ModUpdateApi.updateMod(addedModItem);
        }
    }

    public async addModFromUrl(url: string, groupId: number): Promise<boolean> {
        await StatusBar.log(t("Fetch Mod Info"));

        const mods = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

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

        const addedModItem = await mods.addMod(modItem);
        this.ActiveProfile.addMod(addedModItem.id, groupId);
        this.updateTreeViewCallback?.call(this);
        await ModUpdateApi.updateMod(addedModItem);

        if (resp.dependencies) {
            await this.addModDependencies(subModList, resp.id, groupId);
        }

        await emit("tree-view-count-label-update");
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

        await emit("tree-view-count-label-update");
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
    }

    public async removeMod(id: number): Promise<void> {
        this.ActiveProfile.removeMod(id);
        this.updateTreeViewCallback?.call(this);
    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.displayName = name;
        }

        this.updateTreeViewCallback?.call(this);
    }

    public async setModEnabled(id: number, enable: boolean): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setModEnabled(id, enable);
    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setModUsedVersion(id, version);
        // this.updateTreeViewCallback?.call(this);
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        this.ActiveProfile.setGroupName(id, name);
        this.updateTreeViewCallback?.call(this);
    }

    public async addGroup(parentGroupId: number, groupName: string): Promise<void> {
        this.ActiveProfile.addGroup(groupName, parentGroupId);

        this.updateTreeViewCallback?.call(this);
    }

    public async removeGroup(groupId: number): Promise<void> {
        if (groupId === ProfileTreeGroupType.MODIO || groupId === ProfileTreeGroupType.LOCAL) {
            message.error(t("Can't Remove Default Group"));
            return;
        }

        this.ActiveProfile.removeGroup(groupId);

        this.updateTreeViewCallback?.call(this);
    }

    public async updateUI() {
        await emit("home-page-update-tree-view");
    }

    public static async getInstance() {
        if (HomeViewModel.instance) {
            return HomeViewModel.instance;
        }
        HomeViewModel.instance = new HomeViewModel();
        return HomeViewModel.instance;
    }

}

