import {t} from "i18next";
import React, {useState} from "react";
import {Dropdown, Flex, MenuProps, Progress, Select, Spin, Switch, Tag, theme, Tooltip} from "antd";
import {ClockCircleOutlined, ExclamationCircleOutlined, FolderOutlined} from "@ant-design/icons";
import {open} from "@tauri-apps/plugin-shell";
import {emit, listen} from "@tauri-apps/api/event";
import {ModListItem, ModSourceType} from "@/vm/config/ModList.ts";
import {HomeViewModel} from "@/vm/HomeViewModel.ts";
import {ModioApi} from "@/apis/ModioApi.ts";
import {ModUpdateApi} from "@/apis/ModUpdateApi.ts";
import {ModFile} from "@/vm/modio/ModInfo.ts";

const {useToken} = theme;


function ModTreeViewFolder({nodeData, onMenuClick}) {
    const contextMenusGroup: MenuProps['items'] = [
        {label: t('Add Mod'), key: 'add_mod'},
        {label: t('Add New Group'), key: 'add_new_group'},
        {label: t('Add Sub Group'), key: 'add_sub_group'},
        {label: t('Rename Group'), key: 'rename_group'},
        {label: t('Delete Group'), key: 'delete_group'}
    ];
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
                        paddingLeft: "6px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(238,238,238,0.2)",
                    }}>
                      <b><FolderOutlined/> {nodeData.title}</b>
                    </span>
        </Dropdown>
    );
}


function ModTreeViewSwitch({nodeData}) {

    const onSwitchChange = async (checked: boolean) => {
        nodeData.enabled = checked;
        const viewModel = await HomeViewModel.getInstance();
        await viewModel.setModEnabled(nodeData.key, checked);

        await emit("tree-view-count-label-update");
    };

    return (
        <Switch checked={nodeData.enabled}
                size={"small"}
                onChange={(checked) => onSwitchChange(checked)}
                style={{marginRight: "8px", marginTop: "-3px"}}
        />
    );
}


function ModTreeViewVersionSelect({nodeData}) {

    const [fetching, setFetching] = useState(false);
    const [options, setOptions] = useState<any[]>([]);

    let fileInfos: ModFile[] = [];
    const onDropdownVisibleChange = async (visible: boolean) => {
        if (visible) {
            setFetching(true);

            fileInfos = await ModioApi.getModFiles(nodeData.modId);
            const optionList = [];
            for (const fileInfo of fileInfos) {
                optionList.push({value: JSON.stringify(fileInfo), label: fileInfo.version ? fileInfo.version : "-"});
            }

            setFetching(false);
            setOptions(optionList.reverse());
        }
    }

    const onChange = async (value: string) => {
        const fileInfo = JSON.parse(value);
        nodeData.usedVersion = fileInfo.version;
        await emit("status-bar-log", `${t("Switch Version")}: ${nodeData.title} ${fileInfo.version}`);

        const viewModel = await HomeViewModel.getInstance();
        await viewModel.setModUsedVersion(nodeData.key, fileInfo.version);

        const modItem = viewModel.ModList.get(nodeData.key);
        modItem.downloadUrl = fileInfo.download.binary_url;
        modItem.downloadProgress = 0;
        modItem.fileSize = fileInfo.filesize;
        modItem.usedVersion = fileInfo.version;

        await emit("mod-treeview-update" + nodeData.key, modItem);
        await ModUpdateApi.updateModFile(modItem);
    }

    return (
        <Select size={"small"}
                suffixIcon={null}
                popupMatchSelectWidth={false}
                style={{marginRight: "8px", width: "80px"}}
                value={nodeData.usedVersion === "" ? nodeData.fileVersion : nodeData.usedVersion}
                notFoundContent={fetching ? <Spin size="small"/> : null}
                options={options}
                onChange={onChange}
                onDropdownVisibleChange={onDropdownVisibleChange}
        />
    );
}


