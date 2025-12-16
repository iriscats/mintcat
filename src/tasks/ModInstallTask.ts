import { ITask, TaskContext } from './ITask';
import { TreeViewModel } from '@/pages/HomePage/TreeViewModel';
import { ProfileViewModel } from '@/dialogs/ProfileEditDialog/ProfileViewModel';
import { IoC } from '@/core/IoC.ts';
import { ModUpdateApi } from '@/apis/ModUpdateApi';
import { IntegrateApi } from '@/apis/IntegrateApi';
import { ModListItem } from '@/storage/db/Schema';
import { StorageAPI } from '@/storage';
import { TimeUtils } from '@/utils/TimeUtils';
import { MessageBox } from '@/components/MessageBox';
import { emit } from '@tauri-apps/api/event';
import { t } from 'i18next';

/**
 * Parameters for ModInstallTask
 */
export interface ModInstallTaskParams {
    /**
     * Profile ID to install mods from
     */
    profileId?: string;

    /**
     * Optional list of specific mods to install
     * If not provided, installs all enabled mods from active profile
     */
    mods?: ModListItem[];
}

/**
 * Task: Install mods to game
 * Execution: Frontend (complex business logic, needs access to multiple ViewModels and database)
 *
 * This task performs the full mod installation workflow:
 * 1. Check game path and status
 * 2. Check for mod updates
 * 3. Validate mod files
 * 4. Uninstall old versions if needed
 * 5. Install new mods
 *
 * @example
 * ```typescript
 * const task = new ModInstallTask({ profileId: 'default' });
 * await task.run(context);
 * ```
 */
export class ModInstallTask implements ITask {
    constructor(private params: ModInstallTaskParams) {}

    async run(context: TaskContext): Promise<void> {
        await context.updateProgress(0);
        await emit("status-bar-log", t("Start installation"));

        // Get tree view model and settings
        const treeViewModel = await IoC.get(TreeViewModel);
        const profileVM = await IoC.get(ProfileViewModel);
        const settings = await StorageAPI.getSettings();

        // Step 1: Check game path (10% progress)
        if (!await IntegrateApi.checkGamePath()) {
            throw new Error(t('Game Path Not Found'));
        }
        await context.updateProgress(10);

        // Step 2: Check if game is running (20% progress)
        if (await IntegrateApi.checkSteamGame()) {
            throw new Error(t('Game Not Closed'));
        }
        await context.updateProgress(20);

        // Get mod list
        const api = new IntegrateApi();
        const modList = await (api as any).getAllModsAsList();
        const activeProfile = await profileVM.getActiveProfileTree();
        const subModList = activeProfile.getModList(modList);
        const enabledMods = subModList.filter(m => m.enabled);

        if (enabledMods.length === 0) {
            await emit("status-bar-log", t("No mods to install"));
            await context.updateProgress(100);
            return;
        }

        // Step 3: Check mod updates and validate files (20% - 60% progress)
        let editTime = await profileVM.getActiveProfileEditTime();
        const totalMods = enabledMods.length;
        for (let i = 0; i < totalMods; i++) {
            if (context.checkCancelled()) {
                throw new Error('Task cancelled');
            }

            const item = enabledMods[i];

            // Check for online updates
            await ModUpdateApi.checkOnlineModUpdate(item);
            if (item.cachePath === "") {
                throw new Error(`${t("File Not Found")}: ${item.url}`);
            }

            // Check if mod was modified
            if (await ModUpdateApi.checkLocalModModify(item)) {
                editTime = TimeUtils.getCurrentTime();
                await profileVM.setActiveProfileEditTime(editTime);
            }

            // Validate mod cache
            if (!await ModUpdateApi.checkLocalModCache(item)) {
                throw new Error(`${t("File Not Found")}: ${item.displayName}: ${item.cachePath}`);
            }

            // Update progress
            const progress = 20 + ((i + 1) / totalMods) * 40;
            await context.updateProgress(progress);
        }

        // Step 4: Check installation status (70% progress)
        let installTime = await profileVM.getActiveProfileInstallTime();
        if (installTime < editTime) {
            installTime = editTime;
        }

        const drgPakPath = await settings.getValue('drgPakPath');
        const ue4ss = await settings.getValue('ue4ss');

        const installType = await IntegrateApi.checkInstalled(drgPakPath, installTime);
        await context.updateProgress(70);

        // Handle old version detection
        if (installType === "old_version_mint_installed") {
            const result = await MessageBox.confirm({
                title: t("Installation Warning"),
                content: t("Detected old version MINT(0.2, 0.3) installation file, do you want to uninstall?"),
            });
            if (!result) {
                throw new Error(t("User Cancels Installation"));
            }
        } else if (installType === "mintcat_installed") {
            await emit("status-bar-log", t("Installation Finish"));
            await context.updateProgress(100);
            return;
        }

        // Step 5: Uninstall old mods (80% progress)
        if (ue4ss === "UE4SS-Lite") {
            await IntegrateApi.uninstall(drgPakPath);
        } else {
            await IntegrateApi.uninstall(drgPakPath, false);
        }
        await context.updateProgress(80);

        // Step 6: Prepare mod list for installation
        const installModList = [];
        for (const item of enabledMods) {
            const modName = item.nameId === "" ? item.displayName : item.nameId;
            installModList.push({
                name: modName,
                modio_id: item.modId,
                pak_path: item.cachePath,
            });
        }

        // Step 7: Install mods (90% progress)
        await context.updateProgress(90);
        const result = await IntegrateApi.install(drgPakPath, JSON.stringify(installModList));

        if (!result) {
            throw new Error(t("Installation Failed"));
        }

        // Complete (100% progress)
        await emit("status-bar-log", t("Installation Finish"));
        await context.updateProgress(100);
    }
}
