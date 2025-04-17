import {path} from "@tauri-apps/api";
import {ModList, ModListItem} from "../config/ModList.ts";
import {ProfileList, ProfileTree, ProfileTreeType} from "../config/ProfileList.ts";
import {t} from "i18next";


export class ModConfigConverter {

    public profileList: ProfileList = new ProfileList();
    public profileTreeList: ProfileTree[] = [];
    public modList: ModList = new ModList();

    public createDefault() {
        this.modList = new ModList();
        this.profileList = new ProfileList();
        this.profileList.Profiles.push(t("Default"));
        this.profileList.activeProfile = t("Default");
        this.profileTreeList.push(new ProfileTree(t("Default")));
    }

    private async convertModListDataV01ToV02(data: any) {

        for (const profile in data.profiles) {
            const profileTree = new ProfileTree(profile);
            let mods = data.profiles[profile]["mods"];

            // 去除 mods 中 ["spec"]["url"] 相同的项
            mods = mods.filter((mod: any, index: number, self: any[]) =>
                index === self.findIndex((t) => (t["spec"]["url"] === mod["spec"]["url"]))
            );

            const localFolder = profileTree.LocalFolder;
            const modioFolder = profileTree.ModioFolder;

            for (const modItem of mods) {
                const item = new ModListItem();
                item.url = modItem["spec"]["url"];
                item.required = modItem["required"];
                item.enabled = modItem["enabled"];
                if (item.url.startsWith("http")) {
                    const addedModItem = this.modList.add(item);
                    modioFolder.add(addedModItem.id, ProfileTreeType.ITEM);
                } else {
                    item.displayName = await path.basename(modItem["spec"]["url"]);
                    item.cachePath = modItem["spec"]["url"];
                    item.isLocal = true;
                    item.downloadProgress = 100;
                    const addedModItem = this.modList.add(item);
                    localFolder.add(addedModItem.id, ProfileTreeType.ITEM);
                }
            }

            this.profileTreeList.push(profileTree);
            this.profileList.add(profile);
        }

        this.profileList.activeProfile = data.active_profile;
    }

    public async convertTo(config: string) {
        const data = JSON.parse(config);
        if (data.version === "0.1.0") {
            await this.convertModListDataV01ToV02(data);
        } else if (data.version === "0.2.0") {

        }

    }


}
