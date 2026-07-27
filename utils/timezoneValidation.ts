import moment from "moment-timezone";

/**
 * Validates if a string is a valid IANA timezone identifier
 * @param timezone - Timezone string to validate
 * @returns true if the timezone is valid, false otherwise
 */
export function isValidIANATimezone(timezone: string): boolean {
    if (!timezone || typeof timezone !== "string") {
        return false;
    }
    return moment.tz.zone(timezone) !== null;
}

/**
 * Normalizes a timezone string to a valid IANA identifier or null
 * @param timezone - Timezone string (can be IANA, enum value, or invalid)
 * @returns Valid IANA timezone identifier or null if invalid
 */
export function normalizeTimezone(
    timezone: string | null | undefined
): string | null {
    if (!timezone) {
        return null;
    }

    // If it's already a valid IANA timezone, return it
    if (isValidIANATimezone(timezone)) {
        return timezone;
    }

    // Invalid timezone
    return null;
}

