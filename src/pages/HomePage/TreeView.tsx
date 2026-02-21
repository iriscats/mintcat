import React from "react";
import {Tree, TreeProps} from 'antd';
import type {CompleteModData} from "@/storage/dao/ModDAO";
import {StorageAPI} from "@/storage";
import {autoBind} from "@/utils/ReactUtils";
import {TreeViewModel} from "./TreeViewModel";
import {TreeViewConverter} from "./TreeViewConverter";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import {TreeViewItem} from "./TreeViewItem";
import {dragAndDrop} from "./DragAndDropTree";
import { IoC } from "@/core/IoC";


export interface FolderInfo {
    key: string;
    title: string;
}

export interface TreeViewProps {
    treeData?: TreeProps['treeData'];
    isMultiSelect?: boolean;
    expandedKeys?: any[];
    selectedKeys?: any[];
    checkedKeys?: any[];
    virtual?: boolean;
    onMenuClick: (key: string, nodeKey: string) => void;
    onUpdateTreeView?: () => void;
    onCountLabelUpdate?: () => Promise<void>;
    onTreeNodeSelect?: (keys: any) => void;
    onTreeNodeCheck?: (checkedKeys: any) => void;
    onTreeNodeExpand?: (keys: any) => void;
    onTreeRightClick?: (info: any) => void;
    onVirtualStateChange?: (virtual: boolean) => void;
    onModListChange?: () => void;
}

interface TreeViewState {
    isDragging: boolean;
}

export class TreeView extends React.Component<TreeViewProps, TreeViewState> {
    state: TreeViewState = {
        isDragging: false
    };

    shouldComponentUpdate(nextProps: TreeViewProps, nextState: TreeViewState) {
        return (
            nextProps.treeData !== this.props.treeData ||
            nextProps.expandedKeys !== this.props.expandedKeys ||
            nextProps.selectedKeys !== this.props.selectedKeys ||
            nextProps.checkedKeys !== this.props.checkedKeys ||
            nextProps.isMultiSelect !== this.props.isMultiSelect ||
            nextProps.virtual !== this.props.virtual ||
            nextState.isDragging !== this.state.isDragging
        );
    }

    /**
     * 从 treeData 中提取所有文件夹信息
     */
    private getFolderList(): FolderInfo[] {
        const folders: FolderInfo[] = [];
        
        const collectFolders = (nodes: any[]) => {
            for (const node of nodes) {
                if (!node.isLeaf && node.key !== 'root') {
                    folders.push({
                        key: node.key,
                        title: node.title
                    });
                }
                if (node.children) {
                    collectFolders(node.children);
                }
            }
        };

        if (this.props.treeData) {
            collectFolders(this.props.treeData as any[]);
        }

        return folders;
    }

    /**
     * 移动节点到指定文件夹（复用拖放逻辑）
     */
    @autoBind
    private async onMoveToFolder(sourceKey: string, targetFolderKey: string) {
        await IoC.get(TreeViewModel);
        const profileVM = await IoC.get(ProfileViewModel);
        const activeRoot = await profileVM.getActiveProfileTreeRoot();
        let treeData: any[];
        const modList = await this.getAllModsAsList();
        const converter = new TreeViewConverter(modList);

        if (TreeViewConverter.filterList.length > 0) {
            const filterList = TreeViewConverter.filterList;
            TreeViewConverter.filterList = [];
            treeData = converter.convertToFromRoot(activeRoot);
            TreeViewConverter.filterList = filterList;
        } else {
            treeData = this.props.treeData ? [...this.props.treeData as any[]] : [];
        }

        // 查找源节点和目标文件夹节点
        const findNode = (nodes: any[], key: string): any | null => {
            for (const node of nodes) {
                if (node.key === key) {
                    return node;
                }
                if (node.children) {
                    const found = findNode(node.children, key);
                    if (found) return found;
                }
            }
            return null;
        };

        const targetNode = findNode(treeData, targetFolderKey);
        if (!targetNode) {
            console.error(`[TreeView] Target folder not found: ${targetFolderKey}`);
            return;
        }

        // 构造一个模拟的拖放事件信息
        const mockInfo = {
            node: {
                key: targetFolderKey,
                pos: '0-0', // 简化的位置
                isLeaf: false
            },
            dragNode: {
                key: sourceKey
            },
            dropToGap: false, // 拖入文件夹内部
            dropPosition: 0
        };

        const dragTreeData = dragAndDrop(mockInfo, treeData);

        try {
            const profileTreeItem = converter.convertFrom(dragTreeData);

            if (!profileTreeItem || profileTreeItem.children.length === 0) {
                return;
            }

            await profileVM.saveProfileTreeToDatabase(profileTreeItem);

            if (this.props.onModListChange) {
                this.props.onModListChange();
            }
            if (this.props.onUpdateTreeView) {
                await this.props.onUpdateTreeView();
            }
        } catch (error) {
            console.error(`[TreeView] Error during move to folder:`, error);
        }
    }

