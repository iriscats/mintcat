import { initTaskRegistry, discoverTasks, taskQueueAPI } from 'tauri-plugin-task-queue-api';

/**
 * Initialize the task system for this project
 *
 * Discovers and registers all tasks in the tasks directory.
 */
export async function initializeTaskSystem(): Promise<void> {

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
