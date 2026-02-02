import {t} from "i18next";
import {emitEvent, onceEvent} from "@/events";
import {ModioApi} from "@/apis/modio";
import {ModcatApi} from "@/apis/modcat";
import {HomeViewModel} from "@/pages/HomePage/HomeViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import {ProfileTreeGroupType} from "@/storage/db/Schema.ts";
import {AddModType} from "@/dialogs/AddModDialog/index.tsx";
import { ProfileService } from "@/services/ProfileService.ts";
import StatusBar from "@/components/StatusBar.tsx";

let windowInstance: WebviewWindow;

export async function openWindow(addModType: string = AddModType.LOCAL,
                                 groupId: number = ProfileTreeGroupType.LOCAL,
                                 text: string = "",
                                 onUpdated?: () => Promise<void>): Promise<void> {

    const vm = await IoC.get(HomeViewModel);

    const setInitData = () => {
        localStorage.setItem('add-mod-dialog-init-data', JSON.stringify({
            text: text,
            groupId:groupId,
            addModType: addModType,
        }));
    };

    const sendInitData = async () => {
        await emitEvent("add-mod-dialog-init-data", {
            text: text,
            groupId: groupId,
            addModType: addModType,
        });
    }

    if (windowInstance) {
        await sendInitData();
        await windowInstance.show();
        return;
    }

    windowInstance = new WebviewWindow('add-mod-dialog', {
        url: 'index.html#/add_mod_dialog',
        width: 400,
        height: 580,
        title: t("Add Mod"),
        dragDropEnabled: true,
    });

    windowInstance.once('tauri://created', () => {
        setInitData();
    }).then();

    windowInstance.once('tauri://destroyed', () => {
        windowInstance = null;
    }).then();

    // ✅ 使用 onceEvent 自动管理类型安全
    await onceEvent('add-mod-dialog-ok', async (result) => {
        // result.list 去重
        result.list = [...new Set(result.list)];

        switch (result.addModType) {
            case AddModType.ONLINE: {
                const list = result.list;
                for (const item of list) {
                    await vm.addModFromUrl(item, result.groupId);
                }
            }
                break;
            case AddModType.LOCAL: {
                const list = result.list;
                for (const item of list) {
                    await vm.addModFromPath(item, result.groupId);
                }
            }
                break;
            default:
                break;
        }

        await StatusBar.success(t("Add Complete"));
        if (onUpdated) {
            await onUpdated();
        }

        await windowInstance.close();
        windowInstance = null;
    });

    await onceEvent('add-mod-dialog-close', async () => {
        await windowInstance.close();
        windowInstance = null;
    });

}

async function onClipboardChange(text: string) {
    if (!text) {
        return;
    }
    const links = text.split("\n").map(l => l.trim()).filter(l => l);
    
    // 检查是否所有链接都是有效的 mod 链接（mod.io 或 modcat）
    let hasModioLinks = false;
    let hasModcatLinks = false;
    
    for (const link of links) {
        const isModio = !!ModioApi.parseModLinks(link);
        const isModcat = ModcatApi.isModcatLink(link);
        
        if (!isModio && !isModcat) {
            return; // 存在无效链接，不处理
        }
        
        if (isModio) hasModioLinks = true;
        if (isModcat) hasModcatLinks = true;
    }

    // 如果没有任何有效链接，不处理
    if (!hasModioLinks && !hasModcatLinks) {
        return;
    }

    // Get current active profile's modio folder ID using ProfileService
    const profileService = await IoC.get(ProfileService);
    const modioFolderId = await profileService.getActiveProfileFolderId('modio');

    if (!modioFolderId) {
        console.warn("[AddModDialog] Modio folder not found for active profile");
        return;
    }

    openWindow(AddModType.ONLINE, modioFolderId, text).then();
}


export function initClipboardWatcher() {
    ClipboardApi.setClipboardWatcher(onClipboardChange).then();
}
