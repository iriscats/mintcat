// Tauri Task Queue API wrapper with TypeScript support

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// Tauri Task Queue Plugin Types

/**
 * Task priority levels
 */
export enum TaskPriority {
  High = 0,
  Medium = 1,
  Low = 2,
}

/**
 * Task status states
 */
export enum TaskStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/**
 * Task origin types
 */
export enum TaskOrigin {
  Frontend = 'frontend',
  Backend = 'backend',
}

/**
 * Task type registration information
 */
export interface TaskTypeInfo {
  /** Task type name */
  name: string;
  /** Task description */
  description: string;
  /** Whether the task type is enabled */
  enabled: boolean;
  /** Default parameters template */
  default_params: Record<string, any>;
  /** Estimated execution duration in seconds */
  estimated_duration?: number;
}

/**
 * Task type registration parameters
 */
export interface RegisterTaskTypeParams {
  name: string;
  description: string;
  enabled?: boolean;
  default_params?: Record<string, any>;
  estimated_duration?: number;
}

/**
 * Base task interface
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Task type identifier */
  type: string;
  /** Task origin */
  origin: TaskOrigin;
  /** Task parameters */
  params: Record<string, any>;
  /** Task priority */
  priority: TaskPriority;
  /** Current task status */
  status: TaskStatus;
  /** Task progress (0-100) */
  progress: number;
  /** Error message if task failed */
  error?: string;
  /** Task creation timestamp */
  created_at: string;
  /** Task last update timestamp */
  updated_at?: string;
}

/**
 * Task creation parameters
 */
export interface CreateTaskParams {
  /** Task type */
  taskType: string;
  /** Task parameters */
  params: Record<string, any>;
  /** Task priority (0=High, 1=Medium, 2=Low) */
  priority?: number;
}

/**
 * Task update event payload
 */
export interface TaskUpdateEvent {
  /** Updated task data */
  payload: Task;
}

/**
 * Available task types
 */
export const TASK_TYPES = {
  DOWNLOAD: 'download',
  PROCESS: 'process',
  UPLOAD: 'upload',
  COMPRESS: 'compress',
} as const;

export type TaskType = typeof TASK_TYPES[keyof typeof TASK_TYPES];

/**
 * Task type display names
 */
export const TASK_TYPE_NAMES: Record<TaskType, string> = {
  [TASK_TYPES.DOWNLOAD]: '下载任务',
  [TASK_TYPES.PROCESS]: '处理任务',
  [TASK_TYPES.UPLOAD]: '上传任务',
  [TASK_TYPES.COMPRESS]: '压缩任务',
};

/**
 * Priority display names
 */
export const PRIORITY_NAMES: Record<TaskPriority, string> = {
  [TaskPriority.High]: '高',
  [TaskPriority.Medium]: '中',
  [TaskPriority.Low]: '低',
};

/**
 * Status display names
 */
export const STATUS_NAMES: Record<TaskStatus, string> = {
  [TaskStatus.Pending]: '等待中',
  [TaskStatus.Processing]: '处理中',
  [TaskStatus.Completed]: '已完成',
  [TaskStatus.Failed]: '失败',
  [TaskStatus.Cancelled]: '已取消',
};

/**
 * Tauri command names
 */
export const COMMANDS = {
  ADD_TASK: 'plugin:task-queue|add_task',
  GET_ALL_TASKS: 'plugin:task-queue|get_all_tasks',
  CANCEL_TASK: 'plugin:task-queue|cancel_task',
  UPDATE_TASK_PROGRESS: 'plugin:task-queue|update_task_progress',
  REGISTER_TASK_TYPE: 'plugin:task-queue|register_task_type',
  GET_TASK_TYPES: 'plugin:task-queue|get_task_types',
  GET_TASK_TYPE: 'plugin:task-queue|get_task_type',
  UPDATE_TASK_TYPE: 'plugin:task-queue|update_task_type',
  UNREGISTER_TASK_TYPE: 'plugin:task-queue|unregister_task_type',
  HANDLE_FRONTEND_TASK_COMPLETION: 'plugin:task-queue|handle_frontend_task_completion',
} as const;

/**
 * Event names
 */
export const EVENTS = {
  TASK_UPDATED: 'task_updated',
  TASK_TYPE_REGISTERED: 'task_type_registered',
  TASK_TYPE_UPDATED: 'task_type_updated',
  TASK_TYPE_UNREGISTERED: 'task_type_unregistered',
  FRONTEND_TASK_START: 'frontend_task_start',
} as const;

/**
 * Component props interfaces
 */
