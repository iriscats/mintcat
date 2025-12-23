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
import {ModUpdateApi} from "@/apis/ModUpdateApi.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {ModSourceType} from "@/storage/db/Schema.ts";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import {autoBind} from "@/utils/ReactUtils.ts";
import {HomeViewModel} from "./HomeViewModel.ts";
import {TreeViewModel} from "./TreeViewModel.ts";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import {ProfileService} from "@/services/ProfileService.ts";
import {CountLabel} from "./CountLabel.tsx";
import {BasePage} from "../IBasePage.ts";
import {emit, listen} from "@tauri-apps/api/event";
import {ProfileTreeGroupType} from "@/storage/db/Schema.ts";
import {AddModType} from "@/dialogs/AddModDialog";
import {SearchBox} from "@/pages/HomePage/SearchBox.tsx";
import {StorageAPI} from "@/storage";
import type {CompleteModData} from "@/storage/dao/ModDAO";
import {TreeView} from "./TreeView.tsx";
import {AppInitializer} from "@/core/AppInitializer";
import {IoC} from "@/core/IoC.ts";
import {TaskManager} from "@/tasks/TaskManager.ts";


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
}


export class HomePage extends BasePage<any, ModListPageState> {

    private readonly profileEditDialogRef: React.RefObject<ProfileEditDialog> = React.createRef();

