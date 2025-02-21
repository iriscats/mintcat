import {ModList, ModListItem} from "../config/ModList.ts";
import {ProfileList, ProfileTree, ProfileTreeItem, ProfileTreeType} from "../config/ProfileList.ts";

export class ModConfigConverter {

    public profileList: ProfileList = new ProfileList();
    public profileTreeList: ProfileTree[] = [];
    public modList: ModList = new ModList();

    private convertModListDataV01ToV02(data: any) {

        for (const profile in data.profiles) {
            const tree = new ProfileTree(profile);
            const mods = data.profiles[profile]["mods"];

            const localFolder = new ProfileTreeItem(90000, ProfileTreeType.FOLDER, "Local");
            const modioFolder = new ProfileTreeItem(90001, ProfileTreeType.FOLDER, "mod.io");

            for (const modItem of mods) {
                const item = new ModListItem();
                item.url = modItem["spec"]["url"];
                item.required = modItem["required"];
                item.enabled = modItem["enabled"];

                const addedModItem = this.modList.add(item);
                if (item.url.startsWith("http")) {
                    modioFolder.add(addedModItem.id, ProfileTreeType.ITEM);
                }else{
                    localFolder.add(addedModItem.id, ProfileTreeType.ITEM);
                }
            }

            tree.root.children.push(localFolder);
            tree.root.children.push(modioFolder);

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
