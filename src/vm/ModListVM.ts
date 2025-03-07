import ConfigApi from "../apis/ConfigApi.ts";
import ModioApi from "../apis/ModioApi.ts";
import {ModConfigConverter} from "./converter/ModConfigConverter.ts";
import {ModList, ModListItem} from "./config/ModList.ts";
import {ProfileList, ProfileTree} from "./config/ProfileList.ts";

export class ModListViewModel {

    private static instance: ModListViewModel;

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

    public set ActiveProfile(activeProfile: string) {
        this.converter.profileList.activeProfile = activeProfile;
        ConfigApi.saveProfileData(this.converter.profileList.toJson()).then(_ => {
        });
    }

    public constructor() {
    }

    public async addModFromUrl(url: string, groupId: number): Promise<void> {
        const resp = await ModioApi.getModInfoByLink(url);
        const addedModItem = this.ModList.add(new ModListItem(resp));
        this.ActiveProfile.addMod(addedModItem.id, groupId);

        await ConfigApi.saveModListData(this.ModList.toJson());
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
    }

    public async addModFromPath(path: string, groupId: number): Promise<void> {
        let modListItem = new ModListItem();
        modListItem.displayName = path.split("/").pop();
        modListItem.cachePath = path;
        const addedModItem = this.ModList.add(modListItem);

        this.ActiveProfile.addMod(addedModItem.id, groupId);

        await ConfigApi.saveModListData(this.ModList.toJson());
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
    }

    public async removeMod(id: number): Promise<void> {
        this.ModList.remove(id);
        this.ActiveProfile.removeMod(id);

        await ConfigApi.saveModListData(this.ModList.toJson());
        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
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
    }

    public async setModEnabled(id: number, enable: boolean): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.enabled = enable;
        }
        await ConfigApi.saveModListData(this.ModList.toJson());
    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {
        let modItem = this.ModList.get(id);
        if (modItem) {
            modItem.usedVersion = version;
        }

        await ConfigApi.saveModListData(this.ModList.toJson());
    }


    public async setGroupName(id: number, name: string): Promise<void> {
        this.ActiveProfile.setGroupName(id, name);

        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
    }

    public async addGroup(groupId: number, groupName: string): Promise<void> {
        this.ActiveProfile.addGroup(groupName, groupId);

        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
    }

    public async removeGroup(groupId: number): Promise<void> {
        this.ActiveProfile.removeGroup(groupId);

        await ConfigApi.saveProfileDetails(this.ActiveProfileName, this.ActiveProfile.toJson());
    }

    public async updateModList(onProgress: () => void): Promise<void> {
        for (const mod of this.ModList.Mods) {
            if (mod.modId === -1 && mod.url.startsWith("http")) {
                const resp = await ModioApi.getModInfoByLink(mod.url);
                let newItem = new ModListItem(resp);
                if (resp) {
                    this.ModList.update(mod, newItem);
                    onProgress();
                }

                newItem = await ModioApi.downloadModFile(newItem, (loaded: number, total: number) => {
                    newItem.downloadProgress = (loaded / total) * 100;
                    this.ModList.update(mod, newItem);
                    onProgress();
                });

                this.ModList.update(mod, newItem);
                await ConfigApi.saveModListData(this.ModList.toJson());
            }
        }
    }

    public static async getInstance() {
        if (ModListViewModel.instance) {
            return ModListViewModel.instance;
        }
        const vm = new ModListViewModel();
        let config = await ConfigApi.loadModListData();
        if (config === undefined) {
            config = await ConfigApi.loadModListDataV1();
            if (config !== undefined) {
                vm.converter.convertTo(config);
                await ConfigApi.saveModListData(vm.converter.modList.toJson());
                await ConfigApi.saveProfileData(vm.converter.profileList.toJson());
                for (const profile of vm.converter.profileList.Profiles) {
                    await ConfigApi.saveProfileDetails(profile,
                        vm.converter.profileTreeList.find(p => p.name === profile)!.toJson());
                }
                return vm;
            } else {
                vm.converter.modList = new ModList();
                vm.converter.profileList = new ProfileList();
                vm.converter.profileList.Profiles.push("default");
                vm.converter.profileTreeList = [];
                vm.converter.profileTreeList.push(new ProfileTree("default"));
                return vm;
            }
        } else {
            vm.converter.modList = ModList.fromJson(config);
            vm.converter.profileList = ProfileList.fromJson(await ConfigApi.loadProfileData());
            for (const profile of vm.converter.profileList.Profiles) {
                const profileDetailData = await ConfigApi.loadProfileDetails(profile);
                if (profileDetailData) {
                    vm.converter.profileTreeList.push(ProfileTree.fromJson(profileDetailData));
                }
            }
        }
        return vm;
    }

}

