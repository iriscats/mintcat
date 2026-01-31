import {t} from "i18next";
import React, {useState} from "react";
import {Dropdown, MenuProps, Select, Spin, Switch, Tag, theme, Tooltip} from "antd";
import {
    ClockCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    DragOutlined,
    EditOutlined,
    ExclamationCircleOutlined,
    ExportOutlined,
    FolderAddOutlined,
    FolderOutlined,
    LinkOutlined,
    PlusCircleOutlined,
    SyncOutlined,
} from "@ant-design/icons";
import {open} from "@tauri-apps/plugin-shell";
import {emitEvent, useFilteredEventListener} from "@/events";
import {ModSourceType} from "@/storage/db/Schema.ts";
import {HomeViewModel} from "./HomeViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {ModioApi} from "@/apis/modio";
import {ModUpdateService} from "@/services/ModUpdateService.ts";
import {ModFile} from "@/apis/modio/ModInfo.ts";
import {StorageAPI} from "@/storage";
import StatusBar from "@/components/StatusBar.tsx";
import type {CompleteModData} from "@/storage/dao/ModDAO";
import {TimeUtils} from "@/utils/TimeUtils.ts";
import type {FolderInfo} from "./TreeView";

const {useToken} = theme;

// 模块级别的缓存，用于在虚拟列表滚动时保持 Switch 状态
const pendingEnabledChanges = new Map<number, boolean>();

// 模块级别的版本切换锁定，防止快速重复点击导致下载冲突
// key: modId, value: { isProcessing: boolean, abortController?: AbortController }
const versionSwitchLocks = new Map<number, { isProcessing: boolean; currentVersion?: string }>();

export function getVersionSwitchLock(modId: number): { isProcessing: boolean; currentVersion?: string } {
    return versionSwitchLocks.get(modId) || { isProcessing: false };
}

export function setVersionSwitchLock(modId: number, lock: { isProcessing: boolean; currentVersion?: string }): void {
    versionSwitchLocks.set(modId, lock);
}

export function clearVersionSwitchLock(modId: number): void {
    versionSwitchLocks.delete(modId);
}

export function getPendingEnabled(modId: number, defaultValue: boolean): boolean {
    return pendingEnabledChanges.has(modId)
        ? pendingEnabledChanges.get(modId)!
        : defaultValue;
}

export function setPendingEnabled(modId: number, value: boolean): void {
    pendingEnabledChanges.set(modId, value);
}

export function clearPendingEnabled(modId?: number): void {
    if (modId !== undefined) {
        pendingEnabledChanges.delete(modId);
    } else {
        pendingEnabledChanges.clear();
    }
}

/**
 * Helper method to get a mod from database by ID
 */
async function getModById(modId: number): Promise<CompleteModData | null> {
    const modsApi = await StorageAPI.getMods();
    return await modsApi.getCompleteModData(modId);
}