function ModTreeViewWarring({nodeData}) {

    const check = () => {
        return nodeData.downloadProgress === 100 &&
            (nodeData.onlineUpdateDate > nodeData.lastUpdateDate ||
                nodeData.usedVersion !== nodeData.fileVersion);
    }

    const [isExpired, setIsExpired] = useState(check());

    listen<ModListItem>("mod-treeview-update" + nodeData.key, (event) => {
        nodeData = event.payload;
        setIsExpired(check());
    }).then();

    return (
        <>
            {
                isExpired &&
                <Tooltip title={t("Discovered New Version")}>
                                <span style={{color: "orange", marginRight: "4px"}}>
                                    <ClockCircleOutlined/>
                                </span>
                </Tooltip>
            }

            {
                nodeData.onlineAvailable === false &&
                <Tooltip title={t("Online Mod has been Deleted by Author")}>
                                <span style={{color: "red", marginRight: "4px"}}>
                                    <ExclamationCircleOutlined/>
                                </span>
                </Tooltip>
            }

        </>
    )
}

function ModTreeViewProgress({nodeData}) {

    const [downloadProgress, setDownloadProgress] = useState(nodeData.downloadProgress);

    listen<ModListItem>("mod-treeview-update" + nodeData.key, (event) => {
        setDownloadProgress(event.payload.downloadProgress);
    }).then();

    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            verticalAlign: "middle",
            marginRight: "5px",
        }}>
            {
                (downloadProgress !== 100) &&
                <Progress
                    type="circle"
                    trailColor="#e6f4ff"
                    percent={downloadProgress}
                    strokeWidth={20}
                    size={14}
                    format={(number) => `Downloading ${number}%`}
                />
            }
        </span>
    );

}


function ModTreeViewTitle({nodeData}) {

    const [downloadProgress, setDownloadProgress] = useState(nodeData.downloadProgress);
    const {token} = useToken();

    listen<ModListItem>("mod-treeview-update" + nodeData.key, (event) => {
        setDownloadProgress(event.payload.downloadProgress);
    }).then();

    return (
        <a style={{
            color: nodeData.enabled &&
            downloadProgress === 100 ? token.colorPrimary : token.colorTextDisabled
        }}
           onClick={async () => {
               await open(nodeData.url);
           }}
        >
            {nodeData.title}
        </a>
    )

}


export function TreeViewItem(nodeData: any, onMenuClick: any) {

    const contextMenus: MenuProps['items'] = [
        {label: t('Rename'), key: 'rename'},
        {label: t('Update'), key: 'update'},
        {label: t('Delete'), key: 'delete'},
        {label: t('Copy Link'), key: 'copy_link'},
        {label: t('Export'), key: 'export'}
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
                          backgroundColor: "rgba(238,238,238,0.05)",
                          display: "block"
                      }}
                >

                    <ModTreeViewSwitch nodeData={nodeData}/>

                    {nodeData.sourceType === ModSourceType.Modio &&
                        <ModTreeViewVersionSelect nodeData={nodeData}/>
                    }

                    {nodeData.sourceType === ModSourceType.Modio &&
                        <ModTreeViewWarring nodeData={nodeData}/>
                    }

                    {nodeData.sourceType === ModSourceType.Modio &&
                        <ModTreeViewProgress nodeData={nodeData}/>
                    }

                    {
                        nodeData.sourceType === ModSourceType.Local &&
                        <a style={{color: nodeData.enabled ? "#403c3c" : "gray"}}>
                            {nodeData.title}
                        </a>
                    }
                    {
                        nodeData.sourceType === ModSourceType.Modio &&
                        <ModTreeViewTitle nodeData={nodeData}/>
                    }

                    {nodeData.approval === "Verified" ? (
                            <Tag color="blue" title={t("Verified")} style={{float: "right"}}>V</Tag>) :
                        nodeData.approval === "Approved" ? (
                                <Tag color="green" title={t("Approved")} style={{float: "right"}}>A</Tag>) :
                            nodeData.approval === "Sandbox" ? (
                                    <Tag color="orange" title={t("Sandbox")} style={{float: "right"}}>S</Tag>) :
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
            <ModTreeViewFolder nodeData={nodeData} onMenuClick={onMenuClick}/>
        );
    }
}