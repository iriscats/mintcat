import React from "react";
import {Button, Checkbox, ConfigProviderProps, Flex, Select, SelectProps, Tree} from 'antd';
import {GetProps} from 'antd';
import Search from "antd/es/input/Search";
import {
    DeleteOutlined, EditOutlined, PlayCircleOutlined, PlusCircleOutlined,
    RedoOutlined, SaveOutlined
} from "@ant-design/icons";

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
        <spen>
            <span>{nodeData.title}</span>
        </spen>
    );
}

const ModListPage: React.FC = () => (
    <div>
        <div style={{marginTop: "5px"}}>
            <Button type="text"><SaveOutlined/>Apply Changes</Button>
            <Button type="text"><DeleteOutlined/>Uninstall All</Button>
            <Button type="text"><PlayCircleOutlined/>Launch Game</Button>
            <Button type="text"><PlusCircleOutlined/>Add Mod</Button>
        </div>
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
                    defaultValue="Visual"
                    onChange={handleChange}
                    style={{width: "90%"}}
                    options={options}
                    mode="tags"
                />
                <Button type="text"><EditOutlined /></Button>
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
            <Flex
                style={{borderTop: "1px solid #eee"}}
            >
                <Checkbox style={{margin: "0 10px 0 10px"}}></Checkbox>
                <Button type="text" size={"small"}><RedoOutlined/>Update All</Button>
            </Flex>
        </div>
    </div>
)

export default ModListPage;