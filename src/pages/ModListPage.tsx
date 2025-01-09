import React from "react";
import {
    Button,
    Card,
    Checkbox,
    Flex,
    Dropdown,
    Switch,
    Tag,
    Tree,
    TreeProps,
    Select,
    SelectProps,
    MenuProps,
    message, TreeDataNode,
} from 'antd';
import {
    ArrowUpOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
    EditOutlined, FolderOutlined,
    PlayCircleOutlined,
    PlusCircleOutlined,
    SaveOutlined,
    SearchOutlined
} from "@ant-design/icons";
import AddModDialog from "../dialogs/AddModDialog.tsx";
import ProfileEditDialog from "../dialogs/ProfileEditDialog.tsx";
import ModListViewModel from "../models/ModPageVM.ts";
import {CheckboxChangeEvent} from "antd/es/checkbox";
import InputDialog from "../dialogs/InputDialog.tsx";


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

    private readonly addModDialogRef: React.RefObject<AddModDialog> = React.createRef();

    private readonly profileEditDialogRef: React.RefObject<ProfileEditDialog> = React.createRef();

    private readonly inputDialogRef: React.RefObject<InputDialog> = React.createRef();

    private contextMenus: MenuProps['items'] = [
        {
            label: 'Add Group',
            key: 'add_group',
        },
        {
            label: 'Rename',
            key: 'rename',
        },
        {
            label: 'Delete',
            key: 'delete',
        }
    ];

    private filterOptions: SelectProps['options'] = [
        {value: '1', label: 'Verified'},
        {value: '2', label: 'Approved'},
        {value: '3', label: 'Sandbox'},
        {value: '3', label: 'RequiredByAll'},
        {value: '3', label: 'Optional'}
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

    private onDrop(info) {
        const dropKey = info.node.key;
        const dragKey = info.dragNode.key;
        const dropPos = info.node.pos.split('-');
        const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]); // the drop position relative to the drop node, inside 0, top -1, bottom 1

        const loop = (
            data: TreeDataNode[],
            key: React.Key,
            callback: (node: TreeDataNode, i: number, data: TreeDataNode[]) => void,
        ) => {
            for (let i = 0; i < data.length; i++) {
                if (data[i].key === key) {
                    return callback(data[i], i, data);
                }
                if (data[i].children) {
                    loop(data[i].children!, key, callback);
                }
            }
        };
        const data = [...this.state.treeData!];

        // Find dragObject
        let dragObj: TreeDataNode;
        loop(data, dragKey, (item, index, arr) => {
            arr.splice(index, 1);
            dragObj = item;
        });

        if (!info.dropToGap) {
            // Drop on the content
            loop(data, dropKey, (item) => {
                item.children = item.children || [];
                // where to insert. New item was inserted to the start of the array in this example, but can be anywhere
                item.children.unshift(dragObj);
            });
        } else {
            let ar: TreeDataNode[] = [];
            let i: number;
            loop(data, dropKey, (_item, index, arr) => {
                ar = arr;
                i = index;
            });
            if (dropPosition === -1) {
                // Drop on the top of the drop node
                ar.splice(i!, 0, dragObj!);
            } else {
                // Drop on the bottom of the drop node
                ar.splice(i! + 1, 0, dragObj!);
            }
        }
        this.setState({
            treeData: data,
        })
    }

    private async onSelectChange(value: string) {
        console.log(`Selected: ${value}`);
        const vm = await ModListViewModel.getViewModel();
        vm.activeProfile = value;
        await this.updateModListTree();
        this.setState({
            defaultProfile: value as string,
        })
    };

    private async onSwitchChange(checked: boolean, node: any) {
        console.log(`Switch: ${checked}`, node);
        const vm = await ModListViewModel.getViewModel();
        await vm.setModEnabled(node.id, checked);
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
        console.log("onTreeRightClick", info);
        this.setState({
            selectedKeys: [info.node.id],
        })
    };

    private async onMenuClick(e) {
        const vm = await ModListViewModel.getViewModel();
        if (e.key === "add_group") {
            this.inputDialogRef.current.setCallback(async (text) => {
                console.log(text);
                await vm.addCategory(text);
                await this.updateModListTree();
            })
            this.inputDialogRef.current?.show();
        } else if (e.key === "rename") {
            this.inputDialogRef.current.setCallback(async (text) => {
                await vm.setModName(0, text);
                await this.updateModListTree();
            })
            this.inputDialogRef.current?.show();
        } else if (e.key === "delete") {
            for (const item of this.state.selectedKeys!) {
                await vm.removeMod(item);
                await this.updateModListTree();
            }
        }
    }

    private async updateProfileSelect() {
        const vm = await ModListViewModel.getViewModel();
        if (vm.profiles === undefined) {
            return;
        }

        let options: SelectProps['options'] = [];
        for (const profileKey in vm.profiles) {
            options.push({
                value: profileKey,
                label: profileKey,
            });
        }
        this.setState({
            options,
            defaultProfile: vm.activeProfile,
        })
    }

    private async updateModListTree() {
        const vm = await ModListViewModel.getViewModel();
        if (vm.profiles === undefined) {
            return;
        }

        const treeData = [];
        const expandedKeys = [];
        const profile = vm.profiles[vm.activeProfile];
        for (const category of profile) {
            const categoryKey = Object.keys(category)[0];
            const mods = [];
            for (const id of category[categoryKey]) {
                const modItem = vm.getModInfo(id);
                const title = modItem.name === "" ? modItem.url : modItem.name;
                mods.push({
                    id: id,
                    key: id,
                    isLeaf: true,
                    title: title,
                    tags: modItem.tags,
                    required: modItem.required,
                    enabled: modItem.enabled,
                    type: modItem.type,
                    approval: modItem.approval,
                    versions: modItem.versions,
                    fileVersion: modItem.fileVersion,
                });
            }
            expandedKeys.push(categoryKey);
            treeData.push({
                title: categoryKey,
                key: categoryKey,
                children: mods
            })
        }
        this.setState({
            treeData,
            expandedKeys
        })
    }


    private onCustomTitleRender(nodeData: any) {

        //console.log(nodeData);
        if (nodeData.isLeaf) {
            return (
                <span style={{width: "100%", display: "block"}}>
                    <Switch checked={nodeData.enabled} size={"small"}
                            onChange={(checked) => this.onSwitchChange(checked, nodeData)}
                            style={{marginRight: "8px", marginTop: "-3px"}}
                    />

                    {nodeData.type === "modio" &&
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
            this.updateModListTree().then(() => {
                // ModListViewModel.updateModList().then(() => {
                //     this.updateModListTree().then(() => {
                //         this.forceUpdate();
                //     });
                // })
            })
        });
    }

    render() {
        return (
            <>
                <AddModDialog ref={this.addModDialogRef}/>
                <ProfileEditDialog ref={this.profileEditDialogRef}/>
                <InputDialog ref={this.inputDialogRef}/>
                <div style={{marginTop: "5px"}}>
                    <Button type="text">
                        <SaveOutlined/>
                        Apply Changes
                    </Button>
                    <Button type="text">
                        <DeleteOutlined/>
                        Uninstall All
                    </Button>
                    <Button type="text">
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
                              height={370}
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
                    <Flex style={{borderTop: "1px solid #eee", paddingTop: "8px"}}>
                        <Checkbox style={{margin: "0 10px 0 10px"}}
                                  onChange={this.onMultiCheckboxChange}
                        />
                        {
                            this.state.isMultiSelect === true &&
                            <>
                                <Button type="text" size={"small"}>
                                    <CloseCircleOutlined/>
                                    Delete Selected
                                </Button>
                                <Button type="text" size={"small"}>
                                    <CloseCircleOutlined/>
                                    Update Selected
                                </Button>
                            </>
                        }
                    </Flex>
                </Card>
            </>
        )
    }

}


export default ModListPage;