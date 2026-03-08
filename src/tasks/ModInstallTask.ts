import { ITask, ITaskContext, Task, SchemaBuilder } from 'tauri-plugin-task-queue';
import { ProfileViewModel } from '@/dialogs/ProfileEditDialog/ProfileViewModel';
import { IoC } from '@/core/IoC.ts';
import { ModUpdateService } from '@/services/ModUpdateService';
import { IntegrateApi } from '@/apis/IntegrateApi';
import type { CompleteModData } from '@/storage/dao/ModDAO';
import { StorageAPI } from '@/storage';
import { MessageBox } from '@/components/MessageBox';
import { ForeignPaksConfirmContent } from '@/components/ForeignPaksConfirmContent';
import React from 'react';
import { t } from 'i18next';
import { exists, stat } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { ModSourceType } from '@/models/mod/types';
import { MODCAT_PLATFORM } from '@/apis/modcat';
import { ensureInternalAssets } from '@/services/InternalAssetService';
import { md5 } from '@/utils/CryptApi';

/**
 * Check if a path is a valid unpacked mod directory
 */
async function isValidUnpackedMod(dirPath: string): Promise<boolean> {
    try {
        const fileInfo = await stat(dirPath);
        if (!fileInfo.isDirectory) {
            return false;
        }
        return await invoke<boolean>('is_valid_unpacked_mod', { path: dirPath });
    } catch (e) {
        return false;
    }
}

/**
 * Compute a deterministic hash from the full set of install inputs.
 * Any change in the mod list, cache files, UE4SS mode, or asset zips
 * produces a different hash, automatically triggering reinstallation.
 */
async function fileSizeAndMtime(filePath: string): Promise<{ size: number; mtime: number }> {
    try {
        if (filePath && await exists(filePath)) {
            const info = await stat(filePath);
            return {
                size: info.size ?? 0,
                mtime: info.mtime?.getTime() ?? 0,
            };
        }
    } catch { /* file missing or inaccessible */ }
    return { size: 0, mtime: 0 };
}

export async function computeInstallManifestHash(
    enabledMods: CompleteModData[],
    isCustomMode: boolean,
    assetPaths?: { ue4ssZipPath?: string; drgZipPath?: string; rcZipPath?: string } | null
): Promise<string> {
    const modEntries = [];
    for (const mod of enabledMods) {
        const cachePath = mod.download?.cachePath || "";
        const { size, mtime } = await fileSizeAndMtime(cachePath);
        modEntries.push({
            modId: mod.modId,
            nameId: mod.nameId || "",
            cachePath,
            fileSize: size,
            mtime,
            isUnpacked: cachePath ? await isValidUnpackedMod(cachePath) : false,
        });
    }

    const ue4ssStat = await fileSizeAndMtime(assetPaths?.ue4ssZipPath || "");
    const drgStat   = await fileSizeAndMtime(assetPaths?.drgZipPath || "");
    const rcStat    = await fileSizeAndMtime(assetPaths?.rcZipPath || "");

    const manifest = {
        mods: modEntries,
        ue4ssMode: isCustomMode ? "Custom" : "Normal",
        ue4ssZip: { path: assetPaths?.ue4ssZipPath || "", ...ue4ssStat },
        drgZip:   { path: assetPaths?.drgZipPath || "",   ...drgStat },
        rcZip:    { path: assetPaths?.rcZipPath || "",     ...rcStat },
    };
    return md5(JSON.stringify(manifest));
}

/**
 * Task: Install mods to game
 * Execution: Frontend (complex business logic, needs access to multiple ViewModels and database)
 *
 * This task performs the full mod installation workflow with stepped progress:
 * 1. Validate game environment
 * 2. Load mod configuration
 * 3. Check and update mods
 * 4. Validate mod files
 * 5. Check installation status
 * 6. Uninstall old versions
 * 7. Install .NET runtime
 * 8. Install mods
 *
 * ```
 */
@Task({
    type: 'mod_install',
    name: t('Mod installation'),
    description: t('Install mods to game directory'),
    schema: null,
    estimatedDuration: 120
})
export class ModInstallTask implements ITask {

