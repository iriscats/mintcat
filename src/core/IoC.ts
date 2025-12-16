/**
 * Lightweight Dependency Injection Container
 * Manages singleton lifecycle and initialization
 */
type Factory<T> = () => Promise<T>;
type InitHook<T> = (instance: T) => Promise<void>;
type Token<T> = Function & { prototype: T };

export class IoC {
    private static instances = new Map<Token<any>, any>();
    private static factories = new Map<Token<any>, Factory<any>>();
    private static initHooks = new Map<Token<any>, InitHook<any>>();
    private static initializing = new Map<Token<any>, Promise<any>>();

    /**
     * Register a singleton factory
     *
     * @param token - Class type to use as identifier
     * @param factory - Factory function to create the instance
     * @param initHook - Optional initialization hook to run after creation
     *
     * @example
     * ```typescript
     * IoC.register(
     *     AppViewModel,
     *     async () => await AppViewModel.getInstance(),
     *     async (vm) => await vm.initialize()
     * );
     * ```
     */
    static register<T>(token: Token<T>, factory: Factory<T>, initHook?: InitHook<T>): void {
        this.factories.set(token, factory);
        if (initHook) {
            this.initHooks.set(token, initHook);
        }
    }

    /**
     * Get or create singleton instance
     * Thread-safe with automatic initialization
     *
     * @param token - Class type to retrieve
     * @returns Promise resolving to the singleton instance
     * @throws Error if no factory is registered for the token
     *
     * @example
     * ```typescript
     * // Type is automatically inferred as AppViewModel
     * const appViewModel = await IoC.get(AppViewModel);
     * ```
     */
    static async get<T>(token: Token<T>): Promise<T> {
        // Return existing instance
        if (this.instances.has(token)) {
            return this.instances.get(token);
        }

        // Wait if already initializing
        if (this.initializing.has(token)) {
            return this.initializing.get(token);
        }

        // Start initialization
        const factory = this.factories.get(token);
        if (!factory) {
            throw new Error(`No factory registered for: ${token.name}`);
        }

        const initPromise = (async () => {
            try {
                const instance = await factory();
                const initHook = this.initHooks.get(token);
                if (initHook) {
                    await initHook(instance);
                }
                this.instances.set(token, instance);
                return instance;
            } finally {
                this.initializing.delete(token);
            }
        })();

        this.initializing.set(token, initPromise);
        return initPromise;
    }

    /**
     * Clear all instances (for testing or window close)
     *
     * @example
     * ```typescript
     * // Clean up when window closes
     * IoC.clear();
     * ```
     */
    static clear(): void {
        this.instances.clear();
        this.initializing.clear();
    }

    /**
     * Check if instance is ready
     *
     * @param token - Class type to check
     * @returns True if instance exists and is initialized
     *
     * @example
     * ```typescript
     * if (IoC.isReady(AppViewModel)) {
     *     // AppViewModel is initialized
     * }
     * ```
     */
    static isReady<T>(token: Token<T>): boolean {
        return this.instances.has(token);
    }
}
