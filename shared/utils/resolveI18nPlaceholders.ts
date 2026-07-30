import type { TFunction } from "i18next";

export type I18nTranslateFn = (
    key: string,
    options?: Record<string, unknown>
) => string;

const WRAPPED_KEY_RE = /^\{\{\s*([^}]+)\s*\}\}$/;
/** Namespaced keys stored as {{activities.fields.foo}} / {{users.values.portal_user}} */
const NAMESPACED_KEY_RE = /^[a-z_][a-z0-9_]*(\.[a-z0-9_]+)+$/i;
/** Any {{...}} token in mixed content (HTML labels, titles with params, etc.) */
const PLACEHOLDER_RE = /\{\{\s*([^}]+)\s*\}\}/g;
/**
 * Activity content embeds literal values rather than params: `{{user:<name>}}`
 * for the acting agent and `{{date:<iso>}}` / `{{dateOnly:<iso>}}` for
 * timestamps. They are not i18n keys, so they need their own resolution.
 */
const PREFIXED_VALUE_RE = /^(user|date|dateOnly):([\s\S]+)$/;
/**
 * Legacy rows stored detail labels as the English word itself rather than a key
 * — `{{Agent}}`, `{{Call Direction}}`. They map onto `activities.fields.*` by
 * snake-casing. Restricted to Title Case so camelCase params are left to the
 * param lookup.
 */
const ENGLISH_LABEL_RE = /^[A-Z][a-z]+(?: [A-Z][a-z]+)*$/;

export type PlaceholderFormatters = {
    /** Renders an embedded timestamp in the viewer's locale and timezone. */
    formatDate?: (date: Date, kind: "date" | "datetime") => string;
};

const KNOWN_NAMESPACES = new Set([
    "activities",
    "activity",
    "common",
    "customers",
    "disputes",
    "users",
    "agents",
    "notifications",
    "business_unit",
    "import",
    "portal",
]);

/**
 * Map legacy singular `activity.*` keys to the `activities` namespace used in locale files.
 */
function normalizeNamespacedKey(rawKey: string): {
    ns: string;
    key: string;
} | null {
    const key = rawKey.trim().replace(/\s+/g, "_");
    if (!NAMESPACED_KEY_RE.test(key)) {
        return null;
    }
    const parts = key.split(".");
    let ns = parts[0];
    let rest = parts.slice(1).join(".");

    // Legacy: {{activity.log_activity.comment}} → activities.fields.log_activity_comment
    // or activities.values / fields depending on path.
    if (ns === "activity") {
        ns = "activities";
        if (rest.startsWith("log_activity.")) {
            const leaf = rest.slice("log_activity.".length);
            rest = `fields.log_activity_${leaf}`;
        } else if (!rest.startsWith("fields.") && !rest.startsWith("values.")) {
            rest = `fields.${rest}`;
        }
    }

    if (!KNOWN_NAMESPACES.has(ns) && ns !== "activities") {
        // Still try — unknown namespaces may exist in locale packs.
    }

    return { ns, key: rest };
}

/**
 * Stored `title_params` values are frequently namespaced keys themselves
 * (e.g. `oldCategory: "customers.values.category_promise_to_pay"`), so they must
 * be translated before interpolation or the raw key ends up in the sentence.
 * Nested resolution is intentionally one level deep — a resolved label is text.
 */
function resolveParamValues(
    params: Record<string, unknown> | undefined,
    t: I18nTranslateFn
): Record<string, unknown> | undefined {
    if (!params) {
        return params;
    }
    const resolved: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(params)) {
        if (typeof value !== "string") {
            resolved[name] = value;
            continue;
        }
        const wrapped = value.trim().match(WRAPPED_KEY_RE);
        const candidate = wrapped ? wrapped[1].trim() : value.trim();
        resolved[name] = NAMESPACED_KEY_RE.test(candidate.replace(/\s+/g, "_"))
            ? (translateNamespaced(candidate, t) ?? value)
            : value;
    }
    return resolved;
}

/**
 * i18next leaves a `{{param}}` token untouched when no value is supplied, so a
 * template that gains a placeholder renders the raw token on every row written
 * before it existed. Drop those leftovers and close up the separators they
 * leave behind. Namespaced tokens are preserved — they are keys, not params,
 * and are resolved by the caller.
 */
function stripUnresolvedPlaceholders(text: string): string {
    if (!text.includes("{{")) {
        return text;
    }
    return text
        .replace(PLACEHOLDER_RE, (match, inner: string) =>
            NAMESPACED_KEY_RE.test(String(inner).trim().replace(/\s+/g, "_"))
                ? match
                : ""
        )
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\s+([,.;:])/g, "$1")
        .trim();
}

function translateNamespaced(
    fullKey: string,
    t: I18nTranslateFn,
    params?: Record<string, unknown>
): string | null {
    const normalized = normalizeNamespacedKey(fullKey);
    if (!normalized) {
        return null;
    }
    const { ns, key } = normalized;
    const translated = t(key, {
        ns,
        defaultValue: "___NOT_FOUND___",
        ...(resolveParamValues(params, t) || {}),
    });
    if (
        translated &&
        translated !== "___NOT_FOUND___" &&
        translated !== key &&
        translated !== fullKey
    ) {
        return stripUnresolvedPlaceholders(translated);
    }
    return null;
}

/**
 * Resolve a single stored activity/notification key such as
 * `{{activities.fields.overdue_block_applied_title}}` or
 * `activities.fields.overdue_block_applied_title`.
 */
