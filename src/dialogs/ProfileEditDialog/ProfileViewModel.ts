import {message} from "antd";
import {t} from "i18next";
import {StorageAPI} from "@/storage";
import {TreeViewModel} from "@/pages/HomePage/TreeViewModel.ts";
import {HomeViewModel} from "@/pages/HomePage/HomeViewModel.ts";


export class ProfileViewModel {

    private static instance: ProfileViewModel;

    public static async getInstance(): Promise<ProfileViewModel> {
        if (ProfileViewModel.instance) {
            return ProfileViewModel.instance;
        }
        ProfileViewModel.instance = new ProfileViewModel();
        return ProfileViewModel.instance;
    }

    public async getProfileList(): Promise<string[]> {
        const profiles = await StorageAPI.getProfiles();
        const profileData = await profiles.getAllProfiles();
        return profileData.map(p => p.name);
    }


    public async addProfile(name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const profileData = await profiles.getAllProfiles();

        if (profileData.some(p => p.name === name)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        await profiles.createProfile({
            name,
            displayName: name,
            gameId: 1,
            userId: 1,
            isActive: false
        });

        HomeViewModel.updateProfileSelect();
        TreeViewModel.updateTreeView();
    }

    public async removeProfile(name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const profileData = await profiles.getAllProfiles();

        if (profileData.length <= 1) {
            message.error(t("Profile must have at least one profile"));
            return;
        }

        const profile = profileData.find(p => p.name === name);
        if (profile) {
            await profiles.deleteProfile(profile.id!);
        }

        HomeViewModel.updateProfileSelect();
        TreeViewModel.updateTreeView();
    }

    public async renameProfile(oldName: string, newName: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const profileData = await profiles.getAllProfiles();

        if (profileData.some(p => p.name === newName)) {
            message.error(t("Profile Already Exists"));
            return;
        }

        const profile = profileData.find(p => p.name === oldName);
        if (profile) {
            await profiles.updateProfile(profile.id!, {name: newName});
        }

        HomeViewModel.updateProfileSelect();
    }
}