function ModTreeViewFolder({nodeData, onMenuClick, folders, onMoveToFolder}: {
    nodeData: any;
    onMenuClick: any;
    folders?: FolderInfo[];
    onMoveToFolder?: (sourceKey: string, targetFolderKey: string) => void;
}) {
    // 过滤掉当前文件夹和默认文件夹(folder-1, folder-2)，避免移动到自身或默认文件夹
    const moveToChildren: MenuProps['items'] = folders
        ?.filter(f => {
            if (f.key === nodeData.key) return false;
            // 不能移动到默认文件夹
            const folderId = parseInt(f.key.split('-')[1]);
            if (folderId === 1 || folderId === 2) return false;
            return true;
        })
        .map(f => ({
            key: `move_to_${f.key}`,
            label: f.title,
            icon: <FolderOutlined />,
        })) || [];

    // 检查当前文件夹是否是默认文件夹
    const currentFolderId = parseInt(nodeData.key.split('-')[1]);
    const isDefaultFolder = currentFolderId === 1 || currentFolderId === 2;

    const contextMenusGroup: MenuProps['items'] = [
        {label: t('Add Mod'), key: 'add_mod', icon: <PlusCircleOutlined />},
        {label: t('Add New Group'), key: 'add_new_group', icon: <FolderAddOutlined />},
        {label: t('Add Sub Group'), key: 'add_sub_group', icon: <FolderAddOutlined />},
        {label: t('Rename Group'), key: 'rename_group', icon: <EditOutlined />},
        // 只有非默认文件夹才显示 "移动到" 和 "删除" 选项
        ...(!isDefaultFolder && moveToChildren.length > 0 ? [{
            label: t('Move To'),
            key: 'move_to',
            icon: <DragOutlined />,
            children: moveToChildren,
        }] : []),
        ...(!isDefaultFolder ? [{label: t('Delete Group'), key: 'delete_group', icon: <DeleteOutlined />}] : [])
    ];
    
    return (
        <Dropdown trigger={['contextMenu']}
                  menu={{
                      items: contextMenusGroup,
                      onClick: (e) => {
                          // 处理 "移动到" 子菜单点击
                          if (e.key.startsWith('move_to_folder-')) {
                              const targetFolderKey = e.key.replace('move_to_', '');
                              onMoveToFolder?.(nodeData.key, targetFolderKey);
                          } else {
                              onMenuClick(e.key, nodeData.key);
                          }
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


function ModTreeViewSwitch({nodeData, onCountLabelUpdate}) {
    // 使用模块级别缓存获取初始状态（同步，不会因滚动丢失）
    const [checked, setChecked] = useState(() =>
        getPendingEnabled(nodeData.modId, nodeData.enabled)
    );

    // 同步外部 prop 变化（当 Tree 完整刷新时）
    React.useEffect(() => {
        const cachedValue = getPendingEnabled(nodeData.modId, nodeData.enabled);
        setChecked(cachedValue);

        // 当数据库值与缓存值同步后，清除缓存
        if (nodeData.enabled === cachedValue) {
            clearPendingEnabled(nodeData.modId);
        }
    }, [nodeData.enabled, nodeData.modId]);

    const onSwitchChange = async (newChecked: boolean) => {
        // 1. 立即更新本地状态和模块缓存（乐观更新）
        setChecked(newChecked);
        setPendingEnabled(nodeData.modId, newChecked);

        // 2. 异步更新数据库（不清除缓存，等 treeData 刷新后自动清除）
        const viewModel = await IoC.get(HomeViewModel);
        await viewModel.setModEnabled(nodeData.modId, newChecked);

        // 3. 只更新计数标签
        if (onCountLabelUpdate) {
            await onCountLabelUpdate();
        }
    };

    return (
        <Switch checked={checked}
                size={"small"}
                onChange={(checked) => onSwitchChange(checked)}
                style={{marginRight: "8px", marginTop: "-3px"}}
        />
    );
}


function ModTreeViewVersionSelect({nodeData}) {

    const [fetching, setFetching] = useState(false);
    const [options, setOptions] = useState<any[]>([]);
    // 使用本地状态追踪当前选中的版本，解决选择后下拉框显示不更新的问题
    const [selectedVersion, setSelectedVersion] = useState<string>(
        nodeData.usedVersion === "" ? nodeData.fileVersion : nodeData.usedVersion
    );
    // 追踪是否正在处理版本切换（下载中）
    const [isProcessing, setIsProcessing] = useState(() => getVersionSwitchLock(nodeData.modId).isProcessing);

    // 同步外部 prop 变化（当 Tree 完整刷新时）
    React.useEffect(() => {
        setSelectedVersion(nodeData.usedVersion === "" ? nodeData.fileVersion : nodeData.usedVersion);
    }, [nodeData.usedVersion, nodeData.fileVersion]);

    // 同步锁定状态
    React.useEffect(() => {
        const lock = getVersionSwitchLock(nodeData.modId);
        setIsProcessing(lock.isProcessing);
    }, [nodeData.modId]);

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
        const newVersion = fileInfo.version || fileInfo.filename;
        
        // 检查是否有正在进行的版本切换
        const currentLock = getVersionSwitchLock(nodeData.modId);
        if (currentLock.isProcessing) {
            // 如果选择的版本与正在处理的版本相同，忽略此次点击
            if (currentLock.currentVersion === newVersion) {
                return;
            }
            // 如果选择了不同的版本，仍然阻止，但更新显示
            await StatusBar.warning(`${t("Version switch in progress")}: ${nodeData.title}`);
            return;
        }
        
        // 设置锁定状态
        setVersionSwitchLock(nodeData.modId, { isProcessing: true, currentVersion: newVersion });
        setIsProcessing(true);
        
        // 立即更新本地状态（乐观更新），让下拉框立即显示新选中的版本
        setSelectedVersion(newVersion);
        
        await StatusBar.info(`${t("Switch Version")}: ${nodeData.title} ${newVersion}`);

        try {
            const viewModel = await IoC.get(HomeViewModel);
            // Use profileModId (profile_mods.id) instead of key
            if (nodeData.profileModId) {
                await viewModel.setModUsedVersion(nodeData.profileModId, fileInfo.version);
            }

            const modItem = await getModById(nodeData.modId);
            if (!modItem) {
                clearVersionSwitchLock(nodeData.modId);
                setIsProcessing(false);
                return;
            }

            // Update modItem with new version and download info
            const updatedModItem: CompleteModData = {
                ...modItem,
                version: {
                    ...modItem.version!,
                    currentVersion: newVersion
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
            await ModUpdateService.updateModFile(updatedModItem);
        } catch (error) {
            console.error("版本切换失败:", error);
            await StatusBar.error(`${t("Version switch failed")}: ${nodeData.title}`);
        } finally {
            // 清除锁定状态
            clearVersionSwitchLock(nodeData.modId);
            setIsProcessing(false);
        }
    }

    return (
        <Select size={"small"}
                suffixIcon={null}
                popupMatchSelectWidth={false}
                style={{marginRight: "8px", width: "80px"}}
                value={selectedVersion}
                notFoundContent={fetching ? <Spin size="small"/> : null}
                options={options}
                onChange={onChange}
                onOpenChange={onDropdownVisibleChange}
                disabled={isProcessing}
                loading={isProcessing}
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
                                <span className="text-red mr-4">
                                    <ExclamationCircleOutlined/>
                                </span>
                </Tooltip>
            }

            {
                isLocalNoFound &&
                <Tooltip title={t("File Not Found")}>
                                <span className="text-red mr-4">
                                    <ExclamationCircleOutlined/>
                                </span>
                </Tooltip>
            }

        </>
    )
}


function ModTreeViewProgressBackground({nodeData, children, ...restProps}) {
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

    const isDownloading = downloadProgress !== 100;

    // 渐变背景样式：从左到右的进度色块
    const progressStyle: React.CSSProperties = isDownloading ? {
        background: `linear-gradient(
            90deg,
            rgba(22, 119, 255, 0.35) 0%,
            rgba(22, 119, 255, 0.2) ${downloadProgress * 0.8}%,
            rgba(22, 119, 255, 0.05) ${downloadProgress}%,
            transparent ${downloadProgress}%
        )`,
    } : {};

    return (
        <div style={{
            width: "calc(100% - 20px)",
            display: "flex",
            alignItems: "center",
            borderRadius: "4px",
            padding: "2px 4px",
            transition: "background 0.3s ease",
            ...progressStyle
        }} {...restProps}>
            {children}
        </div>
    );
}


function ModTreeViewProgressPercent({nodeData}) {
    const [downloadProgress, setDownloadProgress] = useState(nodeData.downloadProgress);

    useFilteredEventListener(
        'mod-treeview-update',
        (payload) => payload.modId === nodeData.modId,
        (payload) => {
            setDownloadProgress(payload.data.download?.downloadProgress || 100);
        },
        [nodeData.modId]
    );

    if (downloadProgress === 100) return null;

    return (
        <Tag color="blue">{downloadProgress.toFixed(2)}%</Tag>
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


export function TreeViewItem(
    nodeData: any, 
    onMenuClick: any, 
    onCountLabelUpdate?: () => Promise<void>,
    folders?: FolderInfo[],
    onMoveToFolder?: (sourceKey: string, targetFolderKey: string) => void
) {
    // 构建"移动到"子菜单，过滤掉默认文件夹(folder-1, folder-2)
    const moveToChildren: MenuProps['items'] = folders
        ?.filter(f => {
            const folderId = parseInt(f.key.split('-')[1]);
            // 不能移动到默认文件夹
            return folderId !== 1 && folderId !== 2;
        })
        .map(f => ({
            key: `move_to_${f.key}`,
            label: f.title,
            icon: <FolderOutlined />,
        })) || [];

    const contextMenus: MenuProps['items'] = [
        {label: t('Rename'), key: 'rename', icon: <EditOutlined />},
        {label: t('Update'), key: 'update', icon: <SyncOutlined />},
        ...(moveToChildren.length > 0 ? [{
            label: t('Move To'),
            key: 'move_to',
            icon: <DragOutlined />,
            children: moveToChildren,
        }] : []),
        {label: t('Delete'), key: 'delete', icon: <DeleteOutlined />},
        {label: t('Copy Link'), key: 'copy_link', icon: <LinkOutlined />},
        {label: t('Export'), key: 'export', icon: <ExportOutlined />}
    ];

    if (nodeData.isLeaf) {
        return (
            <Dropdown trigger={['contextMenu']}
                      menu={{
                          items: contextMenus,
                          onClick: (e) => {
                              // 处理 "移动到" 子菜单点击
                              if (e.key.startsWith('move_to_folder-')) {
                                  const targetFolderKey = e.key.replace('move_to_', '');
                                  onMoveToFolder?.(nodeData.key, targetFolderKey);
                              } else {
                                  onMenuClick(e.key, nodeData.key);
                              }
                          }
                      }}>
                <ModTreeViewProgressBackground nodeData={nodeData}>
                    <ModTreeViewSwitch nodeData={nodeData} onCountLabelUpdate={onCountLabelUpdate}/>

                    {nodeData.sourceType === ModSourceType.Modio &&
                        <ModTreeViewVersionSelect nodeData={nodeData}/>
                    }

                    {
                        //nodeData.sourceType === ModSourceType.Modio &&
                        <ModTreeViewWarring nodeData={nodeData}/>
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

                    {/* 右侧区域：tags 靠右 */}
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                        {nodeData.tags.map(tagName => (
                            <Tag key={tagName}>{tagName}</Tag>
                        ))}

                        {nodeData.required === "RequiredByAll" && (
                            <Tag color="orange">RequiredByAll</Tag>)}

                        {nodeData.versions.length > 0 && nodeData.versions[0] !== "1.39" && (
                            <Tag color="red">{nodeData.versions[0]}</Tag>)}

                        {nodeData.approval === "Verified" ? (
                                <Tag color="blue" title={t("Verified")}>V</Tag>) :
                            nodeData.approval === "Approved" ? (
                                    <Tag color="green" title={t("Approved")}>A</Tag>) :
                                nodeData.approval === "Sandbox" ? (
                                        <Tag color="orange" title={t("Sandbox")}>S</Tag>) :
                                    null}

                        {nodeData.sourceType === ModSourceType.Modio &&
                            <ModTreeViewProgressPercent nodeData={nodeData}/>
                        }
                    </span>
                </ModTreeViewProgressBackground>
            </Dropdown>
        );
    } else {
        return (
            <ModTreeViewFolder 
                nodeData={nodeData} 
                onMenuClick={onMenuClick}
                folders={folders}
                onMoveToFolder={onMoveToFolder}
            />
        );
    }
}
