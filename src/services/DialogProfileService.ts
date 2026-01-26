import { StorageAPI } from "@/storage";

export class DialogProfileService {
    public async getActiveProfileFolders() {
        const profileDAO = await StorageAPI.getProfiles();
        const profileData = await profileDAO.getActiveProfile();
        return await profileDAO.getProfileFolders(profileData.id);
    }
}
