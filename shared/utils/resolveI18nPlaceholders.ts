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
        ...(params || {}),
    });
    if (
        translated &&
        translated !== "___NOT_FOUND___" &&
        translated !== key &&
        translated !== fullKey
    ) {
        return translated;
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
            ...(params || {}),
        });
        if (
            fromActivities &&
            fromActivities !== "___NOT_FOUND___" &&
            fromActivities !== candidate
        ) {
            return fromActivities;
        }
    }

    return wrapped ? trimmed : raw;
}

/**
 * Replace all `{{namespace.path.key}}` placeholders in mixed text/HTML.
 * Simple `{{param}}` tokens are filled from `params` when present.
 */
export function resolveI18nPlaceholders(
    raw: string,
    t: I18nTranslateFn,
    params?: Record<string, unknown>
): string {
    if (!raw || typeof raw !== "string") {
        return raw || "";
    }

    // Fast path: entire string is one wrapped key (common for activity titles).
    if (WRAPPED_KEY_RE.test(raw.trim())) {
        return translateStoredI18nKey(raw, t, params);
    }

    return raw.replace(PLACEHOLDER_RE, (match, inner: string) => {
        const token = String(inner).trim();
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
                return resolveI18nPlaceholders(value, t);
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
