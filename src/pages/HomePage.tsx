import React from "react";
import {t} from "i18next";
import {save} from "@tauri-apps/plugin-dialog";
import {copyFile} from "@tauri-apps/plugin-fs";
import {
    Button,
    Checkbox,
    Divider,
    Flex,
    MenuProps,
    message,
    Select,
    SelectProps,
    Space,
    Tooltip,
    Tree,
    TreeProps,
    Typography,
} from 'antd';
import {
    CloseCircleOutlined,
    EditOutlined,
    PauseCircleOutlined, PlayCircleOutlined,
    PlusCircleOutlined,
    SaveOutlined,
    SearchOutlined,
    SortAscendingOutlined,
    SortDescendingOutlined,
    SyncOutlined,
    UnorderedListOutlined
} from "@ant-design/icons";
import AddModDialog from "../dialogs/AddModDialog.tsx";
import ProfileEditDialog from "../dialogs/ProfileEditDialog.tsx";
import {CheckboxChangeEvent} from "antd/es/checkbox";
import InputDialog from "../dialogs/InputDialog.tsx";
import {ModListPageContext} from "../AppContext.ts"
import {TreeViewConverter} from "../vm/converter/TreeViewConverter.ts";
import {dragAndDrop} from "../components/DragAndDropTree.ts";
import {TreeViewOutlined} from "../components/SvgIcon.tsx";
import {TreeViewItem} from "../components/TreeViewItem.tsx";
import {AppViewModel} from "../vm/AppViewModel.ts";
import {MessageBox} from "../components/MessageBox.ts";
import {BasePage} from "./IBasePage.ts";

interface ModListPageState {
    options?: SelectProps['options'];
    treeData?: TreeProps['treeData'];
    contextMenus?: MenuProps['items'];
    isMultiSelect?: boolean;
    expandedKeys?: any[];
    selectedKeys?: any[];
    defaultProfile?: string;
    displayMode?: string;
}

class HomePage extends BasePage<any, ModListPageState> {

    declare context: React.ContextType<typeof ModListPageContext>;
    static contextType = ModListPageContext;

    private readonly addModDialogRef: React.RefObject<AddModDialog> = React.createRef();

    private readonly profileEditDialogRef: React.RefObject<ProfileEditDialog> = React.createRef();

    private readonly inputDialogRef: React.RefObject<InputDialog> = React.createRef();

    private filterList: string[] = [];

    private filterOptions: SelectProps['options'] = [
        {value: 'All', label: 'All'},
        {value: 'Verified', label: 'Verified'},
        {value: 'Approved', label: 'Approved'},
        {value: 'Sandbox', label: 'Sandbox'},
        {value: 'RequiredByAll', label: 'RequiredByAll'},
        {value: 'Optional', label: 'Optional'},
        {value: 'Audio', label: 'Audio'},
        {value: 'Framework', label: 'Framework'},
        {value: 'Tools', label: 'Tools'},
        {value: 'QoL', label: 'QoL'},
        {value: 'Visual', label: 'Visual'},
    ]

    public constructor(props: any, state: ModListPageState) {
        super(props, state);

        this.state = {
            options: [],
            contextMenus: [],
            expandedKeys: [],
            selectedKeys: [],
            defaultProfile: "",
        }

        this.context.setUpdateViewCallback(
            async () => await this.updateTreeView(),
            async () => await this.updateProfileSelect()
        );

        this.onAddModClick = this.onAddModClick.bind(this);
        this.onEditProfileClick = this.onEditProfileClick.bind(this);
        this.onUpdateClick = this.onUpdateClick.bind(this);
        this.onSelectChange = this.onSelectChange.bind(this);
        this.onTreeNodeSelect = this.onTreeNodeSelect.bind(this);
        this.onTreeNodeExpand = this.onTreeNodeExpand.bind(this);
        this.onTreeRightClick = this.onTreeRightClick.bind(this);
        this.onMultiCheckboxChange = this.onMultiCheckboxChange.bind(this);
        this.onMenuClick = this.onMenuClick.bind(this);
        this.onDrop = this.onDrop.bind(this);
        this.onSwitchChange = this.onSwitchChange.bind(this);
        this.onCustomTitleRender = this.onCustomTitleRender.bind(this);
        this.onSaveChangesClick = this.onSaveChangesClick.bind(this);
        this.onMultiDeleteClick = this.onMultiDeleteClick.bind(this);
        this.onMultiEnableClick = this.onMultiEnableClick.bind(this);
        this.onMultiUpdateClick = this.onMultiUpdateClick.bind(this);
        this.onSearchSelectChange = this.onSearchSelectChange.bind(this);

        this.updateProfileSelect = this.updateProfileSelect.bind(this);
        this.updateTreeView = this.updateTreeView.bind(this);
    }

