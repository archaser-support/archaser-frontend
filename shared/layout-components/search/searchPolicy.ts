/** Minimum trimmed length before a list/toolbar search should run. */
export const MIN_SEARCH_LENGTH = 2;

/** Shared debounce for toolbar / TableSearch search-as-you-type. */
export const SEARCH_DEBOUNCE_MS = 200;

/** Whether the term should run a search (`trim().length >= MIN_SEARCH_LENGTH`). */
export function isSearchableTerm(term: string): boolean {
    return term.trim().length >= MIN_SEARCH_LENGTH;
}

/**
 * Applied filter value for list search: searchable term as-is, otherwise `""`
 * so under-min-length typing clears the applied filter.
 */
export function resolveAppliedSearchTerm(term: string): string {
    return isSearchableTerm(term) ? term : "";
}
