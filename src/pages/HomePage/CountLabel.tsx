import React from "react";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {useEventListener} from "@/events";
import {StorageAPI} from "@/storage";

export const CountLabel = () => {
    const [enableCount, setEnableCount] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);

    const fetchData = React.useCallback(async () => {
        const profileVM = await IoC.get(ProfileViewModel);
        const activeRoot = await profileVM.getActiveProfileTreeRoot();

        // Use ProfileTreeService to get mod list
        const treeService = (profileVM as any).profileService.getTreeService();
        const subModList = await treeService.getModsForTree(activeRoot);

        setEnableCount(subModList.filter(mod => mod.enabled).length);
        setTotalCount(subModList.length);
    }, []);

    // ✅ 使用 useEventListener 自动管理清理
    useEventListener("tree-view-count-label-update", fetchData);

    React.useEffect(() => {
        fetchData().then();
    }, [fetchData]);

    return (
        <span style={{
            display: 'flex',
            alignItems: 'center',
            color: '#888',
            marginRight: '20px',
        }}>
            {enableCount} / {totalCount}
        </span>
    )
}
