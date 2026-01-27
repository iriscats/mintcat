import React from "react";
import {t} from "i18next";
import {save} from "@tauri-apps/plugin-dialog";
import {copyFile, exists} from "@tauri-apps/plugin-fs";
import {
    Button, Checkbox, Divider,
    Flex, MenuProps, message, Select,
    SelectProps, Space, Spin, Tooltip, TreeProps, Typography,
} from 'antd';
import {
    CloseCircleOutlined, CloseOutlined, CopyOutlined,
    DeleteOutlined,
    EditOutlined, FieldTimeOutlined, LoadingOutlined, PauseCircleOutlined, PlayCircleOutlined,
    PlusCircleOutlined, SaveOutlined, SortAscendingOutlined, SortDescendingOutlined, SyncOutlined,
    UnorderedListOutlined
} from "@ant-design/icons";
import * as checkbox from "antd/es/checkbox";

import {openWindow} from "@/dialogs/AddModDialog/open";
import ProfileEditDialog from "@/dialogs/ProfileEditDialog/index.tsx";
import {InputDialog} from "@/dialogs/InputDialog.tsx";
import {TreeViewConverter} from "./TreeViewConverter.ts";
import {TreeViewOutlined} from "@/components/SvgIcon.tsx";
import {MessageBox} from "@/components/MessageBox.ts";
import {ModUpdateService} from "@/services/ModUpdateService.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import {autoBind} from "@/utils/ReactUtils.ts";
import {HomeViewModel} from "./HomeViewModel.ts";
import {TreeViewModel} from "./TreeViewModel.ts";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import {ProfileService} from "@/services/ProfileService.ts";
import {CountLabel} from "./CountLabel.tsx";
import {BasePage} from "../IBasePage.ts";
import {listenEvent, type UnlistenFn} from "@/events";
import {ProfileTreeGroupType} from "@/storage/db/Schema.ts";
import {AddModType} from "@/dialogs/AddModDialog";
import {SearchBox} from "@/pages/HomePage/SearchBox.tsx";
import {StorageAPI} from "@/storage";
import type {CompleteModData} from "@/storage/dao/ModDAO";
import {TreeView} from "./TreeView.tsx";
import {AppInitializer} from "@/core/AppInitializer";
import {IoC} from "@/core/IoC.ts";
import { taskQueueAPI } from "tauri-plugin-task-queue-api";
import type {DataNode} from "antd/es/tree";


interface ModListPageState {
    profileOptions?: SelectProps['options'];
    treeData?: TreeProps['treeData'];
    contextMenus?: MenuProps['items'];
    isMultiSelect?: boolean;
    expandedKeys?: any[];
    selectedKeys?: any[];
    defaultProfile?: string;
    displayMode?: string;
    loading?: boolean;
    virtual?: boolean;
    enableCount?: number;
    totalCount?: number;
}


export class HomePage extends BasePage<any, ModListPageState> {

    private readonly profileEditDialogRef: React.RefObject<ProfileEditDialog> = React.createRef();

    private readonly inputDialogRef: React.RefObject<InputDialog> = React.createRef();

    // Event listener cleanup functions
    private unlistenActiveGameChange?: UnlistenFn;

    public constructor(props: any) {
        super(props);

        this.state = {
            profileOptions: [],
            contextMenus: [],
            expandedKeys: [],
            selectedKeys: [],
            defaultProfile: "",
            loading: false,
            virtual: true,
            enableCount: 0,
            totalCount: 0,
        }

    }

    /**
     * Helper method to extract modId from tree node key
     * Keys can be in format "mod-123" or just a number
     */
    private extractModIdFromKey(key: string | number): number | null {
        if (typeof key === 'number') {
            return key;
        }
        if (typeof key === 'string' && key.startsWith('mod-')) {
            const id = parseInt(key.substring(4));
            return isNaN(id) ? null : id;
        }
        const id = parseInt(String(key));
        return isNaN(id) ? null : id;
    }

    /**
     * Helper method to get a mod from database by ID
     */
    private async getModById(modId: number): Promise<CompleteModData | null> {
        const modsApi = await StorageAPI.getMods();
        return await modsApi.getCompleteModData(modId);
    }

