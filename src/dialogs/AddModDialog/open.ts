import {t} from "i18next";
import {emitEvent, onceEvent} from "@/events";
import {ModioApi} from "@/apis/modio";
import {HomeViewModel} from "@/pages/HomePage/HomeViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {TreeViewModel} from "@/pages/HomePage/TreeViewModel.ts";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import {ProfileTreeGroupType} from "@/storage/db/Schema.ts";
import {AddModType} from "@/dialogs/AddModDialog/index.tsx";
import { ProfileService } from "@/services/ProfileService.ts";
import StatusBar from "@/components/StatusBar.tsx";

let windowInstance: WebviewWindow;

export async function openWindow(addModType: string = AddModType.LOCAL,
                                 groupId: number = ProfileTreeGroupType.LOCAL,
                                 text: string = ""): Promise<void> {

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
            case AddModType.MODIO: {
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
        TreeViewModel.updateTreeView();

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
    const links = text.split("\n");
    for (const link of links) {
        if (!ModioApi.parseModLinks(link)) {
            return;
        }
    }

    // Get current active profile's modio folder ID using ProfileService
    const profileService = new ProfileService();
    const modioFolderId = await profileService.getActiveProfileFolderId('modio');

    if (!modioFolderId) {
        console.warn("[AddModDialog] Modio folder not found for active profile");
        return;
    }

    openWindow(AddModType.MODIO, modioFolderId, text).then();
}


export function initClipboardWatcher() {
    ClipboardApi.setClipboardWatcher(onClipboardChange).then();
}

