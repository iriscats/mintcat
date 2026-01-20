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
    onTreeNodeSelect?: (keys: any) => void;
    onTreeNodeExpand?: (keys: any) => void;
    onTreeRightClick?: (info: any) => void;
    onVirtualStateChange?: (virtual: boolean) => void;
}

export class TreeView extends React.Component<TreeViewProps, any> {

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
        return TreeViewItem(nodeData, this.props.onMenuClick);
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
                virtual={this.props.virtual}
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
                    setTimeout(() => {
                        if (this.props.onVirtualStateChange) {
                            this.props.onVirtualStateChange(false);
                        }
                    }, 1000);
                }}
                titleRender={this.onCustomTitleRender}
            />
        );
    }
}
