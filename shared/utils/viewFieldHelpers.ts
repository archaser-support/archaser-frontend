import { TFunction } from "i18next";

/**
 * Get field label from metadata or translations
 * Uses translation keys from metadata first, then falls back to field name
 */
export function getFieldLabel(
    tableName: string,
    fieldName: string,
    tablesMetadata: any[],
    t: TFunction,
    context?: string
): string {
    // Handle prefixed fields like "Company.name" or "Country.name"
    if (fieldName.includes(".")) {
        // First, check if this is a field in the current table's metadata
        const currentTable = tablesMetadata.find(
            (t: any) => t.name === tableName
        );
        const currentTableField = currentTable?.fields.find(
            (f: any) => f.name === fieldName
        );

        // If field has translationKey and translationNamespace in metadata, use them
        if (currentTableField?.translationKey && currentTableField?.translationNamespace) {
            const metadataTranslationKey = `fields.${currentTableField.translationKey}`;
            const translation = t(metadataTranslationKey, {
                ns: currentTableField.translationNamespace,
            });

            if (translation && translation !== metadataTranslationKey) {
                return translation;
            }
        }

        if (currentTableField?.label) {
            return currentTableField.label;
        }

        // If not found in current table, try to resolve as a relation
        const [relationName, relationField] = fieldName.split(".", 2);
        const relationTable = tablesMetadata.find(
            (t: any) => t.name === relationName
        );
        const field = relationTable?.fields.find(
            (f: any) => f.name === relationField
        );

        if (field) {
            // If field has translationKey and translationNamespace in metadata, use them
            if (field.translationKey && field.translationNamespace) {
                const metadataTranslationKey = `fields.${field.translationKey}`;
                const translation = t(metadataTranslationKey, {
                    ns: field.translationNamespace,
                });
                if (translation && translation !== metadataTranslationKey) {
                    return translation;
                }
            }

            if (field.label) {
                return field.label;
            }
        }

        // Also try to find the field in the relation table by just the field name (e.g., "name" in Customer table)
        if (relationTable) {
            const relationFieldByName = relationTable.fields.find(
                (f: any) => f.name === relationField
            );
            if (relationFieldByName) {
                // If field has translationKey and translationNamespace in metadata, use them
                if (relationFieldByName.translationKey && relationFieldByName.translationNamespace) {
                    const metadataTranslationKey = `fields.${relationFieldByName.translationKey}`;
                    const translation = t(metadataTranslationKey, {
                        ns: relationFieldByName.translationNamespace,
                    });
                    if (translation && translation !== metadataTranslationKey) {
                        return translation;
                    }
                }

                if (relationFieldByName.label) {
                    return relationFieldByName.label;
                }
            }
        }

        // Fallback to relation field name
        return relationField;
    }

    // Handle simple field names
    const table = tablesMetadata.find((t: any) => t.name === tableName);
    const field = table?.fields.find((f: any) => f.name === fieldName);

    if (field) {
        // If field has translationKey and translationNamespace in metadata, use them first
        if (field.translationKey && field.translationNamespace) {
            const metadataTranslationKey = `fields.${field.translationKey}`;
            const translation = t(metadataTranslationKey, {
                ns: field.translationNamespace,
            });

            if (translation && translation !== metadataTranslationKey) {
                return translation;
            }
        }

        if (field.label) {
            // IMPORTANT: If field.label exists but is in English, and we have translationKey,
            // we should still try to translate it. But if translationKey check above already failed,
            // we might need to try direct translation using the field name
            // Try direct translation using field name as fallback
            if (!field.translationKey || !field.translationNamespace) {
                const namespace = context || "customers";
                const directTranslationKey = `fields.${fieldName}`;
                const directTranslation = t(directTranslationKey, {
                    ns: namespace,
                });

                if (directTranslation && directTranslation !== directTranslationKey) {
                    return directTranslation;
                }
            }

            return field.label;
        }
    }

    // Special handling for Customer table fields that map to Company
    if (tableName === "Customer") {
        const companyTable = tablesMetadata.find(
            (t: any) => t.name === "Company"
        );
        const companyField = companyTable?.fields.find(
            (f: any) => f.name === fieldName
        );

        if (companyField) {
            // If field has translationKey and translationNamespace in metadata, use them
            if (companyField.translationKey && companyField.translationNamespace) {
                const metadataTranslationKey = `fields.${companyField.translationKey}`;
                const translation = t(metadataTranslationKey, {
                    ns: companyField.translationNamespace,
                });
                if (translation && translation !== metadataTranslationKey) {
                    return translation;
                }
            }

            if (companyField.label) {
                return companyField.label;
            }
        }
    }

    // Try direct translation using field name before final fallback
    // This handles virtual/computed fields that aren't in metadata
    const namespace = context || "customers";
    const directTranslationKey = `fields.${fieldName}`;
    const directTranslation = t(directTranslationKey, {
        ns: namespace,
    });

    if (directTranslation && directTranslation !== directTranslationKey) {
        return directTranslation;
    }

    // Final fallback to field name
    return fieldName;
}

