/**
 * Generic Field Utilities
 *
 * Centralized logic for generic field configuration across Customer, Contact, Invoice, Payment.
 * All consumers must import from this module - no inline generic field config logic.
 */

export const GENERIC_ENTITY_KEYS = [
    "customer",
    "contact",
    "invoice",
    "payment",
] as const;

export const GENERIC_FIELD_KEYS = [
    "text1",
    "text2",
    "number1",
    "number2",
    "date1",
    "date2",
] as const;

export type GenericEntityKey = (typeof GENERIC_ENTITY_KEYS)[number];
export type GenericFieldKey = (typeof GENERIC_FIELD_KEYS)[number];

export interface GenericFieldConfigItem {
    enabled: boolean;
    label: string;
    read_only: boolean;
}

export interface EntityGenericFieldConfig {
    text1: GenericFieldConfigItem;
    text2: GenericFieldConfigItem;
    number1: GenericFieldConfigItem;
    number2: GenericFieldConfigItem;
    date1: GenericFieldConfigItem;
    date2: GenericFieldConfigItem;
}

export type GenericFieldConfig = {
    [K in GenericEntityKey]: EntityGenericFieldConfig;
};

const DEFAULT_LABELS: Record<GenericFieldKey, string> = {
    text1: "Custom Text 1",
    text2: "Custom Text 2",
    number1: "Custom Number 1",
    number2: "Custom Number 2",
    date1: "Custom Date 1",
    date2: "Custom Date 2",
};

export const MAX_LABEL_LENGTH = 100;

/** Database column names for generic fields */
export const GENERIC_FIELD_DB_COLUMNS: Record<GenericFieldKey, string> = {
    text1: "generic_text1",
    text2: "generic_text2",
    number1: "generic_number1",
    number2: "generic_number2",
    date1: "generic_date1",
    date2: "generic_date2",
};

/** Map field key to type for report metadata */
export function getFieldType(
    fieldKey: GenericFieldKey | string
): "string" | "number" | "date" {
    if (fieldKey.startsWith("text")) return "string";
    if (fieldKey.startsWith("number")) return "number";
    if (fieldKey.startsWith("date")) return "date";
    return "string";
}

/** Create default config for a single entity */
function createEntityDefaultConfig(): EntityGenericFieldConfig {
    return {
        text1: {
            enabled: false,
            label: DEFAULT_LABELS.text1,
            read_only: false,
        },
        text2: {
            enabled: false,
            label: DEFAULT_LABELS.text2,
            read_only: false,
        },
        number1: {
            enabled: false,
            label: DEFAULT_LABELS.number1,
            read_only: false,
        },
        number2: {
            enabled: false,
            label: DEFAULT_LABELS.number2,
            read_only: false,
        },
        date1: {
            enabled: false,
            label: DEFAULT_LABELS.date1,
            read_only: false,
        },
        date2: {
            enabled: false,
            label: DEFAULT_LABELS.date2,
            read_only: false,
        },
    };
}

/** Returns full default generic field config (24 fields across 4 entities) */
export function getDefaultGenericFieldConfig(): GenericFieldConfig {
    return {
        customer: createEntityDefaultConfig(),
        contact: createEntityDefaultConfig(),
        invoice: createEntityDefaultConfig(),
        payment: createEntityDefaultConfig(),
    };
}

/** Merge account config with defaults - returns complete config, never null */
export function mergeWithDefaults(
    config: GenericFieldConfig | null | undefined
): GenericFieldConfig {
    const defaults = getDefaultGenericFieldConfig();
    if (!config || typeof config !== "object") {
        return defaults;
    }

    const result: GenericFieldConfig = {} as GenericFieldConfig;

    for (const entity of GENERIC_ENTITY_KEYS) {
        const entityConfig = config[entity];
        const entityDefaults = defaults[entity];

        if (!entityConfig || typeof entityConfig !== "object") {
            result[entity] = entityDefaults;
            continue;
        }

        result[entity] = {} as EntityGenericFieldConfig;

        for (const fieldKey of GENERIC_FIELD_KEYS) {
            const fieldConfig = entityConfig[fieldKey];
            const fieldDefaults = entityDefaults[fieldKey];

            if (!fieldConfig || typeof fieldConfig !== "object") {
                result[entity][fieldKey] = fieldDefaults;
                continue;
            }

            result[entity][fieldKey] = {
                enabled:
                    typeof fieldConfig.enabled === "boolean"
                        ? fieldConfig.enabled
                        : fieldDefaults.enabled,
                label:
                    typeof fieldConfig.label === "string" &&
                        fieldConfig.label.trim()
                        ? fieldConfig.label.trim().slice(0, MAX_LABEL_LENGTH)
                        : fieldDefaults.label,
                read_only:
                    typeof fieldConfig.read_only === "boolean"
                        ? fieldConfig.read_only
                        : fieldDefaults.read_only,
            };
        }
    }

    return result;
}

/** Validate a single field config - returns validation errors or null */
export function validateFieldConfig(
    fieldConfig: Partial<GenericFieldConfigItem>,
    defaultLabel: string
): { label?: string } | null {
    const label = fieldConfig.label?.trim();
    if (!label) {
        return { label: "Label is required" };
    }
    if (label.length > MAX_LABEL_LENGTH) {
        return { label: `Label must be ${MAX_LABEL_LENGTH} characters or less` };
    }
    return null;
}

/** Get default label for a field key */
export function getDefaultLabel(fieldKey: GenericFieldKey): string {
    return DEFAULT_LABELS[fieldKey];
}

/** Get enabled fields for an entity (for display/import) */
export function getEnabledFields(
    config: GenericFieldConfig,
    entity: GenericEntityKey,
    options?: { excludeReadOnly?: boolean }
): GenericFieldKey[] {
    const entityConfig = config[entity];
    if (!entityConfig) return [];

    return GENERIC_FIELD_KEYS.filter((key) => {
        const item = entityConfig[key];
        if (!item?.enabled) return false;
        if (options?.excludeReadOnly && item.read_only) return false;
        return true;
    });
}
