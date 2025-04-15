import {t} from "i18next";
import {check} from '@tauri-apps/plugin-updater';
import {relaunch} from '@tauri-apps/plugin-process';
import {MessageBox} from "../components/MessageBox.ts";


export async function checkUpdate() {
    try {
        const update = await check();
        if (!update) {
            return;
        }

        const confirmed = MessageBox.confirm({
            title: t("Update"),
            content: `
            ${t("Found Update")} ${update.version} ${update.date} ${update.body}
            `,
        });
        if (!confirmed) {
            return;
        }

        let downloaded = 0;
        let contentLength = 0;
        // alternatively we could also call update.download() and update.install() separately
        await update.downloadAndInstall((event) => {
            switch (event.event) {
                case 'Started':
                    contentLength = event.data.contentLength;
                    console.log(`started downloading ${event.data.contentLength} bytes`);
                    break;
                case 'Progress':
                    downloaded += event.data.chunkLength;
                    console.log(`downloaded ${downloaded} from ${contentLength}`);
                    break;
                case 'Finished':
                    console.log('download finished');
                    break;
            }
        });

        console.log('update installed');
        await relaunch();
    } catch (e) {
    }
}


