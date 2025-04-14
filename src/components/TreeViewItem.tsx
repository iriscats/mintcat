import React from "react";
import {Dropdown, Flex, MenuProps, Progress, Select, Switch, Tag, Tooltip} from "antd";
import {ClockCircleOutlined, ExclamationCircleOutlined, FolderOutlined} from "@ant-design/icons";
import {t} from "i18next";
import {open} from "@tauri-apps/plugin-shell";


export function TreeViewItem(nodeData: any, onMenuClick: any, onSwitchChange: any) {

    const contextMenus: MenuProps['items'] = [
        {label: t('Rename'), key: 'rename'},
        {label: t('Update'), key: 'update'},
        {label: t('Delete'), key: 'delete'},
        {label: t('Copy Link'), key: 'copy_link'},
        {label: t('Export'), key: 'export'}
    ];

    const contextMenusGroup: MenuProps['items'] = [
        {label: t('Add Mod'), key: 'add_mod'},
        {label: t('Add New Group'), key: 'add_new_group'},
        {label: t('Add Sub Group'), key: 'add_sub_group'},
        {label: t('Rename Group'), key: 'rename_group'},
        {label: t('Delete Group'), key: 'delete_group'}
    ];

    if (nodeData.isLeaf) {
        return (
            <Dropdown trigger={['contextMenu']}
                      menu={{
                          items: contextMenus,
                          onClick: (e) => {
                              onMenuClick(e.key, nodeData.key);
                          }
                      }}>
                <Flex align="center"
                      style={{
                          width: "calc(100% - 20px)",
                          display: "block"
                      }}
                >

                    <Switch checked={nodeData.enabled} size={"small"}
                            onChange={(checked) => onSwitchChange(checked, nodeData)}
                            style={{marginRight: "8px", marginTop: "-3px"}}
                    />

                    {nodeData.isLocal === false &&
                        <Select size={"small"}
                                suffixIcon={null}
                                popupMatchSelectWidth={false}
                                style={{marginRight: "8px", width: "60px"}}
                                value={nodeData.fileVersion}
                                onDropdownVisibleChange={(visible) => {
                                    console.log("onDropdownVisibleChange" + visible);
                                }}
                        >
                            <Select.Option value={nodeData.fileVersion}>{nodeData.fileVersion}</Select.Option>
                        </Select>
                    }

                    {nodeData.isLocal === false && nodeData.onlineUpdateDate > nodeData.lastUpdateDate &&
                        <Tooltip title={t("Discovered New Version")}>
                            <span style={{color: "orange", marginRight: "4px"}}>
                                <ClockCircleOutlined/>
                            </span>
                        </Tooltip>
                    }

                    {nodeData.isLocal === false && nodeData.onlineAvailable === false &&
                        <Tooltip title={t("Online Mod has been Deleted by Author")}>
                            <span style={{color: "red", marginRight: "4px"}}>
                                <ExclamationCircleOutlined/>
                            </span>
                        </Tooltip>
                    }

                    {nodeData.isLocal === false &&
                        <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            verticalAlign: "middle",
                            marginRight: "5px",
                        }}>
                            {
                                (nodeData.downloadProgress !== 100) &&
                                <Progress
                                    type="circle"
                                    trailColor="#e6f4ff"
                                    percent={nodeData.downloadProgress}
                                    strokeWidth={20}
                                    size={14}
                                    format={(number) => `Downloading ${number}%`}
                                />
                            }
                        </span>
                    }

                    {nodeData.isLocal === true && <a style={{color: "#403c3c"}}> {nodeData.title}</a>}
                    {
                        nodeData.isLocal === false &&
                        <a style={{color: nodeData.downloadProgress === 100 ? "#1f81f8" : "lightblue"}}
                           onClick={async () => {
                               await open(nodeData.url);
                           }}
                        >
                            {nodeData.title}
                        </a>
                    }

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

                </Flex>
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