import React from "react";
import {Dropdown, MenuProps, Select, Switch, Tag} from "antd";
import {FolderOutlined} from "@ant-design/icons";

const contextMenus: MenuProps['items'] = [
    {label: 'Rename', key: 'rename'},
    {label: 'Update', key: 'update'},
    {label: 'Delete', key: 'delete'},
    {label: 'Copy Link', key: 'copy_link'},
    {label: 'Export', key: 'export'}
];

const contextMenusGroup: MenuProps['items'] = [
    {label: 'Add Mod', key: 'add_mod'},
    {label: 'Add New Group', key: 'add_new_group'},
    {label: 'Add Sub Group', key: 'add_sub_group'},
    {label: 'Rename Group', key: 'rename_group'},
    {label: 'Delete Group', key: 'delete_group'}
];

export function TreeViewItem(nodeData: any, onMenuClick: any) {
    if (nodeData.isLeaf) {
        return (
            <Dropdown trigger={['contextMenu']}
                      menu={{
                          items: contextMenus,
                          onClick: (e) => {
                              onMenuClick(e.key, nodeData.key);
                          }
                      }}>
                    <span style={{width: "100%", display: "block"}}>
                        <Switch checked={nodeData.enabled} size={"small"}
                                onChange={(checked) => this.onSwitchChange(checked, nodeData)}
                                style={{marginRight: "8px", marginTop: "-3px"}}
                        />

                        {nodeData.isLocal === false &&
                            <Select size={"small"}
                                    suffixIcon={null}
                                    popupMatchSelectWidth={false}
                                    style={{marginRight: "8px", width: "60px"}}
                                    value={nodeData.fileVersion}>
                                <Select.Option value={nodeData.fileVersion}>{nodeData.fileVersion}</Select.Option>
                            </Select>}

                        <a>{nodeData.title}</a>

                        {nodeData.approval === "Verified" ? (<Tag color="blue" style={{float: "right"}}>V</Tag>) :
                            nodeData.approval === "Approved" ? (<Tag color="green" style={{float: "right"}}>A</Tag>) :
                                nodeData.approval === "Sandbox" ? (
                                        <Tag color="orange" style={{float: "right"}}>S</Tag>) :
                                    (<></>)}

                        {nodeData.versions.length > 0 && nodeData.versions[0] !== "1.39" && (
                            <Tag color="red" style={{float: "right"}}>{nodeData.versions[0]}</Tag>)}

                        {nodeData.required === "RequiredByAll" && (
                            <Tag color="orange" style={{float: "right"}}>RequiredByAll</Tag>)}

                        {nodeData.tags.map(tagName => (
                            <Tag key={tagName} style={{float: "right"}}>{tagName}</Tag>
                        ))}

                    </span>
            </Dropdown>
        );
    } else {
        return (
            <Dropdown trigger={['contextMenu']}
                      menu={{
                          items: contextMenusGroup,
                          onClick: (e) => {
                              onMenuClick(e.key, nodeData.key);
                          }
                      }}>
                    <span style={{
                        width: "100%",
                        display: "block",
                        backgroundColor: "rgba(238,238,238,0.2)",
                        paddingLeft: "6px",
                        borderRadius: "6px"
                    }}>
                       <FolderOutlined/> {nodeData.title}
                    </span>
            </Dropdown>
        );
    }
}