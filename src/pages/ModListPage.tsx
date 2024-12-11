import React from "react";
import {Button, Card, Checkbox, Flex, Select, SelectProps, Tree, GetProps} from 'antd';
import Search from "antd/es/input/Search";
import {
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


type DirectoryTreeProps = GetProps<typeof Tree.DirectoryTree>;

const {DirectoryTree} = Tree;


interface ModListPageState {
    options?: SelectProps['options'];
    treeData?: DirectoryTreeProps['treeData'];
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
            defaultProfile: "",
        }

        this.onAddModClick = this.onAddModClick.bind(this);
        this.onEditProfileClick = this.onEditProfileClick.bind(this);
        this.onSelectChange = this.onSelectChange.bind(this);
        this.onTreeNodeSelect = this.onTreeNodeSelect.bind(this);
        this.onTreeNodeExpand = this.onTreeNodeExpand.bind(this);
    }

    private onAddModClick() {
        this.addModDialogRef.current?.show();
    }

    private onEditProfileClick() {
        this.profileEditDialogRef.current?.show();
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

    private customTitleRender = (nodeData) => {
        return (
            <span>
            <span>{nodeData.title}</span>
        </span>
        );
    }

    private render() {
        return (
            <>
                <AddModDialog ref={this.addModDialogRef}/>
                <ProfileEditDialog ref={this.profileEditDialogRef}/>
                <div style={{marginTop: "5px"}}>
                    <Button type="text" onClick={this.onAddModClick}>
                        <PlusCircleOutlined/>Add Mod
                    </Button>
                    <Button type="text"><SaveOutlined/>Apply Changes</Button>
                    <Button type="text"><DeleteOutlined/>Uninstall All</Button>
                    <Button type="text"><PlayCircleOutlined/>Launch Game</Button>
                </div>
                <Card className="mod-list-page-card">
                    <Flex>
                        <Select
                            size={"middle"}
                            style={{width: "90%"}}
                            value={this.state.defaultProfile}
                            options={this.state.options}
                            onChange={this.onSelectChange}
                        />
                        <Button type="text" onClick={this.onEditProfileClick}>
                            <EditOutlined/>
                        </Button>
                        <Search placeholder="Search"/>
                    </Flex>
                    <DirectoryTree
                        style={{
                            height: "370px",
                            marginTop: "10px",
                        }}
                        height={370}
                        multiple
                        draggable
                        checkable
                        expandedKeys={this.state.expandedKeys}
                        treeData={this.state.treeData}
                        onSelect={this.onTreeNodeSelect}
                        onExpand={this.onTreeNodeExpand}
                        titleRender={this.customTitleRender}
                    />
                    <Flex style={{borderTop: "1px solid #eee", paddingTop: "8px"}}>
                        <Checkbox style={{margin: "0 10px 0 10px"}}/>
                        <Button type="text" size={"small"}><RedoOutlined/>Update All</Button>
                    </Flex>
                </Card>
            </>
        )
    }
}


export default ModListPage;