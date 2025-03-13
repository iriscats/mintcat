import {ModInfo} from "../modio/ModInfo.ts";


export class ModListItem {
    public id: number = -1;
    public modId: number = -1;
    public url: string = "";
    public nameId: string = "";
    public displayName: string = "";
    public required: boolean = false;
    public enabled: boolean = true;
    public fileVersion: string = "-";
    public tags: string[] = [];
    public usedVersion: string = "";
    public versions: string[] = [];
    public approval: string = "";
    public isLocal: boolean = true;
    public downloadUrl: string = "";
    public cachePath: string = "";
    public downloadProgress: number = 100;
    public fileSize: number = 0;

    public constructor(modInfo?: ModInfo) {
        if (modInfo) {
            this.url = modInfo.profile_url;
            this.modId = modInfo.id;
            this.displayName = modInfo.name;
            this.nameId = modInfo.name_id;
            this.fileVersion = modInfo.modfile.version === null ? "-" : modInfo.modfile.version;
            this.downloadUrl = modInfo.modfile.download.binary_url;

            for (const tag of modInfo.tags) {
                this.tags.push(tag.name);
            }

            this.isLocal = false;
            this.downloadProgress = 0;
            this.fileSize = modInfo.modfile.filesize;

            this.convertModVersion();
            this.convertModApprovalType();
            this.convertModRequired();
        } else {
            this.isLocal = true;
            this.downloadProgress = 100;
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

    private convertModApprovalType() {
        const tags = [];
        for (const tag of this.tags) {
            if (tag === "Verified" || tag === "Auto-Verified") {
                this.approval = "Verified";
            } else if (tag === "Approved") {
                this.approval = "Approved";
            } else if (tag === "Sandbox") {
                this.approval = "Sandbox";
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

export class ModList {

    public version: string = "0.2.0";
    private mods: ModListItem[] = [];

    public get Mods(): ModListItem[] {
        return this.mods;
    }

    private makeId() {
        return 10000 + this.mods.length;
    }

    public add(modItem: ModListItem): ModListItem {
        modItem.id = this.makeId();
        this.mods.push(modItem);
        return modItem;
    }

    public remove(id: number) {
        this.mods = this.mods.filter(m => m.id !== id);
    }

    public get(id: number): ModListItem | undefined {
        return this.mods.find(m => m.id === id);
    }

    public update(oldItem: ModListItem, newItem: ModListItem) {
        const index = this.mods.findIndex(m => m.id === oldItem.id);
        if (index !== -1) {
            newItem.id = oldItem.id;
            newItem.enabled = oldItem.enabled;
            newItem.url = oldItem.url;
            if (oldItem.displayName !== "") {
                newItem.displayName = oldItem.displayName;
            }
            if (newItem.url.startsWith("http") === true) {
                newItem.isLocal = false;
            }
            this.mods[index] = newItem;
            return this.mods[index];
        }
    }

    public static fromJson(json_str: string): ModList {
        const json = JSON.parse(json_str);
        let modList = new ModList();
        modList.version = json.version;
        modList.mods = [];
        for (const mod of json.mods) {
            const modItem = new ModListItem();
            modItem.id = mod.id;
            modItem.modId = mod.mod_id;
            modItem.url = mod.url;
            modItem.nameId = mod.name_id;
            modItem.displayName = mod.display_name;
            modItem.required = mod.required;
            modItem.enabled = mod.enabled;
            modItem.fileVersion = mod.file_version;
            modItem.tags = mod.tags;
            modItem.versions = mod.versions;
            modItem.approval = mod.approval;
            modItem.isLocal = mod.is_local;
            modItem.downloadUrl = mod.download_url;
            modItem.cachePath = mod.cache_path;
            modItem.downloadProgress = mod.download_progress;
            modItem.fileSize = mod.file_size;
            modList.mods.push(modItem);
        }
        return modList;
    }

    public toJson() {

        const mods = [];
        for (const mod of this.mods) {
            const modItem = {
                "id": mod.id,
                "mod_id": mod.modId,
                "url": mod.url,
                "name_id": mod.nameId,
                "display_name": mod.displayName,
                "required": mod.required,
                "enabled": mod.enabled,
                "file_version": mod.fileVersion,
                "tags": mod.tags,
                "versions": mod.versions,
                "approval": mod.approval,
                "is_local": mod.isLocal,
                "download_url": mod.downloadUrl,
                "cache_path": mod.cachePath,
                "file_size": mod.fileSize,
                "download_progress": mod.downloadProgress
            }
            mods.push(modItem);
        }

        const modList = {
            "version": this.version,
            "mods": mods
        }
        return JSON.stringify(modList);
    }
}