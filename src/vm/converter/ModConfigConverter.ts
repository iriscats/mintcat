import {ModList, ModListItem} from "../config/ModList.ts";
import {ProfileList, ProfileTree, ProfileTreeType} from "../config/ProfileList.ts";

export class ModConfigConverter {

    public profileList: ProfileList = new ProfileList();
    public profileTreeList: ProfileTree[] = [];
    public modList: ModList = new ModList();

    private convertModListDataV01ToV02(data: any) {
        console.log("convertModListDataV01ToV02");
        for (const profile in data.profiles) {
            const tree = new ProfileTree(profile);
            const mods = data.profiles[profile]["mods"];
            for (const modItem of mods) {
                const item = new ModListItem();
                item.url = modItem["spec"]["url"];
                item.required = modItem["required"];
                item.enabled = modItem["enabled"];

                const addedModItem = this.modList.add(item);
                tree.add(addedModItem.id, ProfileTreeType.ITEM);
            }
            this.profileTreeList.push(tree);
            this.profileList.add(profile);
        }

        this.profileList.activeProfile = data.active_profile;
    }

    public convertTo(config: string) {
        const data = JSON.parse(config);
        if (data.version === "0.1.0") {
            this.convertModListDataV01ToV02(data);
        } else if (data.version === "0.2.0") {

        }

    }


}
