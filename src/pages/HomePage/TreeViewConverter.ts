import {TreeProps} from "antd";
import {ProfileTree, ProfileTreeItem, ProfileTreeType} from "@/storage/db/Schema.ts";
import {ModListItem} from "@/storage/db/Schema.ts";


export class TreeViewConverter {

    public static filterList?: string[] = [];

    public treeData?: TreeProps['treeData'] = []
    public expandedKeys?: TreeProps['expandedKeys'] = [];
    private modList?: ModListItem[];

    public constructor(modList: ModListItem[]) {
        this.modList = modList;
    }

    public static filter(modItem: ModListItem) {
        if (TreeViewConverter.filterList.length === 0) {
            return true;
        }

        for (let filter of TreeViewConverter.filterList) {
            if (filter === "All") {
                return true;
            }
            if (modItem.displayName?.toLocaleLowerCase().indexOf(filter.toLocaleLowerCase()) > -1) {
                return true;
            }
            if (modItem.approval === filter) {
                return true;
            }
            if (modItem.tags?.indexOf(filter) > -1) {
                return true;
            }
        }
        return false;
    }

    private buildTreeNode(parent: any, root: ProfileTreeItem) {
        for (const item of root.children) {
            if (item.type === ProfileTreeType.ITEM) {
                const modItem = this.modList?.find(m => m.id === item.id);
                if (modItem === undefined) {
                    console.warn(`[TreeViewConverter] Mod item not found for id=${item.id}`);
                    continue;
                }
                const title = modItem.displayName === "" ? modItem.url : modItem.displayName;
                if (TreeViewConverter.filter(modItem)) {
                    // 确保 key 有正确的前缀
                    const key = `mod-${item.id}`;

                    parent.children.push({
                        key: key,
                        modId: modItem.modId,
                        isLeaf: true,
                        title: title,
                        url: modItem.url,
                        tags: modItem.tags,
                        required: modItem.required,
                        enabled: modItem.enabled,
                        sourceType: modItem.sourceType,
                        approval: modItem.approval,
                        versions: modItem.versions,
                        fileVersion: modItem.fileVersion,
                        usedVersion: modItem.usedVersion,
                        downloadProgress: modItem.downloadProgress,
                        lastUpdateDate: modItem.lastUpdateDate,
                        onlineUpdateDate: modItem.onlineUpdateDate,
                        onlineAvailable: modItem.onlineAvailable,
                        localNoFound: modItem.localNoFound,
                    });
                }
            } else if (item.type === ProfileTreeType.FOLDER) {
                // 确保文件夹 key 有正确的前缀
                const key = `folder-${item.id}`;

                this.expandedKeys.push(key);
                console.log(`[TreeViewConverter] Creating folder node: id=${item.id}, name=${item.name}, key=${key}`);
                const node = {
                    key: key,
                    title: item.name,
                    isLeaf: false,
                    children: [],
                }
                console.log(`[TreeViewConverter] Folder node created:`, node);
                parent.children.push(node);
                this.buildTreeNode(node, item);
            }
        }
    }

