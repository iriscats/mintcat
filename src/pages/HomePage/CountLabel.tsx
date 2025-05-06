import React from "react";
import {HomeViewModel} from "@/vm/HomeViewModel.ts";
import {listen} from "@tauri-apps/api/event";

export const CountLabel = () => {
    const [enableCount, setEnableCount] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);

    React.useEffect(() => {
        const fetchData = async () => {
            const vm = await HomeViewModel.getInstance();
            if (!vm.ActiveProfile)
                return;

            const subModList = vm.ActiveProfile.getModList(vm.ModList);
            setEnableCount(subModList.Mods.filter(mod => mod.enabled).length);
            setTotalCount(subModList.Mods.length);
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
