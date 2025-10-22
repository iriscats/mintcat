import {ProfileTree, ProfileTreeItem} from "@/vm/config/ProfileList.ts";
import {StorageAPI} from "@/storage";
import {message} from "antd";
import {t} from "i18next";
import {emit} from "@tauri-apps/api/event";

export class ProfileViewModel {

    private static instance: ProfileViewModel;

    // Core data properties
    private profileList: ProfileList = new ProfileList();
    private profileTreeList: ProfileTree[] = [];

    // Callback functions
    public updateTreeViewCallback?: () => void;

    public static updateSelectCallback() {
        emit("home-page-update-profile-select").then();
    }

    public get ProfileList(): string[] {
        return this.profileList.Profiles;
    }

    public get ActiveProfileName(): string {
        return this.profileList.activeProfile;
    }

    public get ActiveProfile(): ProfileTree {
        const profile = this.profileTreeList.find(p => p.name === this.profileList.activeProfile);
        if (!profile) {
            // Create a new profile if it doesn't exist
            const newProfile = new ProfileTree(this.profileList.activeProfile);
            this.profileTreeList.push(newProfile);
            return newProfile;
        }
        return profile;
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

    public static async getInstance(): Promise<ProfileViewModel> {
        if (ProfileViewModel.instance) {
            return ProfileViewModel.instance;
        }
        ProfileViewModel.instance = new ProfileViewModel();
        return ProfileViewModel.instance;
    }

}

