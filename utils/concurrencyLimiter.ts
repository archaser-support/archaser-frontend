/**
 * Utility function to process items with a concurrency limit
 * This ensures that no more than `limit` operations run concurrently
 *
 * @param items - Array of items to process
 * @param processor - Async function that processes each item
 * @param limit - Maximum number of concurrent operations (default: 5)
 * @returns Promise that resolves to an array of results in the same order as input
 */
export async function processWithConcurrencyLimit<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    limit: number = 5
): Promise<R[]> {
    if (items.length === 0) {
        return [];
    }

    const results: R[] = new Array(items.length);
    const executing: Set<Promise<void>> = new Set();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const index = i;

        // Create a promise that processes the item
        const promise = (async () => {
            try {
                const result = await processor(item, index);
                results[index] = result;
            } catch (error) {
                // Store error as result to maintain order
                results[index] = error as R;
            }
        })();

        // Add cleanup handler to remove from executing set when done
        promise.finally(() => {
            executing.delete(promise);
        });

        executing.add(promise);

        // When we reach the limit, wait for one to complete before starting the next
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    // Wait for all remaining promises to complete
    await Promise.all(executing);

    return results;
}

/**
 * Process items with concurrency limit using Promise.allSettled pattern
 * This is similar to processWithConcurrencyLimit but returns results in Promise.allSettled format
 *
 * @param items - Array of items to process
 * @param processor - Async function that processes each item
 * @param limit - Maximum number of concurrent operations (default: 5)
 * @returns Promise that resolves to an array of PromiseSettledResult objects
 */
export async function processWithConcurrencyLimitSettled<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    limit: number = 5
): Promise<PromiseSettledResult<R>[]> {
    if (items.length === 0) {
        return [];
    }

    const results: PromiseSettledResult<R>[] = new Array(items.length);
    const executing: Set<Promise<void>> = new Set();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const index = i;

        // Create a promise that processes the item
        const promise = (async () => {
            try {
                const result = await processor(item, index);
                results[index] = { status: "fulfilled", value: result };
            } catch (error) {
                results[index] = { status: "rejected", reason: error };
            }
        })();

        // Add cleanup handler to remove from executing set when done
        promise.finally(() => {
            executing.delete(promise);
        });

        executing.add(promise);

        // When we reach the limit, wait for one to complete before starting the next
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    // Wait for all remaining promises to complete
    await Promise.all(executing);

    return results;
}
