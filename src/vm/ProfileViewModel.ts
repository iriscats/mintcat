import {ProfileTree, ProfileTreeItem} from "@/vm/config/ProfileList.ts";
import {StorageAPI} from "@/storage";
import {message} from "antd";
import {t} from "i18next";

export class ProfileViewModel {

    public get ProfileList(): string[] {
        return this.profileList.Profiles;
    }

    public get ActiveProfileName(): string {
        return this.profileList.activeProfile;
    }

    public get ActiveProfile(): ProfileTree {
        return this.profileTreeList.find(p => p.name === this.profileList.activeProfile)!;
    }

    public set ActiveProfile(activeProfile: string) {
        this.profileList.activeProfile = activeProfile;

        this.updateTreeViewCallback?.call(this);
    }

    public async setProfileData(root: ProfileTreeItem): Promise<void> {
        this.ActiveProfile.root = root;
    }

    public async addProfile(name: string, data: string): Promise<void> {
        if (this.profileList.Profiles.includes(name)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        const profileTree = ProfileTree.fromJson(data);
        profileTree.name = name;

        this.profileList.add(name);
        this.profileTreeList.push(profileTree);

        this.updateSelectCallback?.call(this);
    }

    public async removeProfile(name: string): Promise<void> {
        if (this.profileList.Profiles.length <= 1) {
            message.error(t("Profile must have at least one profile"));
            return;
        }
        this.profileList.remove(name);

        await StorageAPI.deleteProfileDetails(name);

        this.updateSelectCallback?.call(this);
        this.updateTreeViewCallback?.call(this);
    }

    public async renameProfile(oldName: string, newName: string): Promise<void> {
        if (this.profileList.Profiles.includes(newName)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        this.profileList.rename(oldName, newName);

        const profileTree = this.profileTreeList.find(p => p.name === oldName);
        profileTree.name = newName;

        await StorageAPI.renameProfileDetails(oldName, newName);

        this.updateSelectCallback?.call(this);
    }


}

