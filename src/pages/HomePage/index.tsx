import React from "react";
import {t} from "i18next";
import {save} from "@tauri-apps/plugin-dialog";
import {copyFile} from "@tauri-apps/plugin-fs";
import {
    Button, Checkbox, Divider,
    Flex, MenuProps, message, Select,
    SelectProps, Space, Spin, Tooltip, Tree, TreeDataNode, TreeProps, Typography,
} from 'antd';
import {
    CloseCircleOutlined, CopyOutlined,
    EditOutlined, FieldTimeOutlined, PauseCircleOutlined, PlayCircleOutlined,
    PlusCircleOutlined, SaveOutlined,
    SearchOutlined, SortAscendingOutlined,
    SortDescendingOutlined, SyncOutlined,
    UnorderedListOutlined
} from "@ant-design/icons";
import * as checkbox from "antd/es/checkbox";

import {openWindow} from "@/dialogs/AddModDialog/open";
import ProfileEditDialog from "@/dialogs/ProfileEditDialog.tsx";
import {InputDialog} from "@/dialogs/InputDialog.tsx";
import {TreeViewConverter} from "@/vm/converter/TreeViewConverter.ts";
import {TreeViewOutlined} from "@/components/SvgIcon.tsx";
import {MessageBox} from "@/components/MessageBox.ts";
import {ModUpdateApi} from "@/apis/ModUpdateApi.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {ConfigApi} from "@/apis/ConfigApi.ts";
import {ModSourceType} from "@/vm/config/ModList.ts";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import {autoBind} from "@/utils/ReactUtils.ts";
import {HomeViewModel} from "@/vm/HomeViewModel.ts";
import {dragAndDrop} from "./DragAndDropTree.ts";
import {TreeViewItem} from "./TreeViewItem.tsx";
import {CountLabel} from "./CountLabel.tsx";
import {BasePage} from "../IBasePage.ts";
import {listen} from "@tauri-apps/api/event";
import {ProfileTreeGroupType} from "@/vm/config/ProfileList.ts";
import {AddModType} from "@/dialogs/AddModDialog";
import {SearchBox} from "@/pages/HomePage/SearchBox.tsx";


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

    // Multi Operations
    @autoBind
    private onMultiCheckboxChange(e: checkbox.CheckboxChangeEvent) {
        this.setState({
            isMultiSelect: e.target.checked
        })
    }

    @autoBind
    private async onMultiDeleteClick() {
        const vm = await HomeViewModel.getInstance();

        const confirm = await MessageBox.confirm({
            title: t("Delete Mods"),
            content: t("Are you sure you want to delete the selected mods?"),
        });

        if (this.state.selectedKeys.length === 0) {
            return;
        }

        if (confirm) {
            for (const key of this.state.selectedKeys) {
                const modItem = vm.ModList.get(key);
                if (modItem) {
                    await vm.removeMod(modItem.id);
                }
            }
            await ConfigApi.saveProfileDetails(vm.ActiveProfileName, vm.ActiveProfile);
            await this.updateTreeView();
        }
    }

    @autoBind
    private async onMultiEnableClick(isEnable: boolean) {
        const vm = await HomeViewModel.getInstance();
        if (this.state.selectedKeys.length === 0) {
            return;
        }

        for (const key of this.state.selectedKeys) {
            const modItem = vm.ModList.get(key);
            if (modItem) {
                modItem.enabled = isEnable;
            }
        }
        await ConfigApi.saveModListData(vm.ModList.toJson());
        await ConfigApi.saveProfileDetails(vm.ActiveProfileName, vm.ActiveProfile);
        await this.updateTreeView();
    }

    @autoBind
    private async onMultiUpdateClick() {
        const vm = await HomeViewModel.getInstance();

        for (const key of this.state.selectedKeys) {
            const modItem = vm.ModList.get(key);
            if (modItem) {
                await ModUpdateApi.updateMod(modItem)
            }
        }
    }

    // Menu Bar Operations
    @autoBind
    private async onMenuBarCopyListClick() {
        const vm = await HomeViewModel.getInstance();

        const subModList = vm.ActiveProfile.getModList(vm.ModList);
        let list = "";
        for (const mod of subModList.Mods) {
            if (mod.sourceType === ModSourceType.Modio) {
                list += mod.url + "\n";
            }
        }

        ClipboardApi.setLastClipboardText(list);
        await navigator.clipboard.writeText(list);
        message.success(t("Copied To Clipboard"));
    }

    @autoBind
    private async onMenuBarAddModClick() {
        openWindow().then();
    }

    @autoBind
    private async onMenuBarSaveChangesClick() {
        await IntegrateApi.installMods();
    }

    @autoBind
    private async onMenuBarUpdateClick() {
        await ModUpdateApi.checkModUpdate();
        await ModUpdateApi.checkModList();
        message.success(t("Update Finish"));
    }

    @autoBind
    private async onMenuBarSortClick(order: string) {
        const vm = await HomeViewModel.getInstance();
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
    private async onDrop(info: any) {
        const vm = await HomeViewModel.getInstance();
        let treeData: TreeDataNode[];
        const converter = new TreeViewConverter(vm.ModList);
        if (TreeViewConverter.filterList.length > 0) {
            const filterList = TreeViewConverter.filterList;
            TreeViewConverter.filterList = [];
            treeData = converter.convertTo(vm.ActiveProfile);
            TreeViewConverter.filterList = filterList;
        } else {
            treeData = this.state.treeData;
        }
        const dragTreeData = dragAndDrop(info, treeData);
        await vm.setProfileData(converter.convertFrom(dragTreeData)).then();
        await this.updateTreeView();
    }

    @autoBind
    private async onSelectChange(value: string) {
        const vm = await HomeViewModel.getInstance();

        vm.ActiveProfile = value;
        this.setState({
            defaultProfile: value as string,
        })
        await ModUpdateApi.checkModUpdate();
        await ModUpdateApi.checkModList();
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
        const vm = await HomeViewModel.getInstance();

        let options: SelectProps['options'] = [];
        for (const profileKey of vm.ProfileList) {
            options.push({
                value: profileKey,
                label: profileKey,
            });
        }
        this.setState({
            profileOptions: options,
            defaultProfile: vm.ActiveProfileName,
        })
    }

    @autoBind
    private async updateTreeView() {
        const vm = await HomeViewModel.getInstance();
        const converter = new TreeViewConverter(vm.ModList);
        converter.convertTo(vm.ActiveProfile);

        this.setState({
            treeData: converter.treeData,
        });

        if (this.state.expandedKeys.length === 0) {
            this.setState({
                expandedKeys: converter.expandedKeys,
            });
        }
    }

    @autoBind
    private async onMenuClick(key: string, id: number) {
        const vm = await HomeViewModel.getInstance();
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
                await vm.removeGroup(id);
                break;
            case "rename_group":
                const groupName = vm.ActiveProfile.groupNameMap.get(id);
                this.inputDialogRef.current?.setCallback(
                    t("Rename Group"),
                    groupName,
                    async (text) => {
                        await vm.setGroupName(id, text);
                    }).show();
                break;
            case "update": {
                const mod = vm.ModList.get(id);
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
                const modName = vm.ModList.get(id)?.displayName;
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
                    const mod = vm.ModList.get(id);
                    if (mod?.url) {
                        ClipboardApi.setLastClipboardText(mod.url);
                        await navigator.clipboard.writeText(mod.url);
                        message.success(t("Copied To Clipboard") + `: ${mod.url} `);
                    } else {
                        await navigator.clipboard.writeText(mod.cachePath);
                        message.success(t("Copied To Clipboard") + `: ${mod.cachePath} `);
                    }
                } catch (err) {
                    message.error(t("Copy Failed"));
                }
                break;
            case "export": {
                try {
                    const mod = vm.ModList.get(id);
                    const path = await save({
                        filters: [{
                            name: mod.displayName,
                            extensions: ['zip', 'pak'],
                        }]
                    });
                    await copyFile(mod.cachePath, path);
                    message.success(t("Export Success"));
                } catch (e) {
                    message.error(t("Export Failed"));
                }
            }
                break;
            default:
                break;
        }
    }

    @autoBind
    private onCustomTitleRender(nodeData: any) {
        return TreeViewItem(nodeData, this.onMenuClick);
    }

    componentDidMount(): void {
        this.hookWindowResized();

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


        this.updateProfileSelect().then();
        this.updateTreeView().then();

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
                >
                    <Flex vertical={true}>
                        <Space split={<Divider type="vertical"/>} size={2}
                               style={{borderBottom: "1px solid #eee", paddingBottom: "2px"}}>
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
                            <Tree className="ant-tree-content"
                                  draggable
                                  blockNode
                                  virtual={this.state.virtual}
                                  height={window.innerHeight - 155}
                                  checkable={this.state.isMultiSelect}
                                  expandedKeys={this.state.expandedKeys}
                                  selectedKeys={this.state.selectedKeys}
                                  treeData={this.state.treeData}
                                  onCheck={this.onTreeNodeSelect}
                                  onSelect={this.onTreeNodeSelect}
                                  onRightClick={this.onTreeRightClick}
                                  onExpand={this.onTreeNodeExpand}
                                  onDrop={this.onDrop}
                                  onDragStart={() => {
                                      this.setState({
                                          virtual: false,
                                      })
                                  }}
                                  onDragEnd={() => {
                                      this.setState({
                                          virtual: true,
                                      })
                                  }}
                                  titleRender={this.onCustomTitleRender}
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