/**
 * Check if a field is an amount field
 */
export function isAmountField(
    fieldConfig: any,
    tablesMetadata: any[]
): boolean {
    if (!fieldConfig) return false;
    const fieldName = (typeof fieldConfig === "string" ? fieldConfig : fieldConfig.field) || "";
    const fieldNameLower = fieldName.toLowerCase();

    if (
        fieldNameLower.includes("amount") ||
        fieldNameLower.includes("price") ||
        fieldNameLower.includes("cost") ||
        fieldNameLower.includes("debt") ||
        fieldNameLower.includes("balance") ||
        fieldNameLower.includes("total_invoices_overdue") ||
        fieldNameLower === "overdue_sum" ||
        fieldNameLower.includes("outstanding") ||
        fieldNameLower.includes("total_paid") ||
        fieldNameLower.endsWith("_paid") ||
        fieldNameLower === "paid" ||
        fieldNameLower === "approved_limit" ||
        fieldNameLower === "top_up_total" ||
        fieldNameLower === "effective_approved_limit" ||
        fieldNameLower === "capacity_gap_amount" ||
        fieldNameLower === "policy_risk_allocated" ||
        fieldNameLower === "terms_breach_outstanding" ||
        fieldNameLower === "top_up_resolved_amount"
    ) {
        return true;
    }

    const table = tablesMetadata.find((t: any) => t.name === fieldConfig.table);
    const field = table?.fields.find((f: any) => f.name === fieldConfig.field);
    return (
        (field?.type === "number" || field?.type === "Float" || field?.type === "Decimal") &&
        (fieldNameLower.includes("amount") || fieldNameLower.includes("total") || fieldNameLower.includes("sum"))
    );
}

/**
 * Check if a field is a date or datetime field
 */
export function isDateField(fieldConfig: any, tablesMetadata: any[]): boolean {
    if (!fieldConfig) return false;
    const fieldNameLower = fieldConfig.field?.toLowerCase() || "";
    if (fieldNameLower.includes("date") || fieldNameLower.includes("time")) {
        return true;
    }

    const table = tablesMetadata.find((t: any) => t.name === fieldConfig.table);

    let field: any = undefined;

    // Handle dot notation fields like "Country.name"
    if (fieldConfig.field.includes(".")) {
        // First, check if this is a field in the current table's metadata
        const currentTableField = table?.fields.find(
            (f: any) => f.name === fieldConfig.field
        );
        if (currentTableField) {
            field = currentTableField;
        } else {
            // If not found in current table, try to resolve as a relation
            const [relationName, relationField] = fieldConfig.field.split(
                ".",
                2
            );
            const relationTable = tablesMetadata.find(
                (t: any) => t.name === relationName
            );
            field = relationTable?.fields.find(
                (rf: any) => rf.name === relationField
            );
        }
    } else {
        field = table?.fields.find((f: any) => f.name === fieldConfig.field);
    }

    return (
        field?.type === "date" ||
        field?.type === "datetime" ||
        field?.type === "timestamp"
    );
}

/**
 * Check if a field is a boolean field
 */
