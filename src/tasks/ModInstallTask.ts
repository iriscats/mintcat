import { ITask, ITaskContext, Task, SchemaBuilder } from 'tauri-plugin-task-queue-api';
import { ProfileViewModel } from '@/dialogs/ProfileEditDialog/ProfileViewModel';
import { IoC } from '@/core/IoC.ts';
import { ModUpdateService } from '@/services/ModUpdateService';
import { IntegrateApi } from '@/apis/IntegrateApi';
import type { CompleteModData } from '@/storage/dao/ModDAO';
import { StorageAPI } from '@/storage';
import { TimeUtils } from '@/utils/TimeUtils';
import { MessageBox } from '@/components/MessageBox';
import { t } from 'i18next';
import { exists, stat } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { ModSourceType } from '@/models/mod/types';
import { MODCAT_PLATFORM } from '@/apis/modcat';
import { ensureInternalAssets, getInternalAssetPaths } from '@/services/InternalAssetService';

/**
 * Check if a path is a valid unpacked mod directory
 */
async function isValidUnpackedMod(dirPath: string): Promise<boolean> {
    try {
        // First check if it's a directory
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
    name: '模组安装',
    description: '将模组安装到游戏目录',
    schema: null,
    estimatedDuration: 120
})
export class ModInstallTask implements ITask {

