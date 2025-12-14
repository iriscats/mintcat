import { ITask, TaskContext } from './ITask';
import { IntegrateApi } from '@/apis/IntegrateApi';
import { emit } from '@tauri-apps/api/event';
import { t } from 'i18next';

/**
 * Parameters for CheckGameTask
 */
export interface CheckGameTaskParams {
    /**
     * Optional game path to check
     * If not provided, uses the active game path from settings
     */
    gamePath?: string;
}

/**
 * Task: Check if game path is valid and accessible
 * Execution: Frontend (needs access to UI and database)
 *
 * @example
 * ```typescript
 * const task = new CheckGameTask({ gamePath: '/path/to/game' });
 * await task.run(context);
 * ```
 */
export class CheckGameTask implements ITask {
    constructor(private params: CheckGameTaskParams) {}

    async run(context: TaskContext): Promise<void> {
        await context.updateProgress(0);

        // Check game path validity
        const isValid = await IntegrateApi.checkGamePath(this.params.gamePath);
        await context.updateProgress(50);

        if (!isValid) {
            throw new Error(t('Game Path Not Found'));
        }

        // Check if game is running
        const isRunning = await IntegrateApi.checkSteamGame();
        await context.updateProgress(100);

        if (isRunning) {
            throw new Error(t('Game Not Closed'));
        }
    }
}
