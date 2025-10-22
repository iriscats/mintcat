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

    // Core data properties
    private profileList: ProfileList = new ProfileList();
    private profileTreeList: ProfileTree[] = [];
    private modList: ModList = new ModList();

    // Callback functions
    public updateTreeView?: () => void;

    // Getters for accessing profile and mod data
    public get ProfileList(): string[] {
        return this.profileList.Profiles;
    }

    public get ActiveProfileName(): string {
        return this.profileList.activeProfile;
    }

    public get ActiveProfile(): ProfileTree {
        const profile = this.profileTreeList.find(p => p.name === this.profileList.activeProfile);
        if (!profile) {
            // Create a new profile if it doesn't exist
            const newProfile = new ProfileTree(this.profileList.activeProfile);
            this.profileTreeList.push(newProfile);
            return newProfile;
        }
        return profile;
    }

    public set ActiveProfile(activeProfile: string) {
        this.profileList.activeProfile = activeProfile;
        this.updateTreeView?.call(this);
    }

    public get ModList(): ModList {
        return this.modList;
    }

    public static updateTreeView() {
        emit("home-page-update-tree-view").then();
    }

    public static updateTreeViewCountLabel() {
        emit("tree-view-count-label-update").then();
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

            this.updateTreeView?.call(this);
            await ModUpdateApi.updateMod(addedModItem);
        }
    }

    public async addModFromUrl(url: string, groupId: number): Promise<boolean> {
        await StatusBar.log(t("Fetch Mod Info"));
        const modInfoResp = await ModioApi.getModInfoByLink(url);
        if (modInfoResp === undefined) {
            return false;
        }

        const mods = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        if (await profiles.checkModExits(modInfoResp)) {
            message.warning(`${t("Mod Already Exists")} ${modInfoResp.nameId}`);
            return true;
        }

        const modItem = new ModListItem(modInfoResp);
        const addedModItem = await mods.addMod(modItem);
        await profiles.addModToProfile(addedModItem);
        await ModUpdateApi.updateMod(addedModItem);

        if (modInfoResp.dependencies) {
            await this.addModDependencies(this.modList, modInfoResp.id, groupId);
        }

        HomeViewModel.updateTreeView();
        HomeViewModel.updateTreeViewCountLabel();

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

        HomeViewModel.updateTreeView();
        HomeViewModel.updateTreeViewCountLabel();

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

        HomeViewModel.updateTreeView();
        HomeViewModel.updateTreeViewCountLabel();

    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setDisplayName(id, name);

        HomeViewModel.updateTreeView();
    }

    public async setModEnabled(modId: number, enable: boolean): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setModEnabled(modId, enable);

    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setModUsedVersion(id, version);

    }

    public async setGroupName(id: number, name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setGroupName(id, name);

        HomeViewModel.updateTreeView();
    }

    public async addGroup(parentGroupId: number, groupName: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.addGroup(groupName, parentGroupId);

        HomeViewModel.updateTreeView();
    }

    public async removeGroup(groupId: number): Promise<void> {
        if (groupId === ProfileTreeGroupType.MODIO || groupId === ProfileTreeGroupType.LOCAL) {
            message.error(t("Can't Remove Default Group"));
            return;
        }

        const profiles = await StorageAPI.getProfiles();
        await profiles.removeGroup(groupId);

        HomeViewModel.updateTreeView();
        HomeViewModel.updateTreeViewCountLabel();
    }

    public async setProfileData(root: ProfileTreeItem): Promise<void> {
        try {
            this.ActiveProfile.root = root;
            // Save the updated profile tree
            console.log('Profile data updated');
        } catch (error) {
            console.error('Failed to set profile data:', error);
        }
    }


      public async initializeData(): Promise<void> {
        try {
            // Initialize profile list with default data if needed
            if (this.profileList.Profiles.length === 0) {
                this.profileList.add("default");
                this.profileTreeList.push(new ProfileTree("default"));
            }

            // Ensure the active profile exists in the tree list
            const activeProfileTree = this.profileTreeList.find(p => p.name === this.profileList.activeProfile);
            if (!activeProfileTree) {
                this.profileTreeList.push(new ProfileTree(this.profileList.activeProfile));
            }
        } catch (error) {
            console.error('Failed to initialize HomeViewModel data:', error);
        }
    }

    public static async getInstance() {
        if (HomeViewModel.instance) {
            return HomeViewModel.instance;
        }
        HomeViewModel.instance = new HomeViewModel();
        await HomeViewModel.instance.initializeData();
        return HomeViewModel.instance;
    }

}

