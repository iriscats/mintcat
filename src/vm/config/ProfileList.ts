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
        return JSON.stringify(profile);
    }

}

export enum ProfileTreeType {
    FOLDER = "folder",
    ITEM = "item"
}

export class ProfileTree {
    public version: string = "0.2.0";
    public name: string = "";
    public root: ProfileTreeItem = new ProfileTreeItem(0, ProfileTreeType.FOLDER, "root");

    public get ModioFolder(): ProfileTreeItem | undefined {
        const index = this.root.children.findIndex(p => p.id === 90001);
        if (index >= 0) {
            return this.root.children[index];
        }
    }

    public get LocalFolder(): ProfileTreeItem | undefined {
        const index = this.root.children.findIndex(p => p.id === 90001);
        if (index >= 0) {
            return this.root.children[index];
        }
    }

    public constructor(name: string) {
        this.name = name;
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
        this.children.push(new ProfileTreeItem(id, type));
    }

    public remove(id: number) {
        this.children = this.children.filter(m => m.id !== id);
        for (const child of this.children) {
            child.remove(id);
        }
    }
}


