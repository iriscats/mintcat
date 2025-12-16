import {message} from "antd";
import {t} from "i18next";
import {StorageAPI} from "@/storage";
import {ProfileTree, ProfileTreeItem, ProfileTreeType} from "@/storage/db/Schema.ts";
import {TreeViewModel} from "@/pages/HomePage/TreeViewModel.ts";
import {HomeViewModel} from "@/pages/HomePage/HomeViewModel.ts";


/**
 * ProfileViewModel manages profile-level operations and persistence
 * Handles profile CRUD operations and profile tree data persistence
 * Single source of truth for profile data
 */
export class ProfileViewModel {

    private static instance: ProfileViewModel;

    // Profile data - single source of truth
    private profileTreeList: ProfileTree[] = [];
    private activeProfileName: string = "default";

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
        return profiles.reduce((prev, curr) =>
            curr.root.children.length > prev.root.children.length ? curr : prev
        );
    }

    public setActiveProfile(profileName: string): void {
        this.activeProfileName = profileName;
    }

    /**
     * Update profile data in memory
     * This updates the in-memory structure immediately for UI responsiveness
     */
    public updateProfileData(root: ProfileTreeItem): void {
        const profile = this.profileTreeList.find(p => p.name === this.activeProfileName);
        if (profile) {
            console.log(`[ProfileViewModel] ✅ 找到内存中的 profile，准备更新: ${this.activeProfileName}`);
            profile.root = root;
        } else {
            console.log(`[ProfileViewModel] ❌ 未找到 profile: ${this.activeProfileName}`);
        }
    }

    public static async getInstance(): Promise<ProfileViewModel> {
        if (ProfileViewModel.instance) {
            return ProfileViewModel.instance;
        }
        ProfileViewModel.instance = new ProfileViewModel();
        return ProfileViewModel.instance;
    }

    // ====================================
    // Profile CRUD Operations
    // ====================================

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

        const newProfile = await profiles.createProfile({
            name,
            displayName: name,
            gameId: 1,
            userId: 1,
            isActive: false
        });

        // Create default folders for the new profile (business logic)
        if (newProfile && newProfile.id) {
            await this.createDefaultFolders(newProfile.id);
        }

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

    // ====================================
    // Profile Tree Data Persistence
    // ====================================

    /**
     * Save ProfileTree to database
     */
    public async saveProfileTreeToDatabase(root: ProfileTreeItem): Promise<void> {
        console.log(`\n========== [ProfileViewModel] saveProfileTreeToDatabase 开始 ==========`);
        console.log(`[ProfileViewModel] 传入的 root 有 ${root.children.length} 个子项`);
        console.log(`[ProfileViewModel] root children:`, root.children.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            childrenCount: c.children?.length || 0
        })));

        const profileDAO = await StorageAPI.getProfiles();
        const activeProfile = await profileDAO.getActiveProfile();

        if (!activeProfile) {
            console.error('[ProfileViewModel] ❌ 未找到活跃的 profile');
            return;
        }

        console.log(`[ProfileViewModel] 活跃的 profile: ${activeProfile.name}, id=${activeProfile.id}`);

        try {
            // Get all folders and mods for this profile
            console.log(`[ProfileViewModel] 获取现有的 folders 和 mods...`);
            const folders = await profileDAO.getProfileFolders(activeProfile.id!);
            const mods = await profileDAO.getProfileMods(activeProfile.id!);
            console.log(`[ProfileViewModel] 找到 ${folders.length} 个 folders 和 ${mods.length} 个 mods`);
            console.log(`[ProfileViewModel] 现有 folders:`, folders.map(f => ({ id: f.id, name: f.name, type: f.folderType })));
            console.log(`[ProfileViewModel] 现有 mods:`, mods.map(m => ({ modId: m.modId, parentFolderId: m.parentFolderId })));

            // Get the default folders (Mod.io and Local) to preserve them
            const defaultFolders = folders.filter(f =>
                f.folderType === 'modio' || f.folderType === 'local'
            );
            console.log(`[ProfileViewModel] 默认 folders (Mod.io 和 Local):`, defaultFolders.map(f => ({
                id: f.id,
                name: f.name,
                type: f.folderType
            })));

            // Delete all existing mods from profile
            console.log(`[ProfileViewModel] 开始删除现有的 ${mods.length} 个 mods...`);
            for (const mod of mods) {
                console.log(`[ProfileViewModel] 删除 mod: modId=${mod.modId}`);
                await profileDAO.removeModFromProfile(activeProfile.id!, mod.modId);
            }
            console.log(`[ProfileViewModel] ✅ 已删除 ${mods.length} 个 mods`);

            // Delete only custom folders, keep default folders
            // We need to delete folders in reverse order (children before parents) to avoid foreign key constraints
            const customFolders = folders.filter(f => f.folderType === 'custom');
            customFolders.sort((a, b) => (b.id! - a.id!)); // Sort by ID descending to delete children before parents

            console.log(`[ProfileViewModel] 开始删除 ${customFolders.length} 个自定义 folders...`);
            for (const folder of customFolders) {
                console.log(`[ProfileViewModel] 删除自定义 folder: ${folder.name} (id=${folder.id})`);
                await profileDAO.deleteFolder(folder.id!);
            }
            console.log(`[ProfileViewModel] ✅ 已删除所有自定义 folders`);

            // Save the tree structure for non-default folders/items
            // Recursively collect all non-default folders and items
            const itemsToSave = this.collectNonDefaultItems(root, defaultFolders);
            console.log(`[ProfileViewModel] 需要保存的非默认 items (包括嵌套): ${itemsToSave.length} 个`, itemsToSave.map(i => ({
                id: i.id,
                name: i.name,
                type: i.type
            })));

            await this.saveProfileTreeItems(itemsToSave, profileDAO, activeProfile.id!, null, 0);

            // Handle default folders separately
            console.log(`[ProfileViewModel] 开始处理默认 folders...`);
            for (const defaultFolder of defaultFolders) {
                console.log(`\n[ProfileViewModel] 处理默认 folder: ${defaultFolder.name} (id=${defaultFolder.id})`);
                const correspondingItem = root.children.find(item =>
                    item.type === ProfileTreeType.FOLDER && item.name === defaultFolder.name
                );

                console.log(`[ProfileViewModel] 查找对应的 tree item:`, correspondingItem ? {
                    found: true,
                    item: {
                        id: correspondingItem.id,
                        name: correspondingItem.name,
                        childrenCount: correspondingItem.children?.length || 0
                    }
                } : { found: false });

                if (correspondingItem) {
                    console.log(`[ProfileViewModel] 在 tree 中找到对应的 item，开始保存...`);
                    await this.saveDefaultFolderItems(
                        correspondingItem,
                        profileDAO,
                        activeProfile.id!,
                        defaultFolder.id!
                    );
                    console.log(`[ProfileViewModel] ✅ 默认 folder 保存成功`);
                } else {
                    console.log(`[ProfileViewModel] ⚠️ 在 tree 中未找到对应的 item: ${defaultFolder.name}`);
                }
            }

            console.log(`[ProfileViewModel] ✅ Profile tree 成功保存到数据库`);
            console.log(`========== [ProfileViewModel] saveProfileTreeToDatabase 完成 ==========\n`);
        } catch (error) {
            console.error('[ProfileViewModel] ❌ 保存 profile tree 到数据库失败:', error);
            console.log(`========== [ProfileViewModel] saveProfileTreeToDatabase 失败 ==========\n`);
            throw error;
        }
    }

    /**
     * Collect top-level non-default folders and items from the tree
     * (not recursively - that will be handled by saveProfileTreeItems)
     */
    private collectNonDefaultItems(root: ProfileTreeItem, defaultFolders: any[]): ProfileTreeItem[] {
        console.log(`\n========== [ProfileViewModel] collectNonDefaultItems 开始 ==========`);
        console.log(`[ProfileViewModel] 传入的 root.children 数量: ${root.children.length}`);
        console.log(`[ProfileViewModel] 默认 folders 列表:`, defaultFolders.map(f => ({ id: f.id, name: f.name, type: f.folderType })));

        const result: ProfileTreeItem[] = [];

        for (const item of root.children) {
            if (item.type === ProfileTreeType.FOLDER) {
                // Check if this is a default folder (Mod.io or Local)
                const isDefaultFolder = defaultFolders.some(f => f.name === item.name);
                console.log(`[ProfileViewModel] 检查顶级 folder: ${item.name}, id=${item.id}, isDefault=${isDefaultFolder}`);

                // For default folders, we skip them here because they're handled separately
                // but we still need to save their children as nested custom folders/items
                if (!isDefaultFolder) {
                    console.log(`[ProfileViewModel] ✅ 添加顶级非默认 folder 到保存列表: ${item.name}, id=${item.id}`);
                    result.push(item);
                } else {
                    console.log(`[ProfileViewModel] ⏭️ 跳过默认 folder，将单独处理: ${item.name}`);
                }
            } else if (item.type === ProfileTreeType.ITEM) {
                console.log(`[ProfileViewModel] ✅ 添加顶级 item 到保存列表: id=${item.id}, childrenCount=${item.children?.length || 0}`);
                result.push(item);
            }
        }

        console.log(`[ProfileViewModel] 返回的 result 数量: ${result.length}`);
        console.log(`[ProfileViewModel] result 列表:`, result.map(i => ({ id: i.id, name: i.name, type: i.type })));
        console.log(`========== [ProfileViewModel] collectNonDefaultItems 完成 ==========\n`);

        return result;
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
        console.log(`[ProfileViewModel] saveProfileTreeItems called with ${items.length} items, parentFolderId=${parentFolderId}`);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`[ProfileViewModel] Processing item: ${item.type}, id=${item.id}, name=${item.name}, sortOrder=${sortOrder + i}`);

            if (item.type === ProfileTreeType.FOLDER) {
                // Create folder
                console.log(`[ProfileViewModel] Creating folder: ${item.name}, parentId=${parentFolderId}`);
                const folder = await profileDAO.createFolder({
                    profileId,
                    name: item.name,
                    parentFolderId,
                    folderType: 'custom',
                    sortOrder: sortOrder + i
                });

                console.log(`[ProfileViewModel] Folder created:`, folder);

                if (folder) {
                    // Recursively save children
                    console.log(`[ProfileViewModel] Recursively saving children of folder: ${item.name}, folderId=${folder.id}`);
                    await this.saveProfileTreeItems(
                        item.children,
                        profileDAO,
                        profileId,
                        folder.id!,
                        0
                    );
                } else {
                    console.error(`[ProfileViewModel] Failed to create folder: ${item.name}`);
                }
            } else if (item.type === ProfileTreeType.ITEM) {
                // Create mod association
                console.log(`[ProfileViewModel] Adding mod to profile: modId=${item.id}, parentFolderId=${parentFolderId}`);
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
        console.log(`\n========== [ProfileViewModel] saveDefaultFolderItems 开始 ==========`);
        console.log(`[ProfileViewModel] 处理默认 folder，item:`, {
            id: item.id,
            name: item.name,
            type: item.type,
            childrenCount: item.children.length
        });
        console.log(`[ProfileViewModel] 参数: profileId=${profileId}, defaultFolderId=${defaultFolderId}`);

        // Save mods in this default folder
        const mods = item.children.filter(child => child.type === ProfileTreeType.ITEM);
        console.log(`[ProfileViewModel] 在默认文件夹中找到 ${mods.length} 个 mods:`, mods.map(m => ({ id: m.id, name: m.name })));

        for (let i = 0; i < mods.length; i++) {
            console.log(`[ProfileViewModel] 添加 mod 到默认文件夹 [${i + 1}/${mods.length}]: modId=${mods[i].id}, name=${mods[i].name}, parentFolderId=${defaultFolderId}, sortOrder=${i}`);
            await profileDAO.addModToProfile({
                profileId,
                modId: mods[i].id,
                parentFolderId: defaultFolderId,
                sortOrder: i,
                isEnabled: true,
                usedVersion: ""
            });
        }
        console.log(`[ProfileViewModel] ✅ 成功添加 ${mods.length} 个 mods 到默认文件夹`);

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

    /**
     * Load profiles from database and build the profile tree structure
     * Updates internal profileTreeList and activeProfileName
     */
    public async loadProfilesFromDatabase(): Promise<void> {
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

            // Initialize with default profile if empty
            if (this.profileTreeList.length === 0) {
                this.profileTreeList.push(new ProfileTree("default"));
                this.activeProfileName = "default";
            }

            // Ensure the active profile exists in the tree list
            const activeProfileTree = this.profileTreeList.find(p => p.name === this.activeProfileName);
            if (!activeProfileTree) {
                this.profileTreeList.push(new ProfileTree(this.activeProfileName));
            }
        } catch (error) {
            console.error('[ProfileViewModel] Failed to load profiles from database:', error);
            // Initialize with default on error
            if (this.profileTreeList.length === 0) {
                this.profileTreeList.push(new ProfileTree("default"));
                this.activeProfileName = "default";
            }
        }
    }

    /**
     * Build a profile tree structure from database data
     */
    private async buildProfileTreeFromDatabase(profileData: any): Promise<ProfileTree> {
        console.log(`[ProfileViewModel] buildProfileTreeFromDatabase called for profile: ${profileData.name}, id=${profileData.id}`);
        const profiles = await StorageAPI.getProfiles();
        const profileTree = new ProfileTree(profileData.name);

        try {
            // Get profile tree data (folders and mods)
            console.log(`[ProfileViewModel] Getting profile tree data from database...`);
            const treeData = await profiles.getProfileTree(profileData.id!);

            if (treeData) {
                console.log(`[ProfileViewModel] Got treeData from database:`, {
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

                console.log(`[ProfileViewModel] Folder tree structure from database:`, treeData.folders.map(f => ({
                    id: f.id,
                    name: f.name,
                    parentFolderId: f.parentFolderId,
                    childrenCount: f.children?.length || 0
                })));

                for (const folder of treeData.folders) {
                    console.log(`[ProfileViewModel] Adding folder to tree: ${folder.name}, id=${folder.id}, parentFolderId=${folder.parentFolderId}`);
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

                console.log(`[ProfileViewModel] Profile tree built from database. Root children:`, profileTree.root.children.map(c => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    childrenCount: c.children.length
                })));
            } else {
                console.log(`[ProfileViewModel] No treeData found for profile: ${profileData.name}`);
            }

        } catch (error) {
            console.error(`[ProfileViewModel] Failed to build profile tree for ${profileData.name}:`, error);
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
        console.log(`[ProfileViewModel] addFolderToTree called: folder=${folderData.name}, id=${folderData.id}, parentNode=${parentNode?.name || 'root'}`);
        console.log(`[ProfileViewModel] Folder has ${folderData.children?.length || 0} children, ${folderData.mods?.length || 0} mods`);

        // Ensure the folder exists in the profile tree
        let folderNode = this.findFolderNode(profileTree.root, folderData.id);
        if (!folderNode) {
            // Create the folder node if it doesn't exist
            folderNode = new ProfileTreeItem(folderData.id, ProfileTreeType.FOLDER, folderData.name);

            // Add to appropriate parent
            if (parentNode) {
                parentNode.children.push(folderNode);
                console.log(`[ProfileViewModel] Added folder ${folderData.name} (id=${folderData.id}) to parent ${parentNode.name} (id=${parentNode.id})`);
            } else {
                profileTree.root.children.push(folderNode);
                console.log(`[ProfileViewModel] Added folder ${folderData.name} (id=${folderData.id}) to root`);
            }
        }

        // Add mods that belong to this folder
        // Check if folderData has mods property (from buildFolderTree)
        const folderMods = folderData.mods || allMods.filter(mod => mod.parentFolderId === folderData.id);
        console.log(`[ProfileViewModel] Adding ${folderMods.length} mods to folder ${folderData.name}`);

        for (const modData of folderMods) {
            const modItem = allModData.find(m => m.modId === modData.modId);
            if (modItem) {
                folderNode.add(modItem.modId, ProfileTreeType.ITEM);
            } else {
                console.warn(`[ProfileViewModel] Mod not found for mod_id ${modData.modId} in folder ${folderData.name}`);
            }
        }

        // Recursively process child folders
        if (folderData.children && folderData.children.length > 0) {
            console.log(`[ProfileViewModel] Processing ${folderData.children.length} child folders of ${folderData.name}`);
            for (const childFolder of folderData.children) {
                await this.addFolderToTree(profileTree, childFolder, allMods, allModData, folderNode);
            }
        } else {
            console.log(`[ProfileViewModel] No child folders for ${folderData.name}`);
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

    // ====================================
    // Business Logic - Tree Building
    // Moved from ProfileDAO
    // ====================================

    /**
     * Build folder tree structure from flat folder and mod arrays
     * This is business logic for organizing data into a hierarchical structure
     */
    private buildFolderTreeStructure(folders: any[], mods: any[]): any[] {
        const folderMap = new Map<number, any>();
        const rootFolders: any[] = [];

        // Initialize all folders with children and mods arrays
        folders.forEach(folder => {
            folderMap.set(folder.id!, {
                ...folder,
                children: [],
                mods: []
            });
        });

        // Assign mods to their parent folders
        mods.forEach(mod => {
            if (mod.parentFolderId && folderMap.has(mod.parentFolderId)) {
                folderMap.get(mod.parentFolderId)!.mods.push(mod);
            }
        });

        // Build tree structure
        folders.forEach(folder => {
            const treeFolder = folderMap.get(folder.id!)!;
            if (folder.parentFolderId && folderMap.has(folder.parentFolderId)) {
                folderMap.get(folder.parentFolderId)!.children.push(treeFolder);
            } else {
                rootFolders.push(treeFolder);
            }
        });

        return rootFolders.sort((a, b) => a.sortOrder! - b.sortOrder!);
    }

    /**
     * Create default folders for a new profile
     * This is business logic defining what folders should exist by default
     */
    public async createDefaultFolders(profileId: number): Promise<void> {
        try {
            const profileDAO = await StorageAPI.getProfiles();

            // Check if default folders already exist
            const existingFolders = await profileDAO.getProfileFolders(profileId);
            const hasLocalFolder = existingFolders.some(folder =>
                folder.name === 'Local' || folder.name === '本地'
            );
            const hasModioFolder = existingFolders.some(folder =>
                folder.name === 'mod.io' || folder.name === 'Mod.io'
            );

            if (hasLocalFolder && hasModioFolder) {
                console.log(`[ProfileViewModel] Profile ${profileId} already has default folders, skipping creation`);
                return;
            }

            // Define default folder structure (business rule)
            const defaultFolders = [
                {
                    profileId,
                    name: 'mod.io',
                    folderType: 'modio',
                    sortOrder: 0
                },
                {
                    profileId,
                    name: 'Local',
                    folderType: 'local',
                    sortOrder: 1
                }
            ];

            // Create missing default folders
            for (const folder of defaultFolders) {
                const exists = existingFolders.some(f => f.name === folder.name);
                if (!exists) {
                    await profileDAO.createFolder(folder);
                }
            }
        } catch (error) {
            console.error(`[ProfileViewModel] Failed to create default folders for profile ${profileId}:`, error);
        }
    }
}