export interface TaskFormProps {
  onAddTask: (taskType: string, params: Record<string, any>, priority: number) => Promise<boolean>;
}

export interface TaskListProps {
  tasks: Task[];
  onCancelTask?: (taskId: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

/**
 * Utility type for task filtering
 */
export interface TaskFilter {
  status?: TaskStatus[];
  type?: TaskType[];
  priority?: TaskPriority[];
}

/**
 * Task statistics
 */
export interface TaskStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

/**
 * Error types
 */
export interface TaskError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: TaskError;
}

/**
 * Task Queue API class with TypeScript support
 */
export class TaskQueueAPI {
  private static instance: TaskQueueAPI;
  private eventListeners: Map<string, UnlistenFn> = new Map();
  private frontendTaskHandlers: Map<string, (task: Task) => Promise<void>> = new Map();

  private constructor() { }

  /**
   * Get singleton instance
   */
  public static getInstance(): TaskQueueAPI {
    if (!TaskQueueAPI.instance) {
      TaskQueueAPI.instance = new TaskQueueAPI();
    }
    return TaskQueueAPI.instance;
  }

  /**
   * Add a new task to the queue (legacy method, defaults to frontend task)
   */
  async addTask(params: CreateTaskParams): Promise<string> {
    return this.addFrontendTask(params);
  }

  /**
   * Add a new frontend task to the queue
   */
  async addFrontendTask(params: CreateTaskParams): Promise<string> {
    try {
      const result = await invoke<string>(COMMANDS.ADD_TASK, {
        taskType: params.taskType,
        params: params.params,
        priority: params.priority ?? 1,
        origin: 'frontend',
      });

      if (typeof result !== 'string') {
        throw new Error('Invalid response: expected task ID string');
      }

      return result;
    } catch (error) {
      throw this.createError('Failed to add frontend task', error);
    }
  }

  /**
   * Add a new backend task to the queue
   */
  async addBackendTask(params: CreateTaskParams): Promise<string> {
    try {
      const result = await invoke<string>(COMMANDS.ADD_TASK, {
        taskType: params.taskType,
        params: params.params,
        priority: params.priority ?? 1,
        origin: 'backend',
      });

      if (typeof result !== 'string') {
        throw new Error('Invalid response: expected task ID string');
      }

      return result;
    } catch (error) {
      throw this.createError('Failed to add backend task', error);
    }
  }

  /**
   * Get all tasks from the queue
   */
  async getAllTasks(): Promise<Task[]> {
    try {
      const result = await invoke<Task[]>(COMMANDS.GET_ALL_TASKS);

      if (!Array.isArray(result)) {
        throw new Error('Invalid response: expected task array');
      }

      return result;
    } catch (error) {
      throw this.createError('Failed to get tasks', error);
    }
  }

