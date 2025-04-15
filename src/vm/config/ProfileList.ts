import {ModList} from "./ModList.ts";
import {t} from "i18next";

export class ProfileList {
    public version: string = "0.2.0";
    public activeProfile: string = "default";
    private profiles: string[] = [];

    public get Profiles(): string[] {
        return this.profiles;
    }

    public add(profile: string) {
        this.profiles.push(profile);
    }

    public remove(profile: string) {
        this.profiles.splice(this.profiles.indexOf(profile), 1);
        if (this.activeProfile === profile) {
            this.activeProfile = this.profiles[0];
        }
    }

    public rename(oldName: string, newName: string) {
        const index = this.profiles.indexOf(oldName);
        if (index >= 0) {
            this.profiles[index] = newName;
        }
        if (this.activeProfile === oldName) {
            this.activeProfile = newName;
        }
    }

    public static fromJson(json_str: string): ProfileList {
        const json = JSON.parse(json_str);
        let profile = new ProfileList();
        profile.version = json.version;
        profile.activeProfile = json.active_profile;
        profile.profiles = json.profiles;
        return profile;
    }

    public toJson() {
        const profile = {
            "version": this.version,
            "active_profile": this.activeProfile,
            "profiles": this.profiles
        }
        return JSON.stringify(profile, null, 4);
    }

}

export enum ProfileTreeType {
    FOLDER = "folder",
    ITEM = "item"
}

export enum ProfileTreeGroupType {
    MODIO = 90000,
    LOCAL = 90001
}


export class ProfileTree {
    public version: string = "0.2.0";
    public name: string = "";
    public lastUpdate: number = 0;
    public installTime: number = 0;
    public editTime: number = 0;
    public root: ProfileTreeItem = new ProfileTreeItem(0, ProfileTreeType.FOLDER, "root");
    public groupNameMap: Map<number, string> = new Map<number, string>();

    public get ModioFolder(): ProfileTreeItem | undefined {
        const index = this.root.children
            .findIndex(p => p.id === ProfileTreeGroupType.MODIO);
        if (index >= 0) {
            return this.root.children[index];
        }
    }

    public get LocalFolder(): ProfileTreeItem | undefined {
        const index = this.root.children
            .findIndex(p => p.id === ProfileTreeGroupType.LOCAL);
        if (index >= 0) {
            return this.root.children[index];
        }
    }

    public constructor(name: string) {
        this.name = name;
        this.lastUpdate = 0;
        this.root.add(ProfileTreeGroupType.MODIO, ProfileTreeType.FOLDER, "mod.io");
        this.root.add(ProfileTreeGroupType.LOCAL, ProfileTreeType.FOLDER, t("Local"));
        this.groupNameMap.set(ProfileTreeGroupType.MODIO, "mod.io");
        this.groupNameMap.set(ProfileTreeGroupType.LOCAL, t("Local"));
    }

    private makeId() {
        const hex = crypto.randomUUID().replace(/-/g, '');
        const bigNum = BigInt('0x' + hex);
        return parseInt(bigNum.toString().padStart(39, '0').substring(0, 10));
    }

    private findNode(items: ProfileTreeItem[], targetId: number): ProfileTreeItem | undefined {
        if (targetId === 0) {
            return undefined;
        }
        for (const item of items) {
            if (item.id === targetId)
                return item;
            const found = this.findNode(item.children, targetId);
            if (found)
                return found;
        }
        return undefined;
    };

    public addMod(id: number, parentId: number = 0) {
        const parent = this.findNode(this.root.children, parentId);
        if (parent) {
            parent.add(id, ProfileTreeType.ITEM);
        } else {
            this.root.add(id, ProfileTreeType.ITEM);
        }
    }

    public removeMod(id: number) {
        this.root.remove(id);
    }

    public setGroupName(id: number, name: string) {
        const parent = this.findNode(this.root.children, id);
        if (parent) {
            parent.name = name;
            this.groupNameMap.set(id, name);
        }
    }

    public addGroup(name: string, parentId: number = 0) {
        const parent = this.findNode(this.root.children, parentId);
        if (parent) {
            const newId = this.makeId();
            parent.children.push(new ProfileTreeItem(newId, ProfileTreeType.FOLDER, name));
            this.groupNameMap.set(newId, name);
        } else {
            // 默认添加到根目录
            const newId = this.makeId();
            this.root.add(newId, ProfileTreeType.FOLDER, name);
            this.groupNameMap.set(newId, name);
        }
    }

    public removeGroup(id: number) {
        this.groupNameMap.delete(id);
        const parent = this.findNode(this.root.children, id);
        this.root.remove(id);

        return parent;
    }

    public getModList(mainList: ModList): ModList {
        const modList = new ModList();
        const traverse = (node: ProfileTreeItem) => {
            if (node.type === ProfileTreeType.ITEM) {
                const foundId = mainList.get(node.id);
                if (foundId) {
                    modList.Mods.push(foundId.clone());
                } else {
                    console.log("getModList not found id: " + node.id);
                }
            } else {
                for (const child of node.children) {
                    traverse(child);
                }
            }
        };
        traverse(this.root);
        return modList;
    }

    public static fromJson(json_str: string): ProfileTree {
        const jsonObj = JSON.parse(json_str);
        let profile = new ProfileTree("");
        profile.version = jsonObj.version;
        profile.name = jsonObj.name;
        profile.lastUpdate = jsonObj.last_update;
        profile.installTime = jsonObj.install_time ? jsonObj.install_time : 0;
        profile.editTime = jsonObj.edit_time ? jsonObj.edit_time : 0;
        profile.root = ProfileTreeItem.fromJson(jsonObj.root);
        return profile;
    }

    public toJson() {
        const profile = {
            "version": this.version,
            "name": this.name,
            "last_update": this.lastUpdate,
            "install_time": this.installTime,
            "edit_time": this.editTime,
            "root": this.root.toJsonObject()
        }
        return JSON.stringify(profile, null, 4);
    }

}

export class ProfileTreeItem {
    public id: number = 0;
    public type: ProfileTreeType = ProfileTreeType.ITEM;
    public name: string = "";
    public children: ProfileTreeItem[] = [];

    public constructor(id: number, type: ProfileTreeType, name: string = "") {
        this.id = id;
        this.type = type;
        this.name = name;
    }

    public add(id: number, type: ProfileTreeType, name: string = "") {
        this.children.push(new ProfileTreeItem(id, type, name));
    }

    public remove(id: number) {
        this.children = this.children.filter(m => m.id !== id);
        for (const child of this.children) {
            child.remove(id);
        }
    }

    public static fromJson(json: any) {
        const item = new ProfileTreeItem(json.id, json.type, json.name);
        item.children = json.children.map(m => ProfileTreeItem.fromJson(m));
        return item;
    }

    public toJsonObject() {
        return {
            "id": this.id,
            "type": this.type,
            "name": this.name,
            "children": this.children.map(m => m.toJsonObject())
        };
    }
}


