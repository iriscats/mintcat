type ModCategory = {
    [index: string]: ModListData[];
};
type ProfileData = {
    [index: string]: ModCategory[];
};
type ModListData = {
    url: string;
    name: string;
    required: boolean;
    enabled: boolean;
    tags: string[];
    type: string;
};

class ModListDataV02 {
    public version: string = "0.2.0";
    public active_profile: string;
    public profiles: ProfileData;
}


function convertModListDataV01ToV02(data: any): ModListDataV02 {
    const dataV02 = new ModListDataV02();
    dataV02.active_profile = data.active_profile;
    dataV02.profiles = {};
    for (const profile in data.profiles) {
        const mods = data.profiles[profile]["mods"];
        const localCategory: ModListData[] = [];
        const modioCategory: ModListData[] = [];
        for (const modItem: any of mods) {
            const url = modItem["spec"]["url"];
            if (url.startsWith("https")) {
                modioCategory.push({
                    url: url,
                    name: "",
                    required: modItem["required"],
                    enabled: modItem["enabled"],
                    tags: [],
                    type: "",
                });
            } else {
                localCategory.push({
                    url: url,
                    name: "",
                    required: modItem["required"],
                    enabled: modItem["enabled"],
                    tags: [],
                    type: "",
                });
            }
        }

        const data1: ModCategory = {"local": localCategory};
        const data2: ModCategory = {"modio": modioCategory};
        dataV02.profiles[profile] = [data1, data2];
    }
    return dataV02;
}

function unifiedModListData(config: string) {
    const data = JSON.parse(config);
    if (data.version === "0.1.0") {
        return convertModListDataV01ToV02(data);
    } else if (data.version === "0.2.0") {
        return data;
    }
}

export default unifiedModListData;