import * as ct from "countries-and-timezones";
import { getCountryByAlpha2, getLocaleByAlpha2 } from "country-locale-map";
import moment from "moment-timezone";
import { Session } from "next-auth";

import { SchedulingOptions, SchedulingResult } from "../types/BusinessHours";

import { BusinessHoursService } from "./businessHoursService";
import { isValidIANATimezone } from "./timezoneValidation";

/**
 * UNIFIED DATE FORMATTING AND TIMEZONE OPERATIONS SYSTEM
 *
 * This file contains the SINGLE source of truth for all date formatting, timezone conversion,
 * and scheduling logic throughout the application.
 *
 * ## Architecture
 *
 * ### Date Formatting
 * - `formatDateForDisplay()` - THE ONLY function with formatting logic (use this for new code)
 * - `formatUserTime/Date/DateTime()` - Deprecated wrapper functions (kept for backward compatibility)
 * - `ActivityService.formatDateForDisplay()` - Server wrapper that calls the core function
 *
 * ### Timezone Operations
 * - `getUserTimezone()` - Get user's IANA timezone from session
 * - `toUserTimezone()` - Convert UTC date to user's timezone
 * - `getCountryTimezone()` - Get IANA timezone for a country/state
 * - `getCurrentTimeForCountry()` - Get formatted current time for a country
 *
 * ### Scheduling
 * - `scheduleDateTime()` - Unified scheduling function combining timezone resolution, working day validation, and UTC conversion
 * - `localTimeToUTC()` - Simple local time to UTC conversion
 * - `scheduleWithBusinessHours()` - Advanced scheduling with business hours consideration
 *
 * ## Usage
 *
 * ### For New Code
 * ```typescript
 * // Date formatting
 * formatDateForDisplay(date, "datetime", locale, timezone)
 *
 * // Timezone operations
 * const timezone = getUserTimezone(session);
 * const countryTz = getCountryTimezone("United States of America", "CA");
 * const currentTime = getCurrentTimeForCountry("United States of America");
 *
 * // Scheduling
 * await scheduleDateTime({ baseDate, countryCode, stateCode, timeOfDay, daysToAdd })
 * ```
 *
 * ### For Existing Code
 * Legacy wrapper functions (`formatUserTime`, `formatUserDate`, `formatUserDateTime`) still work
 * but are deprecated. Consider migrating to `formatDateForDisplay()` for consistency.
 *
 * ## Migration Guide
 *
 * ### From getValidWorkingDateAndTimeISO():
 * ```typescript
 * // OLD
 * getValidWorkingDateAndTimeISO(countryCode, targetDateTime, stateCode, timeOfDay, daysToAdd)
 * // NEW
 * scheduleDateTime({ baseDate: targetDateTime, countryCode, stateCode, timeOfDay, daysToAdd })
 * ```
 *
 * ### From generateScheduleTime():
 * ```typescript
 * // OLD
 * generateScheduleTime(base_date, customer_country, customer_state, time_of_day, days_from_prev_step)
 * // NEW
 * scheduleDateTime({ baseDate: base_date, customerCountry, customerState, timeOfDay: time_of_day, daysToAdd: days_from_prev_step })
 * ```
 *
 * ### From convertLocalTimeToUTC():
 * ```typescript
 * // OLD
 * convertLocalTimeToUTC(localTime, baseDate, countryCode, stateCode, daysToAdd)
 * // NEW
 * scheduleDateTime({ baseDate, timeOfDay: localTime, countryCode, stateCode, daysToAdd, skipWeekends: false, businessHoursOnly: false })
 * ```
 *
 * ## Benefits
 * - Single source of truth for all date/time operations
 * - Consistent locale and timezone support across client and server
 * - Better performance with native Intl API where possible
 * - IANA timezone identifiers throughout (no enum mappings)
 * - Centralized country/state timezone resolution
 * - Easy to maintain and extend
 */

