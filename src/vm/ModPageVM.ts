import ConfigApi from "../apis/ConfigApi.ts";
import ModioApi from "../apis/ModioApi.ts";
import {ModConfigConverter} from "./converter/ModConfigConverter.ts";
import {ModList, ModListItem} from "./config/ModList.ts";
import {ProfileList, ProfileTree, ProfileTreeItem} from "./config/ProfileList.ts";

export class ModListViewModel {

    private converter: ModConfigConverter = new ModConfigConverter();

    public get ModList(): ModList {
        return this.converter.modList;
    }

    public get ProfileList(): ProfileList {
        return this.converter.profileList;
    }

    public get ActiveProfileName(): string {
        return this.converter.profileList.activeProfile;
    }

    public get ActiveProfile(): ProfileTree {
        return new ProfileTree();
    }

    public constructor() {
    }

    public async addModFromUrl(url: string): Promise<void> {
        const resp = await ModioApi.getModInfoByLink(url);
        console.log(resp);
        const addedModItem = this.converter.modList.add(new ModListItem(resp));

        const profileTreeItem = new ProfileTreeItem();
        profileTreeItem.id = addedModItem.id;
        this.ActiveProfile.children.push(profileTreeItem);
    }

    public async addModFromPath(path: string): Promise<void> {
        let modListItem = new ModListItem();
        modListItem.cachePath = path;
        const addedModItem = this.converter.modList.add(modListItem);

        const profileTreeItem = new ProfileTreeItem();
        profileTreeItem.id = addedModItem.id;
        this.ActiveProfile.children.push(profileTreeItem);
    }

    public async removeMod(id: number): Promise<void> {
        this.converter.modList.remove(id);
        this.ActiveProfile.children = this.ActiveProfile.children.filter(m => m.id !== id);
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
        let modItem = this.converter.modList.get(id);
        if (modItem) {
            modItem.displayName = name;
        }
    }

    public async setModEnabled(id: number, enable: boolean): Promise<void> {
        let modItem = this.converter.modList.get(id);
        if (modItem) {
            modItem.enabled = enable;
        }
    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {
        let modItem = this.converter.modList.get(id);
        if (modItem) {
            modItem.usedVersion = version;
        }
    }

    public async addCategory(categoryKey: string): Promise<void> {

    }

    public async updateModList() {

    }

    public static async getInstance() {
        const vm = new ModListViewModel();
        let config = await ConfigApi.loadModListData();
        if (config !== undefined) {
            config = await ConfigApi.loadModListDataV1();
            if (config !== undefined) {
                vm.converter.convertTo(config);
            }
        }
        return vm;
    }

}