    private async onMultiDeleteClick() {
        const confirm = await MessageBox.confirm({
            title: t("Delete Mods"),
            content: t("Are you sure you want to delete the selected mods?"),
        });
        if (confirm) {
            for (const key of this.state.selectedKeys) {
                const modItem = this.context.ModList.get(key);
                if (modItem) {
                    await this.context.removeMod(key);
                }
            }
            await this.updateTreeView();
        }
    }

    private async onMultiEnableClick(isEnable: boolean) {
        for (const key of this.state.selectedKeys) {
            const modItem = this.context.ModList.get(key);
            if (modItem) {
                await this.context.setModEnabled(key, isEnable)
            }
        }
        await this.updateTreeView();
    }

    private async onMultiUpdateClick() {
        for (const key of this.state.selectedKeys) {
            const modItem = this.context.ModList.get(key);
            if (modItem) {
                await this.context.updateMod(modItem)
            }
        }
        await this.updateTreeView();
    }

    private async onSearchSelectChange(value: any) {
        this.filterList = [value];
        await this.updateTreeView();
    }

    private async onAddModClick() {
        this.addModDialogRef.current?.setValue().show();
    }

    private async onSaveChangesClick() {
        const vm = await AppViewModel.getInstance();
        await vm.installMods();
    }

    private async onUpdateClick() {
        await this.context.updateModList(true);
    }

    private onEditProfileClick() {
        this.profileEditDialogRef
            .current?.setCallback(async () => {
            await this.updateProfileSelect();
        }).show();
    }

    private onMultiCheckboxChange(e: CheckboxChangeEvent) {
        this.setState({
            isMultiSelect: e.target.checked
        })
    }

    private async onSortClick(order: string) {
        await this.context.sortMods(order);
        await this.updateTreeView();
    }

    private async onDrop(info: any) {
        const newTreeData = dragAndDrop(info, this.state.treeData);
        this.setState({
            treeData: newTreeData,
        })
        const converter = new TreeViewConverter(this.context.ModList, this.filterList);
        await this.context.setProfileData(converter.convertFrom(newTreeData));
    }

    private async onSelectChange(value: string) {
        this.context.ActiveProfile = value;
        this.setState({
            defaultProfile: value as string,
        })
    };

    private async onSwitchChange(checked: boolean, node: any) {
        await this.context.setModEnabled(node.key, checked);
    }

    private onTreeNodeSelect(keys) {
        this.setState({
            selectedKeys: keys,
        })
    }

    private onTreeNodeExpand(keys) {
        this.setState({
            expandedKeys: keys,
        })
    };

    private onTreeRightClick(info) {
        this.setState({
            selectedKeys: [info.node.key],
        })
    };

    private async updateProfileSelect() {
        let options: SelectProps['options'] = [];
        for (const profileKey of this.context.ProfileList) {
            options.push({
                value: profileKey,
                label: profileKey,
            });
        }
        this.setState({
            options,
            defaultProfile: this.context.ActiveProfileName,
        })
    }

    private async updateTreeView() {
        const converter = new TreeViewConverter(this.context.ModList, this.filterList);
        converter.convertTo(this.context.ActiveProfile);

        this.setState({
            treeData: converter.treeData,
        });

        if (this.state.expandedKeys.length === 0) {
            this.setState({
                expandedKeys: converter.expandedKeys,
            });
        }
    }

    private onCustomTitleRender(nodeData: any) {
        return TreeViewItem(nodeData, this.onMenuClick, this.onSwitchChange);
    }

