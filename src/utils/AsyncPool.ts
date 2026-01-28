/**
 * Async Pool - Lightweight concurrency control utility
 *
 * Executes async functions with limited concurrency, collecting all results and errors.
 */

export interface AsyncPoolResult<T, R> {
    results: R[];
    errors: Array<{ item: T; error: Error }>;
}

/**
 * Execute async operations with concurrency limit
 *
 * @param items - Array of items to process
 * @param fn - Async function to apply to each item
 * @param concurrency - Maximum number of concurrent operations (default: 3)
 * @returns Results array (in order) and collected errors
 *
 * @example
 * const { results, errors } = await asyncPoolAll(
 *     mods,
 *     async (mod) => await downloadMod(mod),
 *     3
 * );
 */
export async function asyncPoolAll<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number = 3
): Promise<AsyncPoolResult<T, R>> {
    const results: R[] = new Array(items.length);
    const errors: Array<{ item: T; error: Error }> = [];

    let currentIndex = 0;

    async function worker(): Promise<void> {
        while (currentIndex < items.length) {
            const index = currentIndex++;
            const item = items[index];

            try {
                results[index] = await fn(item);
            } catch (e) {
                errors.push({
                    item,
                    error: e instanceof Error ? e : new Error(String(e))
                });
            }
        }
    }

    // Create workers up to concurrency limit
    const workerCount = Math.min(concurrency, items.length);
    const workers: Promise<void>[] = [];

    for (let i = 0; i < workerCount; i++) {
        workers.push(worker());
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    return { results, errors };
}
