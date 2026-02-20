import {t} from "i18next";
import React, {useState} from "react";
import {Dropdown, MenuProps, Select, Spin, Switch, Tag, theme, Tooltip} from "antd";
import {
    ClockCircleOutlined,
    DeleteOutlined,
    DragOutlined,
    EditOutlined,
    ExclamationCircleOutlined,
    ExportOutlined,
    FolderAddOutlined,
    FolderOutlined,
    LinkOutlined,
    LockOutlined,
    PlusCircleOutlined,
    SyncOutlined,
    VerticalAlignTopOutlined,
    WarningOutlined,
} from "@ant-design/icons";
import {open} from "@tauri-apps/plugin-shell";
import {emitEvent, useFilteredEventListener} from "@/events";
import {ModSourceType} from "@/storage/db/Schema.ts";
import {MODCAT_PLATFORM, ModcatApi} from "@/apis/modcat";
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
import {ConflictService} from "@/services/ConflictService";

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
    // 过滤掉当前文件夹，避免移动到自身
    const moveToChildren: MenuProps['items'] = folders
        ?.filter(f => f.key !== nodeData.key)
        .map(f => ({
            key: `move_to_${f.key}`,
            label: f.title,
            icon: <FolderOutlined />,
        })) || [];

    const contextMenusGroup: MenuProps['items'] = [
        {label: t('Add Mod'), key: 'add_mod', icon: <PlusCircleOutlined />},
        {label: t('Add New Group'), key: 'add_new_group', icon: <FolderAddOutlined />},
        {label: t('Add Sub Group'), key: 'add_sub_group', icon: <FolderAddOutlined />},
        {label: t('Rename Group'), key: 'rename_group', icon: <EditOutlined />},
        ...(moveToChildren.length > 0 ? [{
            label: t('Move To'),
            key: 'move_to',
            icon: <DragOutlined />,
            children: moveToChildren,
        }] : []),
        {label: t('Delete Group'), key: 'delete_group', icon: <DeleteOutlined />}
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

        // 2. 先更新数据库与 editTime（profile 配置变更），再发事件
        // 顺序重要：HomePage 监听 mod-enabled-change 后执行 refreshUnsavedState()，若先发事件则 editTime 尚未更新，第一次点击不会显示「未保存」
        const viewModel = await IoC.get(HomeViewModel);
        await viewModel.setModEnabled(nodeData.modId, newChecked, nodeData.profileModId);

        await emitEvent("mod-enabled-change", {
            modId: nodeData.modId,
            enabled: newChecked
        });

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
    // 计算当前应显示的版本：usedVersion 非空时用 usedVersion，否则用 fileVersion
    const resolveDisplayVersion = (usedVer: string, fileVer: string) => {
        if (usedVer && usedVer !== "") return usedVer;
        if (fileVer && fileVer !== "" && fileVer !== "-") return fileVer;
        return "-";
    };
    // 使用本地状态追踪当前选中的版本，解决选择后下拉框显示不更新的问题
    const [selectedVersion, setSelectedVersion] = useState<string>(
        resolveDisplayVersion(nodeData.usedVersion, nodeData.fileVersion)
    );
    // 追踪是否正在处理版本切换（下载中）
    const [isProcessing, setIsProcessing] = useState(() => getVersionSwitchLock(nodeData.modId).isProcessing);
    // 追踪版本是否被锁定（用户手动选择了非最新版本）
    const [isVersionLocked, setIsVersionLocked] = useState<boolean>(
        !!(nodeData.usedVersion && nodeData.usedVersion !== "")
    );
    // 存储最新版本号，用于判断用户选择的是否为最新版本
    const latestVersionRef = React.useRef<string>("");

    // 同步外部 prop 变化（当 Tree 完整刷新时）
    React.useEffect(() => {
        setSelectedVersion(resolveDisplayVersion(nodeData.usedVersion, nodeData.fileVersion));
        setIsVersionLocked(!!(nodeData.usedVersion && nodeData.usedVersion !== ""));
    }, [nodeData.usedVersion, nodeData.fileVersion]);

    // 同步锁定状态
    React.useEffect(() => {
        const lock = getVersionSwitchLock(nodeData.modId);
        setIsProcessing(lock.isProcessing);
    }, [nodeData.modId]);

    // 监听 mod-treeview-update 事件，当 mod 下载/更新完成后同步版本显示
    // 这解决了 mod 添加后版本数据异步更新导致显示为空的问题
    useFilteredEventListener(
        'mod-treeview-update',
        (payload) => payload.modId === nodeData.modId,
        (payload) => {
            const updatedVersion = payload.data.version?.currentVersion;
            if (updatedVersion && updatedVersion !== "-" && !isVersionLocked) {
                setSelectedVersion(updatedVersion);
            }
        },
        [nodeData.modId, isVersionLocked]
    );

    let fileInfos: ModFile[] = [];
    let modcatVersions: any[] = [];
    
    const onDropdownVisibleChange = async (visible: boolean) => {
        if (visible) {
            setFetching(true);
            const optionList = [];

            if (nodeData.sourceType === MODCAT_PLATFORM) {
                // ModCat: 通过 getModDetail 获取版本信息
                const modDetail = await ModcatApi.getModDetail(nodeData.nameId);
                if (modDetail?.ModVersionEntities) {
                    modcatVersions = modDetail.ModVersionEntities
                        .filter(v => v.FilesId) // 只要有文件 ID 就可以
                        .sort((a, b) => {
                            const dateA = new Date(a.CreatedAt || 0).getTime();
                            const dateB = new Date(b.CreatedAt || 0).getTime();
                            return dateB - dateA; // 最新版本在前
                        });
                    
                    for (const version of modcatVersions) {
                        optionList.push({
                            value: JSON.stringify(version),
                            label: version.VersionNumber || version.VersionId
                        });
                    }
                }
            } else {
                // mod.io: 使用 platformId 获取版本信息
                fileInfos = await ModioApi.getModFiles(nodeData.platformId);
                for (const fileInfo of fileInfos) {
                    optionList.push({
                        value: JSON.stringify(fileInfo),
                        label: fileInfo.version ? fileInfo.version : fileInfo.filename
                    });
                }
                optionList.reverse();
            }

            // 记录最新版本号（列表中第一个即为最新）
            if (optionList.length > 0) {
                latestVersionRef.current = optionList[0].label;
            }

            setFetching(false);
            setOptions(optionList);
        }
    }

    const onChange = async (value: string) => {
        const parsedValue = JSON.parse(value);
        
        // 根据 sourceType 提取版本号
        const isModcat = nodeData.sourceType === MODCAT_PLATFORM;
        const newVersion = isModcat 
            ? (parsedValue.VersionNumber || parsedValue.VersionId)
            : (parsedValue.version || parsedValue.filename);
        
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
        
        // 判断用户选择的是否为最新版本
        const isLatestVersion = latestVersionRef.current !== "" && newVersion === latestVersionRef.current;
        
        // 立即更新本地状态（乐观更新），让下拉框立即显示新选中的版本
        setSelectedVersion(newVersion);
        // 立即更新锁定图标状态
        setIsVersionLocked(!isLatestVersion);
        
        await StatusBar.info(`${t("Switch Version")}: ${nodeData.title} ${newVersion}`);

        try {
            const viewModel = await IoC.get(HomeViewModel);
            // Use profileModId (profile_mods.id) instead of key
            // 选择最新版本时清空 usedVersion（解锁），否则设置为选定版本（锁定）
            if (nodeData.profileModId) {
                await viewModel.setModUsedVersion(
                    nodeData.profileModId,
                    isLatestVersion ? "" : newVersion
                );
            }

            const modItem = await getModById(nodeData.modId);
            if (!modItem) {
                clearVersionSwitchLock(nodeData.modId);
                setIsProcessing(false);
                return;
            }

            // 根据 sourceType 构建下载 URL 和文件大小
            let downloadUrl: string;
            let fileSize: number;
            
            if (isModcat) {
                // ModCat: 使用 FilesId 构建下载 URL
                downloadUrl = parsedValue.FilesId 
                    ? `https://modcat.top:8089/api/Files/DownloadFileGet?FileId=${encodeURIComponent(parsedValue.FilesId)}&NoCount=true`
                    : "";
                fileSize = parseInt(parsedValue.Files?.Size || "0", 10);
            } else {
                // mod.io: 使用原有的下载信息
                downloadUrl = parsedValue.download?.binary_url || "";
                fileSize = parsedValue.filesize || 0;
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
                    downloadUrl: downloadUrl,
                    downloadProgress: 0,
                    fileSize: fileSize,
                }
            };

            await emitEvent("mod-treeview-update", {
                modId: updatedModItem.modId!,
                data: updatedModItem
            });

            // 通知 HomePage 标记未保存变更，让保存按钮高亮
            await emitEvent("mod-enabled-change", {
                modId: nodeData.modId,
                enabled: getPendingEnabled(nodeData.modId, nodeData.enabled)
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
        <>
            <Select size={"small"}
                    suffixIcon={null}
                    popupMatchSelectWidth={false}
                    style={{marginRight: "4px", width: "80px"}}
                    value={selectedVersion}
                    notFoundContent={fetching ? <Spin size="small"/> : null}
                    options={options}
                    onChange={onChange}
                    onOpenChange={onDropdownVisibleChange}
                    disabled={isProcessing}
                    loading={isProcessing}
            />
            {isVersionLocked && (
                <Tooltip title={t("Version locked, switch to latest version to unlock")}>
                    <span style={{color: "orange", marginRight: "4px", cursor: "pointer"}}>
                        <LockOutlined/>
                    </span>
                </Tooltip>
            )}
        </>
    );
}


function ModTreeViewWarring({nodeData}) {
    // 使用 ref 存储 nodeData 以便在回调中访问最新值
    const nodeDataRef = React.useRef(nodeData);
    nodeDataRef.current = nodeData;

    const checkExpired = () => {
        const data = nodeDataRef.current;
        // 支持 Modio 和 ModCat 类型的在线 mod
        if (data.sourceType !== ModSourceType.Modio && data.sourceType !== MODCAT_PLATFORM) {
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
        // 支持 Modio 和 ModCat 类型的在线 mod
        return (data.sourceType === ModSourceType.Modio || data.sourceType === MODCAT_PLATFORM) &&
            data.onlineAvailable === false;
    }

    const checkConflict = () => {
        return ConflictService.hasConflict(nodeDataRef.current.modId);
    }

    const [isExpired, setIsExpired] = useState(checkExpired());
    const [isLocalNoFound, setIsLocalNoFound] = useState(checkLocalNoFound());
    const [isOnlineUnavailable, setIsOnlineUnavailable] = useState(checkOnlineUnavailable());
    const [hasConflict, setHasConflict] = useState(checkConflict());

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

    // 监听冲突更新事件
    useFilteredEventListener(
        'mod-conflict-update',
        (payload) => payload.modId === nodeData.modId,
        () => {
            setHasConflict(checkConflict());
        },
        [nodeData.modId]
    );

    // 生成冲突提示信息
    const getConflictTooltip = () => {
        const conflict = ConflictService.getConflict(nodeData.modId);
        if (!conflict) return t("File conflict with other mods");
        
        const fileCount = conflict.conflictingFiles.length;
        const modCount = conflict.conflictingMods.length;
        return `${t("File conflict")}: ${fileCount} ${t("files conflict with")} ${modCount} ${t("other mods")}`;
    };

    return (
        <>
            {
                hasConflict &&
                <Tooltip title={getConflictTooltip()}>
                                <span style={{color: "#faad14", marginRight: "4px"}}>
                                    <WarningOutlined/>
                                </span>
                </Tooltip>
            }

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


function ModTreeViewLocalTitle({nodeData}) {
    // 使用模块级别缓存获取初始 enabled 状态，与 Switch 保持同步
    const [enabled, setEnabled] = useState(() =>
        getPendingEnabled(nodeData.modId, nodeData.enabled)
    );

    // 同步外部 prop 变化（当 Tree 完整刷新时）
    React.useEffect(() => {
        const cachedValue = getPendingEnabled(nodeData.modId, nodeData.enabled);
        setEnabled(cachedValue);
    }, [nodeData.enabled, nodeData.modId]);

    // 监听 enabled 状态变化事件
    useFilteredEventListener(
        'mod-enabled-change',
        (payload) => payload.modId === nodeData.modId,
        (payload) => {
            setEnabled(payload.enabled);
        },
        [nodeData.modId]
    );

    return (
        <a style={{color: enabled ? "#403c3c" : "gray"}}>
            {nodeData.title}
        </a>
    );
}


function ModTreeViewTitle({nodeData}) {

    const [downloadProgress, setDownloadProgress] = useState(nodeData.downloadProgress);
    // 使用模块级别缓存获取初始 enabled 状态，与 Switch 保持同步
    const [enabled, setEnabled] = useState(() =>
        getPendingEnabled(nodeData.modId, nodeData.enabled)
    );
    const {token} = useToken();

    // 同步外部 prop 变化（当 Tree 完整刷新时）
    React.useEffect(() => {
        const cachedValue = getPendingEnabled(nodeData.modId, nodeData.enabled);
        setEnabled(cachedValue);
    }, [nodeData.enabled, nodeData.modId]);

    // ✅ 使用 useFilteredEventListener 自动清理监听器
    useFilteredEventListener(
        'mod-treeview-update',
        (payload) => payload.modId === nodeData.modId,
        (payload) => {
            setDownloadProgress(payload.data.download?.downloadProgress || 100);
        },
        [nodeData.modId]
    );

    // 监听 enabled 状态变化事件
    useFilteredEventListener(
        'mod-enabled-change',
        (payload) => payload.modId === nodeData.modId,
        (payload) => {
            setEnabled(payload.enabled);
        },
        [nodeData.modId]
    );

    return (
        <a style={{
            color: enabled &&
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
    // 构建"移动到"子菜单
    const moveToChildren: MenuProps['items'] = folders
        ?.map(f => ({
            key: `move_to_${f.key}`,
            label: f.title,
            icon: <FolderOutlined />,
        })) || [];

    const contextMenus: MenuProps['items'] = [
        {label: t('Rename'), key: 'rename', icon: <EditOutlined />},
        {label: t('Update'), key: 'update', icon: <SyncOutlined />},
        {label: t('Pin to Top'), key: 'pin_to_top', icon: <VerticalAlignTopOutlined />},
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

                    {(nodeData.sourceType === ModSourceType.Modio || nodeData.sourceType === MODCAT_PLATFORM) &&
                        <ModTreeViewVersionSelect nodeData={nodeData}/>
                    }

                    {
                        //nodeData.sourceType === ModSourceType.Modio &&
                        <ModTreeViewWarring nodeData={nodeData}/>
                    }

                    {
                        nodeData.sourceType === ModSourceType.Local &&
                        <ModTreeViewLocalTitle nodeData={nodeData} />
                    }
                    {
                        (nodeData.sourceType === ModSourceType.Modio || nodeData.sourceType === MODCAT_PLATFORM) &&
                        <ModTreeViewTitle nodeData={nodeData}/>
                    }

                    {/* 右侧区域：tags 靠右 */}
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                        {nodeData.tags.map(tagName => (
                            <Tag key={tagName}>{tagName}</Tag>
                        ))}

                        {nodeData.required === "RequiredByAll" && (
                            <Tag color="orange">RequiredByAll</Tag>)}

                        {nodeData.versions.length > 0 && nodeData.versions[0] !== "1.40" && (
                            <Tag color="red">{nodeData.versions[0]}</Tag>)}

                        {nodeData.approval === "Verified" ? (
                                <Tag color="blue" title={t("Verified")}>V</Tag>) :
                            nodeData.approval === "Approved" ? (
                                    <Tag color="green" title={t("Approved")}>A</Tag>) :
                                nodeData.approval === "Sandbox" ? (
                                        <Tag color="orange" title={t("Sandbox")}>S</Tag>) :
                                    null}

                        {(nodeData.sourceType === ModSourceType.Modio || nodeData.sourceType === MODCAT_PLATFORM) &&
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
