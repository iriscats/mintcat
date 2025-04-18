import {ModInfo} from "../modio/ModInfo.ts";

export const MOD_INVALID_ID = 999999;

export enum ModSourceType {
    Local = "Local",
    Modio = "Modio",
    Unknown = "Unknown"
}


export class ModListItem {
    public id: number = MOD_INVALID_ID;
    public modId: number = MOD_INVALID_ID;
    public url: string = "";
    public nameId: string = "";
    public displayName: string = "";
    public required: boolean = false;
    public enabled: boolean = true;
    public fileVersion: string = "-";
    public tags: string[] = [];
    public usedVersion: string = "";
    public versions: string[] = [];
    public approval: string = "Sandbox";
    public sourceType: ModSourceType = ModSourceType.Unknown;
    public downloadUrl: string = "";
    public cachePath: string = "";
    public downloadProgress: number = 100;
    public fileSize: number = 0;
    public lastUpdateDate: number = Date.now();
    public onlineUpdateDate: number = Date.now();
    public onlineAvailable: boolean = true;

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

            this.sourceType = ModSourceType.Modio;
            this.downloadProgress = 0;
            this.fileSize = modInfo.modfile.filesize;

            this.convertModVersion();
            this.convertModApprovalType();
            this.convertModRequired();
        } else {
            this.sourceType = ModSourceType.Local;
            this.downloadProgress = 100;
            this.approval = "";
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

    public clone() {
        const modItem = new ModListItem();
        modItem.id = this.id;
        modItem.modId = this.modId;
        modItem.url = this.url;
        modItem.nameId = this.nameId;
        modItem.displayName = this.displayName;
        modItem.required = this.required;
        modItem.enabled = this.enabled;
        modItem.fileVersion = this.fileVersion;
        modItem.tags = this.tags;
        modItem.versions = this.versions;
        modItem.approval = this.approval;
        modItem.sourceType = this.sourceType;
        modItem.downloadUrl = this.downloadUrl;
        modItem.cachePath = this.cachePath;
        modItem.downloadProgress = this.downloadProgress;
        modItem.fileSize = this.fileSize;
        return modItem;
    }
}

export class ModList {

    public version: string = "0.2.0";
    private mods: ModListItem[] = [];

    public get Mods(): ModListItem[] {
        return this.mods;
    }

    private makeId() {
        const hex = crypto.randomUUID().replace(/-/g, '');
        const bigNum = BigInt('0x' + hex);
        return parseInt(bigNum.toString().padStart(39, '0').substring(0, 10));
    }

    public add(modItem: ModListItem): ModListItem {
        if (modItem.modId !== MOD_INVALID_ID) {
            const foundItem = this.getByModId(modItem.modId);
            if (foundItem) {
                return foundItem;
            }
        }

        const foundItem = this.getByUrl(modItem.url);
        if (foundItem) {
            return foundItem;
        }

        modItem.id = this.makeId();
        this.mods.push(modItem);
        return modItem;
    }

    public remove(id: number) {
        this.mods = this.mods.filter(m => m.id !== id);
    }

    public get(id: number): ModListItem | undefined {
        if (id === MOD_INVALID_ID)
            return undefined;
        return this.mods.find(m => m.id === id);
    }

    public getByModId(modId: number): ModListItem | undefined {
        return this.mods.find(m => m.modId === modId);
    }

    public getByUrl(url: string): ModListItem | undefined {
        return this.mods.find(m => m.url === url);
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
            newItem.lastUpdateDate = Date.now();
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
            // patch old version
            if (!mod.source_type) {
                if (mod.url.startsWith("http")) {
                    mod.source_type = ModSourceType.Modio;
                } else {
                    mod.source_type = ModSourceType.Local;
                }
            }

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
            modItem.downloadUrl = mod.download_url;
            modItem.cachePath = mod.cache_path;
            modItem.downloadProgress = mod.download_progress;
            modItem.fileSize = mod.file_size;
            modItem.lastUpdateDate = mod.last_update_date;
            modItem.onlineUpdateDate = mod.online_update_date;
            modItem.onlineAvailable = mod.online_available;
            modItem.sourceType = mod.source_type;
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
                "source_type": mod.sourceType,
                "download_url": mod.downloadUrl,
                "cache_path": mod.cachePath,
                "file_size": mod.fileSize,
                "download_progress": mod.downloadProgress,
                "last_update_date": mod.lastUpdateDate,
                "online_update_date": mod.onlineUpdateDate,
                "online_available": mod.onlineAvailable,
            }
            mods.push(modItem);
        }

        const modList = {
            "version": this.version,
            "mods": mods
        }
        return JSON.stringify(modList, null, 4);
    }
}