export function isBooleanField(fieldConfig: any, tablesMetadata: any[]): boolean {
    if (!fieldConfig) return false;

    // Check field type from metadata
    const table = tablesMetadata.find((t: any) => t.name === fieldConfig.table);

    let field: any = undefined;

    // Handle dot notation fields like "Country.name"
    if (fieldConfig.field?.includes(".")) {
        // First, check if this is a field in the current table's metadata
        const currentTableField = table?.fields.find(
            (f: any) => f.name === fieldConfig.field
        );
        if (currentTableField) {
            field = currentTableField;
        } else {
            // If not found in current table, try to resolve as a relation
            const [relationName, relationField] = fieldConfig.field.split(
                ".",
                2
            );
            const relationTable = tablesMetadata.find(
                (t: any) => t.name === relationName
            );
            field = relationTable?.fields.find(
                (rf: any) => rf.name === relationField
            );
        }
    } else {
        field = table?.fields.find((f: any) => f.name === fieldConfig.field);
    }

    // Check if metadata indicates boolean type
    if (
        field?.type === "boolean" ||
        field?.type === "Boolean" ||
        field?.type === "bool"
    ) {
        return true;
    }

    // Check for known boolean fields by name pattern
    // Exclude enum fields like "status" which should not be rendered as switches
    const fieldName = fieldConfig.field?.toLowerCase() || "";
    
    // Exclude common enum fields that might match boolean patterns
    const enumFieldNames = ["status", "type", "category", "collection_status"];
    if (enumFieldNames.includes(fieldName)) {
        return false;
    }
    
    const booleanFieldPatterns = [
        "receives_",
        "is_",
        "has_",
        "enabled",
        "disabled",
    ];

    return booleanFieldPatterns.some((pattern) => fieldName.startsWith(pattern));
}

/**
 * Check if a field is an enum field
 */
export function isEnumField(fieldConfig: any, tablesMetadata: any[]): boolean {
    if (!fieldConfig) return false;

    // Check field type from metadata
    const table = tablesMetadata.find((t: any) => t.name === fieldConfig.table);

    let field: any = undefined;

    // Handle dot notation fields like "Country.name"
    if (fieldConfig.field.includes(".")) {
        // First, check if this is a field in the current table's metadata
        const currentTableField = table?.fields.find(
            (f: any) => f.name === fieldConfig.field
        );
        if (currentTableField) {
            field = currentTableField;
        } else {
            // If not found in current table, try to resolve as a relation
            const [relationName, relationField] = fieldConfig.field.split(
                ".",
                2
            );
            const relationTable = tablesMetadata.find(
                (t: any) => t.name === relationName
            );
            field = relationTable?.fields.find(
                (rf: any) => rf.name === relationField
            );
        }
    } else {
        field = table?.fields.find((f: any) => f.name === fieldConfig.field);
    }

    // Check if metadata indicates enum type
    if (
        field?.type === "enum" ||
        field?.type === "picklist" ||
        field?.type === "select"
    ) {
        return true;
    }

    // Check for known enum fields by name
    const fieldName = fieldConfig.field?.toLowerCase() || "";
    const enumFieldNames = [
        "category",
        "current_category",
        "collection_status",
        "type",
        "status",
    ];

    return enumFieldNames.some((name) => fieldName.includes(name));
}

/**
 * Translate enum values
 * Uses metadata translation namespace and enumValueKeyPrefix when available
 */
