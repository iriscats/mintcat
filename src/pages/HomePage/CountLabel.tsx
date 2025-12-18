import React from "react";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {listen} from "@tauri-apps/api/event";
import {StorageAPI} from "@/storage";

export const CountLabel = () => {
    const [enableCount, setEnableCount] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);

    React.useEffect(() => {
        const fetchData = async () => {
            const profileVM = await IoC.get(ProfileViewModel);
            const activeRoot = await profileVM.getActiveProfileTreeRoot();

            // Use ProfileTreeService to get mod list
            const treeService = (profileVM as any).profileService.getTreeService();
            const subModList = await treeService.getModsForTree(activeRoot);

            setEnableCount(subModList.filter(mod => mod.enabled).length);
            setTotalCount(subModList.length);
        };

        listen("tree-view-count-label-update", async () => {
            await fetchData();
        }).then();

        fetchData().then();
    }, []);

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
