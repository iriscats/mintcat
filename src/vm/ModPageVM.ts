import ConfigApi from "../apis/ConfigApi.ts";
import ModioApi from "../apis/ModioApi.ts";
import {ModConfigConverter} from "./converter/ModConfigConverter.ts";
import {ModList, ModListItem} from "./config/ModList.ts";
import {ProfileList, ProfileTree, ProfileTreeItem, ProfileTreeType} from "./config/ProfileList.ts";

export class ModListViewModel {

    private converter: ModConfigConverter = new ModConfigConverter();

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

    public constructor() {
    }

    public async addModFromUrl(url: string, groupId: number): Promise<void> {
        const resp = await ModioApi.getModInfoByLink(url);
        const addedModItem = this.ModList.add(new ModListItem(resp));
        addedModItem.enabled = true;
        addedModItem.isLocal = false;

        this.ActiveProfile.addMod(addedModItem.id, groupId);
        console.log(this.ActiveProfile.root, this.ModList, "add mod from url");
    }

    public async addModFromPath(path: string, groupId: number): Promise<void> {
        let modListItem = new ModListItem();
        modListItem.cachePath = path;
        const addedModItem = this.ModList.add(modListItem);

        this.ActiveProfile.addMod(addedModItem.id, groupId);
    }

    public async removeMod(id: number): Promise<void> {
        this.ModList.remove(id);
        this.ActiveProfile.root.remove(id);
    }

    public async setActiveProfile(activeProfile: string): Promise<void> {
        this.converter.profileList.activeProfile = activeProfile;
    }

    public async addProfile(name: string): Promise<void> {
        this.converter.profileList.add(name);
    }

    public async removeProfile(name: string): Promise<void> {
        this.converter.profileList.remove(name);
    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.displayName = name;
        }
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        this.ActiveProfile.setGroupName(id, name);
    }

    public async setModEnabled(id: number, enable: boolean): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.enabled = enable;
        }
    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.usedVersion = version;
        }
    }

    public async addGroup(groupId: number, groupName: string): Promise<void> {
        this.ActiveProfile.addGroup(groupName, groupId);
    }

    public async removeGroup(groupId: number): Promise<void> {
        this.ActiveProfile.removeGroup(groupId);
    }

    public async updateModList(onProgress: () => void): Promise<void> {
        for (const mod of this.ModList.Mods) {
            if (mod.url.startsWith("http")) {
                const resp = await ModioApi.getModInfoByLink(mod.url);
                if (resp) {
                    this.ModList.update(mod, new ModListItem(resp));
                    onProgress();
                }
            }
        }
    }


    public static async getInstance() {
        const vm = new ModListViewModel();
        let config = await ConfigApi.loadModListData();
        if (config === undefined) {
            config = await ConfigApi.loadModListDataV1();
            if (config !== undefined) {
                vm.converter.convertTo(config);
            }
        }
        return vm;
    }

}

