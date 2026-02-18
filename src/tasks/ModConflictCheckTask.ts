import { ITask, ITaskContext, Task } from 'tauri-plugin-task-queue-api';
import { ProfileViewModel } from '@/dialogs/ProfileEditDialog/ProfileViewModel';
import { IoC } from '@/core/IoC.ts';
import { StorageAPI } from '@/storage';
import { invoke } from '@tauri-apps/api/core';
import { exists, stat } from '@tauri-apps/plugin-fs';
import { t } from 'i18next';
import { ConflictService, ModConflictResponse } from '@/services/ConflictService';
import { emitEvent } from '@/events';

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
 * Input structure for conflict check API
 */
interface ConflictCheckModInfo {
    mod_id: number;
    cache_path: string;
    is_unpacked: boolean;
}

/**
 * Task: Check mod file conflicts
 * 
 * This task detects file path conflicts between enabled mods in the current profile.
 * A conflict occurs when multiple mods contain files with the same path.
 * 
 * Steps:
 * 1. Load enabled mod list from current profile
 * 2. Filter mods that have valid cache paths
 * 3. Call backend to analyze pak files
 * 4. Store and display conflict results
 */
@Task({
    type: 'mod_conflict_check',
    name: t('Mod conflict check'),
    description: t('Detect file conflicts between mods'),
    schema: null,
    estimatedDuration: 30
})
export class ModConflictCheckTask implements ITask {
    async run(context: ITaskContext): Promise<void> {
        const TOTAL_STEPS = 4;

        // Step 1: Load enabled mod list
        await context.setStep(t('Load mod list'), 1, TOTAL_STEPS);
        await context.setMessage(t('Loading mod list...'));

        const profileVM = await IoC.get(ProfileViewModel);
        const profilesDAO = await StorageAPI.getProfiles();
        const modsDAO = await StorageAPI.getMods();
        const gameDAO = await StorageAPI.getGames();

        const activeProfileData = await profileVM.getActiveProfileData();
        if (!activeProfileData || !activeProfileData.id) {
            throw new Error(t('No active profile'));
        }

        const activeGame = await gameDAO.getGameById(activeProfileData.gameId);
        const gameName = activeGame?.name ?? undefined;

        // Get enabled mods from profile
        const profileMods = await profilesDAO.getProfileMods(activeProfileData.id);
        const enabledProfileMods = profileMods.filter(pm => pm.isEnabled);

        if (enabledProfileMods.length === 0) {
            await context.setMessage(t('No enabled mods'));
            ConflictService.clearAll();
            await context.updateProgress(100);
            return;
        }

        await context.setMessage(`${t('Found')} ${enabledProfileMods.length} ${t('enabled mods')}`);
        await context.updateProgress(20);

        // Step 2: Prepare mod info for conflict check
        await context.setStep(t('Prepare mod data'), 2, TOTAL_STEPS);
        
        const modInfoList: ConflictCheckModInfo[] = [];
        
        for (let i = 0; i < enabledProfileMods.length; i++) {
            if (context.checkCancelled()) {
                throw new Error('Task cancelled');
            }

            const pm = enabledProfileMods[i];
            const modData = await modsDAO.getCompleteModData(pm.modId);
            
            if (!modData) {
                continue;
            }

            const cachePath = modData.download?.cachePath || '';
            
            // Skip mods without cache path
            if (!cachePath) {
                continue;
            }

            // Check if path exists
            const pathExists = await exists(cachePath);
            if (!pathExists) {
                continue;
            }

            // Check if it's an unpacked mod
            const isUnpacked = await isValidUnpackedMod(cachePath);

            modInfoList.push({
                mod_id: modData.modId!,
                cache_path: cachePath,
                is_unpacked: isUnpacked,
            });

            await context.setMessage(`${t('Preparing')} (${i + 1}/${enabledProfileMods.length}): ${modData.displayName}`);
        }

        if (modInfoList.length < 2) {
            await context.setMessage(t('Not enough mods to check for conflicts'));
            ConflictService.clearAll();
            await context.updateProgress(100);
            return;
        }

        await context.updateProgress(40);

        // Step 3: Call backend to check conflicts
        await context.setStep(t('Check file conflicts'), 3, TOTAL_STEPS);
        await context.setMessage(`${t('Analyzing')} ${modInfoList.length} ${t('mods')}...`);

        try {
            const conflicts = await invoke<ModConflictResponse[]>('check_mod_conflicts', {
                modListJson: JSON.stringify(modInfoList),
                game_name: gameName ?? null,
            });

            await context.updateProgress(80);

            // Step 4: Process results
            await context.setStep(t('Process results'), 4, TOTAL_STEPS);

            if (conflicts.length === 0) {
                await context.setMessage(t('No conflicts detected'));
                ConflictService.clearAll();
            } else {
                // Store conflicts in service
                ConflictService.setConflicts(conflicts);
                
                const conflictCount = conflicts.length;
                await context.setMessage(`${t('Detected')} ${conflictCount} ${t('mods with conflicts')}`);
                
                // Emit global event to refresh UI
                emitEvent('mod-conflict-check-complete', { 
                    hasConflicts: true, 
                    count: conflictCount 
                });
            }

        } catch (error) {
            console.error('Conflict check failed:', error);
            throw new Error(`${t('Conflict check failed')}: ${error}`);
        }

        await context.updateProgress(100);
    }
}
