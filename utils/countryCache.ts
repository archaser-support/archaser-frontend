import { countries } from "countries-list";

const countryCache = new Map();

export function getCountryName(iso2: string): string {
    if (!iso2) return "";

    if (!countryCache.has(iso2)) {
        const country = (countries as any)[iso2];
        countryCache.set(iso2, country?.name || iso2);
    }
    return countryCache.get(iso2);
}

export function getStateName(iso2: string): string {
    if (!iso2) return "";

    // For now, just return the ISO code as we don't have a state database
    // TODO: Implement state name mapping if needed
    return iso2;
}
