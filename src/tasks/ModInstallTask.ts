import { ITask, ITaskContext, Task, SchemaBuilder } from 'tauri-plugin-task-queue-api';
import { ProfileViewModel } from '@/dialogs/ProfileEditDialog/ProfileViewModel';
import { IoC } from '@/core/IoC.ts';
import { ModUpdateService } from '@/services/ModUpdateService';
import { IntegrateApi } from '@/apis/IntegrateApi';
import type { CompleteModData } from '@/storage/dao/ModDAO';
import { StorageAPI } from '@/storage';
import { TimeUtils } from '@/utils/TimeUtils';
import { MessageBox } from '@/components/MessageBox';
import { emit } from '@tauri-apps/api/event';
import { t } from 'i18next';

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
        const TOTAL_STEPS = 8;
        await emit("status-bar-log", t("Start installation"));

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
            await context.setMessage('没有可安装的模组');
            await emit("status-bar-log", t("No mods to install"));
            await context.updateProgress(100);
            return;
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

        // Step 3: Check and update mods
        await context.setStep('检查模组更新', 3, TOTAL_STEPS);
        let editTime = await profileVM.getActiveProfileEditTime();
        const totalMods = enabledMods.length;

        for (let i = 0; i < totalMods; i++) {
            if (context.checkCancelled()) {
                throw new Error('Task cancelled');
            }

            const item = enabledMods[i];
            await context.setMessage(`检查模组 (${i + 1}/${totalMods}): ${item.displayName}`);

            // Check for online updates (mod is enabled since we filtered above)
            await ModUpdateService.checkOnlineModAndUpdate(item, true);
            const cachePath = item.download?.cachePath || "";
            if (cachePath === "") {
                throw new Error(`${t("File Not Found")}: ${item.url}`);
            }

            // Check if mod was modified
            if (await ModUpdateService.checkLocalModModify(item, true)) {
                editTime = TimeUtils.nowSeconds();
                await profileVM.setActiveProfileEditTime(editTime);
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
            await context.setMessage('模组已是最新版本');
            await emit("status-bar-log", t("Mod Already Install"));
            await context.updateProgress(100);
            return;
        }

        // Step 6: Uninstall old mods
        await context.setStep('卸载旧版本', 6, TOTAL_STEPS);
        await context.setMessage('正在卸载旧版本模组...');

        if (ue4ss === "UE4SS-Lite") {
            await IntegrateApi.uninstall(drgPakPath);
        } else {
            await IntegrateApi.uninstall(drgPakPath, false);
        }

        // Step 7: Install .NET runtime
        await context.setStep('安装运行时环境', 7, TOTAL_STEPS);
        await context.setMessage('正在安装 .NET Runtime...');
        await emit("status-bar-log", t("Installing .NET Runtime..."));
        await IntegrateApi.installDotnetRuntime(drgPakPath);

        // Step 8: Install mods
        await context.setStep('安装模组', 8, TOTAL_STEPS);
        await context.setMessage(`准备安装 ${enabledMods.length} 个模组...`);

        const installModList = [];
        for (const item of enabledMods) {
            const modName = item.nameId === "" ? item.displayName : item.nameId;
            installModList.push({
                name: modName,
                modio_id: item.platformId,
                pak_path: item.download?.cachePath || "",
            });
        }

        await context.setMessage('正在写入模组文件...');
        const result = await IntegrateApi.install(drgPakPath, JSON.stringify(installModList));

        if (!result) {
            throw new Error(t("Installation Failed"));
        }

        // Complete
        await context.setMessage('安装完成!');
        await emit("status-bar-log", t("Installation Finish"));
        await context.updateProgress(100);
    }
}