export function translateEnumValue(
    fieldConfig: any,
    value: any,
    t: TFunction,
    context?: string,
    tablesMetadata?: any[]
): string {
    if (value === null || value === undefined || value === "-" || value === "") {
        return "";
    }

    const fieldName = fieldConfig?.field?.toLowerCase() || "";
    
    // Special handling for status fields that use numeric values (1 = active, 0 = inactive)
    // This handles Contact.status and similar fields that store 1/0 instead of "Active"/"Inactive"
    if (fieldName === "status" && (value === 1 || value === 0 || value === "1" || value === "0" || value === "Active" || value === "Inactive")) {
        const statusValue = value === 1 || value === "1" || value === "Active" ? "active" : "inactive";
        const translationKey = `values.status_${statusValue}`;
        const namespace = "common";
        const translation = t(translationKey, { ns: namespace });
        // Check if translation was found (i18next returns the key when translation is not found)
        if (translation && translation !== translationKey) {
            return translation;
        }
        // Fallback to formatted value
        return statusValue === "active" ? "Active" : "Inactive";
    }
    
    const stringValue = String(value);

    // Get field metadata to determine translation namespace and enum value key prefix
    let metadataNamespace: string | undefined;
    let enumValueKeyPrefix: string | undefined;

    if (tablesMetadata && fieldConfig?.table && fieldConfig?.field) {
        const table = tablesMetadata.find((t: any) => t.name === fieldConfig.table);
        let field: any = undefined;

        // Handle dot notation fields like "Country.name"
        if (fieldConfig.field.includes(".")) {
            const [relationName, relationField] = fieldConfig.field.split(".", 2);
            const relationTable = tablesMetadata.find(
                (t: any) => t.name === relationName
            );
            field = relationTable?.fields.find(
                (f: any) => f.name === relationField
            );
        } else {
            field = table?.fields.find((f: any) => f.name === fieldConfig.field);
        }

        if (field) {
            metadataNamespace = field.translationNamespace;
            enumValueKeyPrefix = field.enumValueKeyPrefix;
        }
    }

    // Call outcome/direction are stored as snake_case tokens; force activities outcomes
    // translations even when metadata cache still has type "string".
    if (fieldName === "call_outcome") {
        metadataNamespace = metadataNamespace || "activities";
        enumValueKeyPrefix = enumValueKeyPrefix || "outcomes";
    } else if (fieldName === "call_direction") {
        metadataNamespace = metadataNamespace || "activities";
        enumValueKeyPrefix = enumValueKeyPrefix || "call_direction";
    }

    // Use metadata namespace if available, otherwise use context or default
    const namespace = metadataNamespace || context || "customers";

    // Use enumValueKeyPrefix from metadata if available, otherwise use field name
    const keyPrefix = enumValueKeyPrefix || fieldName;

    // Helper function to safely check if translation was found
    const isTranslationFound = (translation: string, translationKey: string): boolean => {
        if (!translation) return false;
        // i18next returns the key when translation is not found
        return translation !== translationKey;
    };

    // Normalize enum value: handle spaces, underscores, and various formats
    // This handles cases like "Promise to pay" (from DB @map) -> "promise_to_pay" (for translation key)
    const normalizedValue = stringValue
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_") // Replace spaces with underscores
        .replace(/_+/g, "_") // Collapse multiple underscores into one
        .replace(/^_|_$/g, ""); // Remove leading/trailing underscores

    // Generic enum translation using metadata enumValueKeyPrefix

    // Try: values.{keyPrefix}_{value}
    const translationKey = `values.${keyPrefix}_${normalizedValue}`;
    const translation = t(translationKey, { ns: namespace });
    if (isTranslationFound(translation, translationKey)) {
        return translation;
    }

    // Try: values.{table}_{keyPrefix}_{value} (for cases where table prefix is needed)
    const tableName = fieldConfig?.table?.toLowerCase() || "";
    if (tableName && tableName !== keyPrefix) {
        const tableBasedKey = `values.${tableName}_${keyPrefix}_${normalizedValue}`;
        const tableTranslation = t(tableBasedKey, { ns: namespace });
        if (isTranslationFound(tableTranslation, tableBasedKey)) {
            return tableTranslation;
        }
    }

    // Try: values.{value} (just the value itself)
    const valueOnlyKey = `values.${normalizedValue}`;
    const valueTranslation = t(valueOnlyKey, { ns: namespace });
    if (isTranslationFound(valueTranslation, valueOnlyKey)) {
        return valueTranslation;
    }

    // Final fallback: format the value nicely (replace underscores with spaces, capitalize words)
    // This provides a readable fallback when no translation is found
    const formatted = stringValue
        .replace(/_/g, " ") // Replace underscores with spaces
        .replace(/\s+/g, " ") // Collapse multiple spaces
        .trim()
        .split(" ")
        .map(
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");

    return formatted;
}
