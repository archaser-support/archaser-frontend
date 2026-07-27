/**
 * Utility function to create locale-aware navigation URLs
 * Prepends the locale prefix to paths for Next.js internationalized routing
 *
 * @param locale - The current locale (e.g., "en", "he")
 * @param path - The path from AppUrls (e.g., "/app/reports")
 * @returns The locale-prefixed path (e.g., "/en/app/reports")
 */
export function getLocalizedPath(locale: string, path: string): string {
    // Remove leading slash from path if present to avoid double slashes
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `/${locale}${cleanPath}`;
}

/**
 * Hook to get the current locale from Next.js params
 * Can be used in client components
 */
export function getLocaleFromPathname(): string {
    if (typeof window === "undefined") {
        return "en";
    }
    const pathname = window.location.pathname;
    const locale = pathname.match(/^\/([a-z]{2})\//)?.[1];
    return locale || "en";
}