export const stateToTimezoneMap: Record<string, string> = {
    // United States (50 states + DC)
    AL: "America/Chicago",
    AK: "America/Anchorage",
    AZ: "America/Phoenix",
    AR: "America/Chicago",
    CA: "America/Los_Angeles",
    CO: "America/Denver",
    CT: "America/New_York",
    DE: "America/New_York",
    FL: "America/New_York", // Panhandle is Central, but majority is Eastern
    GA: "America/New_York",
    HI: "Pacific/Honolulu",
    ID: "America/Boise", // Split with Pacific, Boise = Mountain
    IL: "America/Chicago",
    IN: "America/Indiana/Indianapolis", // Mostly Eastern
    IA: "America/Chicago",
    KS: "America/Chicago",
    KY: "America/New_York", // Split, but most Eastern
    LA: "America/Chicago",
    ME: "America/New_York",
    MD: "America/New_York",
    MA: "America/New_York",
    MI: "America/Detroit",
    MN: "America/Chicago",
    MS: "America/Chicago",
    MO: "America/Chicago",
    MT: "America/Denver",
    NE: "America/Chicago", // Split but most is Central
    NV: "America/Los_Angeles",
    NH: "America/New_York",
    NJ: "America/New_York",
    NM: "America/Denver",
    NY: "America/New_York",
    NC: "America/New_York",
    ND: "America/Chicago", // Split, but majority Central
    OH: "America/New_York",
    OK: "America/Chicago",
    OR: "America/Los_Angeles", // Split but most is Pacific
    PA: "America/New_York",
    RI: "America/New_York",
    SC: "America/New_York",
    SD: "America/Chicago", // Western part is Mountain
    TN: "America/Chicago", // Eastern TN is in Eastern time
    TX: "America/Chicago", // El Paso and Hudspeth are Mountain
    UT: "America/Denver",
    VT: "America/New_York",
    VA: "America/New_York",
    WA: "America/Los_Angeles",
    WV: "America/New_York",
    WI: "America/Chicago",
    WY: "America/Denver",
    DC: "America/New_York",

    // Canada (10 provinces + 3 territories)
    AB: "America/Edmonton", // Alberta
    BC: "America/Vancouver", // British Columbia
    MB: "America/Winnipeg", // Manitoba
    NB: "America/Moncton", // New Brunswick
    NL: "America/St_Johns", // Newfoundland and Labrador
    NS: "America/Halifax", // Nova Scotia
    ON: "America/Toronto", // Ontario – Northwestern parts use Central
    PE: "America/Halifax", // Prince Edward Island
    QC: "America/Toronto", // Quebec – Eastern parts use Atlantic
    SK: "America/Regina", // Saskatchewan – no DST
    NT: "America/Yellowknife", // Northwest Territories
    NU: "America/Iqaluit", // Nunavut – some parts are Central/Mountain
    YT: "America/Whitehorse", // Yukon
};

export const weekendDaysMap: Record<string, number[]> = {
    // Friday–Saturday
    AE: [5, 6],
    BH: [5, 6],
    DZ: [5, 6],
    EG: [5, 6],
    IL: [5, 6],
    IQ: [5, 6],
    IR: [5, 6],
    JO: [5, 6],
    KW: [5, 6],
    LY: [5, 6],
    MV: [5, 6],
    OM: [5, 6],
    QA: [5, 6],
    SA: [5, 6],
    SD: [5, 6],
    SY: [5, 6],
    YE: [5, 6],
    PK: [5, 6],
    BD: [5, 6],

    // Friday only
    AF: [5],

    // Sunday–Saturday (Western weekend)
    US: [0, 6],
    CA: [0, 6],
    MX: [0, 6],
    BR: [0, 6],
    AR: [0, 6],
    GB: [0, 6],
    FR: [0, 6],
    DE: [0, 6],
    IT: [0, 6],
    ES: [0, 6],
    PT: [0, 6],
    NL: [0, 6],
    BE: [0, 6],
    NO: [0, 6],
    SE: [0, 6],
    DK: [0, 6],
    FI: [0, 6],
    PL: [0, 6],
    HU: [0, 6],
    RO: [0, 6],
    BG: [0, 6],
    CZ: [0, 6],
    SK: [0, 6],
    GR: [0, 6],
    AU: [0, 6],
    NZ: [0, 6],
    JP: [0, 6],
    KR: [0, 6],
    CN: [0, 6],
    IN: [0, 6],
    ID: [0, 6],
    MY: [0, 6],
    PH: [0, 6],
    SG: [0, 6],
    ZA: [0, 6],
    KE: [0, 6],
    NG: [0, 6],
    TR: [0, 6],
    RU: [0, 6],
    UA: [0, 6],
    TH: [0, 6],
    VN: [0, 6],

    // Default fallback
    default: [0, 6],
};

/**
 * Core Time Utility Functions
 * These provide a clean, consistent API for all timezone operations
 */

/**
 * Get user's IANA timezone from session
 * @param session - User session containing timezone information
 * @returns IANA timezone string or 'UTC' as fallback
 */
export function getUserTimezone(session: Session | null): string {
    // Priority 1: User's timezone from database (time_zone field - now stores IANA directly)
    if (session?.user?.timezone) {
        // Validate that it's a valid IANA timezone
        if (isValidIANATimezone(session.user.timezone)) {
            return session.user.timezone;
        }
    }

    // Priority 2: Browser's local timezone (client-side only)
    if (typeof window !== "undefined") {
        const browserTimezone =
            Intl.DateTimeFormat().resolvedOptions().timeZone;
        return browserTimezone;
    }

    // Priority 3: UTC fallback
    return "UTC";
}

/**
 * Convert UTC date to user's timezone
 * @param utcDate - Date from database (TIMESTAMPTZ field)
 * @param session - User session containing timezone
 * @returns Moment object in user's timezone
 */
export function toUserTimezone(
    utcDate: Date,
    session: Session | null
): moment.Moment {
    const timezone = getUserTimezone(session);
    // With TIMESTAMPTZ, the date is already properly timezone-aware
    return moment(utcDate).tz(timezone);
}