    async run(context: ITaskContext): Promise<void> {
        const TOTAL_STEPS = 10;
        await context.setMessage(t("Start installation"));

        // Get profile view model and settings
        const profileVM = await IoC.get(ProfileViewModel);
        const settings = await StorageAPI.getSettings();

        // Step 1: Validate game environment
        await context.setStep(t('Validate game environment'), 1, TOTAL_STEPS);
        await context.setMessage(t('Checking game path...'));

        if (!await IntegrateApi.checkGamePath()) {
            throw new Error(t('Game Path Not Found'));
        }

        await context.setMessage(t('Checking if game is running...'));
        if (await IntegrateApi.checkSteamGame()) {
            throw new Error(t('Game Not Closed'));
        }

        let gameDAO = await StorageAPI.getGames();
        let activeGame = await gameDAO.getActiveGame();
        let drgPakPath = activeGame?.installPath;
        if (drgPakPath) {
            const { hasForeign, fileNames } = await IntegrateApi.checkForeignPaksInPaksDir(drgPakPath);
            if (hasForeign) {
                const confirm = await MessageBox.confirm({
                    title: t('Foreign paks in game dir title'),
                    content: React.createElement(ForeignPaksConfirmContent, {
                        message: t('Foreign paks in game dir message'),
                        fileNames,
                    }),
                    okText: t('Install anyway'),
                    cancelText: t('Cancel'),
                });
                if (!confirm) {
                    throw new Error(t('User Cancels Installation'));
                }
            }
        }

        // Step 2: Load mod configuration
        await context.setStep(t('Load mod configuration'), 2, TOTAL_STEPS);
        await context.setMessage(t('Reading configuration...'));

        const profilesDAO = await StorageAPI.getProfiles();
        const activeProfileData = await profileVM.getActiveProfileData();

        // Get profile mods (with enabled status)
        const profileMods = await profilesDAO.getProfileMods(activeProfileData.id!);
        const enabledProfileMods = profileMods.filter(pm => pm.isEnabled);

        if (enabledProfileMods.length === 0) {
            throw new Error(t('No mods to install'));
        }

        await context.setMessage(`${t('Found')} ${enabledProfileMods.length} ${t('enabled mods')}`);

        // Get complete mod data for enabled mods
        const modsDAO = await StorageAPI.getMods();
        const enabledMods: CompleteModData[] = [];
        for (const pm of enabledProfileMods) {
            const modData = await modsDAO.getCompleteModData(pm.modId);
            if (modData) {
                enabledMods.push(modData);
            }
        }

        // Step 3: Check and update mods (parallel download)
        await context.setStep(t('Check Mod Updates'), 3, TOTAL_STEPS);
        const totalMods = enabledMods.length;

        // First pass: check mod path existence and identify mods that need re-download
        const modsNeedingDownload: CompleteModData[] = [];

        for (let i = 0; i < totalMods; i++) {
            if (context.checkCancelled()) {
                throw new Error('Task cancelled');
            }

            const item = enabledMods[i];
            await context.setMessage(`${t('Checking mod')} (${i + 1}/${totalMods}): ${item.displayName}`);

            const cachePath = item.download?.cachePath || "";
            const pathExists = cachePath ? await exists(cachePath) : false;

            // Check if mod path exists: non-existent or empty path needs re-download (Modio/ModCat) or error (Local)
            const isOnlineMod = item.sourceType === ModSourceType.Modio || item.sourceType === MODCAT_PLATFORM;
            
            if (!cachePath || !pathExists) {
                if (isOnlineMod) {
                    modsNeedingDownload.push(item);
                } else if (cachePath) {
                    throw new Error(
                        `${t("File Not Found")}: ${item.displayName}\n${t("Local mod path does not exist, please re-add the mod")}: ${cachePath}`
                    );
                } else {
                    throw new Error(`${t("File Not Found")}: ${item.displayName}`);
                }
            }

            // Check if this mod needs downloading (online mods only): path exists but outdated
            if (isOnlineMod && pathExists) {
                const onlineUpdateDate = item.status?.onlineUpdateDate || 0;
                const lastUpdateDate = item.status?.lastUpdateDate || 0;
                const downloadProgress = item.download?.downloadProgress || 0;

                if (
                    onlineUpdateDate > lastUpdateDate ||
                    downloadProgress != 100
                ) {
                    modsNeedingDownload.push(item);
                }
            }

            // Check if mod was modified (for local mods) — updates DB timestamps
            await ModUpdateService.checkLocalModModify(item, true);
        }

        // Parallel download all mods that need updating
        if (modsNeedingDownload.length > 0) {
            await context.setMessage(`${t('Downloading mods in parallel...')} (${modsNeedingDownload.length} ${t('mods')})`);

            const { errors } = await ModUpdateService.batchDownloadModFiles(modsNeedingDownload, 3);

            if (errors.length > 0) {
                const failedNames = errors.map(e => e.mod.displayName).join(', ');
                const firstReason = errors[0]?.error?.message;
                const reasonSuffix = firstReason ? ` (${firstReason})` : '';
                throw new Error(`${t("Download Failed")}: ${failedNames}${reasonSuffix}`);
            }

            // Refresh enabledMods from DB so subsequent steps use updated cache paths
            for (let i = 0; i < enabledMods.length; i++) {
                const modsDAO = await StorageAPI.getMods();
                const updated = await modsDAO.getCompleteModData(enabledMods[i].modId!);
                if (updated) {
                    enabledMods[i] = updated;
                }
            }
        }

        // Verify all mods have cache paths after download
        for (const item of enabledMods) {
            const modsDAO = await StorageAPI.getMods();
            const updatedMod = await modsDAO.getCompleteModData(item.modId!);
            const cachePath = updatedMod?.download?.cachePath || "";
            if (cachePath === "") {
                throw new Error(`${t("File Not Found")}: ${item.url}`);
            }
        }

        // Step 4: Validate mod files
        await context.setStep(t('Validate mod files'), 4, TOTAL_STEPS);
        for (let i = 0; i < totalMods; i++) {
            if (context.checkCancelled()) {
                throw new Error('Task cancelled');
            }

            const item = enabledMods[i];
            const cachePath = item.download?.cachePath || "";
            await context.setMessage(`${t('Verifying file')} (${i + 1}/${totalMods}): ${item.displayName}`);

            // Validate mod cache
            if (!await ModUpdateService.checkLocalModCache(item)) {
                throw new Error(`${t("File Not Found")}: ${item.displayName}: ${cachePath}`);
            }
        }

        // Step 5: Check installation status
        await context.setStep(t('Check installation status'), 5, TOTAL_STEPS);
        await context.setMessage(t('Checking existing installation...'));

        gameDAO = await StorageAPI.getGames();
        activeGame = await gameDAO.getActiveGame();
        drgPakPath = activeGame?.installPath;
        if (!drgPakPath) {
            throw new Error(t('Game Path Not Found'));
        }

        const ue4ss = await settings.getValue('ue4ss');
        const isCustomMode = ue4ss === "Custom";

        const installType = await IntegrateApi.checkInstalled(drgPakPath, 0);

        if (installType === "old_version_mint_installed") {
            await context.setMessage(t('Detected old version installation'), 'warning');
            const result = await MessageBox.confirm({
                title: t("Installation Warning"),
                content: t("Detected old version MINT(0.2, 0.3) installation file, do you want to uninstall?"),
            });
            if (!result) {
                throw new Error(t("User Cancels Installation"));
            }
        }

        // Step 6: Ensure internal assets (before hash comparison so asset paths are available)
        const isRc = activeGame?.name?.toLowerCase() === 'rc';
        const assetGame = isRc ? 'rc' : 'drg';
        await context.setStep(t('Check internal assets'), 6, TOTAL_STEPS);
        const assetPaths = await ensureInternalAssets({
            setStep: context.setStep.bind(context),
            setMessage: context.setMessage.bind(context),
            updateProgress: context.updateProgress.bind(context),
            checkCancelled: context.checkCancelled.bind(context),
            game: assetGame,
        });

        // Step 7: Manifest hash comparison — skip only when pak exists AND nothing changed
        await context.setStep(t('Check installation status'), 7, TOTAL_STEPS);
        const currentHash = await computeInstallManifestHash(enabledMods, isCustomMode, assetPaths);
        const savedHash = await profileVM.getActiveProfileInstallHash();
        if (installType === "mintcat_installed" && currentHash === savedHash) {
            await context.setMessage(t("Mod Already Install"));
            await context.updateProgress(100);
            return;
        }

        // Step 8: Uninstall old mods
        await context.setStep(t('Uninstall old version'), 8, TOTAL_STEPS);
        await context.setMessage(t('Uninstalling old mods...'));
        await IntegrateApi.uninstall(drgPakPath, !isCustomMode);

        // Step 9: Install mods
        await context.setStep(t('Install mods'), 9, TOTAL_STEPS);
        await context.setMessage(`${t('Preparing to install mods...')} (${enabledMods.length} ${t('mods')})`);

        const installModList = [];
        for (const item of enabledMods) {
            const modName = item.nameId === "" ? item.displayName : item.nameId;
            const cachePath = item.download?.cachePath || "";
            const isUnpacked = await isValidUnpackedMod(cachePath);
            installModList.push({
                name: modName,
                modio_id: item.platformId,
                pak_path: cachePath,
                is_unpacked: isUnpacked,
            });
        }

        await context.setMessage(t('Writing mod files...'));
        const result = await IntegrateApi.install(
            drgPakPath,
            JSON.stringify(installModList),
            isCustomMode,
            assetPaths?.ue4ssZipPath,
            isRc ? undefined : assetPaths?.drgZipPath,
            isRc ? assetPaths?.rcZipPath : undefined
        );

        if (!result) {
            throw new Error(t("Installation Failed"));
        }

        // Persist manifest hash so the next install can detect "nothing changed"
        await profileVM.setActiveProfileInstallHash(currentHash);

        // Complete
        await context.setMessage(t("Installation Finish"));
        await context.updateProgress(100);
    }
}
