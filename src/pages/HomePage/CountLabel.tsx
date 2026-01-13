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
        const activeProfile = await profileVM.getActiveProfileData();

        if (!activeProfile?.id) {
            setEnableCount(0);
            setTotalCount(0);
            return;
        }

        // Get profile mods which contain the isEnabled status
        const profilesApi = await StorageAPI.getProfiles();
        const profileMods = await profilesApi.getProfileMods(activeProfile.id);

        setEnableCount(profileMods.filter(mod => mod.isEnabled).length);
        setTotalCount(profileMods.length);
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