/**
 * Core date formatting function - used by both client and server
 * This is the single source of truth for all date formatting logic.
 *
 * @param date - Date object or ISO string to format
 * @param format - Format type: 'time' (HH:mm), 'date' (MM/DD/YYYY), 'datetime' (MM/DD/YYYY HH:mm), 'title' (MM/DD/YYYY HH:mm)
 * @param locale - User locale (e.g., 'en-US', 'he-IL'). Defaults to 'en-US'
 * @param timezone - IANA timezone string (e.g., 'America/New_York'). Optional, defaults to UTC
 * @returns Formatted date string according to the specified format and locale
 *
 * @example
 * ```typescript
 * formatDateForDisplay(new Date(), "datetime", "en-US", "America/New_York")
 * // Returns: "12/25/2023, 02:30 PM"
 * ```
 */
export function formatDateForDisplay(
    date: Date | string,
    format: "time" | "date" | "datetime" | "title" = "title",
    locale?: string,
    timezone?: string
): string {
    try {
        const dateObj = typeof date === "string" ? new Date(date) : date;

        if (isNaN(dateObj.getTime())) {
            return "Invalid Date";
        }

        // CRITICAL FIX: Use Intl.DateTimeFormat with timeZone option
        // This properly respects both user locale (for date format) and timezone (for time conversion)
        // Intl.DateTimeFormat automatically formats dates according to the locale (e.g., MM/DD/YYYY for en-US, DD.MM.YYYY for de-DE)
        const formatOptions: Intl.DateTimeFormatOptions = {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            ...(format === "time" && { hour: "2-digit", minute: "2-digit" }),
            ...(format === "datetime" && {
                hour: "2-digit",
                minute: "2-digit",
            }),
            ...(format === "title" && { hour: "2-digit", minute: "2-digit" }),
            hour12: locale !== "he-IL",
            // Use timeZone option to convert UTC date to user's timezone
            // This ensures the time is displayed in the correct timezone while respecting locale for date format
            ...(timezone && isValidIANATimezone(timezone)
                ? { timeZone: timezone }
                : {}),
        };

        const result = dateObj.toLocaleString(locale || "en-US", formatOptions);

        return result;
    } catch (_error) {
        return "Invalid Date";
    }
}

/**
 * @deprecated Use formatDateForDisplay() directly instead
 * Legacy wrapper function for backward compatibility
 */
export function formatUserTime(
    utcDate: Date,
    session: Session | null,
    format: "time" | "date" | "datetime" | "title" = "time"
): string {
    const timezone = getUserTimezone(session);
    const userLocale = session?.user?.locale;

    return formatDateForDisplay(utcDate, format, userLocale, timezone);
}

/**
 * @deprecated Use formatDateForDisplay() directly instead
 * Legacy wrapper function for backward compatibility
 */
export function formatUserDate(
    utcDate: Date,
    session: Session | null,
    format: "date" = "date"
): string {
    const timezone = getUserTimezone(session);
    const userLocale = session?.user?.locale;

    return formatDateForDisplay(utcDate, format, userLocale, timezone);
}

/**
 * @deprecated Use formatDateForDisplay() directly instead
 * Legacy wrapper function for backward compatibility
 */
export function formatUserDateTime(
    utcDate: Date,
    session: Session | null,
    includeTime: boolean = false
): string {
    const timezone = getUserTimezone(session);
    const userLocale = session?.user?.locale;
    const format = includeTime ? "datetime" : "date";

    return formatDateForDisplay(utcDate, format, userLocale, timezone);
}

/**
 * Convenience function for simple local time to UTC conversion
 * @param localTime - Time in HH:mm format (e.g., '09:00')
 * @param baseDate - Base date to schedule from
 * @param timezone - IANA timezone string
 * @param daysToAdd - Optional days to add
 * @returns UTC Date object
 */
export function localTimeToUTC(
    localTime: string,
    baseDate: Date,
    timezone: string,
    daysToAdd: number = 0
): Date {
    // For backward compatibility, we'll keep the original implementation
    // since it takes a direct timezone parameter rather than country/state
    const [hours, minutes] = localTime.split(":").map(Number);

    const scheduledTime = moment.tz(timezone);
    scheduledTime.set({
        year: baseDate.getFullYear(),
        month: baseDate.getMonth(),
        date: baseDate.getDate(),
        hour: hours,
        minute: minutes,
        second: 0,
        millisecond: 0,
    });

    if (daysToAdd) {
        scheduledTime.add(daysToAdd, "days");
    }

    return scheduledTime.utc().toDate();
}

/**
 * Get locale string for a country code
 * @param countryCode - ISO2 country code (e.g., 'US', 'CA', 'GB')
 * @returns Locale string (e.g., 'en-US', 'en-CA', 'en-GB') or 'en-{countryCode}' as fallback
 */
