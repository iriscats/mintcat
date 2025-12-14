/**
 * Task execution context
 * Provides methods for progress reporting and cancellation checking
 */
export interface TaskContext {
    /**
     * Unique task identifier
     */
    taskId: string;

    /**
     * Update task progress (0-100)
     * @param progress - Progress percentage
     */
    updateProgress: (progress: number) => Promise<void>;

    /**
     * Check if task has been cancelled
     * @returns True if task should stop execution
     */
    checkCancelled: () => boolean;
}

/**
 * Base interface for all tasks
 * Tasks implement the run method to perform their work
 *
 * @example
 * ```typescript
 * export class MyTask implements ITask {
 *     constructor(private params: MyParams) {}
 *
 *     async run(context: TaskContext): Promise<void> {
 *         await context.updateProgress(0);
 *         // Do work
 *         await context.updateProgress(50);
 *         // More work
 *         await context.updateProgress(100);
 *     }
 * }
 * ```
 */
export interface ITask {
    /**
     * Execute the task
     * @param context - Task execution context
     * @throws Error if task execution fails
     */
    run(context: TaskContext): Promise<void>;
}

/**
 * Task factory function type
 * Creates task instances from parameters
 */
export type TaskFactory<T = any> = (params: T) => ITask;
