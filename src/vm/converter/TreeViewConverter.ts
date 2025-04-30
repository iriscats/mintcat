import {ProfileTree, ProfileTreeItem, ProfileTreeType} from "../config/ProfileList.ts";
import {TreeProps} from "antd";
import {ModList, ModListItem} from "../config/ModList.ts";


export class TreeViewConverter {

    public static filterList?: string[] = [];

    public treeData?: TreeProps['treeData'] = []
    public expandedKeys?: TreeProps['expandedKeys'] = [];
    private modList?: ModList;

    public constructor(modList: ModList) {
        this.modList = modList;
    }

    private filter(modItem: ModListItem) {
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
                const modItem = this.modList.get(item.id);
                if (modItem === undefined) {
                    continue;
                }
                const title = modItem.displayName === "" ? modItem.url : modItem.displayName;
                if (this.filter(modItem)) {
                    parent.children.push({
                        key: modItem.id,
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
                        onlineAvailable: modItem.onlineAvailable
                    });
                }
            } else if (item.type === ProfileTreeType.FOLDER) {
                this.expandedKeys.push(item.id);
                const node = {
                    key: item.id,
                    title: item.name,
                    isLeaf: false,
                    children: [],
                }
                parent.children.push(node);
                this.buildTreeNode(node, item);
            }
        }
    }

    private buildProfileTree(parent: any, root: ProfileTreeItem) {
        if (parent === undefined) {
            return;
        }
        for (const item of parent.children) {
            if (item.isLeaf === true) {
                root.children.push(new ProfileTreeItem(item.key, ProfileTreeType.ITEM));
            } else {
                const folder = new ProfileTreeItem(item.key, ProfileTreeType.FOLDER, item.title);
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
    }

    public convertFrom(treeData: any) {
        const rootTreeData = {
            key: "root",
            isLeaf: false,
            children: treeData,
        }
        const rootProfile = new ProfileTreeItem(0, ProfileTreeType.FOLDER, "root");
        this.buildProfileTree(rootTreeData, rootProfile);
        return rootProfile;
    }

}