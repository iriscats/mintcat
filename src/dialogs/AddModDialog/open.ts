import {t} from "i18next";
import {once} from "@tauri-apps/api/event";
import {ModioApi} from "@/apis/ModioApi.ts";
import {HomeViewModel} from "@/vm/HomeViewModel.ts";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import {ProfileTreeGroupType} from "@/vm/config/ProfileList.ts";
import {AddModDialogResult, AddModType} from "@/dialogs/AddModDialog/index.tsx";

let windowInstance: WebviewWindow;

export async function openWindow(addModType: string = AddModType.LOCAL,
                                 groupId: number = ProfileTreeGroupType.LOCAL,
                                 text: string = ""): Promise<void> {

    const vm = await HomeViewModel.getInstance();

    const sendInitData = () => {
        windowInstance.emit('init-data', {
            text: text,
            groupId: groupId,
            groupOptions: groupOptions,
            addModType: addModType,
        });
    };

    const groupOptions = Array.from(vm.ActiveProfile?.groupNameMap)
        .map(([key, value]) => ({
            label: value,
            value: key,
        }));

    if (windowInstance) {
        sendInitData();
        await windowInstance.show();
        return;
    }

    windowInstance = new WebviewWindow('add-mod-dialog', {
        url: '/add_mod_dialog',
        width: 400,
        height: 580,
        title: t("Add Mod"),
        dragDropEnabled: true,
    });

    windowInstance.once('tauri://created', () => {
        sendInitData();
        //TODO: 这里需要延迟一下，否则会导致组件渲染失败
        setTimeout(sendInitData, 400);
    }).then();

    windowInstance.once('tauri://destroyed', () => {
        windowInstance = null;
    }).then();

    await once<AddModDialogResult>('add-mod-dialog-ok', async (event) => {
        const result = event.payload;
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

        await vm.updateUI();
        await windowInstance.close();
        windowInstance = null;
    });

    await once('add-mod-dialog-close', async () => {
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

    openWindow(AddModType.MODIO, ProfileTreeGroupType.MODIO, text).then();
}

ClipboardApi.setClipboardWatcher(onClipboardChange).then();

