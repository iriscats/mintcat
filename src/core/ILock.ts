/**
 * Lock mechanism for preventing race conditions in async initialization
 * Each class instance maintains its own lock to prevent concurrent operations
 *
 * @example
 * ```typescript
 * class MyService extends ILock {
 *     async criticalOperation() {
 *         const release = await this.acquireLock();
 *         try {
 *             // Critical section - only one execution at a time
 *             await someAsyncWork();
 *         } finally {
 *             release();
 *         }
 *     }
 * }
 * ```
 */
export abstract class ILock {

    /**
     * Instance-level lock promise
     * Each instance has its own lock to prevent race conditions
     */
    private lock: Promise<void> = Promise.resolve();

    /**
     * Acquire lock for critical section
     *
     * @returns Release function to be called in finally block
     *
     * @example
     * ```typescript
     * const release = await this.acquireLock();
     * try {
     *     // Your critical code here
     * } finally {
     *     release();
     * }
     * ```
     */
    public async acquireLock(): Promise<() => void> {
        let release = () => {};
        const oldLock = this.lock;
        this.lock = new Promise(resolve => release = resolve);
        await oldLock;
        return release;
    }

}