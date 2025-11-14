import {emit} from "@tauri-apps/api/event";
import {StorageAPI} from "@/storage";
import {ProfileTree, ProfileTreeItem, ProfileTreeType} from "@/storage/db/Schema.ts";

export class TreeViewModel {

    private static instance: TreeViewModel;

    // Core data properties - will be loaded lazily
    private profileTreeList: ProfileTree[] = [];
    private activeProfileName: string = "default";

    // Callback functions
    public updateTreeView?: () => void;

    // Getters for accessing profile data
    public get ProfileList(): string[] {
        return this.profileTreeList.map(p => p.name);
    }

    public get ActiveProfileName(): string {
        return this.activeProfileName;
    }

    public get ActiveProfile(): ProfileTree {
        // Find all profiles with the matching name
        const profiles = this.profileTreeList.filter(p => p.name === this.activeProfileName);
        if (profiles.length === 0) {
            // Create a new profile if it doesn't exist
            const newProfile = new ProfileTree(this.activeProfileName);
            this.profileTreeList.push(newProfile);
            return newProfile;
        }

        // Return the profile with the most children (most recent/complete one)
        const profile = profiles.reduce((prev, curr) =>
            curr.root.children.length > prev.root.children.length ? curr : prev
        );

        return profile;
    }

    public set ActiveProfile(activeProfile: string) {
        this.activeProfileName = activeProfile;
        this.updateTreeView?.call(this);
    }

    public static updateTreeView() {
        console.log(`[TreeViewModel] updateTreeView() called - emitting event`);
        emit("home-page-update-tree-view").then(() => {
            console.log(`[TreeViewModel] home-page-update-tree-view event emitted`);
        }).catch((error) => {
            console.error(`[TreeViewModel] Failed to emit home-page-update-tree-view event:`, error);
        });
    }

    public static updateTreeViewCountLabel() {
        console.log(`[TreeViewModel] updateTreeViewCountLabel() called - emitting event`);
        emit("tree-view-count-label-update").then(() => {
            console.log(`[TreeViewModel] tree-view-count-label-update event emitted`);
        }).catch((error) => {
            console.error(`[TreeViewModel] Failed to emit tree-view-count-label-update event:`, error);
        });
    }

    private constructor() {
    }

