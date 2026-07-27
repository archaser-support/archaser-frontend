import {
    CalendarToday,
    List,
    Numbers,
    TextFields,
    ToggleOn,
} from "@mui/icons-material";
import { TFunction } from "i18next";

export interface TableField {
    name: string;
    type: string;
    label: string;
    options?: string[];
    translationKey?: string;
    translationNamespace?: string;
}

export interface Table {
    name: string;
    label: string;
    fields: TableField[];
}

/**
 * Get field type icon component
 */
export const getFieldTypeIcon = (fieldType: string) => {
    const normalizedType = fieldType?.toLowerCase() || "";

    if (
        normalizedType === "number" ||
        normalizedType === "decimal" ||
        normalizedType === "integer"
    ) {
        return Numbers;
    } else if (
        normalizedType === "date" ||
        normalizedType === "datetime" ||
        normalizedType === "timestamp"
    ) {
        return CalendarToday;
    } else if (normalizedType === "boolean" || normalizedType === "bool") {
        return ToggleOn;
    } else if (
        normalizedType === "picklist" ||
        normalizedType === "select" ||
        normalizedType === "enum"
    ) {
        return List;
    } else {
        // Default to text for string, text, varchar, etc.
        return TextFields;
    }
};

/**
 * Check if field type is numeric
 */
export const isNumericField = (fieldType?: string): boolean => {
    if (!fieldType) return false;
    const normalizedType = fieldType.toLowerCase();
    return (
        normalizedType === "number" ||
        normalizedType === "decimal" ||
        normalizedType === "integer"
    );
};

/**
 * Get field type category for filtering
 */
export const getFieldTypeCategory = (fieldType: string): string => {
    const normalizedType = fieldType?.toLowerCase() || "";
    if (
        normalizedType === "number" ||
        normalizedType === "decimal" ||
        normalizedType === "integer"
    ) {
        return "number";
    } else if (
        normalizedType === "date" ||
        normalizedType === "datetime" ||
        normalizedType === "timestamp"
    ) {
        return "date";
    } else if (
        normalizedType === "enum" ||
        normalizedType === "picklist" ||
        normalizedType === "select"
    ) {
        return "enum";
    } else {
        return "string";
    }
};

/**
 * Normalize field name (removes Company. prefix for Customer table)
 */
export const normalizeFieldName = (
    tableName: string,
    fieldName: string
): string => {
    if (tableName === "Customer" && fieldName.startsWith("Company.")) {
        return fieldName.replace("Company.", "");
    }
    return fieldName;
};

/**
 * Get all fields for a table (including merged Company fields for Customer)
 */
export const getTableFields = (
    tableName: string,
    tables: Table[],
    t: TFunction
): TableField[] => {
    const table = tables.find((t) => t.name === tableName);
    if (!table) {
        return [];
    }

    // Filter out ID fields from base table fields (except owner/owner_id which are user references)
    // Also translate field labels using translationKey and translationNamespace if available
    let fields = (table.fields || [])
        .filter((f) => {
            const fieldNameLower = f.name.toLowerCase();
            // Allow selected *_id reference fields that should be user-selectable in reports.
            if (
                fieldNameLower === "owner" ||
                fieldNameLower === "owner_id"
            ) {
                return true;
            }
            // Exclude ID fields
            return fieldNameLower !== "id" && !fieldNameLower.endsWith("_id");
        })
        .map((f) => {
            // Translate field label if translationKey and translationNamespace are available
            let translatedLabel = f.label;
            if (f.translationKey && f.translationNamespace) {
                const translationKey = `fields.${f.translationKey}`;
                const translation = t(translationKey, {
                    ns: f.translationNamespace,
                    defaultValue: f.label,
                });
                if (translation && translation !== translationKey) {
                    translatedLabel = translation;
                }
            }
            return {
                ...f,
                label: translatedLabel,
            };
        });

    // If Customer table, include Company fields directly (without id, created_at, modified_at)
    if (tableName === "Customer") {
        const companyTable = tables.find((t) => t.name === "Company");

        if (companyTable?.fields) {
            const companyFields = companyTable.fields
                .filter((field) => {
                    const fieldNameLower = field.name.toLowerCase();
                    return (
                        fieldNameLower !== "id" &&
                        !fieldNameLower.endsWith("_id") &&
                        fieldNameLower !== "created_at" &&
                        fieldNameLower !== "modified_at" &&
                        // Exclude fields that are already handled as Customer virtual fields
                        fieldNameLower !== "name" &&
                        fieldNameLower !== "company_number"
                    );
                })
                .map((field) => {
                    // Translate field label if translationKey and translationNamespace are available
                    let translatedLabel = field.label || field.name;
                    if (field.translationKey && field.translationNamespace) {
                        const translationKey = `fields.${field.translationKey}`;
                        const translation = t(translationKey, {
                            ns: field.translationNamespace,
                            defaultValue: field.label || field.name,
                        });
                        if (translation && translation !== translationKey) {
                            translatedLabel = translation;
                        }
                    }
                    return {
                        ...field,
                        name: field.name, // Direct merge without Company. prefix
                        label: translatedLabel,
                    };
                });
            fields = [...fields, ...companyFields];
        }

        // Add Parent Customer Name field (only if not already present)
        if (!fields.some((f) => f.name === "parent_customer_name")) {
            fields.push({
                name: "parent_customer_name",
                type: "string",
                label: t("fields.parent_customer_name", "Parent Customer"),
            });
        }

        // Add Country and State fields (only if not already present)
        if (!fields.some((f) => f.name === "Country.name")) {
            fields.push({
                name: "Country.name",
                type: "string",
                label: t("fields.country", {
                    ns: "common",
                    defaultValue: "Country",
                }),
            });
        }
        if (!fields.some((f) => f.name === "State.name")) {
            fields.push({
                name: "State.name",
                type: "string",
                label: t("fields.state", {
                    ns: "customers",
                    defaultValue: "State",
                }),
            });
        }
        if (!fields.some((f) => f.name === "BusinessUnit.name")) {
            fields.push({
                name: "BusinessUnit.name",
                type: "string",
                label: t("fields.business_unit", {
                    ns: "customers",
                    defaultValue: "Business Unit",
                }),
            });
        }
    }

    // Add created_by and modified_by when not already in table metadata
    if (!fields.some((f) => f.name === "created_by")) {
        fields.push({
            name: "created_by",
            type: "user",
            label: t("fields.created_by", "Created By"),
        });
    }
    if (!fields.some((f) => f.name === "modified_by")) {
        fields.push({
            name: "modified_by",
            type: "user",
            label: t("fields.modified_by", "Modified By"),
        });
    }

    return fields;
};

/**
 * Check if field is an ID field
 */
export const isIdField = (fieldName: string): boolean => {
    const normalizedName = fieldName.toLowerCase();
    // Allow selected foreign-key fields that are intentionally exposed in report builder.
    if (normalizedName === "owner_id") {
        return false;
    }
    // Check for exact match: "id"
    if (normalizedName === "id") {
        return true;
    }
    // Check for fields ending with "_id"
    if (normalizedName.endsWith("_id")) {
        return true;
    }
    return false;
};

/**
 * Get RTL-aware tooltip props
 */
export const getRTLTooltipProps = (i18n: any) => ({
    arrow: true,
    enterDelay: 300,
    leaveDelay: 100,
    placement: "bottom" as const,
    PopperProps: {
        sx: {
            "& .MuiTooltip-tooltip": {
                direction: i18n.language === "he" ? "rtl" : "ltr",
            },
        },
    },
});