    /**
     * Helper method to get expanded folder names from current expandedKeys
     * This is used to preserve expanded state across tree reloads when folder IDs change
     */
    private getExpandedFolderNames(): string[] {
        const { expandedKeys, treeData } = this.state;
        if (!expandedKeys || !treeData) return [];

        const names: string[] = [];

        const findFolderName = (nodes: DataNode[], key: string): string | null => {
            for (const node of nodes) {
                if (node.key === key && key.toString().startsWith('folder-')) {
                    return node.title as string;
                }
                if (node.children) {
                    const found = findFolderName(node.children as DataNode[], key);
                    if (found) return found;
                }
            }
            return null;
        };

        for (const key of expandedKeys) {
            const name = findFolderName(treeData as DataNode[], key.toString());
            if (name) names.push(name);
        }

        return names;
    }

    /**
     * Helper method to reconstruct expandedKeys from folder names after tree reload
     * Maps folder names back to their new IDs
     */
    private reconstructExpandedKeys(folderNames: string[], treeData: DataNode[]): string[] {
        const newKeys: string[] = [];

        const findKeyByName = (nodes: DataNode[], name: string): string | null => {
            for (const node of nodes) {
                const key = node.key.toString();
                if (key.startsWith('folder-') && node.title === name) {
                    return key;
                }
                if (node.children) {
                    const found = findKeyByName(node.children as DataNode[], name);
                    if (found) return found;
                }
            }
            return null;
        };

        for (const name of folderNames) {
            const key = findKeyByName(treeData, name);
            if (key) newKeys.push(key);
        }

        return newKeys;
    }

    private async handleExportMod(id: number): Promise<void> {
        try {
            const mod = await this.getModById(id);
            if (!mod) {
                message.error(t("Mod Not Found"));
                return;
            }

            const cachePath = mod.download?.cachePath || "";
            const downloadStatus = mod.download?.downloadStatus || "pending";

            if (!cachePath || downloadStatus !== "completed") {
                if (downloadStatus === "downloading") {
                    message.warning(t("Mod is downloading, please wait"));
                } else if (downloadStatus === "failed") {
                    message.error(t("Mod download failed, please click update to download mod try again"));
                } else {
                    message.warning(t("Please click update to download mod"));
                }
                return;
            }

            const fileExists = await exists(cachePath);
            if (!fileExists) {
                message.error(t("File Not Found") + `: ${cachePath}`);
                return;
            }

            const path = await save({
                filters: [{
                    name: mod.displayName,
                    extensions: ['zip', 'pak'],
                }]
            });

            if (!path) {
                return;
            }

            await copyFile(cachePath, path);
            message.success(t("Export Success"));
        } catch (e) {
            console.error(`[HomePage] Export failed for id=${id}:`, e);
            message.error(t("Export Failed") + `: ${e}`);
        }
    }

    private async handleCopyLink(id: number): Promise<void> {
        try {
            const mod = await this.getModById(id);
            if (mod?.url) {
                ClipboardApi.setLastClipboardText(mod.url);
                await navigator.clipboard.writeText(mod.url);
                message.success(t("Copied To Clipboard") + `: ${mod.url} `);
            } else {
                const cachePath = mod?.download?.cachePath || "";
                await navigator.clipboard.writeText(cachePath);
                message.success(t("Copied To Clipboard") + `: ${cachePath} `);
            }
        } catch (err) {
            console.error(`[HomePage] Copy link failed for id=${id}:`, err);
            message.error(t("Copy Failed"));
        }
    }

    // Multi Operations
    @autoBind
    private onMultiCheckboxChange(e: checkbox.CheckboxChangeEvent) {
        this.setState({
            isMultiSelect: e.target.checked
        })
    }

    @autoBind
    private async onMultiDeleteClick() {
        const vm = await IoC.get(HomeViewModel);

        const confirm = await MessageBox.confirm({
            title: t("Delete Mods"),
            content: t("Are you sure you want to delete the selected mods?"),
        });

        if (this.state.selectedKeys.length === 0) {
            return;
        }

        if (confirm) {
            for (const key of this.state.selectedKeys) {
                const modId = this.extractModIdFromKey(key);
                if (modId === null) continue;
                const modItem = await this.getModById(modId);
                if (modItem) {
                    await vm.removeMod(modItem.modId!);
                }
            }
            await this.updateTreeView();
            await this.updateCountLabel();
        }
    }

    @autoBind
    private async onMultiEnableClick(isEnable: boolean) {
        const vm = await IoC.get(HomeViewModel);
        if (this.state.selectedKeys.length === 0) {
            return;
        }

        for (const key of this.state.selectedKeys) {
            const modId = this.extractModIdFromKey(key);
            if (modId === null) continue;
            await vm.setModEnabled(modId, isEnable);
        }
        await this.updateTreeView();
        await this.updateCountLabel();
    }

