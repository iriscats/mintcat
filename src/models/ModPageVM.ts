import ConfigApi from "../apis/ConfigApi.ts";
import ModioApi from "../apis/ModioApi.ts";
import {ModInfo} from "./ModInfo.ts";

type ModCategory = {
    [index: string]: number[];
};
type ProfileData = {
    [index: string]: ModCategory[];
};

class ModListItem {
    public id: number = -1;
    public modId: number = -1;
    public url: string = "";
    public name: string = "";
    public modName: string = "";
    public required: boolean = false;
    public enabled: boolean = false;
    public fileVersion: string = "-";
    public tags: string[] = [];
    public versions: string[] = [];
    public type: string = "";

    public constructor(modInfo?: ModInfo) {
        if (modInfo) {
            this.modId = modInfo.id;
            this.modName = modInfo.name_id;
            this.name = modInfo.name;
            this.fileVersion = modInfo.modfile.version === null ? "-" : modInfo.modfile.version;
            for (const tag of modInfo.tags) {
                this.tags.push(tag.name);
            }
            this.convertModVersion();
            this.convertModType();
            this.convertModRequired();
        }
    }

    private convertModVersion() {
        const tags = [];
        for (let tag of this.tags) {
            if (tag.startsWith("1.")) {
                this.versions.push(tag);
            } else {
                tags.push(tag);
            }
        }
        this.versions.reverse();
        this.tags = tags;
    }

    private convertModType() {
        const tags = [];
        for (const tag of this.tags) {
            if (tag === "Verified" || tag === "Auto-Verified") {
                this.type = "Verified";
            } else if (tag === "Approved") {
                this.type = "Approved";
            } else if (tag === "Sandbox") {
                this.type = "Sandbox";
            } else {
                tags.push(tag);
            }
        }
        this.tags = tags;
    }

    private convertModRequired() {
        const tags = [];
        for (let tag of this.tags) {
            if (tag === "RequiredByAll") {
                this.required = true;
            } else if (tag === "Optional") {
                this.required = false;
            } else {
                tags.push(tag);
            }
        }
        this.tags = tags;
    }
}

class ModListDataV02 {
    public version: string = "0.2.0";
    public activeProfile: string;
    public profiles: ProfileData;
    public mods: ModListItem[];


    public async setProfile(): Promise<void> {

    }

    public async setModName(id: number, name: string): Promise<void> {

    }

    public async setModEnabled(id: number, enable: boolean): Promise<void> {

    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {

    }

    public async setModPriority(id: number, priority: number): Promise<void> {

    }

    public async addMod(): Promise<void> {

    }

    public async removeMod(): Promise<void> {

    }

}

class ModListViewModel {

    private static viewModel = undefined

    public constructor() {
    }

    public async getViewModel(): Promise<ModListDataV02> {
        if (ModListViewModel.viewModel == undefined) {
            // Allocate a value, avoid repeating requests
            ModListViewModel.viewModel = new ModListDataV02();
            const resp = await ConfigApi.loadModListData();
            ModListViewModel.viewModel = this.unifiedModListData(resp);
        }
        return ModListViewModel.viewModel;
    }

    public async setActiveProfile(activeProfile: string): Promise<void> {
        ModListViewModel.viewModel.activeProfile = activeProfile;

    }


    public async updateModList() {
        const vm = ModListViewModel.viewModel;
        const modCategory = vm.profiles[vm.activeProfile];
        const ids = [];
        for (const category of modCategory) {
            const categoryKey = Object.keys(category)[0];
            for (const id of category[categoryKey]) {
                ids.push(id);
            }
        }
        console.log(ModListViewModel.viewModel);
        for (const id of ids) {
            const modItem = ModListViewModel.viewModel.mods[id];
            if (modItem.modId == -1) {
                try {
                    const resp = await ModioApi.getModInfoByLink(modItem.url);
                    const newModItem = new ModListItem(resp);
                    console.log(resp, newModItem);
                    newModItem.id = id;
                    newModItem.enabled = modItem.enabled;
                    newModItem.url = modItem.url;
                    ModListViewModel.viewModel.mods[id] = newModItem;
                } catch (e) {
                    console.log(e);
                }
            }
        }
    }

    private convertModListDataV01ToV02(data: any): ModListDataV02 {
        const dataV02 = new ModListDataV02();
        dataV02.activeProfile = data.active_profile;
        dataV02.profiles = {};
        dataV02.mods = [];

        for (const profile in data.profiles) {
            const mods = data.profiles[profile]["mods"];
            const localCategory: number[] = [];
            const modioCategory: number[] = [];
            for (const modItem of mods) {
                const url = modItem["spec"]["url"];
                const id = dataV02.mods.length;

                const item = new ModListItem();
                item.url = url;
                item.enabled = modItem["enabled"];
                dataV02.mods.push(item);

                if (url.startsWith("https")) {
                    modioCategory.push(id);
                } else {
                    localCategory.push(id);
                }
            }
            dataV02.profiles[profile] = [{"local": localCategory}, {"modio": modioCategory}];
        }
        return dataV02;
    }

    private unifiedModListData(config: string) {
        //console.log("unifiedModListData");
        const data = JSON.parse(config);
        if (data.version === "0.1.0") {
            return this.convertModListDataV01ToV02(data);
        } else if (data.version === "0.2.0") {
            return data;
        }
    }

}

export default new ModListViewModel();
