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
                    continue;
                }
                const title = modItem.displayName === "" ? modItem.url : modItem.displayName;
                if (TreeViewConverter.filter(modItem)) {
                    parent.children.push({
                        key: `mod-${item.id}`, // 添加前缀确保唯一性
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
                this.expandedKeys.push(`folder-${item.id}`);
                const folderKey = `folder-${item.id}`;
                console.log(`[TreeViewConverter] Creating folder node: id=${item.id}, name=${item.name}, key=${folderKey}`);
                const node = {
                    key: folderKey, // 添加前缀确保唯一性
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
        console.log(`[TreeViewConverter] buildProfileTree processing:`, { parentKey: parent.key, childrenCount: parent.children?.length || 0 });

        for (const item of parent.children) {
            // 提取原始 ID（去除前缀）
            const id = typeof item.key === 'string'
                ? parseInt(item.key.split('-')[1])
                : item.key;

            console.log(`[TreeViewConverter] Processing item:`, { key: item.key, title: item.title, isLeaf: item.isLeaf, extractedId: id });

            if (item.isLeaf === true) {
                console.log(`[TreeViewConverter] Adding ITEM: id=${id}, title=${item.title}`);
                root.children.push(new ProfileTreeItem(id, ProfileTreeType.ITEM));
            } else {
                console.log(`[TreeViewConverter] Adding FOLDER: id=${id}, title=${item.title}`);
                const folder = new ProfileTreeItem(id, ProfileTreeType.FOLDER, item.title);
                root.children.push(folder);
                this.buildProfileTree(item, folder);
            }
        }
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
        console.log(`[TreeViewConverter] convertFrom called with ${treeData?.length || 0} items`);
        console.log(`[TreeViewConverter] Input treeData:`, treeData);
        const rootTreeData = {
            key: "root",
            isLeaf: false,
            children: treeData,
        }
        const rootProfile = new ProfileTreeItem(0, ProfileTreeType.FOLDER, "root");
        console.log(`[TreeViewConverter] Building profile tree...`);
        this.buildProfileTree(rootTreeData, rootProfile);
        console.log(`[TreeViewConverter] Converted profile tree root has ${rootProfile.children.length} children`);
        console.log(`[TreeViewConverter] Converted children:`, rootProfile.children.map(c => ({ id: c.id, name: c.name, type: c.type })));
        return rootProfile;
    }

}