    @autoBind
    private async onMultiUpdateClick() {
        const mods: CompleteModData[] = [];

        for (const key of this.state.selectedKeys) {
            const modId = this.extractModIdFromKey(key);
            if (modId === null) continue;
            const modItem = await this.getModById(modId);
            if (modItem) {
                mods.push(modItem);
            }
        }

        if (mods.length > 0) {
            await ModUpdateService.batchUpdateMods(mods);
        }
    }

    @autoBind
    private async onMultiCopyClick() {
        if (this.state.selectedKeys.length === 0) {
            return;
        }

        const urls: string[] = [];
        for (const key of this.state.selectedKeys) {
            const modId = this.extractModIdFromKey(key);
            if (modId === null) continue;
            const mod = await this.getModById(modId);
            if (mod?.url) {
                urls.push(mod.url);
            }
        }

        if (urls.length > 0) {
            const text = urls.join("\n");
            ClipboardApi.setLastClipboardText(text);
            await navigator.clipboard.writeText(text);
            message.success(t("Copied To Clipboard") + `: ${urls.length} URLs`);
        }
    }

    // Menu Bar Operations
    @autoBind
    private async onMenuBarCopyListClick() {
        const vm = await IoC.get(HomeViewModel);
        await vm.exportModioUrlsToClipboard();
    }

    @autoBind
    private async onMenuBarAddModClick() {
        // Get current active profile's Local folder ID using ProfileService
        const profileService = new ProfileService();
        const localFolderId = await profileService.getActiveProfileFolderId('local');

        if (!localFolderId) {
            message.error(t("Local Folder Not Found"));
            return;
        }

        openWindow(AddModType.LOCAL, localFolderId, "", async () => {
            await this.updateTreeView();
            await this.updateCountLabel();
        }).then();
    }

