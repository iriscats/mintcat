import { ITask, ITaskContext, Task } from 'tauri-plugin-task-queue';
import { ProfileViewModel } from '@/dialogs/ProfileEditDialog/ProfileViewModel';
import { IoC } from '@/core/IoC.ts';
import { StorageAPI } from '@/storage';
import { TimeUtils } from '@/utils/TimeUtils';
import { ModioApi } from '@/apis/modio';
import { ModcatApi, MODCAT_PLATFORM } from '@/apis/modcat';
import { ModSourceType } from '@/models/mod/types';
import { t } from 'i18next';
import { ensureInternalAssets } from '@/services/InternalAssetService';

@Task({
    type: 'check_mod_update',
    name: t('Check Mod Updates'),
    description: t('Check mod updates online'),
    schema: null,
    estimatedDuration: 30
})
export class CheckModUpdateTask implements ITask {
    async run(context: ITaskContext): Promise<void> {
        const TOTAL_STEPS = 5;

        // Step 1: Check internal assets (UE4SSL.zip, DRG.zip)
        await context.setStep(t('Check internal assets'), 1, TOTAL_STEPS);
        await ensureInternalAssets({
            setStep: context.setStep.bind(context),
            setMessage: context.setMessage.bind(context),
            updateProgress: context.updateProgress.bind(context),
            checkCancelled: context.checkCancelled.bind(context),
        });

        // Step 2: Load mod list
        await context.setStep(t('Load mod list'), 2, TOTAL_STEPS);
        await context.setMessage(t("Mod Update Check Start"));

        const profileVM = await IoC.get(ProfileViewModel);
        const lastUpdate = await profileVM.getActiveProfileLastUpdate();
        const updateTime = lastUpdate || (TimeUtils.nowSeconds() - 60 * 60 * 24 * 30);

        const modsApi = await StorageAPI.getMods();
        const profilesApi = await StorageAPI.getProfiles();
        
        // 只获取当前活跃 profile 下的 mod，而不是全部 mod
        const activeProfile = await profilesApi.getActiveProfile();
        if (!activeProfile?.id) {
            await context.setMessage(t('No active profile'));
            await context.updateProgress(100);
            return;
        }
        
        const profileModList = await profilesApi.getProfileMods(activeProfile.id);
        const modIds = profileModList.map(pm => pm.modId!).filter(id => id != null);
        
        if (modIds.length === 0) {
            await context.setMessage(t('Current profile has no mods'));
            await context.updateProgress(100);
            return;
        }
        
        const allMods = await modsApi.getBatchCompleteModData(modIds);
        
        // 分类 mod
        const modioMods = allMods.filter(m => m.sourceType === ModSourceType.Modio);
        const modcatMods = allMods.filter(m => m.sourceType === MODCAT_PLATFORM || m.sourceType === "modcat");

        if (modioMods.length === 0 && modcatMods.length === 0) {
            await context.setMessage(t('No mods to check'));
            await context.updateProgress(100);
            return;
        }

        // Step 3: Check Modio mods via events API
        await context.setStep(t('Check Modio updates'), 3, TOTAL_STEPS);
        
        if (modioMods.length > 0) {
            // Check modio OAuth
            const oAuthDAO = await StorageAPI.getOAuths();
            const modioOAuth = await oAuthDAO.getActiveUserOAuthByPlatform('mod.io');
            
            if (modioOAuth?.oauth) {
                const modIdList = modioMods.map(m => m.platformId);
                await context.setMessage(`${t('Checking Modio mods...')} (${modIdList.length} ${t('mods')})`);

                const events = await ModioApi.getEvents(updateTime, modIdList.join(","));

                for (const event of events) {
                    if (context.checkCancelled()) {
                        throw new Error('Task cancelled');
                    }

                    switch (event.event_type) {
                        case "MODFILE_CHANGED": {
                            const mod = modioMods.find(m => m.platformId === event.mod_id);
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
                            const mod = modioMods.find(m => m.platformId === event.mod_id);
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
            } else {
                await context.setMessage(t("No mod.io OAuth, skip Modio update check"));
            }
        }

        // Step 4: Check ModCat mods by fetching latest version
        await context.setStep(t('Check ModCat updates'), 4, TOTAL_STEPS);
        
        if (modcatMods.length > 0) {
            await context.setMessage(`${t('Checking ModCat mods...')} (${modcatMods.length} ${t('mods')})`);
            
            for (let i = 0; i < modcatMods.length; i++) {
                if (context.checkCancelled()) {
                    throw new Error('Task cancelled');
                }

                const mod = modcatMods[i];
                await context.setMessage(`检查 ModCat 模组 (${i + 1}/${modcatMods.length}): ${mod.displayName}`);
                await context.updateProgress(Math.floor((i / modcatMods.length) * 50) + 50);

                try {
                    const modId = mod.nameId;
                    if (!modId) continue;

                    // 获取在线详情
                    const modDetail = await ModcatApi.getModDetail(modId);
                    if (!modDetail) {
                        await modsApi.upsertModStatus({
                            modId: mod.modId!,
                            isOnlineAvailable: false
                        });
                        continue;
                    }

                    // 获取最新版本
                    const latestVersion = modDetail.ModVersionEntities
                        ?.filter(v => v.Status === "Approved" && v.FilesId)
                        .sort((a, b) => {
                            const dateA = new Date(a.CreatedAt || 0).getTime();
                            const dateB = new Date(b.CreatedAt || 0).getTime();
                            return dateB - dateA;
                        })[0];

                    if (latestVersion) {
                        const onlineUpdateDate = latestVersion.UpdatedAt
                            ? new Date(latestVersion.UpdatedAt).getTime()
                            : TimeUtils.now();
                        const currentLastUpdate = mod.status?.lastUpdateDate || 0;

                        // 如果在线更新时间比本地更新时间新，标记为有更新
                        if (onlineUpdateDate > currentLastUpdate) {
                            await modsApi.upsertModStatus({
                                modId: mod.modId!,
                                onlineUpdateDate: onlineUpdateDate,
                                isOnlineAvailable: true
                            });
                        } else {
                            await modsApi.upsertModStatus({
                                modId: mod.modId!,
                                isOnlineAvailable: true
                            });
                        }
                    }
                } catch (e) {
                    console.error(`检查 ModCat 模组更新失败: ${mod.displayName}`, e);
                }
            }
        }

        // Step 5: Complete
        await context.setStep(t('Complete'), 5, TOTAL_STEPS);
        await profileVM.setActiveProfileLastUpdate(TimeUtils.nowSeconds());

        await context.setMessage(t("Mod Update Check Finish"));
        await context.updateProgress(100);
    }
}
