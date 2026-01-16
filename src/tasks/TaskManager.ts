import { TaskQueueAPI, TaskPriority, Task } from '@/apis/TaskQueueAPI';
import { ITask, TaskContext, TaskFactory } from './ITask';
import { CheckGameTask, CheckGameTaskParams } from './CheckGameTask';
import { ModInstallTask, ModInstallTaskParams } from './ModInstallTask';

/**
 * Centralized task management
 * Integrates TaskQueueAPI with ITask implementations
 *
 * @example
 * ```typescript
 * const taskManager = TaskManager.getInstance();
 *
 * // Submit a frontend task
 * const taskId = await taskManager.submitFrontendTask('check_game', {
 *     gamePath: '/path/to/game'
 * });
 *
 * // Listen to task updates
 * taskManager.onTaskUpdated((task) => {
 *     console.log(`Task ${task.id}: ${task.status} - ${task.progress}%`);
 * });
 * ```
 */
export class TaskManager {
    private static instance: TaskManager;
    private taskQueue: TaskQueueAPI;
    private taskFactories = new Map<string, TaskFactory>();

    private constructor() {
        this.taskQueue = TaskQueueAPI.getInstance();
        this.registerTaskTypes();
        this.setupTaskHandlers();
    }

    /**
     * Get singleton instance of TaskManager
     */
    static getInstance(): TaskManager {
        if (!this.instance) {
            this.instance = new TaskManager();
        }
        return this.instance;
    }

    /**
     * Register all task types
     * This method registers both frontend and backend tasks
     */
    private registerTaskTypes(): void {
        // Frontend tasks - executed in TypeScript
        this.registerFrontendTask<CheckGameTaskParams>(
            'check_game',
            'Check game path and status',
            (params) => new CheckGameTask(params)
        );

        this.registerFrontendTask<ModInstallTaskParams>(
            'mod_install',
            'Install mods to game',
            (params) => new ModInstallTask(params)
        );

        // Backend tasks - executed in Rust
        // Note: These are registered but don't have TypeScript factories
        // The Rust side will handle execution
        this.taskQueue.registerTaskType({
            name: 'mod_download',
            description: 'Download mod file',
            enabled: true,
            default_params: { url: '', savePath: '', modId: '' }
        }).catch(err => {
            console.error('[TaskManager] Failed to register mod_download:', err);
        });
    }

    /**
     * Register a frontend task with factory
     * @param taskType - Unique task type identifier
     * @param description - Human-readable description
     * @param factory - Factory function to create task instances
     */
    private registerFrontendTask<T>(
        taskType: string,
        description: string,
        factory: TaskFactory<T>
    ): void {
        this.taskFactories.set(taskType, factory as TaskFactory);

        // Register to task queue
        this.taskQueue.registerTaskType({
            name: taskType,
            description: description,
            enabled: true,
            default_params: {}
        }).catch(err => {
            console.error(`[TaskManager] Failed to register ${taskType}:`, err);
        });

        // Register handler
        this.taskQueue.registerFrontendTaskHandler(taskType, async (task) => {
            console.log(`[TaskManager] Executing frontend task: ${taskType}, ID: ${task.id}`);

            const taskInstance = factory(task.params as T);
            const context: TaskContext = {
                taskId: task.id,
                updateProgress: (progress) => this.taskQueue.updateTaskProgress(task.id, progress),
                checkCancelled: () => task.status === 'cancelled'
            };

            try {
                await taskInstance.run(context);
                console.log(`[TaskManager] Task ${task.id} completed successfully`);
            } catch (error) {
                console.error(`[TaskManager] Task ${task.id} failed:`, error);
                throw error;
            }
        });
    }

    /**
     * Setup task event handlers
     */
    private setupTaskHandlers(): void {
        this.taskQueue.onFrontendTaskStart((task) => {
            console.log(`[TaskManager] Frontend task started: ${task.type} (${task.id})`);
        }).catch(err => {
            console.error('[TaskManager] Failed to setup frontend task start listener:', err);
        });

        this.taskQueue.onTaskUpdated((task) => {
            console.log(`[TaskManager] Task updated: ${task.id}, status: ${task.status}, progress: ${task.progress}%`);
        }).catch(err => {
            console.error('[TaskManager] Failed to setup task update listener:', err);
        });
    }

    /**
     * Submit a frontend task
     * @param taskType - Type of task to submit
     * @param params - Task parameters
     * @param priority - Task priority (default: Medium)
     * @returns Task ID
     *
     * @example
     * ```typescript
     * const taskId = await taskManager.submitFrontendTask('check_game', {
     *     gamePath: '/path/to/game'
     * }, TaskPriority.High);
     * ```
     */
    async submitFrontendTask<T>(
        taskType: string,
        params: T,
        priority: TaskPriority = TaskPriority.Medium
    ): Promise<string> {
        console.log(`[TaskManager] Submitting frontend task: ${taskType}`, params);
        return this.taskQueue.addFrontendTask({ taskType, params, priority });
    }

    /**
     * Submit a backend task
     * @param taskType - Type of task to submit
     * @param params - Task parameters
     * @param priority - Task priority (default: Medium)
     * @returns Task ID
     *
     * @example
     * ```typescript
     * const taskId = await taskManager.submitBackendTask('mod_download', {
     *     url: 'https://example.com/mod.zip',
     *     savePath: '/path/to/save',
     *     modId: '12345'
     * });
     * ```
     */
    async submitBackendTask<T>(
        taskType: string,
        params: T,
        priority: TaskPriority = TaskPriority.Medium
    ): Promise<string> {
        console.log(`[TaskManager] Submitting backend task: ${taskType}`, params);
        return this.taskQueue.addBackendTask({ taskType, params, priority });
    }

    /**
     * Get all tasks
     * @returns Array of all tasks
     */
    async getAllTasks(): Promise<Task[]> {
        return this.taskQueue.getAllTasks();
    }

    /**
     * Cancel a task
     * @param taskId - ID of task to cancel
     */
    async cancelTask(taskId: string): Promise<void> {
        console.log(`[TaskManager] Cancelling task: ${taskId}`);
        return this.taskQueue.cancelTask(taskId);
    }

    /**
     * Listen for task updates
     * @param callback - Callback function to handle task updates
     * @returns Unlisten function
     *
     * @example
     * ```typescript
     * const unlisten = await taskManager.onTaskUpdated((task) => {
     *     console.log(`Task ${task.id}: ${task.progress}%`);
     * });
     *
     * // Later: stop listening
     * unlisten();
     * ```
     */
    async onTaskUpdated(callback: (task: Task) => void): Promise<() => void> {
        return this.taskQueue.onTaskUpdated(callback);
    }

    /**
     * Wait for a task to complete
     * @param taskId - Task ID to wait for
     * @param timeout - Timeout in milliseconds. Pass 0 or undefined to disable timeout.
     * @returns Completed task
     *
     * @example
     * ```typescript
     * const taskId = await taskManager.submitFrontendTask('check_game', {});
     * const result = await taskManager.waitForTask(taskId);
     * if (result.status === 'completed') {
     *     console.log('Task completed successfully');
     * }
     * ```
     */
    async waitForTask(taskId: string, timeout?: number): Promise<Task> {
        return this.taskQueue.waitForTaskCompletion(taskId, timeout);
    }
}
