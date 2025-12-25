import {t} from "i18next";
import React, {useState} from "react";
import {Dropdown, Flex, MenuProps, Progress, Select, Spin, Switch, Tag, theme, Tooltip} from "antd";
import {ClockCircleOutlined, ExclamationCircleOutlined, FolderOutlined} from "@ant-design/icons";
import {open} from "@tauri-apps/plugin-shell";
import {emitEvent, emitVoidEvent, useFilteredEventListener} from "@/events";
import {ModSourceType} from "@/storage/db/Schema.ts";
import {HomeViewModel} from "./HomeViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {ModioApi} from "@/apis/modio";
import {ModUpdateApi} from "@/apis/ModUpdateApi.ts";
import {ModFile} from "@/apis/modio/ModInfo.ts";
import {StorageAPI} from "@/storage";
import type {CompleteModData} from "@/storage/dao/ModDAO";
import {TimeUtils} from "@/utils/TimeUtils.ts";

const {useToken} = theme;

/**
 * Helper method to get a mod from database by ID
 */
async function getModById(modId: number): Promise<CompleteModData | null> {
    const modsApi = await StorageAPI.getMods();
    return await modsApi.getCompleteModData(modId);
}


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
        console.log(`[ModTreeViewSwitch] onSwitchChange called: key=${nodeData.key}, modId=${nodeData.modId}, checked=${checked}`);
        const viewModel = await IoC.get(HomeViewModel);
        console.log(`[ModTreeViewSwitch] Got HomeViewModel, calling setModEnabled`);
        await viewModel.setModEnabled(nodeData.modId, checked);
        console.log(`[ModTreeViewSwitch] setModEnabled completed`);

        await emitVoidEvent("tree-view-count-label-update");
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

            // Use platformId for mod.io API calls
            fileInfos = await ModioApi.getModFiles(nodeData.platformId);
            const optionList = [];
            for (const fileInfo of fileInfos) {
                optionList.push({
                    value: JSON.stringify(fileInfo),
                    label: fileInfo.version ? fileInfo.version : fileInfo.filename
                });
            }

            setFetching(false);
            setOptions(optionList.reverse());
        }
    }

    const onChange = async (value: string) => {
        const fileInfo = JSON.parse(value);
        await emitEvent("status-bar-log", `${t("Switch Version")}: ${nodeData.title} ${fileInfo.version}`);

        const viewModel = await IoC.get(HomeViewModel);
        // Use profileModId (profile_mods.id) instead of key
        if (nodeData.profileModId) {
            await viewModel.setModUsedVersion(nodeData.profileModId, fileInfo.version);
        }

        const modItem = await getModById(nodeData.modId);
        if (!modItem) return;

        // Update modItem with new version and download info
        const updatedModItem: CompleteModData = {
            ...modItem,
            version: {
                ...modItem.version!,
                currentVersion: fileInfo.version || fileInfo.filename
            },
            download: {
                ...modItem.download!,
                downloadUrl: fileInfo.download.binary_url,
                downloadProgress: 0,
                fileSize: fileInfo.filesize,
            }
        };

        await emitEvent("mod-treeview-update", {
            modId: updatedModItem.modId!,
            data: updatedModItem
        });
        await ModUpdateApi.updateModFile(updatedModItem);
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
                onOpenChange={onDropdownVisibleChange}
        />
    );
}


function ModTreeViewWarring({nodeData}) {
    // 使用 ref 存储 nodeData 以便在回调中访问最新值
    const nodeDataRef = React.useRef(nodeData);
    nodeDataRef.current = nodeData;

    const checkExpired = () => {
        const data = nodeDataRef.current;
        if (data.sourceType !== ModSourceType.Modio) {
            return false;
        }

        if (data.downloadProgress !== 100) {
            return false;
        }

        // 如果用户手动选择了版本（usedVersion 不为空），则不提示更新
        // 因为用户可能故意选择了旧版本
        if (data.usedVersion && data.usedVersion !== "") {
            return false;
        }

        // 只有在用户没有手动选择版本时，才检查在线是否有新版本
        // 如果 lastUpdateDate 为 0，说明是旧数据或初始化数据，不应该显示警告
        const hasNewerOnlineVersion = TimeUtils.hasUpdate(
            data.onlineUpdateDate,
            data.lastUpdateDate
        );

        return hasNewerOnlineVersion;
    }

    const checkLocalNoFound = () => {
        return nodeDataRef.current.localNoFound === true;
    }

    const checkOnlineUnavailable = () => {
        const data = nodeDataRef.current;
        return data.sourceType === ModSourceType.Modio &&
            data.onlineAvailable === false;
    }

    const [isExpired, setIsExpired] = useState(checkExpired());
    const [isLocalNoFound, setIsLocalNoFound] = useState(checkLocalNoFound());
    const [isOnlineUnavailable, setIsOnlineUnavailable] = useState(checkOnlineUnavailable());

    // ✅ 使用 useFilteredEventListener 自动清理监听器
    useFilteredEventListener(
        'mod-treeview-update',
        (payload) => payload.modId === nodeData.modId,
        (payload) => {
            // 更新 nodeDataRef
            nodeDataRef.current = payload.data;
            // 重新检查状态
            setIsExpired(checkExpired());
            setIsLocalNoFound(checkLocalNoFound());
            setIsOnlineUnavailable(checkOnlineUnavailable());
        },
        [nodeData.modId]
    );

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
                isOnlineUnavailable &&
                <Tooltip title={t("Mod cannot be retrieved or has been deleted by the author")}>
                                <span style={{color: "red", marginRight: "4px"}}>
                                    <ExclamationCircleOutlined/>
                                </span>
                </Tooltip>
            }

            {
                isLocalNoFound &&
                <Tooltip title={t("File Not Found")}>
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

    // ✅ 使用 useFilteredEventListener 自动清理监听器
    useFilteredEventListener(
        'mod-treeview-update',
        (payload) => payload.modId === nodeData.modId,
        (payload) => {
            setDownloadProgress(payload.data.download?.downloadProgress || 100);
        },
        [nodeData.modId]
    );

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

    // ✅ 使用 useFilteredEventListener 自动清理监听器
    useFilteredEventListener(
        'mod-treeview-update',
        (payload) => payload.modId === nodeData.modId,
        (payload) => {
            setDownloadProgress(payload.data.download?.downloadProgress || 100);
        },
        [nodeData.modId]
    );

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

                    {
                        //nodeData.sourceType === ModSourceType.Modio &&
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
                                null}

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