  /**
   * Cancel a task by ID
   */
  async cancelTask(taskId: string): Promise<void> {
    try {
      await invoke<void>(COMMANDS.CANCEL_TASK, { id: taskId });
    } catch (error) {
      throw this.createError('Failed to cancel task', error);
    }
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(taskId: string, progress: number): Promise<void> {
    try {
      await invoke<void>(COMMANDS.UPDATE_TASK_PROGRESS, {
        id: taskId,
        progress: Math.min(100, Math.max(0, Math.round(progress)))
      });
    } catch (error) {
      throw this.createError('Failed to update task progress', error);
    }
  }

  /**
   * Register a new task type
   */
  async registerTaskType(params: RegisterTaskTypeParams): Promise<void> {
    try {
      const taskTypeInfo: TaskTypeInfo = {
        name: params.name,
        description: params.description,
        enabled: params.enabled ?? true,
        default_params: params.default_params ?? {},
        estimated_duration: params.estimated_duration,
      };

      await invoke<void>(COMMANDS.REGISTER_TASK_TYPE, { taskTypeInfo });
    } catch (error) {
      throw this.createError('Failed to register task type', error);
    }
  }

  /**
   * Get all registered task types
   */
  async getTaskTypes(): Promise<TaskTypeInfo[]> {
    try {
      const result = await invoke<TaskTypeInfo[]>(COMMANDS.GET_TASK_TYPES);

      if (!Array.isArray(result)) {
        throw new Error('Invalid response: expected task type array');
      }

      return result;
    } catch (error) {
      throw this.createError('Failed to get task types', error);
    }
  }

  /**
   * Get specific task type information
   */
  async getTaskType(name: string): Promise<TaskTypeInfo | null> {
    try {
      const result = await invoke<TaskTypeInfo | null>(COMMANDS.GET_TASK_TYPE, { name });
      return result;
    } catch (error) {
      throw this.createError('Failed to get task type', error);
    }
  }

  /**
   * Update an existing task type
   */
  async updateTaskType(taskTypeInfo: TaskTypeInfo): Promise<void> {
    try {
      await invoke<void>(COMMANDS.UPDATE_TASK_TYPE, { taskTypeInfo });
    } catch (error) {
      throw this.createError('Failed to update task type', error);
    }
  }

  /**
   * Unregister a task type
   */
  async unregisterTaskType(name: string): Promise<void> {
    try {
      await invoke<void>(COMMANDS.UNREGISTER_TASK_TYPE, { name });
    } catch (error) {
      throw this.createError('Failed to unregister task type', error);
    }
  }

  /**
   * Listen for task update events
   */
  async onTaskUpdated(callback: (task: Task) => void): Promise<UnlistenFn> {
    try {
      const unlisten = await listen<Task>(EVENTS.TASK_UPDATED, (event) => {
        const task = event.payload;
        if (this.isValidTask(task)) {
          callback(task);
        } else {
          console.warn('Invalid task update event payload:', task);
        }
      });

      // Store the unlisten function
      const listenerId = Date.now().toString();
      this.eventListeners.set(listenerId, unlisten);

      // Return a wrapper that also removes from our map
      return () => {
        unlisten();
        this.eventListeners.delete(listenerId);
      };
    } catch (error) {
      throw this.createError('Failed to setup event listener', error);
    }
  }

  /**
   * Register a frontend task handler for a specific task type
   */
  registerFrontendTaskHandler(taskType: string, handler: (task: Task) => Promise<void>): void {
    this.frontendTaskHandlers.set(taskType, handler);
    console.log(`Frontend task handler registered for type: ${taskType}`);
  }

  /**
   * Unregister a frontend task handler
   */
  unregisterFrontendTaskHandler(taskType: string): void {
    this.frontendTaskHandlers.delete(taskType);
    console.log(`Frontend task handler unregistered for type: ${taskType}`);
  }

  /**
   * Handle frontend task completion
   */
  async handleFrontendTaskCompletion(taskId: string, status: string, progress?: number): Promise<void> {
    try {
      await invoke<void>(COMMANDS.HANDLE_FRONTEND_TASK_COMPLETION, {
        taskId,
        status,
        progress,
      });
    } catch (error) {
      throw this.createError('Failed to handle frontend task completion', error);
    }
  }

  /**
   * Listen for frontend task start events
   */
  async onFrontendTaskStart(callback: (task: Task) => void): Promise<UnlistenFn> {
    try {
      const unlisten = await listen<Task>(EVENTS.FRONTEND_TASK_START, async (event) => {
        const task = event.payload;
        console.log('Frontend task start event received:', task);

        if (this.isValidTask(task)) {
          // Check if we have a registered handler for this task type
          // Support both 'type' (frontend) and 'task_type' (backend) field names
          const taskType = (task as any).type || (task as any).task_type;
          const handler = this.frontendTaskHandlers.get(taskType);
          if (handler) {
            try {
              // Execute the frontend handler
              await handler(task);
              // Mark task as completed
              await this.handleFrontendTaskCompletion(task.id, 'completed', 100);
            } catch (error) {
              console.error('Frontend task handler error:', error);
              // Mark task as failed
              await this.handleFrontendTaskCompletion(task.id, 'failed', task.progress || 0);
            }
          } else {
            console.warn(`No frontend handler registered for task type: ${taskType}`);
            // Mark task as failed due to no handler
            await this.handleFrontendTaskCompletion(task.id, 'failed', 0);
          }

          // Also call the provided callback
          callback(task);
        } else {
          console.warn('Invalid frontend task start event payload:', task);
        }
      });

      // Store the unlisten function
      const listenerId = `frontend_task_start_${Date.now()}`;
      this.eventListeners.set(listenerId, unlisten);

      // Return a wrapper that also removes from our map
      return () => {
        unlisten();
        this.eventListeners.delete(listenerId);
      };
    } catch (error) {
      throw this.createError('Failed to setup frontend task start listener', error);
    }
  }
  async removeAllListeners(): Promise<void> {
    for (const unlisten of this.eventListeners.values()) {
      unlisten();
    }
    this.eventListeners.clear();
  }

  /**
   * Batch operations helper
   */
  async addMultipleTasks(taskParams: CreateTaskParams[]): Promise<string[]> {
    const results: string[] = [];
    const errors: Error[] = [];

    for (const params of taskParams) {
      try {
        const taskId = await this.addTask(params);
        results.push(taskId);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to add ${errors.length} out of ${taskParams.length} tasks`);
    }

    return results;
  }

  /**
   * Refresh tasks with error handling
   */
  async refreshTasks(): Promise<Task[]> {
    return this.getAllTasks();
  }

  /**
   * Check if Tauri commands are available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getAllTasks();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get task by ID (utility method)
   */
  async getTaskById(taskId: string): Promise<Task | null> {
    try {
      const tasks = await this.getAllTasks();
      return tasks.find(task => task.id === taskId) || null;
    } catch {
      return null;
    }
  }

  /**
   * Wait for task completion
   * @param taskId - Task ID to wait for
   * @param timeoutMs - Timeout in milliseconds. Pass 0 or undefined to disable timeout.
   */
  async waitForTaskCompletion(
    taskId: string,
    timeoutMs?: number
  ): Promise<Task> {
    return new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs && timeoutMs > 0) {
        timeout = setTimeout(() => {
          reject(new Error('Task completion timeout'));
        }, timeoutMs);
      }

      this.onTaskUpdated((task) => {
        if (task.id === taskId) {
          // Support both lowercase (frontend) and capitalized (backend) status values
          const status = task.status.toLowerCase();
          if (status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'canceled') {
            if (timeout) clearTimeout(timeout);
            resolve(task);
          }
        }
      }).catch(reject);
    });
  }

  /**
   * Private helper to validate task object
   */
  private isValidTask(task: any): task is Task {
    // Support both 'type' (frontend) and 'task_type' (backend) field names
    const taskType = task.type || task.task_type;
    // Support both number (frontend) and string (backend) priority
    const hasValidPriority = typeof task.priority === 'number' || typeof task.priority === 'string';

    return (
      typeof task === 'object' &&
      task !== null &&
      typeof task.id === 'string' &&
      typeof taskType === 'string' &&
      typeof task.status === 'string' &&
      hasValidPriority &&
      typeof task.progress === 'number' &&
      typeof task.created_at === 'string'
    );
  }

  /**
   * Private helper to create standardized errors
   */
  private createError(message: string, originalError: any): TaskError {
    const error: TaskError = {
      message,
      details: {
        originalError: originalError instanceof Error ? originalError.message : String(originalError),
      },
    };

    if (originalError instanceof Error && originalError.message) {
      error.message = `${message}: ${originalError.message}`;
    }

    return error;
  }
}

/**
 * Default export instance for convenience
 */
export const taskQueueAPI = TaskQueueAPI.getInstance();

/**
 * Convenience hooks for React components
 */
export const useTaskQueue = () => {
  return {
    addTask: (params: CreateTaskParams) => taskQueueAPI.addTask(params),
    addFrontendTask: (params: CreateTaskParams) => taskQueueAPI.addFrontendTask(params),
    addBackendTask: (params: CreateTaskParams) => taskQueueAPI.addBackendTask(params),
    getAllTasks: () => taskQueueAPI.getAllTasks(),
    cancelTask: (taskId: string) => taskQueueAPI.cancelTask(taskId),
    updateTaskProgress: (taskId: string, progress: number) => taskQueueAPI.updateTaskProgress(taskId, progress),
    registerTaskType: (params: RegisterTaskTypeParams) => taskQueueAPI.registerTaskType(params),
    getTaskTypes: () => taskQueueAPI.getTaskTypes(),
    getTaskType: (name: string) => taskQueueAPI.getTaskType(name),
    updateTaskType: (taskTypeInfo: TaskTypeInfo) => taskQueueAPI.updateTaskType(taskTypeInfo),
    unregisterTaskType: (name: string) => taskQueueAPI.unregisterTaskType(name),
    registerFrontendTaskHandler: (taskType: string, handler: (task: Task) => Promise<void>) => taskQueueAPI.registerFrontendTaskHandler(taskType, handler),
    unregisterFrontendTaskHandler: (taskType: string) => taskQueueAPI.unregisterFrontendTaskHandler(taskType),
    handleFrontendTaskCompletion: (taskId: string, status: string, progress?: number) => taskQueueAPI.handleFrontendTaskCompletion(taskId, status, progress),
    onTaskUpdated: (callback: (task: Task) => void) => taskQueueAPI.onTaskUpdated(callback),
    onFrontendTaskStart: (callback: (task: Task) => void) => taskQueueAPI.onFrontendTaskStart(callback),
    refreshTasks: () => taskQueueAPI.refreshTasks(),
    isAvailable: () => taskQueueAPI.isAvailable(),
  };
};

export default taskQueueAPI;