    private async sortNode(modItem: ProfileTreeItem, order: string): Promise<ProfileTreeItem[]> {
        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();

        return modItem.children.sort((a, b) => {
            if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.ITEM) {
                const modAData = allMods.find(m => m.modId === a.id);
                const modBData = allMods.find(m => m.modId === b.id);

                // If mods not found, keep original order
                if (!modAData || !modBData) return 0;

                if (order === "asc") {
                    return modAData.displayName.localeCompare(modBData.displayName);
                } else if (order === "desc") {
                    return modAData.displayName.localeCompare(modBData.displayName) * -1;
                } else if (order === "time") {
                    const modAStatus = modAData.modId ? modsApi.getModStatus(modAData.modId) : null;
                    const modBStatus = modBData.modId ? modsApi.getModStatus(modBData.modId) : null;
                    // Simple time comparison - in real implementation, you'd get the actual status
                    return 0;
                }
            } else if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.FOLDER) {
                return -1;
            } else if (a.type === ProfileTreeType.FOLDER && b.type === ProfileTreeType.ITEM) {
                return 1;
            }
            return 0;
        })
    }

    public async sortMods(order: string): Promise<void> {
        if (this.ActiveProfile.ModioFolder) {
            this.ActiveProfile.ModioFolder.children = await this.sortNode(this.ActiveProfile.ModioFolder, order);
        }
        if (this.ActiveProfile.LocalFolder) {
            this.ActiveProfile.LocalFolder.children = await this.sortNode(this.ActiveProfile.LocalFolder, order);
        }
    }

    public async setGroupName(id: number, name: string): Promise<void> {
        const profiles = await StorageAPI.getProfiles();
        await profiles.setGroupName(id, name);

        // Also update in-memory structure for immediate UI update
        this.ActiveProfile.setGroupName(id, name);

        TreeViewModel.updateTreeView();
    }

    public async getGroupName(id: number): Promise<string | undefined> {
        return this.ActiveProfile.getGroupName(id);
    }

    public async setProfileData(root: ProfileTreeItem): Promise<void> {
        console.log(`[TreeViewModel] setProfileData called for profile: ${this.activeProfileName}`);
        try {
            // Update in-memory structure first
            const profile = this.profileTreeList.find(p => p.name === this.activeProfileName);
            if (profile) {
                console.log(`[TreeViewModel] Updating memory structure for profile: ${this.activeProfileName}`);
                console.log(`[TreeViewModel] Before update - root children count: ${profile.root.children.length}`);
                profile.root = root;
                console.log(`[TreeViewModel] After update - root children count: ${profile.root.children.length}`);
            } else {
                console.log(`[TreeViewModel] Profile not found: ${this.activeProfileName}`);
            }

            // Save to database
            console.log(`[TreeViewModel] Saving profile tree to database...`);
            try {
                await this.saveProfileTreeToDatabase(root);
                console.log(`[TreeViewModel] Profile tree saved to database successfully`);

                // CRITICAL FIX: Reload from database to ensure in-memory state matches database state
                // This synchronizes database-generated IDs with in-memory structure
                console.log(`[TreeViewModel] Reloading profile tree from database to synchronize IDs...`);
                await this.loadProfilesFromDatabase();
                console.log(`[TreeViewModel] Profile tree reloaded from database successfully`);
            } catch (saveError) {
                console.error(`[TreeViewModel] Failed to save profile tree to database:`, saveError);
                throw saveError;
            }
        } catch (error) {
            console.error('[TreeViewModel] Failed to set profile data:', error);
            throw error;
        }
    }

    /**
     * Collect top-level non-default folders and items from the tree
     * (not recursively - that will be handled by saveProfileTreeItems)
     */
    private collectNonDefaultItems(root: ProfileTreeItem, defaultFolders: any[]): ProfileTreeItem[] {
        const result: ProfileTreeItem[] = [];

        for (const item of root.children) {
            if (item.type === ProfileTreeType.FOLDER) {
                // Check if this is a default folder (Mod.io or Local)
                const isDefaultFolder = defaultFolders.some(f => f.name === item.name);
                console.log(`[TreeViewModel] Checking top-level folder: ${item.name}, id=${item.id}, isDefault=${isDefaultFolder}`);

                // For default folders, we skip them here because they're handled separately
                // but we still need to save their children as nested custom folders/items
                if (!isDefaultFolder) {
                    console.log(`[TreeViewModel] Adding top-level non-default folder to save list: ${item.name}, id=${item.id}`);
                    result.push(item);
                }
            } else if (item.type === ProfileTreeType.ITEM) {
                console.log(`[TreeViewModel] Adding top-level item to save list: id=${item.id}`);
                result.push(item);
            }
        }

        return result;
    }

    /**
     * Save ProfileTree to database
     */
    private async saveProfileTreeToDatabase(root: ProfileTreeItem): Promise<void> {
        console.log(`[TreeViewModel] saveProfileTreeToDatabase called, root has ${root.children.length} children`);
        const profileDAO = await StorageAPI.getProfiles();
        const activeProfile = await profileDAO.getActiveProfile();

        if (!activeProfile) {
            console.error('[TreeViewModel] No active profile found');
            return;
        }

        console.log(`[TreeViewModel] Active profile: ${activeProfile.name}, id=${activeProfile.id}`);

        try {
            // Get all folders and mods for this profile
            console.log(`[TreeViewModel] Getting existing folders and mods...`);
            const folders = await profileDAO.getProfileFolders(activeProfile.id!);
            const mods = await profileDAO.getProfileMods(activeProfile.id!);
            console.log(`[TreeViewModel] Found ${folders.length} folders and ${mods.length} mods`);

            // Get the default folders (Mod.io and Local) to preserve them
            const defaultFolders = folders.filter(f =>
                f.folderType === 'modio' || f.folderType === 'local'
            );
            console.log(`[TreeViewModel] Default folders:`, defaultFolders.map(f => ({ id: f.id, name: f.name, type: f.folderType })));

            // Delete all existing mods from profile
            console.log(`[TreeViewModel] Deleting existing mods...`);
            for (const mod of mods) {
                await profileDAO.removeModFromProfile(activeProfile.id!, mod.modId);
            }
            console.log(`[TreeViewModel] Deleted ${mods.length} mods`);

            // Delete only custom folders, keep default folders
            // We need to delete folders in reverse order (children before parents) to avoid foreign key constraints
            const customFolders = folders.filter(f => f.folderType === 'custom');
            customFolders.sort((a, b) => (b.id! - a.id!)); // Sort by ID descending to delete children before parents

            console.log(`[TreeViewModel] Deleting ${customFolders.length} custom folders...`);
            for (const folder of customFolders) {
                console.log(`[TreeViewModel] Deleting custom folder: ${folder.name} (id=${folder.id})`);
                await profileDAO.deleteFolder(folder.id!);
            }
            console.log(`[TreeViewModel] Deleted all custom folders`);

            // Save the tree structure for non-default folders/items
            // Recursively collect all non-default folders and items
            const itemsToSave = this.collectNonDefaultItems(root, defaultFolders);
            console.log(`[TreeViewModel] Items to save (non-default, including nested): ${itemsToSave.length}`, itemsToSave.map(i => ({ id: i.id, name: i.name, type: i.type })));

            await this.saveProfileTreeItems(itemsToSave, profileDAO, activeProfile.id!, null, 0);

            // Handle default folders separately
            console.log(`[TreeViewModel] Handling default folders...`);
            for (const defaultFolder of defaultFolders) {
                console.log(`[TreeViewModel] Processing default folder: ${defaultFolder.name} (id=${defaultFolder.id})`);
                const correspondingItem = root.children.find(item =>
                    item.type === ProfileTreeType.FOLDER && item.name === defaultFolder.name
                );

                if (correspondingItem) {
                    console.log(`[TreeViewModel] Found corresponding item in tree, saving...`);
                    await this.saveDefaultFolderItems(
                        correspondingItem,
                        profileDAO,
                        activeProfile.id!,
                        defaultFolder.id!
                    );
                    console.log(`[TreeViewModel] Default folder saved successfully`);
                } else {
                    console.log(`[TreeViewModel] No corresponding item found in tree for ${defaultFolder.name}`);
                }
            }

            console.log('[TreeViewModel] Profile tree saved to database successfully');
        } catch (error) {
            console.error('[TreeViewModel] Failed to save profile tree to database:', error);
            throw error;
        }
    }

    /**
     * Recursively save profile tree items to database
     */
    private async saveProfileTreeItems(
        items: ProfileTreeItem[],
        profileDAO: any,
        profileId: number,
        parentFolderId: number | null,
        sortOrder: number
    ): Promise<void> {
        console.log(`[TreeViewModel] saveProfileTreeItems called with ${items.length} items, parentFolderId=${parentFolderId}`);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`[TreeViewModel] Processing item: ${item.type}, id=${item.id}, name=${item.name}, sortOrder=${sortOrder + i}`);

            if (item.type === ProfileTreeType.FOLDER) {
                // Create folder
                console.log(`[TreeViewModel] Creating folder: ${item.name}, parentId=${parentFolderId}`);
                const folder = await profileDAO.createFolder({
                    profileId,
                    name: item.name,
                    parentFolderId,
                    folderType: 'custom',
                    sortOrder: sortOrder + i
                });

                console.log(`[TreeViewModel] Folder created:`, folder);

                if (folder) {
                    // Recursively save children
                    console.log(`[TreeViewModel] Recursively saving children of folder: ${item.name}, folderId=${folder.id}`);
                    await this.saveProfileTreeItems(
                        item.children,
                        profileDAO,
                        profileId,
                        folder.id!,
                        0
                    );
                } else {
                    console.error(`[TreeViewModel] Failed to create folder: ${item.name}`);
                }
            } else if (item.type === ProfileTreeType.ITEM) {
                // Create mod association
                console.log(`[TreeViewModel] Adding mod to profile: modId=${item.id}, parentFolderId=${parentFolderId}`);
                await profileDAO.addModToProfile({
                    profileId,
                    modId: item.id,
                    parentFolderId,
                    sortOrder: sortOrder + i,
                    isEnabled: true,
                    usedVersion: ""
                });
            }
        }
    }

    /**
     * Save items in a default folder (Mod.io or Local)
     */
    private async saveDefaultFolderItems(
        item: ProfileTreeItem,
        profileDAO: any,
        profileId: number,
        defaultFolderId: number
    ): Promise<void> {
        // Save mods in this default folder
        const mods = item.children.filter(child => child.type === ProfileTreeType.ITEM);
        for (let i = 0; i < mods.length; i++) {
            await profileDAO.addModToProfile({
                profileId,
                modId: mods[i].id,
                parentFolderId: defaultFolderId,
                sortOrder: i,
                isEnabled: true,
                usedVersion: ""
            });
        }

        // Save custom subfolders in this default folder
        const customFolders = item.children.filter(child =>
            child.type === ProfileTreeType.FOLDER
        );

        for (let i = 0; i < customFolders.length; i++) {
            const folder = await profileDAO.createFolder({
                profileId,
                name: customFolders[i].name,
                parentFolderId: defaultFolderId,
                folderType: 'custom',
                sortOrder: i
            });

            if (folder) {
                // Recursively save children of this custom folder
                await this.saveProfileTreeItems(
                    customFolders[i].children,
                    profileDAO,
                    profileId,
                    folder.id!,
                    0
                );
            }
        }
    }

    public async initializeData(): Promise<void> {
        try {
            // Load profile data from database
            await this.loadProfilesFromDatabase();

            // Initialize profile list with default data if needed
            if (this.profileTreeList.length === 0) {
                this.profileTreeList.push(new ProfileTree("default"));
                this.activeProfileName = "default";
            }

            // Ensure the active profile exists in the tree list
            const activeProfileTree = this.profileTreeList.find(p => p.name === this.activeProfileName);
            if (!activeProfileTree) {
                this.profileTreeList.push(new ProfileTree(this.activeProfileName));
            }

            // Update UI components
            TreeViewModel.updateTreeView();
            TreeViewModel.updateTreeViewCountLabel();

            // Notify frontend components that profile data is ready
            emit("home-page-update-profile-select").then();

        } catch (error) {
            console.error('TreeViewModel initialization failed:', error);

            // Attempt to recover with minimal setup
            try {
                // Ensure we have at least one profile
                if (this.profileTreeList.length === 0) {
                    this.profileTreeList.push(new ProfileTree("default"));
                    this.activeProfileName = "default";
                }

                TreeViewModel.updateTreeView();
                TreeViewModel.updateTreeViewCountLabel();

            } catch (recoveryError) {
                console.error('Recovery failed:', recoveryError);
            }
        }
    }

    /**
     * Load profiles from database and build the profile tree structure
     */
    private async loadProfilesFromDatabase(): Promise<void> {
        try {
            const profiles = await StorageAPI.getProfiles();
            const profileDataList = await profiles.getAllProfiles();

            // Find active profile
            const activeProfileData = profileDataList.find(p => p.isActive);
            if (activeProfileData) {
                this.activeProfileName = activeProfileData.name;
            } else if (profileDataList.length > 0) {
                this.activeProfileName = profileDataList[0].name;
            }

            // Build profile tree structures
            this.profileTreeList = [];
            for (const profileData of profileDataList) {
                const profileTree = await this.buildProfileTreeFromDatabase(profileData);
                this.profileTreeList.push(profileTree);
            }
        } catch (error) {
            console.error('Failed to load profiles from database:', error);
        }
    }

    /**
     * Build a profile tree structure from database data
     */
    private async buildProfileTreeFromDatabase(profileData: any): Promise<ProfileTree> {
        console.log(`[TreeViewModel] buildProfileTreeFromDatabase called for profile: ${profileData.name}, id=${profileData.id}`);
        const profiles = await StorageAPI.getProfiles();
        const profileTree = new ProfileTree(profileData.name);

        try {
            // Get profile tree data (folders and mods)
            console.log(`[TreeViewModel] Getting profile tree data from database...`);
            const treeData = await profiles.getProfileTree(profileData.id!);

            if (treeData) {
                console.log(`[TreeViewModel] Got treeData from database:`, {
                    foldersCount: treeData.folders.length,
                    rootModsCount: treeData.mods.length
                });

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

                const modsApi = await StorageAPI.getMods();
                const allModData = await modsApi.getAllMods();

                console.log(`[TreeViewModel] Folder tree structure from database:`, treeData.folders.map(f => ({
                    id: f.id,
                    name: f.name,
                    parentFolderId: f.parentFolderId,
                    childrenCount: f.children?.length || 0
                })));

                for (const folder of treeData.folders) {
                    console.log(`[TreeViewModel] Adding folder to tree: ${folder.name}, id=${folder.id}, parentFolderId=${folder.parentFolderId}`);
                    await this.addFolderToTree(profileTree, folder, allMods, allModData);
                }

                // Also handle root mods (mods without parent folder)
                const rootMods = treeData.mods.filter(mod => !mod.parentFolderId);
                for (const modData of rootMods) {
                    const modItem = allModData.find(m => m.modId === modData.modId);
                    if (modItem) {
                        profileTree.addMod(modItem.modId, 0); // Add to root
                    }
                }

                console.log(`[TreeViewModel] Profile tree built from database. Root children:`, profileTree.root.children.map(c => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    childrenCount: c.children.length
                })));
            } else {
                console.log(`[TreeViewModel] No treeData found for profile: ${profileData.name}`);
            }

        } catch (error) {
            console.error(`Failed to build profile tree for ${profileData.name}:`, error);
        }

        return profileTree;
    }

    /**
     * Add a folder and its mods to the profile tree
     */
    private async addFolderToTree(
        profileTree: ProfileTree,
        folderData: any,
        allMods: any[],
        allModData: any[],
        parentNode?: ProfileTreeItem
    ): Promise<void> {
        console.log(`[TreeViewModel] addFolderToTree called: folder=${folderData.name}, id=${folderData.id}, parentNode=${parentNode?.name || 'root'}`);
        console.log(`[TreeViewModel] Folder has ${folderData.children?.length || 0} children, ${folderData.mods?.length || 0} mods`);

        // Ensure the folder exists in the profile tree
        let folderNode = this.findFolderNode(profileTree.root, folderData.id);
        if (!folderNode) {
            // Create the folder node if it doesn't exist
            folderNode = new ProfileTreeItem(folderData.id, ProfileTreeType.FOLDER, folderData.name);

            // Add to appropriate parent
            if (parentNode) {
                parentNode.children.push(folderNode);
                console.log(`[TreeViewModel] Added folder ${folderData.name} (id=${folderData.id}) to parent ${parentNode.name} (id=${parentNode.id})`);
            } else {
                profileTree.root.children.push(folderNode);
                console.log(`[TreeViewModel] Added folder ${folderData.name} (id=${folderData.id}) to root`);
            }
        }

        // Add mods that belong to this folder
        // Check if folderData has mods property (from buildFolderTree)
        const folderMods = folderData.mods || allMods.filter(mod => mod.parentFolderId === folderData.id);
        console.log(`[TreeViewModel] Adding ${folderMods.length} mods to folder ${folderData.name}`);

        for (const modData of folderMods) {
            const modItem = allModData.find(m => m.modId === modData.modId);
            if (modItem) {
                folderNode.add(modItem.modId, ProfileTreeType.ITEM);
            } else {
                console.warn(`Mod not found for mod_id ${modData.modId} in folder ${folderData.name}`);
            }
        }

        // Recursively process child folders
        if (folderData.children && folderData.children.length > 0) {
            console.log(`[TreeViewModel] Processing ${folderData.children.length} child folders of ${folderData.name}`);
            for (const childFolder of folderData.children) {
                await this.addFolderToTree(profileTree, childFolder, allMods, allModData, folderNode);
            }
        } else {
            console.log(`[TreeViewModel] No child folders for ${folderData.name}`);
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

    public static async getInstance() {
        if (TreeViewModel.instance) {
            return TreeViewModel.instance;
        }
        TreeViewModel.instance = new TreeViewModel();
        await TreeViewModel.instance.initializeData();
        return TreeViewModel.instance;
    }

}