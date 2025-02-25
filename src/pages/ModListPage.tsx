import React from "react";
import {
    Button, Checkbox, Divider,
    Dropdown, Flex, MenuProps, message, Select, SelectProps, Space, Switch, Tag, Tooltip, Tree, TreeProps, Typography,
} from 'antd';
import {
    CloseCircleOutlined,
    EditOutlined,
    FolderOutlined,
    PlusCircleOutlined,
    SearchOutlined,
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
        this.addModDialogRef.current?.show();
        console.log("AddModDialog");
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
        await this.context.setActiveProfile(value);
        await this.updateModListTree();
        this.setState({
            defaultProfile: value as string,
        })
    };

    private async onSwitchChange(checked: boolean, node: any) {
        console.log(`Switch: ${checked}`, node);
        await this.context.setModEnabled(node.id, checked);
        await this.updateModListTree();
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

    private async onMenuClick(e) {
        switch (e.key) {
            case "add_mod":
                this.addModDialogRef.current?.show();
                break;
            case "add_sub_group":
                const parentId = this.state.selectedKeys[0];
                this.inputDialogRef.current.setCallback(
                    "Add Sub Group",
                    "New Group",
                    async (text) => {
                        await this.context.addGroup(parentId, text);
                        await this.updateModListTree();
                    });
                this.inputDialogRef.current?.show();
                break;
            case "delete_group":
                for (const item of this.state.selectedKeys!) {
                    await this.context.deleteGroup(item);
                    await this.updateModListTree();
                }
                break;
            case "rename":
                const modName = this.context.ModList.get(this.state.selectedKeys[0])?.displayName;
                this.inputDialogRef.current.setCallback(
                    "Rename Mod",
                    modName,
                    async (text) => {
                        const key = this.state.selectedKeys[0];
                        await this.context.setDisplayName(key, text);
                        await this.updateModListTree();
                    });
                this.inputDialogRef.current?.show();
                break;
            case "rename_group":
                const groupName = this.state.selectedKeys[0];
                this.inputDialogRef.current.setCallback(
                    "Rename Group",
                    groupName,
                    async (text) => {
                        const key = this.state.selectedKeys[0];
                        await this.context.setDisplayName(key, text);
                        await this.updateModListTree();
                    });
                this.inputDialogRef.current?.show();
                break;
            case "delete":
                for (const item of this.state.selectedKeys!) {
                    await this.context.removeMod(item);
                    await this.updateModListTree();
                }
                break;
            case "copy_link":
                break;
            case "export":
                break;
            default:
                break;
        }
    }

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

    private async updateModListTree() {
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


    componentDidMount(): void {
        this.updateProfileSelect().then(() => {
        });
        this.updateModListTree().then(() => {
        });

        this.context.updateModList(() => {
            this.updateModListTree().then(() => {
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
                            <Tooltip title="Comment">
                                <Button icon={<SyncOutlined/>} type={"text"} onClick={this.onUpdateClick}/>
                            </Tooltip>
                        </Typography.Link>
                        <Typography.Link>
                            <Tooltip title="Star">
                                <Button icon={<UnorderedListOutlined/>} type={"text"}/>
                            </Tooltip>
                            <Tooltip title="Star">
                                <Button icon={<TreeViewOutlined/>} type={"text"}/>
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
                        <span style={{margin: "4px 10px 0 10px"}}>
                            <Checkbox onChange={this.onMultiCheckboxChange}
                            />
                            {
                                this.state.isMultiSelect === true &&
                                <span>
                                    <Button type="text" size={"small"}>
                                        <CloseCircleOutlined/>
                                        Delete
                                    </Button>
                                    <Button type="text" size={"small"}>
                                        <CloseCircleOutlined/>
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