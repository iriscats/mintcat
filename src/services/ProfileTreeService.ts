import { ProfileTreeItem } from '@/models/profile/ProfileTreeItem';
import { ProfileTreeType, ProfileTreeGroupType } from '@/models/profile/types';
import type { ProfileDAO, ProfileData, ProfileFolderData, ProfileModData, ProfileFolderTreeData } from '@/storage/dao/ProfileDAO';
import { StorageAPI } from '@/storage';
import type { CompleteModData } from '@/storage/dao/ModDAO';

/**
 * ProfileTreeService
 * 负责 ProfileTree 的业务逻辑和数据转换
 * 作为 DAO 层和 ViewModel 层的桥梁
 */
export class ProfileTreeService {

    // ====================================
    // 数据转换：DAO DTO ↔ Domain Model
    // ====================================

    /**
     * 从数据库加载并构建 Profile Tree Root
     * Migrated from ProfileViewModel.buildProfileTreeFromDatabase
     * Renamed from loadProfileTree to loadProfileTreeRoot
     */
    public async loadProfileTreeRoot(profileData: ProfileData): Promise<ProfileTreeItem> {
        console.log(`[ProfileTreeService] loadProfileTreeRoot called for profile: ${profileData.name}, id=${profileData.id}`);
        const profiles = await StorageAPI.getProfiles();
        const root = new ProfileTreeItem(ProfileTreeGroupType.ROOT, ProfileTreeType.FOLDER, "root");

        try {
            // Get profile tree data (folders and mods)
            console.log(`[ProfileTreeService] Getting profile tree data from database...`);
            const treeData = await profiles.getProfileTree(profileData.id!);

            if (treeData) {
                console.log(`[ProfileTreeService] Got treeData from database:`, {
                    foldersCount: treeData.folders.length,
                    rootModsCount: treeData.mods.length
                });

                // Clear the default root children and rebuild from database
                root.children = [];

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

                console.log(`[ProfileTreeService] Folder tree structure from database:`, treeData.folders.map(f => ({
                    id: f.id,
                    name: f.name,
                    parentFolderId: f.parentFolderId,
                    childrenCount: f.children?.length || 0
                })));

                for (const folder of treeData.folders) {
                    console.log(`[ProfileTreeService] Adding folder to tree: ${folder.name}, id=${folder.id}, parentFolderId=${folder.parentFolderId}`);
                    await this.addFolderToTree(root, folder, allMods, allModData);
                }

                // Also handle root mods (mods without parent folder)
                const rootMods = treeData.mods.filter(mod => !mod.parentFolderId);
                for (const modData of rootMods) {
                    const modItem = allModData.find(m => m.modId === modData.modId);
                    if (modItem) {
                        this.addModToTree(root, modItem.modId, 0); // Add to root
                    }
                }

                console.log(`[ProfileTreeService] Profile tree built from database. Root children:`, root.children.map(c => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    childrenCount: c.children.length
                })));
            } else {
                console.log(`[ProfileTreeService] No treeData found for profile: ${profileData.name}`);
            }

        } catch (error) {
            console.error(`[ProfileTreeService] Failed to build profile tree for ${profileData.name}:`, error);
        }

        return root;
    }

    /**
     * 保存 ProfileTree 到数据库
     * Migrated from ProfileViewModel.saveProfileTreeToDatabase
     */
    public async saveProfileTree(root: ProfileTreeItem, profileId: number): Promise<void> {
        console.log(`\n========== [ProfileTreeService] saveProfileTree 开始 ==========`);
        console.log(`[ProfileTreeService] 传入的 root 有 ${root.children.length} 个子项`);
        console.log(`[ProfileTreeService] root children:`, root.children.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            childrenCount: c.children?.length || 0
        })));

        const profileDAO = await StorageAPI.getProfiles();

        console.log(`[ProfileTreeService] 活跃的 profileId: ${profileId}`);

        try {
            // Get all folders and mods for this profile
            console.log(`[ProfileTreeService] 获取现有的 folders 和 mods...`);
            const folders = await profileDAO.getProfileFolders(profileId);
            const mods = await profileDAO.getProfileMods(profileId);
            console.log(`[ProfileTreeService] 找到 ${folders.length} 个 folders 和 ${mods.length} 个 mods`);
            console.log(`[ProfileTreeService] 现有 folders:`, folders.map(f => ({ id: f.id, name: f.name, type: f.folderType })));
            console.log(`[ProfileTreeService] 现有 mods:`, mods.map(m => ({ modId: m.modId, parentFolderId: m.parentFolderId })));

            // Get the default folders (Mod.io and Local) to preserve them
            const defaultFolders = folders.filter(f =>
                f.folderType === 'modio' || f.folderType === 'local'
            );
            console.log(`[ProfileTreeService] 默认 folders (Mod.io 和 Local):`, defaultFolders.map(f => ({
                id: f.id,
                name: f.name,
                type: f.folderType
            })));

            // Delete all existing mods from profile
            console.log(`[ProfileTreeService] 开始删除现有的 ${mods.length} 个 mods...`);
            for (const mod of mods) {
                console.log(`[ProfileTreeService] 删除 mod: modId=${mod.modId}`);
                await profileDAO.removeModFromProfile(profileId, mod.modId);
            }
            console.log(`[ProfileTreeService] ✅ 已删除 ${mods.length} 个 mods`);

            // Delete only custom folders, keep default folders
            // We need to delete folders in reverse order (children before parents) to avoid foreign key constraints
            const customFolders = folders.filter(f => f.folderType === 'custom');
            customFolders.sort((a, b) => (b.id! - a.id!)); // Sort by ID descending to delete children before parents

            console.log(`[ProfileTreeService] 开始删除 ${customFolders.length} 个自定义 folders...`);
            for (const folder of customFolders) {
                console.log(`[ProfileTreeService] 删除自定义 folder: ${folder.name} (id=${folder.id})`);
                await profileDAO.deleteFolder(folder.id!);
            }
            console.log(`[ProfileTreeService] ✅ 已删除所有自定义 folders`);

            // Save the tree structure for non-default folders/items
            // Recursively collect all non-default folders and items
            const itemsToSave = this.collectNonDefaultItems(root, defaultFolders);
            console.log(`[ProfileTreeService] 需要保存的非默认 items (包括嵌套): ${itemsToSave.length} 个`, itemsToSave.map(i => ({
                id: i.id,
                name: i.name,
                type: i.type
            })));

            await this.saveProfileTreeItems(itemsToSave, profileDAO, profileId, null, 0);

            // Handle default folders separately
            console.log(`[ProfileTreeService] 开始处理默认 folders...`);
            for (const defaultFolder of defaultFolders) {
                console.log(`\n[ProfileTreeService] 处理默认 folder: ${defaultFolder.name} (id=${defaultFolder.id})`);
                const correspondingItem = root.children.find(item =>
                    item.type === ProfileTreeType.FOLDER && item.name === defaultFolder.name
                );

                console.log(`[ProfileTreeService] 查找对应的 tree item:`, correspondingItem ? {
                    found: true,
                    item: {
                        id: correspondingItem.id,
                        name: correspondingItem.name,
                        childrenCount: correspondingItem.children?.length || 0
                    }
                } : { found: false });

                if (correspondingItem) {
                    console.log(`[ProfileTreeService] 在 tree 中找到对应的 item，开始保存...`);
                    await this.saveDefaultFolderItems(
                        correspondingItem,
                        profileDAO,
                        profileId,
                        defaultFolder.id!
                    );
                    console.log(`[ProfileTreeService] ✅ 默认 folder 保存成功`);
                } else {
                    console.log(`[ProfileTreeService] ⚠️ 在 tree 中未找到对应的 item: ${defaultFolder.name}`);
                }
            }

            console.log(`[ProfileTreeService] ✅ Profile tree 成功保存到数据库`);
            console.log(`========== [ProfileTreeService] saveProfileTree 完成 ==========\n`);
        } catch (error) {
            console.error('[ProfileTreeService] ❌ 保存 profile tree 到数据库失败:', error);
            console.log(`========== [ProfileTreeService] saveProfileTree 失败 ==========\n`);
            throw error;
        }
    }

    // ====================================
    // 树结构操作
    // ====================================

    /**
     * 添加 mod 到树
     * Migrated from ProfileTree.addMod
     */
    public addModToTree(root: ProfileTreeItem, modId: number, parentId: number = 0): void {
        const parent = this.findNode(root.children, parentId);
        if (parent) {
            parent.add(modId, ProfileTreeType.ITEM);
        } else {
            root.add(modId, ProfileTreeType.ITEM);
        }
    }

    /**
     * 移除 mod
     * Migrated from ProfileTree.removeMod
     */
    public removeModFromTree(root: ProfileTreeItem, modId: number): void {
        root.remove(modId);
    }

    /**
     * 设置文件夹名称
     * Migrated from ProfileTree.setGroupName
     */
    public setGroupName(root: ProfileTreeItem, id: number, name: string): void {
        const parent = this.findNode(root.children, id);
        if (parent) {
            parent.name = name;
        }
    }

    /**
     * 获取文件夹名称
     * Migrated from ProfileTree.getGroupName
     */
    public getGroupName(root: ProfileTreeItem, id: number): string | undefined {
        const node = this.findNode(root.children, id);
        return node?.name;
    }

    /**
     * 添加新文件夹
     * Migrated from ProfileTree.addGroup
     */
    public addGroup(root: ProfileTreeItem, name: string, parentId: number = 0): void {
        const parent = this.findNode(root.children, parentId);
        const newId = this.generateId();

        if (parent) {
            parent.children.push(new ProfileTreeItem(newId, ProfileTreeType.FOLDER, name));
        } else {
            // 默认添加到根目录
            root.add(newId, ProfileTreeType.FOLDER, name);
        }
    }

    /**
     * 移除文件夹
     * Migrated from ProfileTree.removeGroup
     */
    public removeGroup(root: ProfileTreeItem, id: number): ProfileTreeItem | undefined {
        console.log(`[ProfileTreeService] removeGroup called, id=${id}`);
        console.log(`[ProfileTreeService] Current root children:`, root.children.map(c => ({ id: c.id, name: c.name, type: c.type })));

        // 找到要删除的节点和其父节点
        // 传递root作为初始parent来处理根节点子项的情况
        const { parent, node } = this.findNodeWithParent(root.children, id, root);

        console.log(`[ProfileTreeService] findNodeWithParent result:`, {
            parentId: parent?.id,
            parentName: parent?.name,
            nodeId: node?.id,
            nodeName: node?.name
        });

        if (parent && node) {
            console.log(`[ProfileTreeService] Removing node from parent's children. Parent had ${parent.children.length} children`);
            // 从父节点的children中移除该节点
            parent.children = parent.children.filter(child => child.id !== id);
            console.log(`[ProfileTreeService] Parent now has ${parent.children.length} children`);
            console.log(`[ProfileTreeService] Removed node successfully:`, { id: node.id, name: node.name });
            return node;
        } else {
            console.log(`[ProfileTreeService] Failed to find node or parent for id=${id}`);
        }
        return undefined;
    }

    /**
     * 排序节点
     * Migrated from TreeViewModel.sortMods
     */
    public async sortTreeNodes(root: ProfileTreeItem, order: string): Promise<void> {
        const modioFolder = this.getModioFolder(root);
        const localFolder = this.getLocalFolder(root);

        if (modioFolder) {
            modioFolder.children = await this.sortNode(modioFolder, order);
        }
        if (localFolder) {
            localFolder.children = await this.sortNode(localFolder, order);
        }
    }

    /**
     * 获取当前配置树中所有 mods 的列表
     * Migrated from ProfileTree.getModList
     */
    /**
     * 获取 Profile Tree 中所有模组的完整数据
     * @param root Profile 树根节点
     * @returns 完整模组数据列表
     */
    public async getModsForTree(root: ProfileTreeItem): Promise<CompleteModData[]> {
        const modIds: number[] = [];

        const traverse = (node: ProfileTreeItem) => {
            if (node.type === ProfileTreeType.ITEM) {
                modIds.push(node.id);
            } else {
                for (const child of node.children) {
                    traverse(child);
                }
            }
        };

        traverse(root);

        const modsDAO = await StorageAPI.getMods();
        return await modsDAO.getBatchCompleteModData(modIds);
    }

    // ====================================
    // 业务规则
    // ====================================

    /**
     * 创建默认文件夹
     * Migrated from ProfileViewModel.createDefaultFolders
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
                console.log(`[ProfileTreeService] Profile ${profileId} already has default folders, skipping creation`);
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
            console.error(`[ProfileTreeService] Failed to create default folders for profile ${profileId}:`, error);
        }
    }

    // ====================================
    // 私有辅助方法
    // ====================================

    /**
     * 生成随机 ID（基于 UUID）
     * Migrated from ProfileTree.makeId
     */
    private generateId(): number {
        const uuid = crypto.randomUUID();
        const hex = uuid.replace(/-/g, '');
        // 只取字符数字部分，避免字母导致的转换问题
        const numericPart = hex.replace(/[a-f]/g, '');
        const bigNum = BigInt('0x' + numericPart.substring(0, 16));
        return Number(bigNum % BigInt(2147483647)); // 使用 32 位整数范围
    }

    /**
     * 查找指定 ID 的节点
     * Migrated from ProfileTree.findNode
     */
    private findNode(items: ProfileTreeItem[], targetId: number): ProfileTreeItem | undefined {
        if (targetId === 0) {
            return undefined;
        }
        for (const item of items) {
            if (item.id === targetId) {
                return item;
            }
            const found = this.findNode(item.children, targetId);
            if (found) {
                return found;
            }
        }
        return undefined;
    }

    /**
     * 查找指定 ID 的节点及其父节点
     * Migrated from ProfileTree.findNodeWithParent
     */
    private findNodeWithParent(items: ProfileTreeItem[], targetId: number, parent?: ProfileTreeItem): { parent?: ProfileTreeItem, node?: ProfileTreeItem } {
        if (targetId === 0) {
            return { parent, node: undefined };
        }

        for (const item of items) {
            console.log(`[ProfileTreeService] Checking item: id=${item.id}, name=${item.name}, targetId=${targetId}`);
            if (item.id === targetId) {
                console.log(`[ProfileTreeService] Found match! parentId=${parent?.id}, parentName=${parent?.name}, nodeId=${item.id}, nodeName=${item.name}`);
                return { parent, node: item };
            }
            const found = this.findNodeWithParent(item.children, targetId, item);
            if (found.node) {
                return found;
            }
        }
        console.log(`[ProfileTreeService] No match found for targetId=${targetId} in ${items.length} items`);
        return { parent: undefined, node: undefined };
    }

    /**
     * 排序单个节点
     * Migrated from TreeViewModel.sortNode
     */
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
                    return modAData.displayName.localeCompare(modBData.displayName) * -1;
                } else if (order === "desc") {
                    return modAData.displayName.localeCompare(modBData.displayName);
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

    /**
     * 添加文件夹和其 mods 到 profile tree
     * Migrated from ProfileViewModel.addFolderToTree
     */
    private async addFolderToTree(
        root: ProfileTreeItem,
        folderData: any,
        allMods: any[],
        allModData: any[],
        parentNode?: ProfileTreeItem
    ): Promise<void> {
        console.log(`[ProfileTreeService] addFolderToTree called: folder=${folderData.name}, id=${folderData.id}, parentNode=${parentNode?.name || 'root'}`);
        console.log(`[ProfileTreeService] Folder has ${folderData.children?.length || 0} children, ${folderData.mods?.length || 0} mods`);

        // Ensure the folder exists in the profile tree
        let folderNode = this.findFolderNode(root, folderData.id);
        if (!folderNode) {
            // Create the folder node if it doesn't exist
            folderNode = new ProfileTreeItem(folderData.id, ProfileTreeType.FOLDER, folderData.name);

            // Add to appropriate parent
            if (parentNode) {
                parentNode.children.push(folderNode);
                console.log(`[ProfileTreeService] Added folder ${folderData.name} (id=${folderData.id}) to parent ${parentNode.name} (id=${parentNode.id})`);
            } else {
                root.children.push(folderNode);
                console.log(`[ProfileTreeService] Added folder ${folderData.name} (id=${folderData.id}) to root`);
            }
        }

        // Add mods that belong to this folder
        // Check if folderData has mods property (from buildFolderTree)
        const folderMods = folderData.mods || allMods.filter(mod => mod.parentFolderId === folderData.id);
        console.log(`[ProfileTreeService] Adding ${folderMods.length} mods to folder ${folderData.name}`);

        for (const modData of folderMods) {
            const modItem = allModData.find(m => m.modId === modData.modId);
            if (modItem) {
                // 保留 mod 的启用状态和使用版本
                const isEnabled = modData.isEnabled ?? true;
                const usedVersion = modData.usedVersion ?? "";
                folderNode.add(modItem.modId, ProfileTreeType.ITEM, "", isEnabled, usedVersion);
            } else {
                console.warn(`[ProfileTreeService] Mod not found for mod_id ${modData.modId} in folder ${folderData.name}`);
            }
        }

        // Recursively process child folders
        if (folderData.children && folderData.children.length > 0) {
            console.log(`[ProfileTreeService] Processing ${folderData.children.length} child folders of ${folderData.name}`);
            for (const childFolder of folderData.children) {
                await this.addFolderToTree(root, childFolder, allMods, allModData, folderNode);
            }
        } else {
            console.log(`[ProfileTreeService] No child folders for ${folderData.name}`);
        }
    }

    /**
     * 查找文件夹节点
     * Migrated from ProfileViewModel.findFolderNode
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
     * 收集顶级非默认文件夹和项目
     * Migrated from ProfileViewModel.collectNonDefaultItems
     */
    private collectNonDefaultItems(root: ProfileTreeItem, defaultFolders: any[]): ProfileTreeItem[] {
        console.log(`\n========== [ProfileTreeService] collectNonDefaultItems 开始 ==========`);
        console.log(`[ProfileTreeService] 传入的 root.children 数量: ${root.children.length}`);
        console.log(`[ProfileTreeService] 默认 folders 列表:`, defaultFolders.map(f => ({ id: f.id, name: f.name, type: f.folderType })));

        const result: ProfileTreeItem[] = [];

        for (const item of root.children) {
            if (item.type === ProfileTreeType.FOLDER) {
                // Check if this is a default folder (Mod.io or Local)
                const isDefaultFolder = defaultFolders.some(f => f.name === item.name);
                console.log(`[ProfileTreeService] 检查顶级 folder: ${item.name}, id=${item.id}, isDefault=${isDefaultFolder}`);

                // For default folders, we skip them here because they're handled separately
                // but we still need to save their children as nested custom folders/items
                if (!isDefaultFolder) {
                    console.log(`[ProfileTreeService] ✅ 添加顶级非默认 folder 到保存列表: ${item.name}, id=${item.id}`);
                    result.push(item);
                } else {
                    console.log(`[ProfileTreeService] ⏭️ 跳过默认 folder，将单独处理: ${item.name}`);
                }
            } else if (item.type === ProfileTreeType.ITEM) {
                console.log(`[ProfileTreeService] ✅ 添加顶级 item 到保存列表: id=${item.id}, childrenCount=${item.children?.length || 0}`);
                result.push(item);
            }
        }

        console.log(`[ProfileTreeService] 返回的 result 数量: ${result.length}`);
        console.log(`[ProfileTreeService] result 列表:`, result.map(i => ({ id: i.id, name: i.name, type: i.type })));
        console.log(`========== [ProfileTreeService] collectNonDefaultItems 完成 ==========\n`);

        return result;
    }

    /**
     * 递归保存 profile tree items
     * Migrated from ProfileViewModel.saveProfileTreeItems
     */
    private async saveProfileTreeItems(
        items: ProfileTreeItem[],
        profileDAO: any,
        profileId: number,
        parentFolderId: number | null,
        sortOrder: number
    ): Promise<void> {
        console.log(`[ProfileTreeService] saveProfileTreeItems called with ${items.length} items, parentFolderId=${parentFolderId}`);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`[ProfileTreeService] Processing item: ${item.type}, id=${item.id}, name=${item.name}, sortOrder=${sortOrder + i}`);

            if (item.type === ProfileTreeType.FOLDER) {
                // Create folder
                console.log(`[ProfileTreeService] Creating folder: ${item.name}, parentId=${parentFolderId}`);
                const folder = await profileDAO.createFolder({
                    profileId,
                    name: item.name,
                    parentFolderId,
                    folderType: 'custom',
                    sortOrder: sortOrder + i
                });

                console.log(`[ProfileTreeService] Folder created:`, folder);

                if (folder) {
                    // Recursively save children
                    console.log(`[ProfileTreeService] Recursively saving children of folder: ${item.name}, folderId=${folder.id}`);
                    await this.saveProfileTreeItems(
                        item.children,
                        profileDAO,
                        profileId,
                        folder.id!,
                        0
                    );
                } else {
                    console.error(`[ProfileTreeService] Failed to create folder: ${item.name}`);
                }
            } else if (item.type === ProfileTreeType.ITEM) {
                // Create mod association，保留原有的启用状态和使用版本
                console.log(`[ProfileTreeService] Adding mod to profile: modId=${item.id}, parentFolderId=${parentFolderId}, isEnabled=${item.enabled}, usedVersion=${item.usedVersion}`);
                await profileDAO.addModToProfile({
                    profileId,
                    modId: item.id,
                    parentFolderId,
                    sortOrder: sortOrder + i,
                    isEnabled: item.enabled,
                    usedVersion: item.usedVersion
                });
            }
        }
    }

    /**
     * 保存默认文件夹中的项目
     * Migrated from ProfileViewModel.saveDefaultFolderItems
     */
    private async saveDefaultFolderItems(
        item: ProfileTreeItem,
        profileDAO: any,
        profileId: number,
        defaultFolderId: number
    ): Promise<void> {
        console.log(`\n========== [ProfileTreeService] saveDefaultFolderItems 开始 ==========`);
        console.log(`[ProfileTreeService] 处理默认 folder，item:`, {
            id: item.id,
            name: item.name,
            type: item.type,
            childrenCount: item.children.length
        });
        console.log(`[ProfileTreeService] 参数: profileId=${profileId}, defaultFolderId=${defaultFolderId}`);

        // Save mods in this default folder
        const mods = item.children.filter(child => child.type === ProfileTreeType.ITEM);
        console.log(`[ProfileTreeService] 在默认文件夹中找到 ${mods.length} 个 mods:`, mods.map(m => ({ id: m.id, name: m.name })));

        for (let i = 0; i < mods.length; i++) {
            console.log(`[ProfileTreeService] 添加 mod 到默认文件夹 [${i + 1}/${mods.length}]: modId=${mods[i].id}, name=${mods[i].name}, parentFolderId=${defaultFolderId}, sortOrder=${i}, isEnabled=${mods[i].enabled}, usedVersion=${mods[i].usedVersion}`);
            await profileDAO.addModToProfile({
                profileId,
                modId: mods[i].id,
                parentFolderId: defaultFolderId,
                sortOrder: i,
                isEnabled: mods[i].enabled,
                usedVersion: mods[i].usedVersion
            });
        }
        console.log(`[ProfileTreeService] ✅ 成功添加 ${mods.length} 个 mods 到默认文件夹`);

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

    // ====================================
    // Helper methods for folder access
    // ====================================

    /**
     * Get Mod.io folder from tree root
     * Migrated from ProfileTree.ModioFolder accessor
     */
    public getModioFolder(root: ProfileTreeItem): ProfileTreeItem | undefined {
        return root.children.find(p =>
            p.type === ProfileTreeType.FOLDER &&
            (p.name === "Mod.io" || p.name === "mod.io")
        );
    }

    /**
     * Get Local folder from tree root
     * Migrated from ProfileTree.LocalFolder accessor
     */
    public getLocalFolder(root: ProfileTreeItem): ProfileTreeItem | undefined {
        return root.children.find(p =>
            p.type === ProfileTreeType.FOLDER &&
            (p.name === "Local" || p.name === "本地")
        );
    }

    /**
     * Duplicate profile tree (folders and mods) to a new profile
     */
    public async duplicateProfileTree(sourceProfileId: number, targetProfileId: number): Promise<void> {
        console.log(`[ProfileTreeService] duplicateProfileTree called, sourceProfileId=${sourceProfileId}, targetProfileId=${targetProfileId}`);

        const profileDAO = await StorageAPI.getProfiles();

        const sourceFolders = await profileDAO.getProfileFolders(sourceProfileId);
        const sourceMods = await profileDAO.getProfileMods(sourceProfileId);

        const folderIdMap = new Map<number, number>();

        for (const folder of sourceFolders) {
            const newFolder = await profileDAO.createFolder({
                profileId: targetProfileId,
                parentFolderId: folder.parentFolderId ? undefined : null,
                name: folder.name,
                folderType: folder.folderType || 'custom',
                sortOrder: folder.sortOrder || 0,
                isExpanded: folder.isExpanded ?? true
            });

            if (newFolder?.id) {
                folderIdMap.set(folder.id!, newFolder.id);
            }
        }

        for (const folder of sourceFolders) {
            if (folder.parentFolderId) {
                const newParentId = folderIdMap.get(folder.id!);
                const originalParentId = folder.parentFolderId;

                if (newParentId) {
                    const originalNewParent = sourceFolders.find(f => f.id === originalParentId);
                    if (originalNewParent) {
                        const newActualParentId = folderIdMap.get(originalNewParent.id!);
                        if (newActualParentId) {
                            await profileDAO.updateFolder(newParentId, { parentFolderId: newActualParentId });
                        }
                    }
                }
            }
        }

        for (const mod of sourceMods) {
            await profileDAO.addModToProfile({
                profileId: targetProfileId,
                modId: mod.modId,
                parentFolderId: mod.parentFolderId ? folderIdMap.get(mod.parentFolderId) : null,
                sortOrder: mod.sortOrder || 0,
                isEnabled: mod.isEnabled ?? true,
                usedVersion: mod.usedVersion || ""
            });
        }

        console.log(`[ProfileTreeService] duplicateProfileTree completed successfully`);
    }
}
