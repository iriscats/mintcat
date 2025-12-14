/**
 * Lightweight Dependency Injection Container
 * Manages singleton lifecycle and initialization
 */
type Factory<T> = () => Promise<T>;
type InitHook<T> = (instance: T) => Promise<void>;

export class DIContainer {
    private static instances = new Map<string, any>();
    private static factories = new Map<string, Factory<any>>();
    private static initHooks = new Map<string, InitHook<any>>();
    private static initializing = new Map<string, Promise<any>>();

    /**
     * Register a singleton factory
     *
     * @param key - Unique identifier for the singleton
     * @param factory - Factory function to create the instance
     * @param initHook - Optional initialization hook to run after creation
     *
     * @example
     * ```typescript
     * DIContainer.register(
     *     'AppViewModel',
     *     async () => new AppViewModel(),
     *     async (vm) => await vm.initialize()
     * );
     * ```
     */
    static register<T>(key: string, factory: Factory<T>, initHook?: InitHook<T>): void {
        this.factories.set(key, factory);
        if (initHook) {
            this.initHooks.set(key, initHook);
        }
    }

    /**
     * Get or create singleton instance
     * Thread-safe with automatic initialization
     *
     * @param key - Identifier of the singleton to retrieve
     * @returns Promise resolving to the singleton instance
     * @throws Error if no factory is registered for the key
     *
     * @example
     * ```typescript
     * const appViewModel = await DIContainer.get<AppViewModel>('AppViewModel');
     * ```
     */
    static async get<T>(key: string): Promise<T> {
        // Return existing instance
        if (this.instances.has(key)) {
            return this.instances.get(key);
        }

        // Wait if already initializing
        if (this.initializing.has(key)) {
            return this.initializing.get(key);
        }

        // Start initialization
        const factory = this.factories.get(key);
        if (!factory) {
            throw new Error(`No factory registered for: ${key}`);
        }

        const initPromise = (async () => {
            try {
                const instance = await factory();
                const initHook = this.initHooks.get(key);
                if (initHook) {
                    await initHook(instance);
                }
                this.instances.set(key, instance);
                return instance;
            } finally {
                this.initializing.delete(key);
            }
        })();

        this.initializing.set(key, initPromise);
        return initPromise;
    }

    /**
     * Clear all instances (for testing or window close)
     *
     * @example
     * ```typescript
     * // Clean up when window closes
     * DIContainer.clear();
     * ```
     */
    static clear(): void {
        this.instances.clear();
        this.initializing.clear();
    }

    /**
     * Check if instance is ready
     *
     * @param key - Identifier of the singleton to check
     * @returns True if instance exists and is initialized
     *
     * @example
     * ```typescript
     * if (DIContainer.isReady('AppViewModel')) {
     *     // AppViewModel is initialized
     * }
     * ```
     */
    static isReady(key: string): boolean {
        return this.instances.has(key);
    }
}
