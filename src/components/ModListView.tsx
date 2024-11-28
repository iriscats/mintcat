import React from "react";
import {Button, ConfigProviderProps, Flex, Select, SelectProps, Tree} from 'antd';
import {GetProps, TreeDataNode, Card} from 'antd';
import Search from "antd/es/input/Search";
import {
    CheckSquareOutlined,
    DeleteOutlined,
    PlayCircleOutlined,
    PlusCircleOutlined,
    RedoOutlined,
    SaveOutlined
} from "@ant-design/icons";

type DirectoryTreeProps = GetProps<typeof Tree.DirectoryTree>;

const {DirectoryTree} = Tree;

const treeData: (any)[] = [
    {
        title: '文件夹 0',
        key: '0-0',
        children: [
            {title: 'Mod 1', key: '0-0-0', isLeaf: true},
            {title: 'Mod 2', key: '0-0-1', isLeaf: true},
        ],
    },
    {
        title: '文件夹 1',
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


type SizeType = ConfigProviderProps['componentSize'];

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

const ModListView: React.FC = () => (
    <div style={{
        height: "90%",
        margin: "5px 10px",
        backgroundColor: "white",
    }}>
        <Flex style={{
            borderBottom: "1px solid #eee",
            borderRadius: "6px 6px 0 0",
            margin: "5px 0px",
        }}>
            <Select
                size={"middle"}
                defaultValue="a1"
                onChange={handleChange}
                style={{width: "90%"}}
                options={options}
                mode="tags"
            />
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
        />
        <Flex
            style={{borderTop: "1px solid #eee"}}
        >
            <Button type="text"><CheckSquareOutlined/></Button>
            <Button type="text"><RedoOutlined/>Update All</Button>
        </Flex>
    </div>
)

export default ModListView;