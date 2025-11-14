import React from "react";
import {TreeViewModel} from "./TreeViewModel.ts";
import {listen} from "@tauri-apps/api/event";
import {StorageAPI} from "@/storage";

export const CountLabel = () => {
    const [enableCount, setEnableCount] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);

    React.useEffect(() => {
        const fetchData = async () => {
            const vm = await TreeViewModel.getInstance();
            if (!vm.ActiveProfile)
                return;

            const modsApi = await StorageAPI.getMods();
            const allMods = await modsApi.getAllMods();
            const subModList = vm.ActiveProfile.getModList(allMods);
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
