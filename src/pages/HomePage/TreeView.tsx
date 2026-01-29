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


export interface TreeViewProps {
    treeData?: TreeProps['treeData'];
    isMultiSelect?: boolean;
    expandedKeys?: any[];
    selectedKeys?: any[];
    virtual?: boolean;
    onMenuClick: (key: string, nodeKey: string) => void;
    onUpdateTreeView?: () => void;
    onCountLabelUpdate?: () => Promise<void>;
    onTreeNodeSelect?: (keys: any) => void;
    onTreeNodeExpand?: (keys: any) => void;
    onTreeRightClick?: (info: any) => void;
    onVirtualStateChange?: (virtual: boolean) => void;
}

interface TreeViewState {
    isDragging: boolean;
}

export class TreeView extends React.Component<TreeViewProps, TreeViewState> {
    state: TreeViewState = {
        isDragging: false
    };

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
        return TreeViewItem(nodeData, this.props.onMenuClick, this.props.onCountLabelUpdate);
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
                // Workaround for antd bug: https://github.com/ant-design/ant-design/issues/54610
                // Disable virtual scrolling during drag to prevent auto-scroll from getting stuck
                virtual={!this.state.isDragging}
                height={window.innerHeight - 155}
                checkable={this.props.isMultiSelect}
                expandedKeys={this.props.expandedKeys}
                selectedKeys={this.props.selectedKeys}
                treeData={this.props.treeData}
                onCheck={this.onTreeNodeSelect}
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
