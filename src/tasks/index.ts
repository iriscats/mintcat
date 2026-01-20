/**
 * Task System Entry Point
 *
 * Re-exports all task-related types and utilities from the plugin,
 * plus project-specific initialization.
 */

// Re-export values from plugin
export {
    // Enums
    TaskPriority,
    TaskStatus,

    // Core classes
    TaskQueueAPI,
    taskQueueAPI,
    TaskContext,
    TaskRegistry,

    // Decorator
    Task,

    // Schema
    SchemaBuilder,
    createSchema,
    SchemaValidationError,

    // Initialization
    initTaskRegistry,
    discoverTasks,
} from 'tauri-plugin-task-queue-api';

// Re-export types from plugin
export type {
    TaskMessageLevel,
    ITaskContext,
    ITask,
    TaskFactory,
    TaskMetadata,
    RegisteredTask,
    TaskDecoratorConfig,
    TaskParamSchema,
} from 'tauri-plugin-task-queue-api';

/**
 * Initialize the task system for this project
 *
 * Discovers and registers all tasks in the tasks directory.
 */
export async function initializeTaskSystem(): Promise<void> {
    const { initTaskRegistry, discoverTasks, taskQueueAPI } = await import('tauri-plugin-task-queue-api');

    // Initialize registry with TaskQueueAPI
    await initTaskRegistry();

    // Discover tasks in this project
    await discoverTasks(() => import.meta.glob('./**/*Task.ts'));

    // Setup task_start event listener to handle frontend task execution
    await taskQueueAPI.onTaskStart((task) => {
        console.log('[TaskSystem] Task started:', task.id, task.type);
    });

    console.log('[TaskSystem] Task start listener registered');
}
