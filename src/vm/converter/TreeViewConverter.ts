import {ProfileTree, ProfileTreeItem, ProfileTreeType} from "../config/ProfileList.ts";
import {TreeProps} from "antd";
import {ModList} from "../config/ModList.ts";


export class TreeViewConverter {

    public treeData?: TreeProps['treeData'] = []
    public expandedKeys?: TreeProps['expandedKeys'] = [];
    private modList?: ModList;

    public constructor(modList: ModList) {
        this.modList = modList;
    }

    private buildTreeNode(parent: any, root: ProfileTreeItem) {
        for (const item of root.children) {
            if (item.type === ProfileTreeType.ITEM) {
                const modItem = this.modList.get(item.id);
                const title = modItem.displayName === "" ? modItem.url : modItem.displayName;
                parent.children.push({
                    key: modItem.id,
                    isLeaf: true,
                    title: title,
                    tags: modItem.tags,
                    required: modItem.required,
                    enabled: modItem.enabled,
                    isLocal: modItem.isLocal,
                    approval: modItem.approval,
                    versions: modItem.versions,
                    fileVersion: modItem.fileVersion,
                });

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


    public convertTo(tree: ProfileTree) {
        const root = {
            key: "root",
            isLeaf: false,
            children: [],
        }
        this.buildTreeNode(root, tree.root);
        this.treeData = root.children;
    }


}