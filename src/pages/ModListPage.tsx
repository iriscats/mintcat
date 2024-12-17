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
} from 'antd';
import Search from "antd/es/input/Search";
import {
    ArrowUpOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    PlayCircleOutlined,
    PlusCircleOutlined,
    RedoOutlined,
    SaveOutlined
} from "@ant-design/icons";
import AddModDialog from "../dialogs/AddModDialog.tsx";
import ProfileEditDialog from "../dialogs/ProfileEditDialog.tsx";
import ModListViewModel from "../models/ModListPageVM.ts";
import {CheckboxChangeEvent} from "antd/es/checkbox";


interface ModListPageState {
    options?: SelectProps['options'];
    treeData?: TreeProps['treeData'];
    contextMenus?: MenuProps['items'];
    isMultiSelect?: boolean;
    expandedKeys?: any[];
    defaultProfile?: string;
}

class ModListPage extends React.Component<any, ModListPageState> {

    private readonly addModDialogRef: React.RefObject<AddModDialog> = React.createRef();

    private readonly profileEditDialogRef: React.RefObject<AddModDialog> = React.createRef();

    public constructor(props: any, context: ModListPageState) {
        super(props, context);

        this.state = {
            options: [],
            contextMenus: [],
            defaultProfile: "",
        }

        this.onAddModClick = this.onAddModClick.bind(this);
        this.onEditProfileClick = this.onEditProfileClick.bind(this);
        this.onSelectChange = this.onSelectChange.bind(this);
        this.onTreeNodeSelect = this.onTreeNodeSelect.bind(this);
        this.onTreeNodeExpand = this.onTreeNodeExpand.bind(this);
        this.onCheckboxChange = this.onCheckboxChange.bind(this);
    }

    private onAddModClick() {
        this.addModDialogRef.current?.show();
    }

    private onEditProfileClick() {
        this.profileEditDialogRef.current?.show();
    }

    private onCheckboxChange(e: CheckboxChangeEvent) {
        console.log(e.target.checked);
        this.setState({
            isMultiSelect: e.target.checked
        })
    }

    private async onSelectChange(value: string) {
        console.log(`Selected: ${value}`);
        const vm = await ModListViewModel.getViewModel();
        vm.activeProfile = value;
        await this.loadModListTree();
        this.setState({
            defaultProfile: value as string,
        })
    };

    private onTreeNodeSelect(keys, info) {
    }

    private onTreeNodeExpand(keys, info) {
        this.setState({
            expandedKeys: keys,
        })
    };

    private async loadProfile() {
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

    private async loadModListTree() {
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
            for (const modItem: any of category[categoryKey]) {
                mods.push({
                    title: modItem.url,
                    key: modItem.url,
                    required: modItem.required,
                    enabled: modItem.enabled,
                    isLeaf: true
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

    private override componentDidMount(): void {
        this.loadProfile().then(() => {
            this.loadModListTree().then(() => {
            })
        });
    }

    private customTitleRender(nodeData) {
        if (nodeData.isLeaf) {
            return (
                <span style={{width: "100%", display: "block"}}>
                    <Switch checked={nodeData.enabled} size={"small"} style={{marginRight: "8px", marginTop: "-3px"}}/>
                    <a>{nodeData.title}</a>
                    <Tag color="blue" style={{float: "right"}}>Verify</Tag>
                </span>
            );
        } else {
            return (
                <span style={{width: "100%", display: "block"}}>
                    {nodeData.title}
                </span>
            );
        }
    }

    private contextMenus: MenuProps['items'] = [
        {
            label: 'Add Group',
            key: '1',
        },
        {
            label: 'Delete',
            key: '2',
        }
    ];

    private render() {
        return (
            <>
                <AddModDialog ref={this.addModDialogRef}/>
                <ProfileEditDialog ref={this.profileEditDialogRef}/>
                <div style={{marginTop: "5px"}}>
                    <Button type="text">
                        <SaveOutlined/>Apply Changes
                    </Button>
                    <Button type="text">
                        <DeleteOutlined/>Uninstall All
                    </Button>
                    <Button type="text">
                        <PlayCircleOutlined/>Launch Game
                    </Button>
                    {/*<Button type="text" onClick={this.onAddModClick}>*/}
                    {/*    <PlusCircleOutlined/>Add Mod*/}
                    {/*</Button>*/}
                </div>
                <Card className="mod-list-page-card">
                    <Flex>
                        <Button type="text" size={"small"} onClick={this.onAddModClick}>
                            <PlusCircleOutlined/>
                        </Button>
                        <Button type="text" size={"small"} onClick={this.onEditProfileClick}>
                            <ArrowUpOutlined/>
                        </Button>
                        <Select
                            size={"small"}
                            style={{width: "90%"}}
                            value={this.state.defaultProfile}
                            options={this.state.options}
                            onChange={this.onSelectChange}
                        />
                        <Button type="text" size={"small"} onClick={this.onEditProfileClick}>
                            <EditOutlined/>
                        </Button>
                        <Search size={"small"} placeholder="Search"/>
                    </Flex>
                    <Dropdown menu={{
                        items: this.contextMenus,
                        onClick: (e) => {
                            console.log(e);
                        }
                    }}
                              onOpenChange={(open) => {
                                  if (open) {
                                      console.log('trigger open');
                                  } else {
                                      console.log('trigger close');
                                  }
                              }}
                              trigger={['contextMenu']}>
                        <Tree
                            style={{
                                height: "370px",
                                marginTop: "10px",
                            }}
                            height={370}
                            draggable
                            blockNode
                            checkable={this.state.isMultiSelect}
                            expandedKeys={this.state.expandedKeys}
                            treeData={this.state.treeData}
                            onSelect={this.onTreeNodeSelect}
                            onRightClick={this.onTreeNodeSelect}
                            onExpand={this.onTreeNodeExpand}
                            titleRender={this.customTitleRender}
                        />
                    </Dropdown>
                    <Flex style={{borderTop: "1px solid #eee", paddingTop: "8px"}}>
                        <Checkbox style={{margin: "0 10px 0 10px"}}
                                  onChange={this.onCheckboxChange}
                        />
                        <Button type="text" size={"small"}>
                            <CloseCircleOutlined/>Delete Select
                        </Button>
                    </Flex>
                </Card>
            </>
        )
    }

}


export default ModListPage;