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
import ConfigApi from "../apis/ConfigApi.ts";
import unifiedModListData from "../models/ModListData.ts";


type DirectoryTreeProps = GetProps<typeof Tree.DirectoryTree>;

const {DirectoryTree} = Tree;

const treeData: (any)[] = [
    {
        title: 'Local',
        key: '0-0',
        children: [
            {title: 'Mod1.pak', key: '0-0-0', isLeaf: true},
            {
                title: 'Mod2.pak',
                key: '0-0-1',
                isLeaf: true,

            },
        ],
    },
    {
        title: 'mod.io',
        key: '0-1',
        children: [
            {title: 'Mod 3', key: '0-1-0', isLeaf: true},
            {title: 'Mod 4', key: '0-1-1', isLeaf: true},
        ],
    },
];

const onSelect: DirectoryTreeProps['onSelect'] = (keys, info) => {
    console.log('Trigger Select', keys, info);
};

const onExpand: DirectoryTreeProps['onExpand'] = (keys, info) => {
    console.log('Trigger Expand', keys, info);
};


const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
}


const options: SelectProps['options'] = [];

for (let i = 10; i < 36; i++) {
    options.push({
        value: i.toString(36) + i,
        label: i.toString(36) + i,
    });
}

const handleChange = (value: string | string[]) => {
    console.log(`Selected: ${value}`);
};

const customTitleRender = (nodeData) => {
    return (
        <span>
            <span>{nodeData.title}</span>
        </span>
    );
}


class ModListPage extends React.Component<any, any> {

    private readonly addModDialogRef: React.RefObject<AddModDialog> = React.createRef();

    private readonly profileEditDialogRef: React.RefObject<AddModDialog> = React.createRef();

    public constructor(props: any, context: any) {
        super(props, context);
        this.state = {}
        this.onAddModClick = this.onAddModClick.bind(this);
        this.onEditProfileClick = this.onEditProfileClick.bind(this);

        console.log("ModListPage");
    }

    private async initViewModel() {
        const data = await ConfigApi.loadModListData();
        const modListData = unifiedModListData(data);
        console.log(JSON.stringify(modListData));
    }

    private onAddModClick() {
        this.addModDialogRef.current?.show();
    }

    private onEditProfileClick() {
        this.profileEditDialogRef.current?.show();
    }

    private componentDidMount() {
        this.initViewModel().then(() => {
        })
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
                <Card style={{
                    height: "92%",
                    margin: "4px 5px 0 5px",
                    padding: "0",
                }}>
                    <Flex>
                        <Select
                            size={"middle"}
                            defaultValue="Visual"
                            onChange={handleChange}
                            style={{width: "90%"}}
                            options={options}
                            mode="tags"
                        />
                        <Button type="text" onClick={this.onEditProfileClick}>
                            <EditOutlined/>
                        </Button>
                        <Search placeholder="Search" onChange={onChange}/>
                    </Flex>
                    <DirectoryTree
                        style={{
                            height: "370px",
                            marginTop: "10px",
                        }}
                        multiple
                        draggable
                        checkable
                        defaultExpandAll
                        onSelect={onSelect}
                        onExpand={onExpand}
                        treeData={treeData}
                        titleRender={customTitleRender}
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