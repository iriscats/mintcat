import React from "react";
import {
    Button, Checkbox, Divider,
    Flex, MenuProps, message, Select, SelectProps, Space, Tooltip, Tree, TreeProps, Typography,
} from 'antd';
import {
    CloseCircleOutlined,
    EditOutlined,
    PlusCircleOutlined,
    SearchOutlined, SortAscendingOutlined, SortDescendingOutlined,
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

interface ModListPageState {
    options?: SelectProps['options'];
    treeData?: TreeProps['treeData'];
    contextMenus?: MenuProps['items'];
    isMultiSelect?: boolean;
    expandedKeys?: any[];
    selectedKeys?: any[];
    defaultProfile?: string;
}

class ModListPage extends React.Component<any, ModListPageState> {

    declare context: React.ContextType<typeof ModListPageContext>;
    static contextType = ModListPageContext;

    private readonly addModDialogRef: React.RefObject<AddModDialog> = React.createRef();

    private readonly profileEditDialogRef: React.RefObject<ProfileEditDialog> = React.createRef();

    private readonly inputDialogRef: React.RefObject<InputDialog> = React.createRef();

    private filterOptions: SelectProps['options'] = [
        {value: 'Verified', label: 'Verified'},
        {value: 'Approved', label: 'Approved'},
        {value: 'Sandbox', label: 'Sandbox'},
        {value: 'RequiredByAll', label: 'RequiredByAll'},
        {value: 'Optional', label: 'Optional'}
    ]

    public constructor(props: any, context: ModListPageState) {
        super(props, context);

        this.state = {
            options: [],
            contextMenus: [],
            defaultProfile: "",
        }

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
    }

    private onAddModClick() {
        this.addModDialogRef.current?.setValue()
            .setCallback(async () => {
                await this.updateTreeData();
            }).show();
    }

    private async onUpdateClick() {
        await message.info("Updating...");
    }

    private onEditProfileClick() {
        this.profileEditDialogRef.current?.show();
    }

    private onMultiCheckboxChange(e: CheckboxChangeEvent) {
        this.setState({
            isMultiSelect: e.target.checked
        })
    }

    private onDrop(info: any) {
        this.setState({
            treeData: dragAndDrop(info, this.state.treeData),
        })
        //TODO：treeData to vm
    }

    private async onSelectChange(value: string) {
        console.log(`Selected: ${value}`);
        this.context.ActiveProfile = value;
        await this.updateTreeData();
        this.setState({
            defaultProfile: value as string,
        })
    };

    private async onSwitchChange(checked: boolean, node: any) {
        console.log(`Switch: ${checked}`, node);
        await this.context.setModEnabled(node.id, checked);
        await this.updateTreeData();
    }

    private onTreeNodeSelect(keys, info) {
        console.log(keys, info);
    }

    private onTreeNodeExpand(keys, info) {
        this.setState({
            expandedKeys: keys,
        })
    };

    private onTreeRightClick(info) {
        this.setState({
            selectedKeys: [info.node.id],
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

    private async updateTreeData() {
        const converter = new TreeViewConverter(this.context.ModList);
        converter.convertTo(this.context.ActiveProfile);
        this.setState({
            treeData: converter.treeData,
            expandedKeys: converter.expandedKeys,
        })
    }

    private onCustomTitleRender(nodeData: any) {
        return TreeViewItem(nodeData, this.onMenuClick);
    }

    private async onMenuClick(key: string, id: number) {
        switch (key) {
            case "add_new_group": {
                this.inputDialogRef.current?.setCallback(
                    "Add New Group",
                    "New Group",
                    async (text) => {
                        await this.context.addGroup(0, text);
                        await this.updateTreeData();
                    })
                    .show();
            }
                break;
            case "add_sub_group":
                this.inputDialogRef.current?.setCallback(
                    "Add Sub Group",
                    "New Group",
                    async (text) => {
                        await this.context.addGroup(id, text);
                        await this.updateTreeData();
                    }).show();
                break;
            case "delete_group":
                await this.context.removeGroup(id);
                await this.updateTreeData();
                break;
            case "rename_group":
                const groupName = this.context.ActiveProfile.groupNameMap.get(id);
                this.inputDialogRef.current?.setCallback(
                    "Rename Group",
                    groupName,
                    async (text) => {
                        await this.context.setGroupName(id, text);
                        await this.updateTreeData();
                    }).show();
                break;
            case "add_mod": {
                this.addModDialogRef.current?.setValue(id).setCallback(
                    async () => {
                        await this.updateTreeData();
                    }).show();
            }
                break;
            case "rename":
                const modName = this.context.ModList.get(id)?.displayName;
                this.inputDialogRef.current.setCallback(
                    "Rename Mod",
                    modName,
                    async (text) => {
                        await this.context.setDisplayName(id, text);
                        await this.updateTreeData();
                    }).show();
                break;
            case "delete":
                await this.context.removeMod(id);
                await this.updateTreeData();
                break;
            case "copy_link":
                try {
                    const mod = this.context.ModList.get(id);
                    if (mod?.url) {
                        await navigator.clipboard.writeText(mod.url);
                        message.success(`已复制到剪贴板: ${mod.url} `);
                    }
                } catch (err) {
                    message.error('复制失败');
                }
                break;
            case "export":
                break;
            default:
                break;
        }
    }

    componentDidMount(): void {
        this.updateProfileSelect().then(() => {
        });
        this.updateTreeData().then(() => {
        });

        this.context.updateModList(() => {
            this.updateTreeData().then(() => {
            });
        }).then(() => {
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
                            <Tooltip title="Add Mod">
                                <Button icon={<PlusCircleOutlined/>} type={"text"} onClick={this.onAddModClick}/>
                            </Tooltip>
                            <Tooltip title="Update All Mods">
                                <Button icon={<SyncOutlined/>} type={"text"} onClick={this.onUpdateClick}/>
                            </Tooltip>
                        </Typography.Link>
                        <Typography.Link>
                            <Tooltip title="List View">
                                <Button icon={<UnorderedListOutlined/>} type={"text"}/>
                            </Tooltip>
                            <Tooltip title="Group View">
                                <Button icon={<TreeViewOutlined/>} type={"text"}/>
                            </Tooltip>
                        </Typography.Link>
                        <Typography.Link>
                            <Tooltip title="Sort Ascending">
                                <Button icon={<SortAscendingOutlined/>} type={"text"}/>
                            </Tooltip>
                            <Tooltip title="Sort Descending">
                                <Button icon={<SortDescendingOutlined/>} type={"text"}/>
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
                            <Tooltip title="Comment">
                                <Button icon={<EditOutlined/>} type={"text"} onClick={this.onEditProfileClick}/>
                            </Tooltip>
                        </Typography.Link>
                        <Typography.Link>
                            <Select size={"small"}
                                    showSearch
                                    style={{width: "300px"}}
                                    suffixIcon={<SearchOutlined/>}
                                    options={this.filterOptions}
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
                          onSelect={this.onTreeNodeSelect}
                          onRightClick={this.onTreeRightClick}
                          onExpand={this.onTreeNodeExpand}
                          onDrop={this.onDrop}
                          titleRender={this.onCustomTitleRender}
                    />
                    <Flex style={{borderTop: "1px solid #eee"}}>
                        <span style={{margin: "2px 10px 0 10px"}}>
                            <Checkbox onChange={this.onMultiCheckboxChange}
                            />
                            {
                                this.state.isMultiSelect === true &&
                                <span>
                                    <Button type="text" size={"small"} icon={<CloseCircleOutlined/>}>
                                        Delete
                                    </Button>
                                    <Button type="text" size={"small"} icon={<SyncOutlined/>}>
                                        Update
                                    </Button>
                                </span>
                            }
                        </span>
                    </Flex>
                </Flex>
            </div>
        )
    }

}


export default ModListPage;