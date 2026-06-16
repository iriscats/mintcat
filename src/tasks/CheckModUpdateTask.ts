import { ITask, ITaskContext, Task } from 'tauri-plugin-task-queue';
import { ProfileViewModel } from '@/dialogs/ProfileEditDialog/ProfileViewModel';
import { IoC } from '@/core/IoC.ts';
import { StorageAPI } from '@/storage';
import { TimeUtils } from '@/utils/TimeUtils';
import { ModioApi } from '@/apis/modio';
import { ModcatApi, MODCAT_PLATFORM } from '@/apis/modcat';
import { NexusModsApi, NEXUSMODS_PLATFORM } from '@/apis/nexusmods';
import type { ModcatModVersionEntity } from '@/apis/modcat/types';
import { ModSourceType } from '@/models/mod/types';
import { t } from 'i18next';
import { ensureInternalAssets } from '@/services/InternalAssetService';
import { emitEvent } from '@/events';
import { isUe4ssEnabled } from '@/utils/Ue4ssSetting';

/** 将秒级时间戳格式化为 ModCat API Since 参数格式 "YYYY-MM-DD HH:mm:ss" */
function formatSinceForModcat(seconds: number): string {
    const d = new Date(seconds * 1000);
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

/** 将批量返回的版本列表按 ModId 分组 */
function groupVersionsByModId(versions: ModcatModVersionEntity[]): Map<string, ModcatModVersionEntity[]> {
    const map = new Map<string, ModcatModVersionEntity[]>();
    for (const v of versions) {
        const id = v.ModId ?? '';
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(v);
    }
    return map;
}

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

        // Step 1: Check internal assets required by the current UE4SS setting.
        await context.setStep(t('Check internal assets'), 1, TOTAL_STEPS);
        const settings = await StorageAPI.getSettings();
        await ensureInternalAssets({
            setStep: context.setStep.bind(context),
            setMessage: context.setMessage.bind(context),
            updateProgress: context.updateProgress.bind(context),
            checkCancelled: context.checkCancelled.bind(context),
            includeUe4ss: isUe4ssEnabled(await settings.getValue('ue4ss')),
        });

        // Step 2: Load mod list
        await context.setStep(t('Load mod list'), 2, TOTAL_STEPS);
        await context.setMessage(t("Mod Update Check Start"));

        const profileVM = await IoC.get(ProfileViewModel);
        const lastUpdate = await profileVM.getActiveProfileLastUpdate();
        const updateTime = lastUpdate || (TimeUtils.nowSeconds() - 60 * 60 * 24 * 30);

        const modsApi = await StorageAPI.getMods();
        const profilesApi = await StorageAPI.getProfiles();
        const emitModTreeUpdate = async (modId: number) => {
            const updatedMod = await modsApi.getCompleteModData(modId);
            if (updatedMod) {
                await emitEvent("mod-treeview-update", {
                    modId: updatedMod.modId!,
                    data: updatedMod
                });
            }
        };
        
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
            await context.setMessage(t('profile.currentHasNoMods'));
            await context.updateProgress(100);
            return;
        }
        
        const allMods = await modsApi.getBatchCompleteModDataOptimized(modIds);
        
        // 分类 mod
        const modioMods = allMods.filter(m => m.sourceType === ModSourceType.Modio);
        const modcatMods = allMods.filter(m => m.sourceType === MODCAT_PLATFORM || m.sourceType === "modcat");
        const nexusMods = allMods.filter(m => m.sourceType === NEXUSMODS_PLATFORM);

        if (modioMods.length === 0 && modcatMods.length === 0 && nexusMods.length === 0) {
            await context.setMessage(t('No mods to check'));
            await context.updateProgress(100);
            return;
        }

        // Step 3: Check Modio mods via events API
        await context.setStep(t('Check Modio updates'), 3, TOTAL_STEPS);
        
        if (modioMods.length > 0) {
            // Check modio OAuth first; skip Modio check without auth to avoid confusing errors
            const oAuthDAO = await StorageAPI.getOAuths();
            const modioOAuth = await oAuthDAO.getActiveUserOAuthByPlatform('mod.io');
            const hasModioAuth = !!(modioOAuth?.oauth);

            if (!hasModioAuth) {
                await context.setMessage(t('modio.skipUpdateCheckNoOAuth'));
            } else if (typeof ModioApi?.getEvents !== 'function') {
                await context.setMessage(t('modio.skipUpdateCheckServiceUnavailable'));
            } else {
                try {
                    const modIdList = modioMods.map(m => m.platformId);
                    await context.setMessage(`${t('Checking Modio mods...')} (${modIdList.length} ${t('mods')})`);

                    const events = await ModioApi.getEvents(updateTime, modIdList.join(",")) ?? [];

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
                                });
                                await emitModTreeUpdate(mod.modId!);
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
                                await emitModTreeUpdate(mod.modId!);
                            }
                            break;
                        }
                    }
                }
                } catch (e) {
                    console.warn('[CheckModUpdateTask] Modio update check failed:', e);
                    await context.setMessage(t('modio.skipUpdateCheckFailed'));
                }
            }
        }

        // Step 4: Check ModCat mods via batch GetVersionsByModIds（批量获取版本，仅 Since 之后的新版本）
        await context.setStep(t('Check ModCat updates'), 4, TOTAL_STEPS);
        
        if (modcatMods.length > 0) {
            await context.setMessage(`${t('Checking ModCat mods...')} (${modcatMods.length} ${t('mods')})`);
            if (context.checkCancelled()) {
                throw new Error('Task cancelled');
            }

            const modcatModIds = modcatMods.map(m => m.nameId).filter((id): id is string => !!id);
            const sinceStr = formatSinceForModcat(updateTime);

            const allVersions = await ModcatApi.getVersionsByModIds(modcatModIds, sinceStr);
            const versionsByModId = groupVersionsByModId(allVersions);

            for (let i = 0; i < modcatMods.length; i++) {
                if (context.checkCancelled()) {
                    throw new Error('Task cancelled');
                }
                await context.updateProgress(Math.floor((i / modcatMods.length) * 50) + 50);

                const mod = modcatMods[i];
                const modId = mod.nameId;
                if (!modId) continue;

                const versions = versionsByModId.get(modId) ?? [];
                const latestVersion = versions
                    .filter(v => v.Status === "Approved" && v.FilesId)
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
                    if (onlineUpdateDate > currentLastUpdate) {
                        await modsApi.upsertModStatus({
                            modId: mod.modId!,
                            onlineUpdateDate: onlineUpdateDate,
                            isOnlineAvailable: true
                        });
                        await emitModTreeUpdate(mod.modId!);
                    } else {
                        await modsApi.upsertModStatus({
                            modId: mod.modId!,
                            isOnlineAvailable: true
                        });
                        await emitModTreeUpdate(mod.modId!);
                    }
                }
                // 若批量结果中无该 mod 的新版本，不修改状态（表示自 Since 以来无新版本）
            }
        }

        if (nexusMods.length > 0) {
            await context.setMessage(`Checking Nexus Mods... (${nexusMods.length} ${t('mods')})`);
            for (const mod of nexusMods) {
                if (context.checkCancelled()) {
                    throw new Error('Task cancelled');
                }
                try {
                    const resolved = await NexusModsApi.refreshResolvedMod(mod);
                    if (!resolved) {
                        await modsApi.upsertModStatus({ modId: mod.modId!, isOnlineAvailable: false });
                        await emitModTreeUpdate(mod.modId!);
                        continue;
                    }
                    const onlineUpdateDate = resolved.file?.uploaded_timestamp
                        ? resolved.file.uploaded_timestamp * 1000
                        : resolved.mod.updated_time
                          ? resolved.mod.updated_time * 1000
                          : TimeUtils.now();
                    await modsApi.upsertModStatus({
                        modId: mod.modId!,
                        onlineUpdateDate,
                        isOnlineAvailable: true
                    });
                    await emitModTreeUpdate(mod.modId!);
                } catch (error) {
                    console.warn('[CheckModUpdateTask] Nexus Mods update check failed:', mod.displayName, error);
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