    private async onMenuClick(key: string, id: number) {
        switch (key) {
            case "add_new_group": {
                this.inputDialogRef.current?.setCallback(
                    t("Add New Group"),
                    t("New Group"),
                    async (text) => {
                        await this.context.addGroup(0, text);
                    })
                    .show();
            }
                break;
            case "add_sub_group":
                this.inputDialogRef.current?.setCallback(
                    t("Add Sub Group"),
                    t("New Group"),
                    async (text) => {
                        await this.context.addGroup(id, text);
                    }).show();
                break;
            case "delete_group":
                await this.context.removeGroup(id);
                await this.updateTreeView();
                break;
            case "rename_group":
                const groupName = this.context.ActiveProfile.groupNameMap.get(id);
                this.inputDialogRef.current?.setCallback(
                    t("Rename Group"),
                    groupName,
                    async (text) => {
                        await this.context.setGroupName(id, text);
                    }).show();
                break;
            case "update": {
                const mod = this.context.ModList.get(id);
                if (mod) {
                    await this.context.updateMod(mod);
                }
            }
                break;
            case "add_mod":
                this.addModDialogRef.current?.setValue(id).show();
                break;
            case "rename":
                const modName = this.context.ModList.get(id)?.displayName;
                this.inputDialogRef.current.setCallback(
                    "Rename Mod",
                    modName,
                    async (text) => {
                        await this.context.setDisplayName(id, text);
                    }).show();
                break;
            case "delete":
                await this.context.removeMod(id);
                break;
            case "copy_link":
                try {
                    const mod = this.context.ModList.get(id);
                    if (mod?.url) {
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
                    const mod = this.context.ModList.get(id);
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

    private renderCountLabel() {
        if (!this.context.ActiveProfile) {
            return "";
        }
        const subModList = this.context.ActiveProfile.getModList(this.context.ModList);
        const enableCount = subModList.Mods.filter((value) => value.enabled).length;
        return `${enableCount} / ${subModList.Mods.length}`;
    }

    componentDidMount(): void {
        this.hookWindowResized();
        this.updateProfileSelect().then(() => {
        });
        this.updateTreeView().then(() => {
        });
        this.context.updateModList().then(() => {
        })
    }

    render() {
        return (
            <div className="mod-list-page-card">
                <AddModDialog ref={this.addModDialogRef}/>
                <ProfileEditDialog ref={this.profileEditDialogRef}/>
                <InputDialog ref={this.inputDialogRef}/>
                <Flex vertical={true}>
                    <Space split={<Divider type="vertical"/>} size={2}
                           style={{borderBottom: "1px solid #eee", paddingBottom: "2px"}}>
                        <Typography.Link>
                            <Tooltip title={t("Save Changes")}>
                                <Button icon={<SaveOutlined/>} type={"text"} onClick={this.onSaveChangesClick}/>
                            </Tooltip>
                            <Tooltip title={t("Add Mod")}>
                                <Button icon={<PlusCircleOutlined/>} type={"text"} onClick={this.onAddModClick}/>
                            </Tooltip>
                            <Tooltip title={t("Update All Mods")}>
                                <Button icon={<SyncOutlined/>} type={"text"} onClick={this.onUpdateClick}/>
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
                                        onClick={() => this.onSortClick("asc")}
                                />
                            </Tooltip>
                            <Tooltip title={t("Sort Descending")}>
                                <Button icon={<SortDescendingOutlined/>}
                                        type={"text"}
                                        onClick={() => this.onSortClick("dasc")}
                                />
                            </Tooltip>
                        </Typography.Link>
                        <Typography.Link>
                            <Select
                                size={"small"}
                                style={{width: "300px"}}
                                value={this.state.defaultProfile}
                                options={this.state.options}
                                onChange={this.onSelectChange}
                            />
                            <Tooltip title={t("Edit Profile")}>
                                <Button icon={<EditOutlined/>} type={"text"} onClick={this.onEditProfileClick}/>
                            </Tooltip>
                        </Typography.Link>
                        <Typography.Link>
                            <Select size={"small"}
                                    style={{width: "300px"}}
                                    suffixIcon={<SearchOutlined/>}
                                    options={this.filterOptions}
                                    onChange={this.onSearchSelectChange}
                            />
                        </Typography.Link>
                    </Space>
                    <Tree className="ant-tree-content"
                          style={{minHeight: window.innerHeight - 155}}
                          height={window.innerHeight - 155}
                          draggable
                          blockNode
                          checkable={this.state.isMultiSelect}
                          expandedKeys={this.state.expandedKeys}
                          selectedKeys={this.state.selectedKeys}
                          treeData={this.state.treeData}
                          onCheck={this.onTreeNodeSelect}
                          onSelect={this.onTreeNodeSelect}
                          onRightClick={this.onTreeRightClick}
                          onExpand={this.onTreeNodeExpand}
                          onDrop={this.onDrop}
                          titleRender={this.onCustomTitleRender}
                    />
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
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: '#888',
                            marginRight: '20px',
                        }}>
                          {this.renderCountLabel()}
                        </span>
                    </Flex>
                </Flex>
            </div>
        )
    }

}


export default HomePage;