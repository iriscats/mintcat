import {message} from "antd";
import {t} from "i18next";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {path} from "@tauri-apps/api";
import {emit} from "@tauri-apps/api/event";
import {ModioApi} from "@/apis/modio";
import {ModList, ModListItem, ModSourceType} from "./config/ModList.ts";
import {
    ProfileList,
    ProfileTree,
    ProfileTreeGroupType,
    ProfileTreeItem,
    ProfileTreeType
} from "./config/ProfileList.ts";
import {ModUpdateApi} from "@/apis/ModUpdateApi.ts";
import {StorageAPI} from "@/storage";
import StatusBar from "@/components/StatusBar.tsx";

export class HomeViewModel {

    private static instance: HomeViewModel;

    // Core data properties
    private profileList: ProfileList = new ProfileList();
    private profileTreeList: ProfileTree[] = [];
    private modList: ModList = new ModList();

    // Callback functions
    public updateTreeView?: () => void;

    // Getters for accessing profile and mod data
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
        this.updateTreeView?.call(this);
    }

    public get ModList(): ModList {
        return this.modList;
    }

    public static updateTreeView() {
        emit("home-page-update-tree-view").then();
    }

    public static updateTreeViewCountLabel() {
        emit("tree-view-count-label-update").then();
    }

    private constructor() {
    }

    private async addModDependencies(modList: ModList, modId: number, groupId: number): Promise<void> {
        await StatusBar.log(t("Fetch Mod Dependencies"));

        const depends = await ModioApi.getDependencies(modId);
        if (!depends) {
            return;
        }

        for (const depend of depends) {
            const modItem = new ModListItem(depend);
            if (modList.getByModId(modItem.modId)) {
                continue;
            }

            // Use helper function to add mod to database and profile
            const addedModItem = await this.addModToDatabaseAndProfile(modItem, groupId);
            if (!addedModItem) {
                continue;
            }

            // Also add to in-memory structure for immediate UI update
            this.ActiveProfile.addMod(addedModItem.id, groupId);
            this.updateTreeView?.call(this);

            await ModUpdateApi.updateMod(addedModItem);
        }
    }

    public async addModFromUrl(url: string, groupId: number): Promise<boolean> {
        await StatusBar.log(t("Fetch Mod Info"));
        const modInfoResp = await ModioApi.getModInfoByLink(url);
        if (modInfoResp === undefined) {
            return false;
        }

        const profiles = await StorageAPI.getProfiles();

        if (await profiles.checkModExits(modInfoResp)) {
            message.warning(`${t("Mod Already Exists")} ${modInfoResp.name}`);
            return true;
        }

        const modItem = new ModListItem(modInfoResp);

        // Use helper function to add mod to database and profile
        const addedModItem = await this.addModToDatabaseAndProfile(modItem, groupId);
        if (!addedModItem) {
            message.error(t("Failed to add mod to database"));
            return false;
        }

        // Add to in-memory structure for immediate UI update
        this.ActiveProfile.addMod(addedModItem.id, groupId);

        await ModUpdateApi.updateMod(addedModItem);

        if (modInfoResp.dependencies) {
            await this.addModDependencies(this.modList, modInfoResp.id, groupId);
        }

        HomeViewModel.updateTreeView();
        HomeViewModel.updateTreeViewCountLabel();

        return true;
    }

    public async addModFromPath(modPath: string, groupId: number): Promise<boolean> {
        let modListItem = new ModListItem();
        modListItem.displayName = await path.basename(modPath);
        modListItem.url = modPath;
        modListItem.cachePath = modPath;
        if (!await exists(modPath)) {
            message.warning(t("Mod Path No Exists" + modPath));
            return true;
        }

        const subModList = this.ActiveProfile.getModList(this.ModList);
        if (subModList.getByUrl(modPath)) {
            message.error(t("Mod Already Exists"));
            return false;
        }

        const fileInfo = await stat(modPath);
        modListItem.lastUpdateDate = fileInfo.mtime.getTime();

        const foundItem = this.ModList.getByUrl(modPath);
        let addedModItem: ModListItem;
        if (foundItem) {
            addedModItem = foundItem;
        } else {
            addedModItem = this.ModList.add(modListItem);
        }
        this.ActiveProfile.addMod(addedModItem.id, groupId);

        HomeViewModel.updateTreeView();
        HomeViewModel.updateTreeViewCountLabel();

        return true;
    }

    private sortNode(modItem: ProfileTreeItem, order: string): ProfileTreeItem[] {
        return modItem.children.sort((a, b) => {
            if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.ITEM) {
                const modA = this.ModList.get(a.id);
                const modB = this.ModList.get(b.id);
                if (order === "asc") {
                    return modA.displayName.localeCompare(modB.displayName);
                } else if (order === "desc") {
                    return modA.displayName.localeCompare(modB.displayName) * -1;
                } else if (order === "time") {
                    return modA.lastUpdateDate > modB.lastUpdateDate ? 1 : -1;
                }
            } else if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.FOLDER) {
                return -1;
            } else if (a.type === ProfileTreeType.FOLDER && b.type === ProfileTreeType.ITEM) {
                return 1;
            }
        })
    }

    public async sortMods(order: string): Promise<void> {
        if (this.ActiveProfile.ModioFolder) {
            this.ActiveProfile.ModioFolder.children = this.sortNode(this.ActiveProfile.ModioFolder, order);
        }
        if (this.ActiveProfile.LocalFolder) {
            this.ActiveProfile.LocalFolder.children = this.sortNode(this.ActiveProfile.LocalFolder, order);
        }
    }

    public async removeMod(id: number): Promise<void> {
        this.ActiveProfile.removeMod(id);

        HomeViewModel.updateTreeView();
        HomeViewModel.updateTreeViewCountLabel();

    }

    public async setDisplayName(id: number, name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setDisplayName(id, name);

        HomeViewModel.updateTreeView();
    }

    public async setModEnabled(modId: number, enable: boolean): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            console.error("No active profile found");
            return;
        }
        await profiles.setModEnabled(activeProfile.id!, modId, enable);
    }

    public async setModUsedVersion(id: number, version: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        const activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            console.error("No active profile found");
            return;
        }

        // Update the used version in the profile_mods table
        await profiles.updateProfileMod(id, { usedVersion: version });
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setGroupName(id, name);

        HomeViewModel.updateTreeView();
    }

    /**
     * Helper function to convert ModListItem to ModData for database storage
     */
    private modItemToModData(modItem: ModListItem): any {
        return {
            platform_id: modItem.modId,
            game_id: 2475, // DRG game ID - should get from active game
            name_id: modItem.nameId,
            display_name: modItem.displayName,
            url: modItem.url,
            source_type: modItem.sourceType,
            tags: JSON.stringify(modItem.tags || []),
            approval_status: modItem.approval || "Sandbox"
        };
    }

    /**
     * Helper function to add a mod to both database and in-memory structure
     */
    private async addModToDatabaseAndProfile(modItem: ModListItem, groupId: number): Promise<ModListItem | null> {
        const mods = await StorageAPI.getMods();
        const profiles = await StorageAPI.getProfiles();

        // Convert to ModData for database storage
        const modData = this.modItemToModData(modItem);

        // Add mod to database
        const addedModData = await mods.addMod(modData);
        if (!addedModData) {
            return null;
        }

        // Get active profile
        const activeProfile = await profiles.getActiveProfile();
        if (!activeProfile) {
            console.error("No active profile found");
            return null;
        }

        // Add mod to profile database with proper parameters
        await profiles.addModToProfile({
            profileId: activeProfile.id!,
            modId: addedModData.modId!,
            parentFolderId: groupId,
            sortOrder: 0,
            isEnabled: true,
            usedVersion: modItem.usedVersion || ""
        });

        // Create ModListItem for UI operations with proper database ID
        const resultModItem = new ModListItem();
        Object.assign(resultModItem, modItem);
        resultModItem.modId = addedModData.modId!;

        return resultModItem;
    }

    public async addGroup(parentGroupId: number, groupName: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.addGroup(groupName, parentGroupId);

        HomeViewModel.updateTreeView();
    }

    public async removeGroup(groupId: number): Promise<void> {
        if (groupId === ProfileTreeGroupType.MODIO || groupId === ProfileTreeGroupType.LOCAL) {
            message.error(t("Can't Remove Default Group"));
            return;
        }

        const profiles = await StorageAPI.getProfiles();
        await profiles.removeGroup(groupId);

        HomeViewModel.updateTreeView();
        HomeViewModel.updateTreeViewCountLabel();
    }

    public async setProfileData(root: ProfileTreeItem): Promise<void> {
        try {
            this.ActiveProfile.root = root;
        } catch (error) {
            console.error('Failed to set profile data:', error);
        }
    }


      public async initializeData(): Promise<void> {
        try {
            // Load mods from database into memory - CRITICAL: This must be done first
            await this.loadModsFromDatabase();

            if (this.modList.Mods.length === 0) {
                console.warn('No mods loaded. Tree view will be empty.');
            }

            // Load profile data from database - this depends on mods being loaded first
            await this.loadProfilesFromDatabase();

            // Initialize profile list with default data if needed
            if (this.profileList.Profiles.length === 0) {
                this.profileList.add("default");
                this.profileTreeList.push(new ProfileTree("default"));
            }

            // Ensure the active profile exists in the tree list
            const activeProfileTree = this.profileTreeList.find(p => p.name === this.profileList.activeProfile);
            if (!activeProfileTree) {
                this.profileTreeList.push(new ProfileTree(this.profileList.activeProfile));
            }

            // Update UI components
            HomeViewModel.updateTreeView();
            HomeViewModel.updateTreeViewCountLabel();

            // Notify frontend components that profile data is ready
            emit("home-page-update-profile-select").then();

        } catch (error) {
            console.error('HomeViewModel initialization failed:', error);

            // Attempt to recover with minimal setup
            try {
                // Ensure we have at least one profile
                if (this.profileList.Profiles.length === 0) {
                    this.profileList.add("default");
                    this.profileTreeList.push(new ProfileTree("default"));
                }

                HomeViewModel.updateTreeView();
                HomeViewModel.updateTreeViewCountLabel();

            } catch (recoveryError) {
                console.error('Recovery failed:', recoveryError);
            }
        }
    }

    /**
     * Load mods from database into the in-memory ModList
     */
    private async loadModsFromDatabase(): Promise<void> {
        try {
            const modsApi = await StorageAPI.getMods();
            const allMods = await modsApi.getAllMods();

            if (allMods.length === 0) {
                console.warn('No mods found in database. This might indicate a database issue.');
                return;
            }

            // Get complete mod data including versions, downloads, and status
            const completeMods = await Promise.all(
                allMods.map(async (modData) => {
                    try {
                        const completeMod = await modsApi.getCompleteModData(modData.modId!);
                        return this.convertCompleteModDataToModListItem(completeMod);
                    } catch (modError) {
                        console.error(`Error processing mod ${modData.displayName}:`, modError);
                        return null;
                    }
                })
            );

            let loadedCount = 0;
            for (const modItem of completeMods) {
                if (modItem) {
                    this.modList.add(modItem);
                    loadedCount++;
                }
            }

            console.log(`Loaded ${loadedCount} mods into memory`);
        } catch (error) {
            console.error('Failed to load mods from database:', error);
        }
    }

    /**
     * Load profiles from database and build the profile tree structure
     */
    private async loadProfilesFromDatabase(): Promise<void> {
        try {
            const profiles = await StorageAPI.getProfiles();
            const profileDataList = await profiles.getAllProfiles();

            for (const profileData of profileDataList) {
                this.profileList.add(profileData.name);
            }

            // Find active profile
            const activeProfileData = profileDataList.find(p => p.isActive);
            if (activeProfileData) {
                this.profileList.activeProfile = activeProfileData.name;
            } else if (profileDataList.length > 0) {
                this.profileList.activeProfile = profileDataList[0].name;
            }

            // Build profile tree structures
            this.profileTreeList = [];
            for (const profileData of profileDataList) {
                const profileTree = await this.buildProfileTreeFromDatabase(profileData);
                this.profileTreeList.push(profileTree);
            }

            console.log(`Loaded ${this.profileTreeList.length} profile trees`);
        } catch (error) {
            console.error('Failed to load profiles from database:', error);
        }
    }

    /**
     * Build a profile tree structure from database data
     */
    private async buildProfileTreeFromDatabase(profileData: any): Promise<ProfileTree> {
        const profiles = await StorageAPI.getProfiles();
        const profileTree = new ProfileTree(profileData.name);

        try {
            // Get profile tree data (folders and mods)
            const treeData = await profiles.getProfileTree(profileData.id!);

            if (treeData) {
                // Clear the default root children and rebuild from database
                profileTree.root.children = [];

                // Build folder structure and add mods
                // Collect all mods including those in folders
                const allMods: any[] = [...treeData.mods];
                for (const folder of treeData.folders) {
                    if (folder.mods && folder.mods.length > 0) {
                        allMods.push(...folder.mods);
                    }
                }

                for (const folder of treeData.folders) {
                    await this.addFolderToTree(profileTree, folder, allMods);
                }

                // Also handle root mods (mods without parent folder)
                const rootMods = treeData.mods.filter(mod => !mod.parentFolderId);
                for (const modData of rootMods) {
                    const modItem = this.modList.get(modData.modId);
                    if (modItem) {
                        modItem.enabled = modData.isEnabled;
                        modItem.usedVersion = modData.usedVersion || "";
                        profileTree.addMod(modItem.id, 0); // Add to root
                    } else {
                        console.warn(`Root mod not found for mod_id ${modData.modId}`);
                    }
                }
            }

        } catch (error) {
            console.error(`Failed to build profile tree for ${profileData.name}:`, error);
        }

        return profileTree;
    }

    /**
     * Add a folder and its mods to the profile tree
     */
    private async addFolderToTree(profileTree: ProfileTree, folderData: any, allMods: any[], parentNode?: ProfileTreeItem): Promise<void> {
        // Ensure the folder exists in the profile tree
        let folderNode = this.findFolderNode(profileTree.root, folderData.id);
        if (!folderNode) {
            // Create the folder node if it doesn't exist
            folderNode = new ProfileTreeItem(folderData.id, ProfileTreeType.FOLDER, folderData.name);

            // Add to appropriate parent
            if (parentNode) {
                parentNode.children.push(folderNode);
            } else {
                profileTree.root.children.push(folderNode);
            }
        }

        // Add mods that belong to this folder
        // Check if folderData has mods property (from buildFolderTree)
        const folderMods = folderData.mods || allMods.filter(mod => mod.parentFolderId === folderData.id);

        for (const modData of folderMods) {
            const modItem = this.modList.get(modData.modId);
            if (modItem) {
                modItem.enabled = modData.isEnabled;
                modItem.usedVersion = modData.usedVersion || "";
                folderNode.add(modItem.id, ProfileTreeType.ITEM);
            } else {
                console.warn(`Mod not found for mod_id ${modData.modId} in folder ${folderData.name}`);
            }
        }

        // Recursively process child folders
        if (folderData.children && folderData.children.length > 0) {
            for (const childFolder of folderData.children) {
                await this.addFolderToTree(profileTree, childFolder, allMods, folderNode);
            }
        }
    }

    /**
     * Find a folder node by ID in the profile tree
     */
    private findFolderNode(root: ProfileTreeItem, folderId: number): ProfileTreeItem | null {
        if (root.type === ProfileTreeType.FOLDER && root.id === folderId) {
            return root;
        }

        for (const child of root.children) {
            const found = this.findFolderNode(child, folderId);
            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * Convert CompleteModData to ModListItem
     */
    private convertCompleteModDataToModListItem(completeMod: any): ModListItem | null {
        if (!completeMod) return null;

        const modItem = new ModListItem();

        // Basic mod info
        modItem.modId = completeMod.platformId || 0;
        modItem.nameId = completeMod.nameId;
        modItem.displayName = completeMod.displayName;
        modItem.url = completeMod.url || "";
        modItem.sourceType = completeMod.sourceType as ModSourceType || ModSourceType.Unknown;
        modItem.tags = completeMod.tags ? completeMod.tags : [];
        modItem.approval = completeMod.approvalStatus || "Sandbox";

        // Version info
        if (completeMod.version) {
            modItem.fileVersion = completeMod.version.currentVersion || "-";
            modItem.versions = completeMod.version.availableVersions || [];
            modItem.usedVersion = completeMod.version.currentVersion || "-";
        }

        // Download info
        if (completeMod.download) {
            modItem.downloadUrl = completeMod.download.downloadUrl || "";
            modItem.cachePath = completeMod.download.cachePath || "";
            modItem.fileSize = completeMod.download.fileSize || 0;
            modItem.downloadProgress = completeMod.download.downloadProgress || 100;
        }

        // Status info
        if (completeMod.status) {
            modItem.lastUpdateDate = completeMod.status.lastUpdateDate || Date.now();
            modItem.onlineUpdateDate = completeMod.status.onlineUpdateDate || Date.now();
            modItem.onlineAvailable = completeMod.status.isOnlineAvailable !== false;
            modItem.localNoFound = completeMod.status.isLocalNotFound === true;
        }

        // Use database modId as the item ID to ensure proper mapping
        modItem.id = completeMod.modId;

        return modItem;
    }

    public static async getInstance() {
        if (HomeViewModel.instance) {
            return HomeViewModel.instance;
        }
        HomeViewModel.instance = new HomeViewModel();
        await HomeViewModel.instance.initializeData();
        return HomeViewModel.instance;
    }

}