    @autoBind
    private async onMenuBarSaveChangesClick() {
        try {
            // Submit installation task
            const taskId = await IntegrateApi.installMods();

            // Wait for task to complete (no timeout)
            const result = await taskQueueAPI.waitForTaskCompletion(taskId);

            if (result.status === 'completed') {
                message.success(t("Installation Finish"));
            } else if (result.status === 'failed') {
                message.error(`${t("Installation Failed")}: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('[HomePage] Installation failed:', error);
            message.error(t("Installation Failed"));
        }
    }

    @autoBind
    private async onMenuBarUpdateClick() {
        await ModUpdateService.checkModUpdate();
        await ModUpdateService.checkModList((loading) => {
            this.setState({ loading });
        });
        await this.updateTreeView();
        await this.updateCountLabel();
        message.success(t("Update Finish"));
    }

    @autoBind
    private async onMenuBarUninstallModsClick() {
        try {
            const confirm = await MessageBox.confirm({
                title: t("Uninstall Mods"),
                content: t("Are you sure you want to uninstall the selected mods?"),
            });
            if (!confirm) {
                return;
            }
            await IntegrateApi.uninstallMods();
        } catch (error) {
            console.error('[HomePage] Uninstall mods failed:', error);
            message.error(t("Uninstall Failed"));
        }
    }

    @autoBind
    private async onMenuBarSortClick(order: string) {
        const vm = await IoC.get(TreeViewModel);
        await vm.sortMods(order);
        await this.updateTreeView();
    }

    @autoBind
    private onEditProfileClick() {
        this.profileEditDialogRef
            .current?.setCallback(async () => {
            await this.updateProfileSelect();
            await this.updateTreeView();
            await this.updateCountLabel();
        }).show();
    }

    @autoBind
    private async onSelectChange(value: string) {
        await IoC.get(TreeViewModel);
        const profileVM = await IoC.get(ProfileViewModel);

        await profileVM.setActiveProfile(value);
        this.setState({
            defaultProfile: value as string,
        })
        await ModUpdateService.checkModUpdate();
        await ModUpdateService.checkModList((loading) => {
            this.setState({ loading });
        });
        await this.updateTreeView();
        await this.updateCountLabel();
    };

    @autoBind
    private onTreeNodeSelect(keys) {
        this.setState({
            selectedKeys: keys,
        })
    }

    @autoBind
    private onTreeNodeExpand(keys) {
        this.setState({
            expandedKeys: keys,
        })
    };

    @autoBind
    private onTreeRightClick(info) {
        this.setState({
            selectedKeys: [info.node.key],
        })
    };

    @autoBind
    private async updateProfileSelect() {
        await IoC.get(TreeViewModel);
        const profileVM = await IoC.get(ProfileViewModel);

        const profileList = await profileVM.getProfileList();
        const activeProfileName = await profileVM.getActiveProfileName();

        const options: SelectProps['options'] = profileList.map(profileKey => ({
            value: profileKey,
            label: profileKey,
        }));
        this.setState({
            profileOptions: options,
            defaultProfile: activeProfileName,
        })
        await this.updateCountLabel();
    }

    @autoBind
    private async updateTreeView() {
        // Before reload: Save expanded folder names to preserve expanded state
        const expandedFolderNames = this.getExpandedFolderNames();

        await IoC.get(TreeViewModel);
        const modsApi = await StorageAPI.getMods();
        const profilesApi = await StorageAPI.getProfiles();

        // Get all mods with complete data (version, download, status)
        const basicMods = await modsApi.getAllMods();
        const modIds = basicMods.map(m => m.modId!);
        const allMods = await modsApi.getBatchCompleteModData(modIds);
        const activeProfile = await profilesApi.getActiveProfile();

        // Get profile-specific mod data (enabled status, used version)
        const profileMods = activeProfile ? await profilesApi.getProfileMods(activeProfile.id!) : [];

        // TreeViewConverter now accepts CompleteModData[] and ProfileModData[]
        const converter = new TreeViewConverter(allMods, profileMods);

        // After reload: Reconstruct expandedKeys using folder names
        let newExpandedKeys: any[];
        if (expandedFolderNames.length > 0) {
            // Reconstruct expandedKeys from folder names (handles ID changes)
            newExpandedKeys = this.reconstructExpandedKeys(expandedFolderNames, converter.treeData as DataNode[]);
        } else if (this.state.expandedKeys.length === 0) {
            // First load: use default expanded keys from converter
            newExpandedKeys = converter.expandedKeys;
        } else {
            // Keep existing expandedKeys (shouldn't normally reach here)
            newExpandedKeys = this.state.expandedKeys;
        }

        this.setState({
            treeData: converter.treeData,
            expandedKeys: newExpandedKeys,
        });
    }

    @autoBind
    private async updateCountLabel() {
        const profileVM = await IoC.get(ProfileViewModel);
        const activeProfile = await profileVM.getActiveProfileData();

        if (!activeProfile?.id) {
            this.setState({
                enableCount: 0,
                totalCount: 0,
            });
            return;
        }

        const profilesApi = await StorageAPI.getProfiles();
        const profileMods = await profilesApi.getProfileMods(activeProfile.id);

        this.setState({
            enableCount: profileMods.filter(mod => mod.isEnabled).length,
            totalCount: profileMods.length,
        });
    }

    @autoBind
    private async onMenuClick(key: string, nodeKey: string) {
        const vm = await IoC.get(HomeViewModel);
        let shouldUpdateTree = false;
        let shouldUpdateCount = false;

        // Helper function to extract numeric ID from nodeKey (e.g., "folder-3" -> 3)
        const extractId = (key: string): number => {
            if (typeof key === 'string' && key.includes('-')) {
                const parts = key.split('-');
                return parseInt(parts[1], 10);
            }
            return parseInt(key as any, 10);
        };

        // Extract ID for tree nodes
        const id = extractId(nodeKey);

        switch (key) {
            case "add_new_group": {
                this.inputDialogRef.current?.setCallback(
                    t("Add New Group"),
                    t("New Group"),
                    async (text) => {
                        await vm.addGroup(0, text);
                        await this.updateTreeView();
                    })
                    .show();
            }
                break;
            case "add_sub_group":
                this.inputDialogRef.current?.setCallback(
                    t("Add Sub Group"),
                    t("New Group"),
                    async (text) => {
                        await vm.addGroup(id, text);
                        await this.updateTreeView();
                    }).show();
                break;
            case "delete_group":
                try {
                    await vm.removeGroup(id);
                    shouldUpdateTree = true;
                } catch (error) {
                    console.error(`[HomePage] Delete group failed for id=${id}:`, error);
                }
                break;
            case "rename_group":
                const groupName = await vm.getGroupName(id);
                this.inputDialogRef.current?.setCallback(
                    t("Rename Group"),
                    groupName || "",
                    async (text) => {
                        await vm.setGroupName(id, text);
                        await this.updateTreeView();
                    }).show();
                break;
            case "update": {
                const mod = await this.getModById(id);
                if (mod) {
                    await ModUpdateService.updateMod(mod);
                }
            }
                break;
            case "add_mod": {
                switch (id) {
                    case ProfileTreeGroupType.LOCAL:
                        await openWindow(AddModType.LOCAL, id, "", async () => {
                            await this.updateTreeView();
                            await this.updateCountLabel();
                        });
                        break;
                    case ProfileTreeGroupType.MODIO:
                        await openWindow(AddModType.MODIO, id, "", async () => {
                            await this.updateTreeView();
                            await this.updateCountLabel();
                        });
                        break;
                    default:
                        await openWindow(AddModType.MODIO, id, "", async () => {
                            await this.updateTreeView();
                            await this.updateCountLabel();
                        });
                        break;
                }
            }
                break;
            case "rename":
                const mod = await this.getModById(id);
                const modName = mod?.displayName;
                this.inputDialogRef.current.setCallback(
                    "Rename Mod",
                    modName,
                    async (text) => {
                        await vm.setDisplayName(id, text);
                        await this.updateTreeView();
                    }).show();
                break;
            case "delete":
                await vm.removeMod(id);
                shouldUpdateTree = true;
                shouldUpdateCount = true;
                break;
            case "copy_link":
                await this.handleCopyLink(id);
                break;
            case "export": {
                await this.handleExportMod(id);
            }
                break;
            default:
                break;
        }

        if (shouldUpdateTree) {
            await this.updateTreeView();
        }
        if (shouldUpdateCount) {
            await this.updateCountLabel();
        }
    }

    async componentDidMount(): Promise<void> {
        // Wait for core to be ready
        if (!AppInitializer.isCoreReady()) {
            await AppInitializer.initializeCore();
        }

        // Pre-initialize UI ViewModels (optional but recommended for better UX)
        await IoC.get(TreeViewModel);
        await IoC.get(HomeViewModel);

        // Setup window resize hook
        this.hookWindowResized();

        // Setup event listeners
        // 监听游戏切换事件，切换时更新 TreeView 和 Profile 列表
        this.unlistenActiveGameChange = await listenEvent("active-game-change", async () => {
            await this.updateProfileSelect();
            await this.updateTreeView();
            await this.updateCountLabel();
        });

        // Initial UI update
        this.updateProfileSelect().then();
        this.updateTreeView().then();
        this.updateCountLabel().then();

        // Check for mod updates
        ModUpdateService.checkModList((loading) => {
            this.setState({ loading });
        }).then();
    }

    componentWillUnmount(): void {
        // ✅ 清理所有事件监听器
        if (this.unlistenActiveGameChange) {
            this.unlistenActiveGameChange();
        }
    }

    render() {
        return (
            <div className="mod-list-page-card">
                <ProfileEditDialog ref={this.profileEditDialogRef}/>
                <InputDialog ref={this.inputDialogRef}/>
                <Spin spinning={this.state.loading}
                      delay={500}
                      size={"large"}
                      indicator={null}
                      tip={
                          <Flex gap={"large"}
                                vertical={false}
                                className="home-loading-tip"
                          >
                              <LoadingOutlined spin/>
                              <span>{t("Loading")}</span>
                              <Button type={"text"}
                                      icon={<CloseOutlined/>}
                                      onClick={() => {
                                          this.setState({
                                              loading: false,
                                          })
                                      }}
                              />
                          </Flex>
                      }
                >
                    <Flex vertical={true}>
                        <Space separator={<Divider orientation="vertical"/>} size={2}
                               className="home-menu-bar">
                            <Typography.Link>
                                <Tooltip title={t("Save Changes")}>
                                    <Button icon={<SaveOutlined/>} type={"text"}
                                            onClick={this.onMenuBarSaveChangesClick}/>
                                </Tooltip>
                                <Tooltip title={t("Uninstall Mods")}>
                                    <Button icon={<DeleteOutlined/>} type={"text"}
                                            onClick={this.onMenuBarUninstallModsClick}/>
                                </Tooltip>
                                <Tooltip title={t("Add Mod")}>
                                    <Button icon={<PlusCircleOutlined/>} type={"text"}
                                            onClick={this.onMenuBarAddModClick}/>
                                </Tooltip>
                                <Tooltip title={t("Check Mod Updates")}>
                                    <Button icon={<SyncOutlined/>} type={"text"} onClick={this.onMenuBarUpdateClick}/>
                                </Tooltip>
                                <Tooltip title={t("Copy List")}>
                                    <Button icon={<CopyOutlined/>} type={"text"} onClick={this.onMenuBarCopyListClick}/>
                                </Tooltip>
                            </Typography.Link>
                            {
                                this.state.displayMode === "ListView" &&
                                <Typography.Link>
                                    <Tooltip title="List View">
                                        <Button icon={<UnorderedListOutlined/>} type={"text"}/>
                                    </Tooltip>
                                    <Tooltip title="Group View">
                                        <Button icon={<TreeViewOutlined/>} type={"text"}/>
                                    </Tooltip>
                                </Typography.Link>
                            }
                            <Typography.Link>
                                <Tooltip title={t("Sort Ascending")}>
                                    <Button icon={<SortAscendingOutlined/>}
                                            type={"text"}
                                            onClick={() => this.onMenuBarSortClick("asc")}
                                    />
                                </Tooltip>
                                <Tooltip title={t("Sort Descending")}>
                                    <Button icon={<SortDescendingOutlined/>}
                                            type={"text"}
                                            onClick={() => this.onMenuBarSortClick("desc")}
                                    />
                                </Tooltip>
                                <Tooltip title={t("Sort By Time")}>
                                    <Button icon={<FieldTimeOutlined/>}
                                            type={"text"}
                                            onClick={() => this.onMenuBarSortClick("time")}/>
                                </Tooltip>
                            </Typography.Link>
                            <Typography.Link>
                                <Select
                                    size={"small"}
                                    className="w-300"
                                    value={this.state.defaultProfile}
                                    options={this.state.profileOptions}
                                    onChange={this.onSelectChange}
                                />
                                <Tooltip title={t("Edit Profile")}>
                                    <Button icon={<EditOutlined/>} type={"text"} onClick={this.onEditProfileClick}/>
                                </Tooltip>
                            </Typography.Link>
                            <Typography.Link>
                                <SearchBox onUpdateTreeView={this.updateTreeView}/>
                            </Typography.Link>
                        </Space>
                        <div style={{
                            height: window.innerHeight - 145,
                        }}>
                            <TreeView
                                treeData={this.state.treeData}
                                isMultiSelect={this.state.isMultiSelect}
                                expandedKeys={this.state.expandedKeys}
                                selectedKeys={this.state.selectedKeys}
                                virtual={this.state.virtual}
                                onMenuClick={this.onMenuClick}
                                onUpdateTreeView={this.updateTreeView}
                                onCountLabelUpdate={this.updateCountLabel}
                                onTreeNodeSelect={this.onTreeNodeSelect}
                                onTreeNodeExpand={this.onTreeNodeExpand}
                                onTreeRightClick={this.onTreeRightClick}
                                onVirtualStateChange={(virtual) => {
                                    this.setState({ virtual });
                                }}
                            />
                        </div>
                        <Flex className="home-footer-bar">
                            <Checkbox onChange={this.onMultiCheckboxChange}
                            />
                            {
                                this.state.isMultiSelect === true &&
                                <span className="mr-auto">
                                    <Button type="text" 
                                            className="ml-10"
                                            size={"small"}
                                            icon={<CloseCircleOutlined/>}
                                            onClick={this.onMultiDeleteClick}>
                                    {t("Delete")}
                                    </Button>
                                    <Button type="text" size={"small"}
                                            icon={<PlayCircleOutlined/>}
                                            onClick={() => this.onMultiEnableClick(true)}>
                                        {t("Enable")}
                                    </Button>
                                    <Button type="text" size={"small"}
                                            icon={<PauseCircleOutlined/>}
                                            onClick={() => this.onMultiEnableClick(false)}>
                                        {t("Disable")}
                                    </Button>
                                    <Button type="text" size={"small"}
                                            icon={<SyncOutlined/>}
                                            onClick={this.onMultiUpdateClick}>
                                        {t("Update")}
                                    </Button>
                                    <Button type="text" size={"small"}
                                            icon={<CopyOutlined/>}
                                            onClick={this.onMultiCopyClick}>
                                        {t("Copy")}
                                    </Button>
                                </span>
                            }
                            <CountLabel enableCount={this.state.enableCount} totalCount={this.state.totalCount}/>
                        </Flex>
                    </Flex>
                </Spin>
            </div>
        )
    }
}
