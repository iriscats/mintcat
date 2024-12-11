import ConfigApi from "../apis/ConfigApi.ts";

type ModCategory = {
    [index: string]: ModListPageVM[];
};
type ProfileData = {
    [index: string]: ModCategory[];
};
type ModListPageVM = {
    id: number;
    url: string;
    name: string;
    required: boolean;
    enabled: boolean;
    tags: string[];
    type: string;
};

class ModListDataV02 {
    public version: string = "0.2.0";
    public activeProfile: string;
    public profiles: ProfileData;
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

    public async updateModInfo() {
    }

    private convertModListDataV01ToV02(data: any): ModListDataV02 {
        const dataV02 = new ModListDataV02();
        dataV02.activeProfile = data.active_profile;
        dataV02.profiles = {};
        for (const profile in data.profiles) {
            const mods = data.profiles[profile]["mods"];
            const localCategory: ModListPageVM[] = [];
            const modioCategory: ModListPageVM[] = [];
            for (const modItem: any of mods) {
                const url = modItem["spec"]["url"];
                const item = {
                    id: -1,
                    url: url,
                    name: "",
                    required: modItem["required"],
                    enabled: modItem["enabled"],
                    tags: [],
                    type: "",
                }
                if (url.startsWith("https")) {
                    modioCategory.push(item);
                } else {
                    localCategory.push(item);
                }
            }

            const data1: ModCategory = {"local": localCategory};
            const data2: ModCategory = {"modio": modioCategory};
            dataV02.profiles[profile] = [data1, data2];
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