    private readonly inputDialogRef: React.RefObject<InputDialog> = React.createRef();

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
        }

    }

    /**
     * Helper method to get a mod from database by ID
     */
    private async getModById(modId: number): Promise<CompleteModData | null> {
        const modsApi = await StorageAPI.getMods();
        return await modsApi.getCompleteModData(modId);
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
                const modItem = await this.getModById(key);
                if (modItem) {
                    await vm.removeMod(modItem.modId!);
                }
            }
            await this.updateTreeView();
        }
    }

    @autoBind
    private async onMultiEnableClick(isEnable: boolean) {
        const vm = await IoC.get(HomeViewModel);
        if (this.state.selectedKeys.length === 0) {
            return;
        }

        for (const key of this.state.selectedKeys) {
            await vm.setModEnabled(key, isEnable);
        }
        await this.updateTreeView();
    }

    @autoBind
    private async onMultiUpdateClick() {
        const vm = await IoC.get(TreeViewModel);

        for (const key of this.state.selectedKeys) {
            const modItem = await this.getModById(key);
            if (modItem) {
                await ModUpdateApi.updateMod(modItem)
            }
        }
    }

    // Menu Bar Operations
    @autoBind
    private async onMenuBarCopyListClick() {
        await IoC.get(TreeViewModel);
        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();

        const profileVM = await IoC.get(ProfileViewModel);
        const activeRoot = await profileVM.getActiveProfileTreeRoot();

        // Use ProfileTreeService to get mod list
        const treeService = (profileVM as any).profileService.getTreeService();
        const subModList = await treeService.getModsForTree(activeRoot);

        let list = "";
        for (const mod of subModList) {
            if (TreeViewConverter.filter(mod) && mod.sourceType === ModSourceType.Modio) {
                list += mod.url + "\n";
            }
        }

        ClipboardApi.setLastClipboardText(list);
        await navigator.clipboard.writeText(list);
        message.success(t("Copied To Clipboard"));
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

        openWindow(AddModType.LOCAL, localFolderId).then();
    }

    @autoBind
    private async onMenuBarSaveChangesClick() {
        try {
            // Submit installation task
            const taskId = await IntegrateApi.installMods();

            // Setup progress listener
            const taskManager = TaskManager.getInstance();
            const unlisten = await taskManager.onTaskUpdated((task) => {
                if (task.id === taskId) {
                    // Update status bar with progress
                    emit("status-bar-percent", task.progress).catch(console.error);

                    if (task.status === 'processing') {
                        console.log(`[HomePage] Installation progress: ${task.progress}%`);
                    }
                }
            });

            // Wait for task to complete
            const result = await taskManager.waitForTask(taskId, 120000); // 2 min timeout

            // Cleanup listener
            unlisten();

            if (result.status === 'completed') {
                await emit("status-bar-percent", 0);
                message.success(t("Installation Finish"));
            } else if (result.status === 'failed') {
                await emit("status-bar-percent", 0);
                message.error(`${t("Installation Failed")}: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('[HomePage] Installation failed:', error);
            await emit("status-bar-percent", 0);
            message.error(t("Installation Failed"));
        }
    }

    @autoBind
    private async onMenuBarUpdateClick() {
        await ModUpdateApi.checkModUpdate();
        await ModUpdateApi.checkModList();
        message.success(t("Update Finish"));
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
        }).show();
    }

    @autoBind
    private async onSelectChange(value: string) {
        await IoC.get(TreeViewModel);
        const profileVM = await IoC.get(ProfileViewModel);

        await profileVM.setActiveProfile(value);
        TreeViewModel.updateTreeView();
        this.setState({
            defaultProfile: value as string,
        })
        await ModUpdateApi.checkModUpdate();
        await ModUpdateApi.checkModList();

        await emit("tree-view-count-label-update");
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
    }

    @autoBind
    private async updateTreeView() {
        console.log(`[HomePage] updateTreeView() called`);
        await IoC.get(TreeViewModel);
        const profileVM = await IoC.get(ProfileViewModel);
        const modsApi = await StorageAPI.getMods();
        const profilesApi = await StorageAPI.getProfiles();

        // Get all mods with complete data (version, download, status)
        const basicMods = await modsApi.getAllMods();
        const modIds = basicMods.map(m => m.modId!);
        const allMods = await modsApi.getBatchCompleteModData(modIds);

        const activeRoot = await profileVM.getActiveProfileTreeRoot();
        const activeProfileName = await profileVM.getActiveProfileName();
        const activeProfile = await profilesApi.getActiveProfile();

        console.log(`[HomePage] Got ${allMods.length} mods from database`);
        console.log(`[HomePage] Converting profile tree, active profile: ${activeProfileName}`);
        console.log(`[HomePage] ActiveProfile root children:`, activeRoot.children.map(c => ({ id: c.id, name: c.name, type: c.type })));

        // Get profile-specific mod data (enabled status, used version)
        const profileMods = activeProfile ? await profilesApi.getProfileMods(activeProfile.id!) : [];

        // TreeViewConverter now accepts CompleteModData[] and ProfileModData[]
        const converter = new TreeViewConverter(allMods, profileMods);
        const treeData = converter.convertToFromRoot(activeRoot);

        console.log(`[HomePage] Converted treeData:`, treeData);

        this.setState({
            treeData: converter.treeData,
        }, () => {
            console.log(`[HomePage] treeData state updated, count=${converter.treeData?.length || 0}`);
        });

        if (this.state.expandedKeys.length === 0) {
            this.setState({
                expandedKeys: converter.expandedKeys,
            });
            console.log(`[HomePage] Set expandedKeys:`, converter.expandedKeys);
        }

        console.log(`[HomePage] updateTreeView() completed`);
    }

    @autoBind
    private async onMenuClick(key: string, nodeKey: string) {
        const vm = await IoC.get(HomeViewModel);

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
        console.log(`[HomePage] Menu click: key=${key}, nodeKey=${nodeKey}, extractedId=${id}`);

        switch (key) {
            case "add_new_group": {
                this.inputDialogRef.current?.setCallback(
                    t("Add New Group"),
                    t("New Group"),
                    async (text) => {
                        await vm.addGroup(0, text);
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
                    }).show();
                break;
            case "delete_group":
                console.log(`[HomePage] Starting delete group operation for id=${id}`);
                try {
                    await vm.removeGroup(id);
                    console.log(`[HomePage] Delete group completed for id=${id}`);
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
                    }).show();
                break;
            case "update": {
                const mod = await this.getModById(id);
                if (mod) {
                    await ModUpdateApi.updateMod(mod);
                }
            }
                break;
            case "add_mod": {
                switch (id) {
                    case ProfileTreeGroupType.LOCAL:
                        await openWindow(AddModType.LOCAL, id);
                        break;
                    case ProfileTreeGroupType.MODIO:
                        await openWindow(AddModType.MODIO, id);
                        break;
                    default:
                        await openWindow(AddModType.MODIO, id);
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
                    }).show();
                break;
            case "delete":
                await vm.removeMod(id);
                break;
            case "copy_link":
                try {
                    const mod = await this.getModById(id);
                    if (mod?.url) {
                        console.log(`[HomePage] Copying link for mod ${mod.displayName}: ${mod.url}`);
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
                break;
            case "export": {
                try {
                    const mod = await this.getModById(id);
                    if (!mod) {
                        message.error(t("Mod Not Found"));
                        break;
                    }

                    const cachePath = mod.download?.cachePath || "";
                    const downloadStatus = mod.download?.downloadStatus || "pending";

                    // Check if mod has been downloaded
                    if (!cachePath || downloadStatus !== "completed") {
                        if (downloadStatus === "downloading") {
                            message.warning(t("Mod is downloading, please wait"));
                        } else if (downloadStatus === "failed") {
                            message.error(t("Mod download failed, please click update to download mod try again"));
                        } else {
                            message.warning(t("Please click update to download mod"));
                        }
                        break;
                    }

                    // Check if the file actually exists
                    const fileExists = await exists(cachePath);
                    if (!fileExists) {
                        message.error(t("File Not Found") + `: ${cachePath}`);
                        break;
                    }

                    const path = await save({
                        filters: [{
                            name: mod.displayName,
                            extensions: ['zip', 'pak'],
                        }]
                    });

                    // User cancelled the save dialog
                    if (!path) {
                        break;
                    }

                    await copyFile(cachePath, path);
                    message.success(t("Export Success"));
                } catch (e) {
                    console.error(`[HomePage] Export failed for id=${id}:`, e);
                    message.error(t("Export Failed") + `: ${e}`);
                }
            }
                break;
            default:
                break;
        }
    }

    async componentDidMount(): Promise<void> {
        // Wait for core to be ready
        if (!AppInitializer.isCoreReady()) {
            console.warn('[HomePage] Core not ready, waiting...');
            await AppInitializer.initializeCore();
        }

        // Pre-initialize UI ViewModels (optional but recommended for better UX)
        console.log('[HomePage] Initializing UI ViewModels...');
        await IoC.get(TreeViewModel);
        await IoC.get(HomeViewModel);
        console.log('[HomePage] UI ViewModels initialized');

        // Setup window resize hook
        this.hookWindowResized();

        // Setup event listeners
        listen<boolean>("home-page-loading", async (event) => {
            this.setState({
                loading: event.payload,
            });
        }).then();

        listen("home-page-update-tree-view", async () => {
            await this.updateTreeView();
        }).then();

        listen("home-page-update-profile-select", async () => {
            await this.updateProfileSelect();
        }).then();

        // Initial UI update
        this.updateProfileSelect().then();
        this.updateTreeView().then();

        // Check for mod updates
        ModUpdateApi.checkModList().then();
    }

    render() {
        return (
            <div className="mod-list-page-card">
                <ProfileEditDialog ref={this.profileEditDialogRef}/>
                <InputDialog ref={this.inputDialogRef}/>
                <Spin spinning={this.state.loading}
                      delay={500}
                      size={"large"}
                      indicator={<></>}
                      tip={
                          <Flex gap={"large"}
                                vertical={false}
                                style={{
                                    fontSize: "large",
                                    marginLeft: "41%",
                                    lineHeight: "34px",
                                }}
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
                               style={{
                                   borderBottom: "1px solid #eee",
                                   paddingBottom: "2px",
                                   minWidth: "1000px",
                               }}>
                            <Typography.Link>
                                <Tooltip title={t("Save Changes")}>
                                    <Button icon={<SaveOutlined/>} type={"text"}
                                            onClick={this.onMenuBarSaveChangesClick}/>
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
                                    style={{width: "300px"}}
                                    value={this.state.defaultProfile}
                                    options={this.state.profileOptions}
                                    onChange={this.onSelectChange}
                                />
                                <Tooltip title={t("Edit Profile")}>
                                    <Button icon={<EditOutlined/>} type={"text"} onClick={this.onEditProfileClick}/>
                                </Tooltip>
                            </Typography.Link>
                            <Typography.Link>
                                <SearchBox/>
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
                                onTreeNodeSelect={this.onTreeNodeSelect}
                                onTreeNodeExpand={this.onTreeNodeExpand}
                                onTreeRightClick={this.onTreeRightClick}
                                onVirtualStateChange={(virtual) => {
                                    this.setState({ virtual });
                                }}
                            />
                        </div>
                        <Flex style={{
                            borderTop: "1px solid #eee",
                            padding: "2px 10px 0 10px",
                            width: "100%",
                            justifyContent: "space-between",
                        }}>
                            <Checkbox onChange={this.onMultiCheckboxChange}
                            />
                            {
                                this.state.isMultiSelect === true &&
                                <span style={{marginRight: 'auto'}}>
                                <Button type="text" size={"small"}
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
                            </span>
                            }
                            <CountLabel/>
                        </Flex>
                    </Flex>
                </Spin>
            </div>
        )
    }
}
