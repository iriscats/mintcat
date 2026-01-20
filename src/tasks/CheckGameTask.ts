import { ITask, ITaskContext, Task, SchemaBuilder } from 'tauri-plugin-task-queue-api';
import { IntegrateApi } from '@/apis/IntegrateApi';
import { t } from 'i18next';

/**
 * Schema for CheckGameTask parameters
 */
const CheckGameParamsSchema = new SchemaBuilder<CheckGameTaskParams>()
    .field('gamePath', { type: 'string', required: false })
    .build();

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
 * Uses enhanced context for stepped progress tracking:
 * - Step 1/2: Validate game path
 * - Step 2/2: Check if game is running
 *
 * @example
 * ```typescript
 * const task = new CheckGameTask({ gamePath: '/path/to/game' });
 * await task.run(context);
 * ```
 */
@Task({
    type: 'check_game',
    name: '游戏检测',
    description: '检查游戏路径是否有效以及游戏是否正在运行',
    schema: CheckGameParamsSchema,
    estimatedDuration: 5
})
export class CheckGameTask implements ITask {
    constructor(private params: CheckGameTaskParams) {}

    async run(context: ITaskContext): Promise<void> {
        // Step 1: Validate game path
        await context.setStep('验证游戏路径', 1, 2);
        await context.setMessage('正在检查游戏路径...');

        const isValid = await IntegrateApi.checkGamePath(this.params.gamePath);

        if (!isValid) {
            throw new Error(t('Game Path Not Found'));
        }

        await context.setMessage('游戏路径验证成功');

        // Step 2: Check if game is running
        await context.setStep('检查游戏状态', 2, 2);
        await context.setMessage('正在检查游戏是否运行中...');

        const isRunning = await IntegrateApi.checkSteamGame();

        if (isRunning) {
            throw new Error(t('Game Not Closed'));
        }

        await context.setMessage('游戏检测完成');
        await context.updateProgress(100);
    }
}
