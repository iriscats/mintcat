import {TreeProps} from "antd";
import {ProfileTreeItem, ProfileTreeType} from "@/storage/db/Schema.ts";
import type {CompleteModData} from "@/storage/dao/ModDAO";
import type {ProfileModData} from "@/storage/dao/ProfileDAO";

/**
 * TreeViewConverter
 *
 * 职责：UI 数据格式转换
 * - 将 ProfileTreeItem (Domain Model) 转换为 AntD TreeView 格式
 * - 将 AntD TreeView 格式转换回 ProfileTreeItem
 * - 处理 UI 过滤逻辑
 *
 * Note: 这是一个纯粹的数据转换器，不包含业务逻辑
 */
export class TreeViewConverter {

    public static filterList?: string[] = [];

    public treeData?: TreeProps['treeData'] = []
    public expandedKeys?: TreeProps['expandedKeys'] = [];
    private modList?: CompleteModData[];
    private profileModList?: ProfileModData[];

    public constructor(modList: CompleteModData[], profileModList?: ProfileModData[]) {
        this.modList = modList;
        this.profileModList = profileModList;
    }

    // ====================================
    // 过滤逻辑
    // ====================================

    /**
     * 根据当前过滤器列表过滤 mod
     */
    public static filter(modItem: CompleteModData, isEnabled: boolean): boolean {
        const filterList = TreeViewConverter.filterList ?? [];
        if (filterList.length === 0) {
            return true;
        }

        for (let filter of filterList) {
            if (filter === "All") {
                return true;
            }
            // 处理来源类型筛选
            if (filter.startsWith("source:")) {
                const sourceType = filter.substring(7); // 去掉 "source:" 前缀
                if (modItem.sourceType === sourceType) {
                    return true;
                }
                continue;
            }
            if (filter.startsWith("enabled:")) {
                const enabled = filter === "enabled:true";
                if (isEnabled === enabled) {
                    return true;
                }
                continue;
            }
            if (modItem.displayName?.toLocaleLowerCase().indexOf(filter.toLocaleLowerCase()) > -1) {
                return true;
            }
            if (modItem.approvalStatus === filter) {
                return true;
            }
            if (modItem.tags?.indexOf(filter) > -1) {
                return true;
            }
        }
        return false;
    }

    // ====================================
    // ProfileTreeItem -> AntD TreeView
    // ====================================

    /**
     * 将 ProfileTreeItem root 转换为 AntD TreeView 格式
     */
    public convertToFromRoot(root: ProfileTreeItem): TreeProps['treeData'] {
        const treeRoot = {
            key: "root",
            isLeaf: false,
            children: [],
        }
        this.buildTreeNode(treeRoot, root);
        this.treeData = treeRoot.children;
        return this.treeData;
    }

    /**
     * 递归构建 TreeView 节点
     */
    private buildTreeNode(parent: any, root: ProfileTreeItem): void {
        for (const item of root.children) {
            if (item.type === ProfileTreeType.ITEM) {
                this.buildModNode(parent, item);
            } else if (item.type === ProfileTreeType.FOLDER) {
                this.buildFolderNode(parent, item);
            }
        }
    }

