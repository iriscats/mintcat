import React from "react";
import {
    Button,
    Card,
    Checkbox,
    Dropdown,
    Flex,
    MenuProps,
    message,
    Select,
    SelectProps,
    Switch,
    Tag,
    Tree,
    TreeDataNode,
    TreeProps,
} from 'antd';
import {
    ArrowUpOutlined,
    CloseCircleOutlined,
    EditOutlined,
    FolderOutlined,
    PlayCircleOutlined,
    PlusCircleOutlined,
    SearchOutlined
} from "@ant-design/icons";
import AddModDialog from "../dialogs/AddModDialog.tsx";
import ProfileEditDialog from "../dialogs/ProfileEditDialog.tsx";
import {CheckboxChangeEvent} from "antd/es/checkbox";
import InputDialog from "../dialogs/InputDialog.tsx";
import {ModListPageContext} from "../AppContext.ts"
import {ProfileTreeType} from "../vm/config/ProfileList.ts";
import {TreeViewConverter} from "../vm/converter/TreeViewConverter.ts";
import {dragAndDrop} from "../components/DragAndDropTree.ts";

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

    private contextMenus: MenuProps['items'] = [
        {label: 'Add Group', key: 'add_group'},
        {label: 'Rename', key: 'rename'},
        {label: 'Delete', key: 'delete'}
    ];

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
        this.onLaunchGameClick = this.onLaunchGameClick.bind(this);
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
    }

    private async onUpdateClick() {
        await message.info("Updating...");
    }

    private onEditProfileClick() {
        this.profileEditDialogRef.current?.show();
    }

    private async onLaunchGameClick() {
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
        if (e.key === "add_group") {
            this.inputDialogRef.current.setCallback(
                "Add Group",
                "New Group",
                async (text) => {
                    await this.context.addCategory(text);
                    await this.updateModListTree();
                });
            this.inputDialogRef.current?.show();
        } else if (e.key === "rename") {
            this.inputDialogRef.current.setCallback(
                "Rename Mod",
                this.context.ModList.get(this.state.selectedKeys[0])?.displayName,
                async (text) => {
                    const key = this.state.selectedKeys[0];
                    await this.context.setDisplayName(key, text);
                    await this.updateModListTree();
                });
            this.inputDialogRef.current?.show();
        } else if (e.key === "delete") {
            for (const item of this.state.selectedKeys!) {
                await this.context.removeMod(item);
                await this.updateModListTree();
            }
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
        if (nodeData.isLeaf) {
            return (
                <span style={{width: "100%", display: "block"}}>
                    <Switch checked={nodeData.enabled} size={"small"}
                            onChange={(checked) => this.onSwitchChange(checked, nodeData)}
                            style={{marginRight: "8px", marginTop: "-3px"}}
                    />

                    {nodeData.isLocal === false &&
                        <Select size={"small"} style={{marginRight: "8px", minWidth: "78px"}}
                                value={nodeData.fileVersion}>
                            <Select.Option value={nodeData.fileVersion}>{nodeData.fileVersion}</Select.Option>
                        </Select>}

                    <a>{nodeData.title}</a>

                    {nodeData.approval === "Verified" ? (<Tag color="blue" style={{float: "right"}}>V</Tag>) :
                        nodeData.approval === "Approved" ? (<Tag color="green" style={{float: "right"}}>A</Tag>) :
                            nodeData.approval === "Sandbox" ? (<Tag color="orange" style={{float: "right"}}>S</Tag>) :
                                (<></>)}

                    {nodeData.versions.length > 0 && nodeData.versions[0] !== "1.39" && (
                        <Tag color="red" style={{float: "right"}}>{nodeData.versions[0]}</Tag>)}

                    {nodeData.required === "RequiredByAll" && (
                        <Tag color="orange" style={{float: "right"}}>RequiredByAll</Tag>)}

                    {nodeData.tags.map(tag => (<Tag style={{float: "right"}}>{tag}</Tag>))}
                </span>
            );
        } else {
            return (
                <span style={{width: "100%", display: "block"}}>
                   <FolderOutlined/> {nodeData.title}
                </span>
            );
        }
    }


    componentDidMount(): void {
        this.updateProfileSelect().then(() => {
        });
        this.updateModListTree().then(() => {
        });
        this.context.updateModList().then(() => {
            this.updateModListTree().then(() => {
                this.forceUpdate();
            });
        })
    }

    render() {
        return (
            <>
                <AddModDialog ref={this.addModDialogRef}/>
                <ProfileEditDialog ref={this.profileEditDialogRef}/>
                <InputDialog ref={this.inputDialogRef}/>
                <div style={{marginTop: "5px"}}>
                    <Button type="text" onClick={this.onLaunchGameClick}>
                        <PlayCircleOutlined/>
                        Launch Game
                    </Button>
                </div>
                <Card className="mod-list-page-card" size={"small"}>
                    <Flex>
                        <Button type="text" size={"small"} onClick={this.onAddModClick}>
                            <PlusCircleOutlined/>
                        </Button>
                        <Button type="text" size={"small"} onClick={this.onUpdateClick}>
                            <ArrowUpOutlined/>
                        </Button>
                        <Select
                            size={"small"}
                            style={{width: "50%"}}
                            value={this.state.defaultProfile}
                            options={this.state.options}
                            onChange={this.onSelectChange}
                        />
                        <Button type="text" size={"small"} onClick={this.onEditProfileClick}>
                            <EditOutlined/>
                        </Button>
                        <Select size={"small"}
                                showSearch
                                style={{width: "50%"}}
                                suffixIcon={<SearchOutlined/>}
                                options={this.filterOptions}
                        />
                    </Flex>
                    <Dropdown trigger={['contextMenu']}
                              menu={{
                                  items: this.contextMenus,
                                  onClick: this.onMenuClick
                              }}>
                        <Tree className="ant-tree-content"
                              height={400}
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
                    </Dropdown>
                    <Flex style={{borderTop: "1px solid #eee"}}>
                        <span style={{margin: "4px 10px 0 10px"}}>
                            <Checkbox onChange={this.onMultiCheckboxChange}
                            />
                            {
                                this.state.isMultiSelect === true &&
                                <span>
                                    <Button type="text" size={"small"}>
                                        <CloseCircleOutlined/>
                                        Delete Selected
                                    </Button>
                                    <Button type="text" size={"small"}>
                                        <CloseCircleOutlined/>
                                        Update Selected
                                    </Button>
                                </span>
                            }
                        </span>
                    </Flex>
                </Card>
            </>
        )
    }

}


export default ModListPage;