import React from "react";
import {Tree, TreeProps} from 'antd';
import {ModListItem} from "@/storage/db/Schema";
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
        console.log(`\n========== [TreeView] onDrop 开始 ==========`);
        console.log(`[TreeView] 拖拽信息:`, {
            dragKey: info.dragNode.key,
            dragTitle: info.dragNode.title,
            dropKey: info.node.key,
            dropTitle: info.node.title,
            dropPosition: info.dropPosition,
            dropToGap: info.dropToGap
        });

        await IoC.get(TreeViewModel);
        const profileVM = await IoC.get(ProfileViewModel);
        const activeProfile = await profileVM.getActiveProfileTree();
        let treeData: any[];
        const modList = await this.getAllModsAsList();
        const converter = new TreeViewConverter(modList);

        console.log(`[TreeView] 当前 modList 数量:`, modList.length);

        if (TreeViewConverter.filterList.length > 0) {
            const filterList = TreeViewConverter.filterList;
            TreeViewConverter.filterList = [];
            treeData = converter.convertTo(activeProfile);
            TreeViewConverter.filterList = filterList;
        } else {
            treeData = this.props.treeData || [];
        }

        console.log(`[TreeView] 拖拽前树形数据:`, JSON.stringify(treeData, null, 2));

        const dragTreeData = dragAndDrop(info, treeData);

        console.log(`[TreeView] 拖拽后树形数据:`, JSON.stringify(dragTreeData, null, 2));

        try {
            console.log(`[TreeView] 开始转换 dragTreeData 为 ProfileTreeItem...`);
            const profileTreeItem = converter.convertFrom(dragTreeData);
            console.log(`[TreeView] 转换后的 ProfileTreeItem:`, JSON.stringify(profileTreeItem, (key, value) => {
                if (key === 'children' && Array.isArray(value)) {
                    return `[${value.length} 个子项]`;
                }
                return value;
            }, 2));
            console.log(`[TreeView] ProfileTreeItem 子项详情:`, profileTreeItem.children.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                childrenCount: c.children?.length || 0
            })));

            if (!profileTreeItem || profileTreeItem.children.length === 0) {
                console.warn(`[TreeView] ⚠️ 转换后的 ProfileTreeItem 为空或无效`);
                return;
            }

            console.log(`[TreeView] 开始保存到数据库...`);
            const profileVM = await IoC.get(ProfileViewModel);
            await profileVM.saveProfileTreeToDatabase(profileTreeItem);
            console.log(`[TreeView] ✅ Profile data set successfully`);

            if (this.props.onUpdateTreeView) {
                await this.props.onUpdateTreeView();
            }
            console.log(`[TreeView] ✅ Tree view updated`);
            console.log(`========== [TreeView] onDrop 完成 ==========\n`);
        } catch (error) {
            console.error(`[TreeView] ❌ Error during drag and drop:`, error);
            console.error(`[TreeView] Error details:`, {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : 'No stack trace'
            });
            console.log(`========== [TreeView] onDrop 失败 ==========\n`);
            // 可以在这里添加用户通知，例如使用 antd 的 message 组件
            // message.error(`Failed to move item: ${error instanceof Error ? error.message : String(error)}`);
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
     * Check if a tree node is draggable
     * Default folders (Mod.io, Local) are not draggable
     */
    @autoBind
    private isNodeDraggable(nodeData: any): boolean {
        // Check if this is a default folder (Mod.io or Local)
        // Default folders have IDs 1 (Mod.io) and 2 (Local)
        if (typeof nodeData.key === 'string' && nodeData.key.startsWith('folder-')) {
            const folderId = parseInt(nodeData.key.split('-')[1]);
            if (folderId === 1 || folderId === 2) {
                return false; // Don't allow dragging default folders
            }
        }
        return true;
    }

    /**
     * Helper method to get all mods from database as ModListItem array
     */
    private async getAllModsAsList(): Promise<ModListItem[]> {
        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();

        return allMods.map(mod => ({
            id: mod.modId!,
            modId: mod.platformId,
            url: mod.url || "",
            nameId: mod.nameId,
            displayName: mod.displayName,
            required: false,
            enabled: true,
            fileVersion: "-",
            tags: mod.tags || [],
            usedVersion: "",
            versions: [],
            approval: mod.approvalStatus || "Sandbox",
            sourceType: mod.sourceType as any,
            downloadUrl: "",
            cachePath: "",
            downloadProgress: 100,
            fileSize: 0,
            lastUpdateDate: 0,
            onlineUpdateDate: 0,
            onlineAvailable: true,
            localNoFound: false
        }));
    }

    render() {
        return (
            <Tree
                className="ant-tree-content"
                draggable={this.isNodeDraggable}
                blockNode
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