export function translateStoredI18nKey(
    raw: string,
    t: I18nTranslateFn,
    params?: Record<string, unknown>
): string {
    if (!raw || typeof raw !== "string") {
        return raw || "";
    }

    const trimmed = raw.trim();
    const wrapped = trimmed.match(WRAPPED_KEY_RE);
    const candidate = wrapped ? wrapped[1].trim() : trimmed;

    const translated = translateNamespaced(candidate, t, params);
    if (translated) {
        return translated;
    }

    // Bare activities-relative key (fields.xxx)
    if (/^(fields|values|actions|sections|messages)\./.test(candidate)) {
        const fromActivities = t(candidate, {
            ns: "activities",
            defaultValue: "___NOT_FOUND___",
            ...(resolveParamValues(params, t) || {}),
        });
        if (
            fromActivities &&
            fromActivities !== "___NOT_FOUND___" &&
            fromActivities !== candidate
        ) {
            return stripUnresolvedPlaceholders(fromActivities);
        }
    }

    return wrapped ? trimmed : raw;
}

/**
 * `dateOnly` values are stored as UTC midnight, so parsing them as instants and
 * rendering in the viewer's timezone can roll the day backwards. Anchor them to
 * local midnight instead, and keep true timestamps as-is.
 */
function parseEmbeddedDate(value: string, dateOnly: boolean): Date | null {
    if (dateOnly) {
        const [year, month, day] = value.slice(0, 10).split("-").map(Number);
        if (![year, month, day].every(Number.isFinite)) {
            return null;
        }
        const local = new Date(year, month - 1, day);
        return Number.isNaN(local.getTime()) ? null : local;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function defaultFormatDate(date: Date, kind: "date" | "datetime"): string {
    return date.toLocaleString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(kind === "datetime" ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
}

/**
 * Resolve a `{{prefix:value}}` token. Returns null when the token isn't one, so
 * the caller can fall through to key/param resolution.
 */
function resolvePrefixedValue(
    token: string,
    t: I18nTranslateFn,
    formatters?: PlaceholderFormatters
): string | null {
    const matched = token.match(PREFIXED_VALUE_RE);
    if (!matched) {
        return null;
    }
    const [, prefix, rawValue] = matched;
    const value = rawValue.trim();

    if (prefix === "user") {
        // The API resolves ids to display names and maps non-user actors
        // (system, portal) to keys; anything left is already presentable text.
        return translateStoredI18nKey(value, t) || value;
    }

    const kind = prefix === "date" ? "datetime" : "date";
    const parsed = parseEmbeddedDate(value, kind === "date");
    if (!parsed) {
        return value;
    }
    return (formatters?.formatDate ?? defaultFormatDate)(parsed, kind);
}

/**
 * Replace all `{{namespace.path.key}}` placeholders in mixed text/HTML.
 * Simple `{{param}}` tokens are filled from `params` when present.
 */
export function resolveI18nPlaceholders(
    raw: string,
    t: I18nTranslateFn,
    params?: Record<string, unknown>,
    formatters?: PlaceholderFormatters
): string {
    if (!raw || typeof raw !== "string") {
        return raw || "";
    }

    // Fast path: entire string is one wrapped key (common for activity titles).
    if (WRAPPED_KEY_RE.test(raw.trim())) {
        const wrappedToken = raw.trim().match(WRAPPED_KEY_RE)?.[1]?.trim() ?? "";
        const prefixed = resolvePrefixedValue(wrappedToken, t, formatters);
        if (prefixed !== null) {
            return prefixed;
        }
        return translateStoredI18nKey(raw, t, params);
    }

    return raw.replace(PLACEHOLDER_RE, (match, inner: string) => {
        const token = String(inner).trim();
        const prefixed = resolvePrefixedValue(token, t, formatters);
        if (prefixed !== null) {
            return prefixed;
        }
        if (NAMESPACED_KEY_RE.test(token.replace(/\s+/g, "_"))) {
            const translated = translateNamespaced(token, t, params);
            if (translated) {
                return translated;
            }
        }
        if (params && Object.prototype.hasOwnProperty.call(params, token)) {
            const value = params[token];
            if (value == null) {
                return "";
            }
            // Nested translation keys in param values
            if (typeof value === "string" && value.includes("{{")) {
                return resolveI18nPlaceholders(value, t, undefined, formatters);
            }
            if (
                typeof value === "string" &&
                NAMESPACED_KEY_RE.test(value.replace(/\s+/g, "_"))
            ) {
                return translateStoredI18nKey(value, t) || String(value);
            }
            return String(value);
        }
        // activities-relative leaf inside braces
        if (/^(fields|values|actions)\./.test(token)) {
            const fromActivities = t(token, {
                ns: "activities",
                defaultValue: "___NOT_FOUND___",
                ...(params || {}),
            });
            if (
                fromActivities &&
                fromActivities !== "___NOT_FOUND___" &&
                fromActivities !== token
            ) {
                return fromActivities;
            }
        }
        if (ENGLISH_LABEL_RE.test(token)) {
            const key = `fields.${token.toLowerCase().replace(/\s+/g, "_")}`;
            const translated = t(key, {
                ns: "activities",
                defaultValue: "___NOT_FOUND___",
            });
            // Worst case the bare English word still beats showing the braces.
            return translated !== "___NOT_FOUND___" && translated !== key
                ? translated
                : token;
        }
        return match;
    });
}

/** Convenience for i18next `TFunction` callers. */
export function resolveI18nPlaceholdersWithT(
    raw: string,
    t: TFunction,
    params?: Record<string, unknown>
): string {
    return resolveI18nPlaceholders(raw, t as I18nTranslateFn, params);
}
