/**
 * Base class for all ViewModels
 * Provides standardized lifecycle and initialization
 *
 * @example
 * ```typescript
 * export class MyViewModel extends BaseViewModel {
 *     protected async initialize(): Promise<void> {
 *         // Custom initialization logic
 *         await this.loadData();
 *         this.initialized = true;
 *     }
 *
 *     async dispose(): Promise<void> {
 *         // Cleanup resources
 *         this.listeners.forEach(l => l.unlisten());
 *     }
 * }
 * ```
 */
export abstract class BaseViewModel {
    protected initialized: boolean = false;

    /**
     * Initialize the ViewModel
     * Override in subclasses for custom initialization
     *
     * @throws Error if initialization fails
     *
     * @example
     * ```typescript
     * protected async initialize(): Promise<void> {
     *     await this.loadSettings();
     *     await this.setupListeners();
     *     this.initialized = true;
     * }
     * ```
     */
    async initialize(): Promise<void> {
        // Override in subclasses
    }

    /**
     * Check if ViewModel is ready
     *
     * @returns True if initialization is complete
     *
     * @example
     * ```typescript
     * if (viewModel.isReady()) {
     *     // Safe to use ViewModel
     * }
     * ```
     */
    isReady(): boolean {
        return this.initialized;
    }

    /**
     * Cleanup resources
     * Override in subclasses for custom cleanup
     *
     * @example
     * ```typescript
     * async dispose(): Promise<void> {
     *     await super.dispose();
     *     this.eventListeners.forEach(l => l());
     *     this.subscriptions.clear();
     * }
     * ```
     */
    async dispose(): Promise<void> {
        // Override in subclasses
    }
}
