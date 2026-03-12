import {t} from "i18next";
import {emitEvent, emitVoidEvent, onceEvent} from "@/events";
import {ModioApi} from "@/apis/modio";
import {ModcatApi} from "@/apis/modcat";
import {HomeViewModel} from "@/pages/HomePage/HomeViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import {AddModType} from "@/dialogs/AddModDialog/index.tsx";
import StatusBar from "@/components/StatusBar.tsx";
import {StorageAPI} from "@/storage";
import {asyncPoolAll} from "@/utils/AsyncPool";
import {message} from "antd";
import type {AddModFromUrlResult} from "@/services/HomeService.ts";
import type {AddModFromPathResult} from "@/services/HomeService.ts";

let windowInstance: WebviewWindow;

export async function openWindow(addModType: string = AddModType.LOCAL,
                                 groupId: number = 0,
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
            case AddModType.SUBSCRIBED: {
                if (result.modInfoList && result.modInfoList.length > 0) {
                    const batchResult = await vm.addModsFromSubscribed(result.modInfoList, result.groupId);
                    if (batchResult.existsCount > 0) {
                        message.warning(t("Mod Already Exists") + ` (${batchResult.existsCount} ${t("in current list")})`);
                    }
                    if (batchResult.errorCount > 0) {
                        message.warning(t("Some mods failed to add") + `: ${batchResult.errorCount}/${result.modInfoList.length}`);
                    }
                }
                break;
            }
            case AddModType.ONLINE: {
                const list = result.list;
                const { results, errors } = await asyncPoolAll(
                    list,
                    (item) => vm.addModFromUrl(item, result.groupId),
                    5
                );
                const existsCount = (results as AddModFromUrlResult[]).filter((r) => r?.status === "exists").length;
                if (existsCount > 0) {
                    message.warning(t("Mod Already Exists") + ` (${existsCount} ${t("in current list")})`);
                }
                if (errors.length > 0) {
                    message.warning(t("Some mods failed to add") + `: ${errors.length}/${list.length}`);
                }
            }
                break;
            case AddModType.LOCAL: {
                const list = result.list;
                const pathResults: AddModFromPathResult[] = [];
                for (const item of list) {
                    pathResults.push(await vm.addModFromPath(item, result.groupId));
                }
                const existsCount = pathResults.filter((r) => r.status === "exists").length;
                if (existsCount > 0) {
                    message.warning(t("Mod Already Exists") + ` (${existsCount} ${t("in current list")})`);
                }
            }
                break;
            default:
                break;
        }

        await StatusBar.success(t("Add Complete"));
        await emitVoidEvent('mods-added');
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

    openWindow(AddModType.ONLINE, 0, text).then();
}


export async function initClipboardWatcher() {
    const settings = await StorageAPI.getSettings();
    const enabled = await settings.getClipboardMonitorEnabled();
    if (enabled) {
        await ClipboardApi.setClipboardWatcher(onClipboardChange);
    } else {
        // 仍然注册回调，但不启动监控
        ClipboardApi.setClipboardWatcher(onClipboardChange).then(() => {
            ClipboardApi.stopClipboardWatcher();
        });
    }
}
