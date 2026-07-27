/**
 * Debounce utility for performance optimization
 * Phase 4: Performance Optimizations
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function debounced(...args: Parameters<T>) {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

/**
 * Creates a debounced function with immediate execution option
 */
export function debounceImmediate<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate: boolean = false
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function debounced(...args: Parameters<T>) {
        const callNow = immediate && !timeout;

        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
            timeout = null;
            if (!immediate) {
                func(...args);
            }
        }, wait);

        if (callNow) {
            func(...args);
        }
    };
}

/**
 * Throttle utility - limits function execution to once per wait milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeout: NodeJS.Timeout | null = null;

    return function throttled(...args: Parameters<T>) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall >= wait) {
            lastCall = now;
            func(...args);
        } else {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                lastCall = Date.now();
                func(...args);
            }, wait - timeSinceLastCall);
        }
    };
}
