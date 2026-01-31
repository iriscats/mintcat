import { ITask, ITaskContext, Task } from 'tauri-plugin-task-queue-api';
import { ProfileViewModel } from '@/dialogs/ProfileEditDialog/ProfileViewModel';
import { IoC } from '@/core/IoC.ts';
import { StorageAPI } from '@/storage';
import { TimeUtils } from '@/utils/TimeUtils';
import { ModioApi } from '@/apis/modio';
import { ModSourceType } from '@/models/mod/types';
import { t } from 'i18next';

@Task({
    type: 'check_mod_update',
    name: '检查模组更新',
    description: '在线检查模组是否有更新',
    schema: null,
    estimatedDuration: 30
})
export class CheckModUpdateTask implements ITask {
    async run(context: ITaskContext): Promise<void> {
        const TOTAL_STEPS = 3;

        // Step 0: Check modio OAuth
        const oAuthDAO = await StorageAPI.getOAuths();
        const modioOAuth = await oAuthDAO.getModioOAuth();
        if (!modioOAuth || !modioOAuth.oauth) {
            await context.setMessage(t("No mod.io OAuth, skip update check"));
            await context.updateProgress(100);
            return;
        }

        // Step 1: Load mod list
        await context.setStep('加载模组列表', 1, TOTAL_STEPS);
        await context.setMessage(t("Mod Update Check Start"));

        const profileVM = await IoC.get(ProfileViewModel);
        const lastUpdate = await profileVM.getActiveProfileLastUpdate();
        const updateTime = lastUpdate || (TimeUtils.nowSeconds() - 60 * 60 * 24 * 30);

        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();
        const modIdList = [];
        for (const mod of allMods) {
            if (mod.sourceType === ModSourceType.Modio) {
                modIdList.push(mod.platformId);
            }
        }

        if (modIdList.length === 0) {
            await context.setMessage('没有需要检查的模组');
            await context.updateProgress(100);
            return;
        }

        // Step 2: Fetch events from mod.io
        await context.setStep('获取更新信息', 2, TOTAL_STEPS);
        await context.setMessage(`正在检查 ${modIdList.length} 个模组...`);

        const events = await ModioApi.getEvents(updateTime, modIdList.join(","));

        // Step 3: Process events
        await context.setStep('处理更新信息', 3, TOTAL_STEPS);
        const totalEvents = events.length;

        for (let i = 0; i < totalEvents; i++) {
            if (context.checkCancelled()) {
                throw new Error('Task cancelled');
            }

            const event = events[i];
            await context.setMessage(`处理事件 (${i + 1}/${totalEvents})`);
            await context.updateProgress(Math.floor((i / totalEvents) * 100));

            switch (event.event_type) {
                case "MODFILE_CHANGED": {
                    const mod = allMods.find(m => m.platformId === event.mod_id);
                    if (mod) {
                        await modsApi.upsertModStatus({
                            modId: mod.modId!,
                            onlineUpdateDate: TimeUtils.fromModio(event.date_added),
                            lastUpdateDate: 0
                        });
                    }
                    break;
                }
                case "MOD_UNAVAILABLE":
                case "MOD_DELETED": {
                    const mod = allMods.find(m => m.platformId === event.mod_id);
                    if (mod) {
                        await modsApi.upsertModStatus({
                            modId: mod.modId!,
                            isOnlineAvailable: false,
                            lastUpdateDate: TimeUtils.fromModio(event.date_added),
                            onlineUpdateDate: TimeUtils.fromModio(event.date_added)
                        });
                    }
                    break;
                }
            }
        }

        await profileVM.setActiveProfileLastUpdate(TimeUtils.nowSeconds());

        await context.setMessage(t("Mod Update Check Finish"));
        await context.updateProgress(100);
    }
}