    private buildProfileTree(parent: any, root: ProfileTreeItem) {
        if (parent === undefined) {
            return;
        }
        console.log(`\n[TreeViewConverter] buildProfileTree 处理:`, { parentKey: parent.key, childrenCount: parent.children?.length || 0 });

        for (let i = 0; i < parent.children.length; i++) {
            const item = parent.children[i];
            console.log(`\n[TreeViewConverter] ---- 处理第 ${i + 1}/${parent.children.length} 个子项 ----`);
            console.log(`[TreeViewConverter] 原始 item:`, { key: item.key, title: item.title, isLeaf: item.isLeaf });

            // 提取原始 ID（去除前缀）
            let id: number;
            if (typeof item.key === 'string') {
                const keyParts = item.key.split('-');
                if (keyParts.length > 1) {
                    const parsedId = parseInt(keyParts[1]);
                    id = isNaN(parsedId) ? 0 : parsedId;
                    console.log(`[TreeViewConverter] 解析带前缀的 key: ${item.key} -> ${keyParts[1]} -> id=${id}`);
                } else {
                    // 对于没有前缀的 key，尝试直接解析
                    const parsedId = parseInt(item.key);
                    id = isNaN(parsedId) ? 0 : parsedId;
                    console.log(`[TreeViewConverter] 解析无前缀的 key: ${item.key} -> id=${id}`);
                }
            } else {
                id = item.key;
                console.log(`[TreeViewConverter] 直接使用数值 key: id=${id}`);
            }

            console.log(`[TreeViewConverter] 提取结果:`, { key: item.key, title: item.title, isLeaf: item.isLeaf, extractedId: id });

            // 跳过无效的 ID（0 或 NaN）
            if (id === 0 || isNaN(id)) {
                console.warn(`[TreeViewConverter] ⚠️ 跳过无效 ID 的 item:`, { key: item.key, title: item.title, reason: 'id=0 或 NaN' });
                continue;
            }

            if (item.isLeaf === true) {
                console.log(`[TreeViewConverter] ✅ 添加 ITEM: id=${id}, title=${item.title}`);
                const newItem = new ProfileTreeItem(id, ProfileTreeType.ITEM);
                console.log(`[TreeViewConverter] ITEM 详情:`, { id: newItem.id, type: newItem.type });
                root.children.push(newItem);
            } else {
                console.log(`[TreeViewConverter] ✅ 添加 FOLDER: id=${id}, title=${item.title}, childrenCount=${item.children?.length || 0}`);
                const folder = new ProfileTreeItem(id, ProfileTreeType.FOLDER, item.title);
                console.log(`[TreeViewConverter] FOLDER 详情:`, { id: folder.id, name: folder.name, type: folder.type });
                root.children.push(folder);

                // 递归处理子项
                if (item.children && item.children.length > 0) {
                    console.log(`[TreeViewConverter] 递归处理 ${item.children.length} 个子项...`);
                    this.buildProfileTree(item, folder);
                } else {
                    console.log(`[TreeViewConverter] 该文件夹没有子项`);
                }
            }
        }

        console.log(`\n[TreeViewConverter] buildProfileTree 完成 - 当前 root.children.length=${root.children.length}`);
    }

    public convertTo(tree: ProfileTree) {
        const root = {
            key: "root",
            isLeaf: false,
            children: [],
        }
        this.buildTreeNode(root, tree.root);
        this.treeData = root.children;
        console.log(`[TreeViewConverter] convertTo completed. treeData:`, this.treeData);
        console.log(`[TreeViewConverter] First item key type: ${typeof this.treeData?.[0]?.key}, value: ${this.treeData?.[0]?.key}`);
        return this.treeData;
    }

    public convertFrom(treeData: any) {
        console.log(`\n========== [TreeViewConverter] convertFrom 开始 ==========`);
        console.log(`[TreeViewConverter] 输入的 treeData 项目数量:`, treeData?.length || 0);
        console.log(`[TreeViewConverter] 输入的 treeData 详情:`, JSON.stringify(treeData, null, 2));

        const rootTreeData = {
            key: "root",
            isLeaf: false,
            children: treeData,
        }
        const rootProfile = new ProfileTreeItem(0, ProfileTreeType.FOLDER, "root");

        console.log(`[TreeViewConverter] 开始构建 profile tree...`);
        try {
            this.buildProfileTree(rootTreeData, rootProfile);
            console.log(`[TreeViewConverter] ✅ 转换完成 - ProfileTreeItem 根节点有 ${rootProfile.children.length} 个子项`);
            console.log(`[TreeViewConverter] 子项列表:`, rootProfile.children.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                childrenCount: c.children?.length || 0
            })));
            console.log(`========== [TreeViewConverter] convertFrom 完成 ==========\n`);
        } catch (error) {
            console.error(`[TreeViewConverter] ❌ 转换过程出错:`, error);
            console.error(`[TreeViewConverter] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
            console.log(`========== [TreeViewConverter] convertFrom 失败 ==========\n`);
            throw new Error(`Failed to convert tree data: ${error instanceof Error ? error.message : String(error)}`);
        }
        return rootProfile;
    }

}