    async run(context: ITaskContext): Promise<void> {
        const TOTAL_STEPS = 9;
        await context.setMessage(t("Start installation"));

        // Get profile view model and settings
        const profileVM = await IoC.get(ProfileViewModel);
        const settings = await StorageAPI.getSettings();

        // Step 1: Validate game environment
        await context.setStep('验证游戏环境', 1, TOTAL_STEPS);
        await context.setMessage('正在检查游戏路径...');

        if (!await IntegrateApi.checkGamePath()) {
            throw new Error(t('Game Path Not Found'));
        }

        await context.setMessage('正在检查游戏是否运行中...');
        if (await IntegrateApi.checkSteamGame()) {
            throw new Error(t('Game Not Closed'));
        }

        // Step 2: Load mod configuration
        await context.setStep('加载模组配置', 2, TOTAL_STEPS);
        await context.setMessage('正在读取配置文件...');

        const profilesDAO = await StorageAPI.getProfiles();
        const activeProfileData = await profileVM.getActiveProfileData();

        // Get profile mods (with enabled status)
        const profileMods = await profilesDAO.getProfileMods(activeProfileData.id!);
        const enabledProfileMods = profileMods.filter(pm => pm.isEnabled);

        if (enabledProfileMods.length === 0) {
            throw new Error('没有可安装的模组');
        }

        await context.setMessage(`找到 ${enabledProfileMods.length} 个已启用的模组`);

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
        await context.setStep('检查模组更新', 3, TOTAL_STEPS);
        let editTime = await profileVM.getActiveProfileEditTime();
        const totalMods = enabledMods.length;

        // First pass: check mod path existence and identify mods that need re-download
        const modsNeedingDownload: CompleteModData[] = [];

        for (let i = 0; i < totalMods; i++) {
            if (context.checkCancelled()) {
                throw new Error('Task cancelled');
            }

            const item = enabledMods[i];
            await context.setMessage(`检查模组 (${i + 1}/${totalMods}): ${item.displayName}`);

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

            // Check if mod was modified (for local mods)
            if (await ModUpdateService.checkLocalModModify(item, true)) {
                editTime = TimeUtils.nowSeconds();
                await profileVM.setActiveProfileEditTime(editTime);
            }
        }

        // Parallel download all mods that need updating
        if (modsNeedingDownload.length > 0) {
            await context.setMessage(`并行下载 ${modsNeedingDownload.length} 个模组...`);

            const { errors } = await ModUpdateService.batchDownloadModFiles(modsNeedingDownload, 3);

            if (errors.length > 0) {
                const failedNames = errors.map(e => e.mod.displayName).join(', ');
                throw new Error(`${t("Download Failed")}: ${failedNames}`);
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
        await context.setStep('验证模组文件', 4, TOTAL_STEPS);
        for (let i = 0; i < totalMods; i++) {
            if (context.checkCancelled()) {
                throw new Error('Task cancelled');
            }

            const item = enabledMods[i];
            const cachePath = item.download?.cachePath || "";
            await context.setMessage(`验证文件 (${i + 1}/${totalMods}): ${item.displayName}`);

            // Validate mod cache
            if (!await ModUpdateService.checkLocalModCache(item)) {
                throw new Error(`${t("File Not Found")}: ${item.displayName}: ${cachePath}`);
            }
        }

        // Step 5: Check installation status
        await context.setStep('检查安装状态', 5, TOTAL_STEPS);
        await context.setMessage('正在检查现有安装...');

        let installTime = await profileVM.getActiveProfileInstallTime();
        if (installTime < editTime) {
            installTime = editTime;
        }

        const gameDAO = await StorageAPI.getGames();
        const activeGame = await gameDAO.getActiveGame();
        const drgPakPath = activeGame?.installPath;
        if (!drgPakPath) {
            throw new Error(t('Game Path Not Found'));
        }

        const ue4ss = await settings.getValue('ue4ss');
        // Custom mode: user manages UE4SS themselves, skip install/uninstall
        const isCustomMode = ue4ss === "Custom";

        const installType = await IntegrateApi.checkInstalled(drgPakPath, installTime);

        // Handle old version detection
        if (installType === "old_version_mint_installed") {
            await context.setMessage('检测到旧版本安装文件', 'warning');
            const result = await MessageBox.confirm({
                title: t("Installation Warning"),
                content: t("Detected old version MINT(0.2, 0.3) installation file, do you want to uninstall?"),
            });
            if (!result) {
                throw new Error(t("User Cancels Installation"));
            }
        } else if (installType === "mintcat_installed") {
            await context.setMessage(t("Mod Already Install"));
            await context.updateProgress(100);
            return;
        }

        // Step 6: Uninstall old mods
        await context.setStep('卸载旧版本', 6, TOTAL_STEPS);
        await context.setMessage('正在卸载旧版本模组...');

        // In Custom mode, don't delete UE4SS; otherwise delete it
        await IntegrateApi.uninstall(drgPakPath, !isCustomMode);

        // Step 7: Ensure internal assets (UE4SSL.zip, DRG.zip) - force download if missing
        await context.setStep('检查内部资产', 7, TOTAL_STEPS);
        let assetPaths = await getInternalAssetPaths();
        if (!assetPaths) {
            await context.setMessage('正在下载模组管理器资产...');
            assetPaths = await ensureInternalAssets({
                setStep: context.setStep.bind(context),
                setMessage: context.setMessage.bind(context),
                updateProgress: context.updateProgress.bind(context),
                checkCancelled: context.checkCancelled.bind(context),
            });
        }

        // Step 8: Install mods
        await context.setStep('安装模组', 8, TOTAL_STEPS);
        await context.setMessage(`准备安装 ${enabledMods.length} 个模组...`);

        const installModList = [];
        for (const item of enabledMods) {
            const modName = item.nameId === "" ? item.displayName : item.nameId;
            const cachePath = item.download?.cachePath || "";
            
            // Check if this is an unpacked mod directory
            const isUnpacked = await isValidUnpackedMod(cachePath);
            
            installModList.push({
                name: modName,
                modio_id: item.platformId,
                pak_path: cachePath,
                is_unpacked: isUnpacked,
            });
        }

        await context.setMessage('正在写入模组文件...');
        // In Custom mode, skip UE4SS installation (user manages it themselves)
        const result = await IntegrateApi.install(
            drgPakPath,
            JSON.stringify(installModList),
            isCustomMode,
            assetPaths.ue4ssZipPath,
            assetPaths.drgZipPath
        );

        if (!result) {
            throw new Error(t("Installation Failed"));
        }

        // Complete
        await context.setMessage(t("Installation Finish"));
        await context.updateProgress(100);
    }
}