export function findLocale(countryCode: string | null | undefined): string {
    if (!countryCode) {
        return "en-US"; // Default locale if no country code provided
    }

    try {
        // Try to get the locale using country-locale-map
        const locale = getLocaleByAlpha2(countryCode);
        if (locale) {
            // Convert locale format from en_CA to en-CA
            return locale.replace("_", "-");
        }

        // If no locale found, get country info and use its default locale
        const country = getCountryByAlpha2(countryCode);
        if (country?.default_locale) {
            return country.default_locale.replace("_", "-");
        }

        // Fallback to en-{countryCode} if no locale information is available
        return `en-${countryCode}`;
    } catch (_error) {
        // If any error occurs, fallback to en-{countryCode}
        return `en-${countryCode}`;
    }
}

/**
 * Mapping of common country names to ISO2 country codes
 * Used for resolving timezones from country names in UI components
 */
const countryNameToCodeMap: Record<string, string> = {
    "United States of America": "US",
    "United States": "US",
    USA: "US",
    India: "IN",
    "United Kingdom": "GB",
    UK: "GB",
    Germany: "DE",
    Australia: "AU",
    Israel: "IL",
    Canada: "CA",
    Japan: "JP",
    China: "CN",
    Brazil: "BR",
    "South Africa": "ZA",
    France: "FR",
};

/**
 * Get IANA timezone for a country and optional state
 * @param countryNameOrCode - Country name (e.g., "United States of America") or ISO2 code (e.g., "US")
 * @param stateCode - Optional state/province code (e.g., "CA" for California)
 * @returns IANA timezone string (e.g., "America/New_York") or "UTC" as fallback
 */
export function getCountryTimezone(
    countryNameOrCode: string | null | undefined,
    stateCode?: string | null
): string {
    if (!countryNameOrCode) {
        return "UTC";
    }

    // Normalize input - check if it's already an ISO2 code (2 characters, uppercase)
    let countryCode: string | null = null;
    if (
        countryNameOrCode.length === 2 &&
        countryNameOrCode === countryNameOrCode.toUpperCase()
    ) {
        // Likely an ISO2 code
        countryCode = countryNameOrCode;
    } else {
        // Try to find ISO2 code from country name mapping
        countryCode = countryNameToCodeMap[countryNameOrCode] || null;
    }

    if (!countryCode) {
        // If we can't find the country code, try to use countries-and-timezones library
        // by searching all countries (this is less efficient but more comprehensive)
        try {
            const allCountries = ct.getAllCountries();
            const countriesArray = Object.values(allCountries);
            const foundCountry = countriesArray.find(
                (c: ct.Country) =>
                    c.name.toLowerCase() === countryNameOrCode.toLowerCase() ||
                    c.id.toLowerCase() === countryNameOrCode.toLowerCase()
            );
            if (foundCountry?.timezones?.length) {
                // If state code provided and country is US/CA, try state mapping first
                if (stateCode && ["US", "CA"].includes(foundCountry.id)) {
                    const stateTimezone = stateToTimezoneMap[stateCode];
                    if (stateTimezone) {
                        return stateTimezone;
                    }
                }
                return foundCountry.timezones[0];
            }
        } catch (_error) {
            // Fallback to UTC if lookup fails
        }
        return "UTC";
    }

    // If state code provided and country is US/CA, use state mapping
    if (stateCode && ["US", "CA"].includes(countryCode)) {
        const stateTimezone = stateToTimezoneMap[stateCode];
        if (stateTimezone) {
            return stateTimezone;
        }
    }

    // Get timezone from country code using countries-and-timezones library
    try {
        const country = ct.getCountry(countryCode);
        if (country?.timezones?.length) {
            return country.timezones[0];
        }
    } catch (_error) {
        // Fallback to UTC if lookup fails
    }

    return "UTC";
}

/**
 * Get current time formatted for a specific country
 * @param countryNameOrCode - Country name (e.g., "United States of America") or ISO2 code (e.g., "US")
 * @param stateCode - Optional state/province code (e.g., "CA" for California)
 * @param locale - Optional locale for formatting (default: "en-US")
 * @param includeSeconds - Whether to include seconds in the time string (default: true)
 * @returns Formatted current time string (e.g., "02:30:45 PM") or "Unknown" on error
 */
export function getCurrentTimeForCountry(
    countryNameOrCode: string | null | undefined,
    stateCode?: string | null,
    locale: string = "en-US",
    includeSeconds: boolean = true
): string {
    const timezone = getCountryTimezone(countryNameOrCode, stateCode);

    if (timezone === "UTC" && !countryNameOrCode) {
        return "Unknown";
    }

    try {
        const options: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            ...(includeSeconds && { second: "2-digit" }),
            hour12: locale !== "he-IL",
        };

        return new Date().toLocaleTimeString(locale, options);
    } catch (_error) {
        return "Unknown";
    }
}