    /**
     * 构建 Mod 节点
     */
    private buildModNode(parent: any, item: ProfileTreeItem): void {
        const modItem = this.modList?.find(m => m.modId === item.id);
        if (!modItem) {
            console.warn(`[TreeViewConverter] Mod item not found for id=${item.id}`);
            return;
        }

        // Find profile-specific data (enabled status, used version)
        const profileMod = this.profileModList?.find(pm => pm.modId === modItem.modId);
        const isEnabled = profileMod?.isEnabled ?? item.enabled;

        if (!TreeViewConverter.filter(modItem, isEnabled)) {
            return; // 不满足过滤条件，跳过
        }

        const title = modItem.displayName || modItem.originalName || modItem.url || modItem.nameId || "Unknown";
        const key = `mod-${item.id}`;

        parent.children.push({
            key,
            modId: modItem.modId,
            platformId: modItem.platformId,  // Add platformId for mod.io API calls
            nameId: modItem.nameId || "",  // Add nameId for ModCat API calls
            profileModId: profileMod?.id,  // Add profile_mods.id for updates
            isLeaf: true,
            title,
            url: modItem.url || "",
            tags: (modItem.tags || []).filter(t => t !== 'RequiredByAll'),
            required: modItem.tags?.includes('RequiredByAll') || false,
            enabled: isEnabled,
            sourceType: modItem.sourceType,
            approval: modItem.approvalStatus,
            versions: modItem.version?.availableVersions || [],
            fileVersion: modItem.version?.currentVersion || "-",
            usedVersion: profileMod?.usedVersion || "",  // Use profile-specific used version
            downloadProgress: modItem.download?.downloadProgress || 100,
            lastUpdateDate: modItem.status?.lastUpdateDate || 0,
            onlineUpdateDate: modItem.status?.onlineUpdateDate || 0,
            onlineAvailable: modItem.status?.isOnlineAvailable ?? true,
            localNoFound: modItem.status?.isLocalNotFound ?? false,
        });
    }

    /**
     * 构建文件夹节点
     */
    private buildFolderNode(parent: any, item: ProfileTreeItem): void {
        const key = `folder-${item.id}`;
        this.expandedKeys.push(key);

        const node = {
            key,
            title: item.name,
            isLeaf: false,
            children: [],
        }

        parent.children.push(node);
        this.buildTreeNode(node, item); // 递归处理子节点
    }

    // ====================================
    // AntD TreeView -> ProfileTreeItem
    // ====================================

    /**
     * 将 AntD TreeView 数据转换回 ProfileTreeItem root
     */
    public convertFrom(treeData: any): ProfileTreeItem {
        const rootTreeData = {
            key: "root",
            isLeaf: false,
            children: treeData,
        }
        const rootProfile = new ProfileTreeItem(0, ProfileTreeType.FOLDER, "root");

        this.buildProfileTree(rootTreeData, rootProfile);
        return rootProfile;
    }

    /**
     * 递归构建 ProfileTree
     */
    private buildProfileTree(parent: any, root: ProfileTreeItem): void {
        if (!parent || !parent.children) {
            return;
        }

        for (const item of parent.children) {
            const id = this.extractIdFromKey(item.key);

            // 跳过无效的 ID
            if (id === 0 || isNaN(id)) {
                console.warn(`[TreeViewConverter] Skipping item with invalid ID:`, { key: item.key, title: item.title });
                continue;
            }

            if (item.isLeaf === true) {
                // Mod 节点，保留 enabled 状态和使用版本
                const isEnabled = item.enabled ?? true;
                const usedVersion = item.usedVersion ?? "";
                const newItem = new ProfileTreeItem(id, ProfileTreeType.ITEM, "", isEnabled, usedVersion);
                root.children.push(newItem);
            } else {
                // 文件夹节点
                const folder = new ProfileTreeItem(id, ProfileTreeType.FOLDER, item.title);
                root.children.push(folder);

                // 递归处理子项
                if (item.children && item.children.length > 0) {
                    this.buildProfileTree(item, folder);
                }
            }
        }
    }

    /**
     * 从 key 中提取 ID
     * 支持格式：
     * - "mod-123" -> 123
     * - "folder-456" -> 456
     * - "123" -> 123
     */
    private extractIdFromKey(key: string | number): number {
        if (typeof key === 'number') {
            return key;
        }

        if (typeof key === 'string') {
            const keyParts = key.split('-');
            if (keyParts.length > 1) {
                // 带前缀的 key: "mod-123" or "folder-456"
                const parsedId = parseInt(keyParts[1]);
                return isNaN(parsedId) ? 0 : parsedId;
            } else {
                // 无前缀的 key: "123"
                const parsedId = parseInt(key);
                return isNaN(parsedId) ? 0 : parsedId;
            }
        }

        return 0;
    }
}