    @autoBind
    private async onDrop(info: any) {
        await IoC.get(TreeViewModel);
        const profileVM = await IoC.get(ProfileViewModel);
        const activeRoot = await profileVM.getActiveProfileTreeRoot();
        let treeData: any[];
        const modList = await this.getAllModsAsList();
        const converter = new TreeViewConverter(modList);

        if (TreeViewConverter.filterList.length > 0) {
            const filterList = TreeViewConverter.filterList;
            TreeViewConverter.filterList = [];
            treeData = converter.convertToFromRoot(activeRoot);
            TreeViewConverter.filterList = filterList;
        } else {
            treeData = this.props.treeData || [];
        }

        // 修复：对于第一个文件夹的特殊处理
        // 当目标是文件夹（非叶子节点）且拖放到间隙但位置是0时，
        // 如果该节点是其父级中的第一个节点，应该视为拖入文件夹内部
        const dropNode = info.node;
        const dropPos = dropNode.pos.split('-');
        const nodeIndex = Number(dropPos[dropPos.length - 1]);
        
        // 如果目标是文件夹，且是第一个节点，且 dropPosition 在节点上方（0）
        // 则修正 dropToGap 为 false，视为拖入文件夹内部
        if (dropNode.isLeaf === false && 
            nodeIndex === 0 && 
            info.dropToGap && 
            info.dropPosition === 0) {
            // 创建修正后的 info 对象
            info = {
                ...info,
                dropToGap: false,
            };
        }

        const dragTreeData = dragAndDrop(info, treeData);

        try {
            const profileTreeItem = converter.convertFrom(dragTreeData);

            if (!profileTreeItem || profileTreeItem.children.length === 0) {
                return;
            }

            const profileVM = await IoC.get(ProfileViewModel);
            await profileVM.saveProfileTreeToDatabase(profileTreeItem);

            if (this.props.onModListChange) {
                this.props.onModListChange();
            }
            if (this.props.onUpdateTreeView) {
                await this.props.onUpdateTreeView();
            }
        } catch (error) {
            console.error(`[TreeView] Error during drag and drop:`, error);
        }
    }

    @autoBind
    private onTreeNodeSelect(keys: any) {
        if (this.props.onTreeNodeSelect) {
            this.props.onTreeNodeSelect(keys);
        }
    }

    @autoBind
    private onTreeNodeCheck(checkedKeys: any) {
        if (this.props.onTreeNodeCheck) {
            this.props.onTreeNodeCheck(checkedKeys);
        }
    }

    @autoBind
    private onTreeNodeExpand(keys: any) {
        if (this.props.onTreeNodeExpand) {
            this.props.onTreeNodeExpand(keys);
        }
    }

    @autoBind
    private onTreeRightClick(info: any) {
        if (this.props.onTreeRightClick) {
            this.props.onTreeRightClick(info);
        }
    }

    @autoBind
    private onCustomTitleRender(nodeData: any) {
        const folders = this.getFolderList();
        return TreeViewItem(
            nodeData, 
            this.props.onMenuClick, 
            this.props.onCountLabelUpdate,
            folders,
            this.onMoveToFolder
        );
    }
    /**
     * Helper method to get all mods from database as CompleteModData array
     */
    private async getAllModsAsList(): Promise<CompleteModData[]> {
        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();
        const modIds = allMods.map(m => m.modId!);
        return await modsApi.getBatchCompleteModData(modIds);
    }

    render() {
        return (
            <Tree
                className="ant-tree-content"
                blockNode
                draggable
                focusable={false}
                tabIndex={-1}
                // Workaround for antd bug: https://github.com/ant-design/ant-design/issues/54610
                // Disable virtual scrolling during drag to prevent auto-scroll from getting stuck
                virtual={!this.state.isDragging}
                height={window.innerHeight - 155}
                checkable={this.props.isMultiSelect}
                expandedKeys={this.props.expandedKeys}
                selectedKeys={this.props.selectedKeys}
                checkedKeys={this.props.isMultiSelect ? this.props.checkedKeys : undefined}
                treeData={this.props.treeData}
                onCheck={this.onTreeNodeCheck}
                onSelect={this.onTreeNodeSelect}
                onRightClick={this.onTreeRightClick}
                onExpand={this.onTreeNodeExpand}
                onDrop={this.onDrop}
                onDragStart={() => {
                    this.setState({ isDragging: true });
                }}
                onDragEnd={() => {
                    this.setState({ isDragging: false });
                }}
                titleRender={this.onCustomTitleRender}
            />
        );
    }
}