/**
 * Format a date string using session-based locale and format options
 * @param dateString - ISO date string to format
 * @param locale - Optional locale override (e.g., 'en-US', 'he-IL')
 * @param session - Optional user session for locale/timezone preferences
 * @returns Formatted date string
 */
export function formatDate(
    dateString: string,
    locale: string | null | undefined,
    session?: Session | null
): string {
    const date = new Date(dateString);

    // If session is provided, use the new format options
    if (session) {
        const formatOptions = getUserDateFormatOptions(session);
        const userLocale = getUserDateLocale(session);

        try {
            return date.toLocaleDateString(userLocale, formatOptions);
        } catch (_error) {
            // Fallback to default locale if user locale is invalid
            return date.toLocaleDateString();
        }
    }

    // Legacy behavior for backward compatibility
    const formatter = new Intl.DateTimeFormat(locale || "en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });

    return formatter.format(date).toString();
}

/**
 * Get user's locale with Hebrew date formatting logic and fallback support
 * This function handles both general locale retrieval and Hebrew-specific date formatting needs.
 *
 * @param session - User session
 * @param fallback - Fallback locale (default: 'en-US')
 * @returns User's locale with Hebrew logic applied, or fallback if no locale is set
 *
 * @example
 * ```typescript
 * // General usage - returns session locale or fallback
 * getUserDateLocale(session, "en-US") // Returns: session locale or "en-US"
 *
 * // Hebrew logic: If user has Hebrew locale, always returns "he-IL"
 * getUserDateLocale(session) // Returns: "he-IL" if Hebrew locale, otherwise session locale or "en-US"
 * ```
 */
export function getUserDateLocale(
    session: Session | null,
    fallback: string = "en-US"
): string {
    const userLocale = session?.user?.locale || fallback;
    const userLanguage = session?.user?.language;

    // Special case: If language is English but locale is Hebrew, use Hebrew locale
    if (userLanguage === "English" && userLocale === "he-IL") {
        return "he-IL";
    }

    // Standard logic: If locale is Hebrew, return Hebrew; otherwise return the locale or fallback
    if (userLocale === "he-IL") {
        return "he-IL";
    }

    return userLocale;
}

/**
 * Get date format string for MUI DatePicker based on user's locale from session.
 * Uses DD/MM/YYYY for he-IL, en-GB, and most locales; MM/DD/YYYY for en-US.
 *
 * @param session - User session
 * @returns Moment format string (e.g. "DD/MM/YYYY", "MM/DD/YYYY")
 */
export function getDatePickerFormat(
    session: Session | null,
    fallback: string = "DD/MM/YYYY"
): string {
    const userLocale = getUserDateLocale(session, "en-US");
    // en-US uses month-first; most other locales use day-first
    if (userLocale === "en-US") {
        return "MM/DD/YYYY";
    }
    return fallback;
}

/**
 * Moment locale id for MUI AdapterMoment (calendar month/weekday language).
 * Uses {@link Session.user.language} first: Hebrew → Hebrew labels; English → English labels with
 * US vs GB calendar from {@link getUserDateLocale}. If language is unset, falls back to locale only.
 * Ensure `moment/locale/he` and `moment/locale/en-gb` are imported where this is used (default `en` is built in).
 */
export function getMomentAdapterLocale(session: Session | null): string {
    const language = session?.user?.language;

    if (language === "Hebrew") {
        return "he";
    }

    if (language === "English") {
        const userLocale = getUserDateLocale(session, "en-US");
        return userLocale === "en-US" ? "en" : "en-gb";
    }

    const userLocale = getUserDateLocale(session, "en-US");
    if (userLocale === "he-IL") {
        return "he";
    }
    if (userLocale === "en-US") {
        return "en";
    }
    return "en-gb";
}

/**
 * Format a calendar date stored as YYYY-MM-DD for display using the user's session locale.
 * Parses as local calendar date (avoids UTC off-by-one for date-only strings).
 */
export function formatDateOnlyYmdForSession(
    ymd: string | null | undefined,
    session: Session | null
): string {
    if (ymd === null || ymd === undefined) {
        return "";
    }
    const s = String(ymd).trim();
    if (s === "") {
        return "";
    }
    const parts = s.split("-");
    if (parts.length !== 3) {
        return s;
    }
    const y = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
        return s;
    }
    const local = new Date(y, mo - 1, d);
    if (Number.isNaN(local.getTime())) {
        return s;
    }
    const userLocale = getUserDateLocale(session, "en-US");
    try {
        return local.toLocaleDateString(userLocale, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return local.toLocaleDateString();
    }
}

/**
 * Get date format options based on user's language and locale
 * @param session - User session
 * @returns Date format options object
 */
export function getUserDateFormatOptions(
    session: Session | null
): Intl.DateTimeFormatOptions {
    const userLocale = session?.user?.locale;
    const userLanguage = session?.user?.language;

    // Special case: If language is English but locale is Hebrew, use dd/MM/yyyy format
    if (userLanguage === "English" && userLocale === "he-IL") {
        return {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        };
    }

    // Standard format for other cases
    return {
        year: "numeric",
        month: "short",
        day: "numeric",
    };
}

/**
 * Get date and time format options based on user's language and locale
 * @param session - User session
 * @returns Date and time format options object
 */
export function getUserDateTimeFormatOptions(
    session: Session | null
): Intl.DateTimeFormatOptions {
    const userLocale = session?.user?.locale;
    const userLanguage = session?.user?.language;

    // Special case: If language is English but locale is Hebrew, use dd/MM/yyyy HH:mm format
    if (userLanguage === "English" && userLocale === "he-IL") {
        return {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        };
    }

    // Standard format for other cases
    return {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    };
}

/**
 * Format duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @param detailed - Whether to include translation keys and detailed formatting (default: false)
 * @returns Formatted duration string (e.g., "5 min" or "5 {{activities.fields.log_activity_minutes}}")
 */
export function formatDuration(
    seconds: number,
    detailed: boolean = false
): string {
    if (seconds < 60) {
        return detailed
            ? `${seconds} {{activities.fields.log_activity_seconds}}`
            : `${seconds} sec`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (detailed) {
        if (remainingSeconds === 0) {
            return `${minutes} {{activities.fields.log_activity_minutes}}`;
        } else {
            return `${minutes} {{activities.fields.log_activity_minutes}} ${remainingSeconds} {{activities.fields.log_activity_seconds}}`;
        }
    } else {
        return `${minutes} min`;
    }
}

/**
 * Unified scheduling function that combines timezone resolution, working day validation, and UTC conversion
 * This function can handle various scheduling scenarios with a single API
 *
 * @param options Configuration object for scheduling
 * @param options.baseDate - Base date to schedule from
 * @param options.timeOfDay - Time of day in HH:mm format (default: "09:00")
 * @param options.daysToAdd - Number of days to add to base date (default: 0)
 * @param options.countryCode - Primary country code (e.g., 'US')
 * @param options.stateCode - Primary state code (e.g., 'CA')
 * @param options.customerCountry - Customer country code (fallback)
 * @param options.customerState - Customer state code (fallback)
 * @param options.skipWeekends - Whether to skip weekends (default: true)
 * @param options.businessHoursOnly - Whether to enforce business hours (default: true)
 * @param options.returnUTC - Whether to return UTC date (default: true)
 * @param options.preserveInputDate - Whether to preserve the input date (default: false)
 * @returns Scheduled date/time as Date object
 */
export async function scheduleDateTime(options: {
    baseDate: Date;
    timeOfDay?: string;
    daysToAdd?: number;
    countryCode?: string | null;
    stateCode?: string | null;
    customerCountry?: string | null;
    customerState?: string | null;
    skipWeekends?: boolean;
    skipHolidays?: boolean;
    businessHoursOnly?: boolean;
    returnUTC?: boolean;
    preserveInputDate?: boolean;
    activityId?: number;
    isFirstStep?: boolean; // Add this parameter
}): Promise<{ scheduledTime: Date; calculation: string }> {
    const {
        baseDate,
        timeOfDay = "09:00",
        daysToAdd = 0,
        countryCode,
        stateCode,
        customerCountry,
        customerState,
        skipWeekends = true,
        skipHolidays = true,
        businessHoursOnly = true,
        returnUTC = true,
        preserveInputDate = false,
        isFirstStep = false, // Add this with default
    } = options;

    // Initialize calculation story with structured steps
    const calculationSteps: string[] = [];
    let stepNumber = 1;

    // Step 1: Base date
    calculationSteps.push(
        `Step ${stepNumber++}: Starting with base date: ${baseDate.toISOString()}`
    );

    // Determine the target country and state with priority logic
    let targetCountryCode: string | null = null;
    let targetStateCode: string | null | undefined = null;

    // Priority: 1. Direct country/state, 2. Customer
    if (countryCode) {
        targetCountryCode = countryCode;
        targetStateCode = stateCode;
    } else if (customerCountry) {
        targetCountryCode = customerCountry;
        targetStateCode = customerState;
    }

    // Clear state code for non-US/CA countries
    if (targetCountryCode && !["US", "CA"].includes(targetCountryCode)) {
        targetStateCode = null;
    }

    // Get timezone
    let timezone: string;
    if (targetStateCode && stateToTimezoneMap[targetStateCode]) {
        timezone = stateToTimezoneMap[targetStateCode];
    } else if (targetCountryCode) {
        const country = ct.getCountry(targetCountryCode);
        if (!country?.timezones?.length) {
            throw new Error(
                `Timezone not found for country code: ${targetCountryCode}`
            );
        }
        timezone = country.timezones[0];
    } else {
        timezone = "UTC";
    }

    // Step 2: Timezone determination
    calculationSteps.push(
        `Step ${stepNumber++}: Determined timezone as "${timezone}" based on country "${targetCountryCode || "N/A"}" and state "${targetStateCode || "N/A"}"`
    );

    // Parse time
    const [hours, minutes] = timeOfDay.split(":").map(Number);
    calculationSteps.push(
        `Step ${stepNumber++}: Set target time to ${timeOfDay} (${hours}:${minutes.toString().padStart(2, "0")})`
    );

    // Create base moment in target timezone
    let scheduledTime: moment.Moment;

    if (preserveInputDate) {
        // Parse the input date as if it's already in the target timezone
        const inputDate = new Date(baseDate);
        const year = inputDate.getUTCFullYear();
        const month = inputDate.getUTCMonth();
        const day = inputDate.getUTCDate();

        scheduledTime = moment.tz(
            [year, month, day, hours, minutes, 0, 0],
            timezone
        );
        calculationSteps.push(
            `Step ${stepNumber++}: Preserved input date and converted to timezone "${timezone}" → ${scheduledTime.format()}`
        );
    } else {
        // Current behavior - convert from UTC to target timezone
        // First, get the date in the target timezone
        const baseDateInTimezone = moment.tz(baseDate, timezone);
        // Then set the time on that date
        scheduledTime = baseDateInTimezone.clone().set({
            hour: hours,
            minute: minutes,
            second: 0,
            millisecond: 0,
        });
        calculationSteps.push(
            `Step ${stepNumber++}: Converted base date to timezone "${timezone}" and set time → ${scheduledTime.format()}`
        );
    }

    // Add days if specified FIRST
    if (daysToAdd !== undefined && daysToAdd !== 0) {
        const stepDescription = isFirstStep
            ? "first activity delay configuration"
            : "previous step configuration";
        calculationSteps.push(
            `Step ${stepNumber++}: Adding ${daysToAdd} day(s) from ${stepDescription}`
        );

        // For weekend skipping tests, we need to add days in UTC first to preserve the date
        if (skipWeekends) {
            const baseDateWithDays = new Date(
                baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000
            );
            // Treat the date as if it's already in the target timezone
            const year = baseDateWithDays.getUTCFullYear();
            const month = baseDateWithDays.getUTCMonth();
            const day = baseDateWithDays.getUTCDate();

            scheduledTime = moment.tz(
                [year, month, day, hours, minutes, 0, 0],
                timezone
            );
        } else {
            scheduledTime = scheduledTime.add(daysToAdd, "days");
        }
        calculationSteps.push(
            `Step ${stepNumber++}: After adding days → ${scheduledTime.format()}`
        );
    } else {
        const stepDescription = isFirstStep
            ? "first activity delay"
            : "previous step";
        calculationSteps.push(
            `Step ${stepNumber++}: No additional days configured from ${stepDescription}`
        );
    }

    // Handle business logic if enabled (AFTER adding days)
    if (businessHoursOnly || skipWeekends) {
        const nowLocal = moment.tz(timezone);
        calculationSteps.push(
            `Step ${stepNumber++}: Current time in timezone "${timezone}" is ${nowLocal.format()}`
        );

        let daysAddedForBusinessHours = 0;
        const maxDaysToAdd = 30; // Safety limit to prevent infinite loops
        while (
            scheduledTime.isBefore(nowLocal) &&
            daysAddedForBusinessHours < maxDaysToAdd
        ) {
            scheduledTime = scheduledTime
                .add(1, "day")
                .startOf("day")
                .set({ hour: hours, minute: minutes });
            daysAddedForBusinessHours++;
        }

        if (daysAddedForBusinessHours > 0) {
            calculationSteps.push(
                `Step ${stepNumber++}: Scheduled time was in the past, added ${daysAddedForBusinessHours} day(s) to ensure future scheduling → ${scheduledTime.format()}`
            );
        } else {
            calculationSteps.push(
                `Step ${stepNumber++}: Scheduled time is already in the future, no business hours adjustment needed`
            );
        }
    }

    // Skip weekends and holidays if enabled (unified loop to prevent double-skipping)
    if ((skipWeekends || skipHolidays) && targetCountryCode) {
        const weekendDays =
            weekendDaysMap[targetCountryCode] || weekendDaysMap["default"];
        const isWeekend = (day: number) => weekendDays.includes(day);

        // Safety cap: use max of daysToAdd or 14 to support long activity gaps while preventing infinite loops
        const maxAdjustments = Math.max(daysToAdd ?? 0, 14);
        let daysAddedForWeekends = 0;
        let daysAddedForHolidays = 0;
        let totalAdjustments = 0;
        let holidayService: any = null;
        let hasHolidayCalendar = false;

        // Lazy load holiday service if needed
        if (skipHolidays) {
            try {
                const { HolidayCalendarService } = await import(
                    "./holidayCalendarService"
                );
                holidayService = HolidayCalendarService.getInstance();
                const supportedCountries =
                    holidayService.getSupportedCountries();
                hasHolidayCalendar =
                    supportedCountries.includes(targetCountryCode);
            } catch (error) {
                calculationSteps.push(
                    `Step ${stepNumber++}: Holiday service unavailable (${(error as Error).message}), skipping holiday checks`
                );
            }
        }

        // Unified loop: check both weekends and holidays, skip prohibited days
        while (totalAdjustments < maxAdjustments) {
            let needsSkip = false;
            let skipReason = "";
            let isWeekendDay = false;
            let isHolidayDay = false;
            let holidayName = "";

            // Check for weekend
            if (skipWeekends) {
                isWeekendDay = isWeekend(scheduledTime.day());
            }

            // Check for holiday
            if (skipHolidays && hasHolidayCalendar && holidayService) {
                // Use the moment's date in local timezone
                // The isHoliday method uses toISOString().split("T")[0] which converts to UTC,
                // so we format the date string from moment and create a Date at noon UTC
                // to ensure the date string matches correctly
                const localDateStr = scheduledTime.format("YYYY-MM-DD");
                // Create a Date object representing this date at noon UTC
                // This ensures toISOString() will return the same YYYY-MM-DD string
                const [year, month, day] = localDateStr.split("-").map(Number);
                const dateForHolidayCheck = new Date(
                    Date.UTC(year, month - 1, day, 12, 0, 0)
                );
                const holidayCheck = holidayService.isHoliday(
                    targetCountryCode,
                    dateForHolidayCheck
                );
                if (holidayCheck.isHoliday) {
                    isHolidayDay = true;
                    holidayName = holidayCheck.holidayName || "holiday";
                }
            }

            // Determine if we need to skip and the reason
            // Priority: if both weekend and holiday, prefer weekend reason (but only count once)
            if (isWeekendDay) {
                needsSkip = true;
                skipReason = "weekend";
                daysAddedForWeekends++;
            } else if (isHolidayDay) {
                needsSkip = true;
                skipReason = holidayName;
                daysAddedForHolidays++;
            }

            // If no skip needed, we're done
            if (!needsSkip) {
                break;
            }

            // Skip to next day
            scheduledTime = scheduledTime
                .add(1, "day")
                .startOf("day")
                .set({ hour: hours, minute: minutes });
            totalAdjustments++;

            // Log the skip
            if (skipReason === "weekend") {
                calculationSteps.push(
                    `Step ${stepNumber++}: Scheduled time fell on weekend, skipping to next day → ${scheduledTime.format()}`
                );
            } else {
                calculationSteps.push(
                    `Step ${stepNumber++}: Scheduled time fell on ${skipReason}, skipping to next day → ${scheduledTime.format()}`
                );
            }
        }

        // Summary of adjustments
        if (daysAddedForWeekends > 0 || daysAddedForHolidays > 0) {
            const summaryParts: string[] = [];
            if (daysAddedForWeekends > 0) {
                summaryParts.push(`${daysAddedForWeekends} weekend day(s)`);
            }
            if (daysAddedForHolidays > 0) {
                summaryParts.push(`${daysAddedForHolidays} holiday day(s)`);
            }
            calculationSteps.push(
                `Step ${stepNumber++}: Skipped ${summaryParts.join(" and ")} → ${scheduledTime.format()}`
            );
        } else {
            calculationSteps.push(
                `Step ${stepNumber++}: Scheduled time is on a valid business day, no weekend/holiday adjustment needed`
            );
        }

        // Safety check: if we hit the limit, warn
        if (totalAdjustments >= maxAdjustments) {
            calculationSteps.push(
                `Step ${stepNumber++}: WARNING - Reached maximum adjustment limit (${maxAdjustments} days), using current date`
            );
        }
    }

    const finalTime = returnUTC
        ? scheduledTime.utc().toDate()
        : scheduledTime.toDate();

    calculationSteps.push(
        `Step ${stepNumber++}: Final conversion to ${returnUTC ? "UTC" : "Local"} format → ${finalTime.toISOString()}`
    );

    return {
        scheduledTime: finalTime,
        calculation: calculationSteps.join("\n"),
    };
}

/**
 * Enhanced scheduling with business hours consideration
 * This function provides advanced scheduling with personalized business hours,
 * holiday awareness, and response pattern optimization
 */
export async function scheduleWithBusinessHours(
    baseDate: Date,
    options: SchedulingOptions
): Promise<SchedulingResult> {
    const businessHoursService = BusinessHoursService.getInstance();
    return await businessHoursService.scheduleWithBusinessHours(
        baseDate,
        options
    );
}

/**
 * Get contact availability configuration
 */
export async function getContactAvailability(contactId: number) {
    const businessHoursService = BusinessHoursService.getInstance();
    return await businessHoursService.getContactAvailability(contactId);
}

/**
 * Update response pattern for optimization
 */
export async function updateResponsePattern(
    contactId: number,
    channel: string,
    responseTime: number,
    success: boolean
): Promise<void> {
    const businessHoursService = BusinessHoursService.getInstance();
    return await businessHoursService.updateResponsePattern(
        contactId,
        channel,
        responseTime,
        success
    );
}
