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
        const profiles = await StorageAPI.getProfiles();
        const root = new ProfileTreeItem(ProfileTreeGroupType.ROOT, ProfileTreeType.FOLDER, "root");

        try {
            const treeData = await profiles.getProfileTree(profileData.id!);

            if (treeData) {
                root.children = [];

                const allMods: any[] = [...treeData.mods];
                for (const folder of treeData.folders) {
                    if (folder.mods && folder.mods.length > 0) {
                        allMods.push(...folder.mods);
                    }
                }

                const modsApi = await StorageAPI.getMods();
                const allModData = await modsApi.getAllMods();

                for (const folder of treeData.folders) {
                    await this.addFolderToTree(root, folder, allMods, allModData);
                }

                const rootMods = treeData.mods.filter(mod => !mod.parentFolderId);
                for (const modData of rootMods) {
                    const modItem = allModData.find(m => m.modId === modData.modId);
                    if (modItem) {
                        this.addModToTree(root, modItem.modId, 0);
                    }
                }
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
        const profileDAO = await StorageAPI.getProfiles();

        try {
            const folders = await profileDAO.getProfileFolders(profileId);
            const mods = await profileDAO.getProfileMods(profileId);

            const defaultFolders = folders.filter(f =>
                f.folderType === 'modio' || f.folderType === 'local'
            );

            for (const mod of mods) {
                await profileDAO.removeModFromProfile(profileId, mod.modId);
            }

            const customFolders = folders.filter(f => f.folderType === 'custom');
            customFolders.sort((a, b) => (b.id! - a.id!));

            for (const folder of customFolders) {
                await profileDAO.deleteFolder(folder.id!);
            }

            const itemsToSave = this.collectNonDefaultItems(root, defaultFolders);

            await this.saveProfileTreeItems(itemsToSave, profileDAO, profileId, null, 0);

            for (const defaultFolder of defaultFolders) {
                const correspondingItem = root.children.find(item =>
                    item.type === ProfileTreeType.FOLDER && item.name === defaultFolder.name
                );

                if (correspondingItem) {
                    await this.saveDefaultFolderItems(
                        correspondingItem,
                        profileDAO,
                        profileId,
                        defaultFolder.id!
                    );
                }
            }

        } catch (error) {
            console.error('[ProfileTreeService] Failed to save profile tree:', error);
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
        const { parent, node } = this.findNodeWithParent(root.children, id, root);

        if (parent && node) {
            parent.children = parent.children.filter(child => child.id !== id);
            return node;
        }
        return undefined;
    }

    /**
     * 排序节点
     * Migrated from TreeViewModel.sortMods
     */
    public async sortTreeNodes(root: ProfileTreeItem, order: string): Promise<void> {
        // 获取树中所有 mod 的完整数据（包含 status）用于排序
        const allMods = await this.getModsForTree(root);

        // 递归排序所有文件夹（包括自定义文件夹和嵌套子文件夹）
        await this.sortNodeRecursive(root, order, allMods);
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

            const existingFolders = await profileDAO.getProfileFolders(profileId);
            const defaultFolders = [
                {
                    profileId,
                    name: 'mod.io',
                    folderType: 'modio',
                    sortOrder: 0,
                    aliases: ['mod.io', 'Mod.io']
                },
                {
                    profileId,
                    name: 'Local',
                    folderType: 'local',
                    sortOrder: 1,
                    aliases: ['Local', '本地']
                }
            ];

            for (const folder of defaultFolders) {
                const existsByType = existingFolders.find(f => f.folderType === folder.folderType);
                if (existsByType) {
                    continue;
                }

                const existsByName = existingFolders.find(f => folder.aliases.includes(f.name));
                if (existsByName?.id) {
                    await profileDAO.updateFolder(existsByName.id, {
                        folderType: folder.folderType
                    });
                    continue;
                }

                await profileDAO.createFolder(folder);
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
            if (item.id === targetId) {
                return { parent, node: item };
            }
            const found = this.findNodeWithParent(item.children, targetId, item);
            if (found.node) {
                return found;
            }
        }
        return { parent: undefined, node: undefined };
    }

    /**
     * 递归排序节点及其所有子文件夹
     */
    private async sortNodeRecursive(node: ProfileTreeItem, order: string, allMods: CompleteModData[]): Promise<void> {
        // 如果是文件夹，排序其子项
        if (node.type === ProfileTreeType.FOLDER && node.children.length > 0) {
            node.children.sort((a, b) => {
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
                        // 按更新时间排序
                        const timeA = modAData.status?.lastUpdateDate || 0;
                        const timeB = modBData.status?.lastUpdateDate || 0;
                        return timeB - timeA;
                    }
                } else if (a.type === ProfileTreeType.ITEM && b.type === ProfileTreeType.FOLDER) {
                    return -1;
                } else if (a.type === ProfileTreeType.FOLDER && b.type === ProfileTreeType.ITEM) {
                    return 1;
                }
                return 0;
            });

            // 递归处理子文件夹
            for (const child of node.children) {
                if (child.type === ProfileTreeType.FOLDER) {
                    await this.sortNodeRecursive(child, order, allMods);
                }
            }
        }
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
        let folderNode = this.findFolderNode(root, folderData.id);
        if (!folderNode) {
            folderNode = new ProfileTreeItem(folderData.id, ProfileTreeType.FOLDER, folderData.name);

            if (parentNode) {
                parentNode.children.push(folderNode);
            } else {
                root.children.push(folderNode);
            }
        }

        const folderMods = folderData.mods || allMods.filter(mod => mod.parentFolderId === folderData.id);

        for (const modData of folderMods) {
            const modItem = allModData.find(m => m.modId === modData.modId);
            if (modItem) {
                const isEnabled = modData.isEnabled ?? true;
                const usedVersion = modData.usedVersion ?? "";
                folderNode.add(modItem.modId, ProfileTreeType.ITEM, "", isEnabled, usedVersion);
            } else {
                console.warn(`[ProfileTreeService] Mod not found for mod_id ${modData.modId} in folder ${folderData.name}`);
            }
        }

        if (folderData.children && folderData.children.length > 0) {
            for (const childFolder of folderData.children) {
                await this.addFolderToTree(root, childFolder, allMods, allModData, folderNode);
            }
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
        const result: ProfileTreeItem[] = [];

        for (const item of root.children) {
            if (item.type === ProfileTreeType.FOLDER) {
                const isDefaultFolder = defaultFolders.some(f => f.name === item.name);

                if (!isDefaultFolder) {
                    result.push(item);
                }
            } else if (item.type === ProfileTreeType.ITEM) {
                result.push(item);
            }
        }

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
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (item.type === ProfileTreeType.FOLDER) {
                const folder = await profileDAO.createFolder({
                    profileId,
                    name: item.name,
                    parentFolderId,
                    folderType: 'custom',
                    sortOrder: sortOrder + i
                });

                if (folder) {
                    await this.saveProfileTreeItems(
                        item.children,
                        profileDAO,
                        profileId,
                        folder.id!,
                        0
                    );
                }
            } else if (item.type === ProfileTreeType.ITEM) {
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
        const mods = item.children.filter(child => child.type === ProfileTreeType.ITEM);

        for (let i = 0; i < mods.length; i++) {
            await profileDAO.addModToProfile({
                profileId,
                modId: mods[i].id,
                parentFolderId: defaultFolderId,
                sortOrder: i,
                isEnabled: mods[i].enabled,
                usedVersion: mods[i].usedVersion
            });
        }

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
