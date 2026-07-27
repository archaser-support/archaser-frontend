import { useMemo, useCallback } from "react";
import { GridSortModel } from "@mui/x-data-grid";
import { ViewContextConfig } from "@/shared/utils/viewConfigs";

export interface UseViewDataTransformationOptions {
    /** Context configuration */
    config: ViewContextConfig;
    /** Raw data from API */
    rawData: any[];
    /** Sort model */
    sortModel: GridSortModel;
}

/**
 * Generic hook for transforming view data to row format
 * Works with any entity type based on context configuration
 */
export function useViewDataTransformation(
    options: UseViewDataTransformationOptions
) {
    const { config, rawData, sortModel } = options;
    const {
        entityIdField,
        entityNameField,
        fieldMappings,
        clientSortFields,
        tableName,
    } = config;

    // Transform view data to row format
    const transformViewData = useCallback(
        (viewData: any[]): any[] => {
            // Track IDs to ensure uniqueness - use Map to track original index for duplicates
            const idToIndexMap = new Map<number | string, number>();

            return viewData.map((row: any, index: number) => {
                // Extract ID using field mappings - simplified approach
                const idFields = fieldMappings?.id || [entityIdField];
                let entityId: number | string | undefined = undefined;

                // Try each ID field in order
                for (const field of idFields) {
                    let value: any = undefined;

                    if (field.includes(".")) {
                        // Handle dot notation
                        const parts = field.split(".");
                        value = row;
                        for (const part of parts) {
                            value = value?.[part];
                            if (value === undefined || value === null) break;
                        }
                    } else {
                        value = row[field];
                    }

                    if (value !== undefined && value !== null) {
                        entityId = value;
                        break;
                    }
                }

                // Fallback to standard ID fields
                if (!entityId) {
                    entityId = row[entityIdField] || row.id;
                }

                // Ensure unique ID - if duplicate, append index to make it unique
                if (entityId !== undefined && entityId !== null) {
                    const baseId = entityId;
                    if (idToIndexMap.has(baseId)) {
                        // Duplicate found - append index to make unique
                        entityId = `${baseId}-${index}`;
                    } else {
                        idToIndexMap.set(baseId, index);
                    }
                } else {
                    // If no ID found, use index-based ID
                    entityId = index;
                }

                // Extract name using field mappings
                const nameFields = fieldMappings?.name || [entityNameField];
                const nameFieldsArray = Array.isArray(nameFields)
                    ? nameFields
                    : [nameFields];
                const foundName = nameFieldsArray.find((field: string) => {
                    let value: any = undefined;
                    if (field.includes(".")) {
                        const parts = field.split(".");
                        value = row;
                        for (const part of parts) {
                            value = value?.[part];
                            if (value === undefined || value === null) break;
                        }
                    } else {
                        value = row[field];
                    }
                    // Filter out invalid values: null, undefined, empty string, or literal "name"
                    return (
                        value && value !== "name" && String(value).trim() !== ""
                    );
                });

                // Special handling for Customer entities: try to extract from Person/Company if name extraction failed
                let entityName = foundName;
                if (!entityName || entityName === "name") {
                    // For Customer table, try to extract name from Person or Company relations
                    if (tableName === "Customer") {
                        // Try Company name first
                        if (row.Company?.name) {
                            entityName = row.Company.name;
                        }
                        // Fallback to Person name
                        else if (row.Person) {
                            const firstName = row.Person.first_name || "";
                            const lastName = row.Person.last_name || "";
                            const fullName = row.Person.full_name;
                            const personName =
                                fullName || `${firstName} ${lastName}`.trim();
                            if (personName) {
                                entityName = personName;
                            }
                        }
                        // Try customer_number as last resort before fallback
                        else if (row.customer_number) {
                            entityName = row.customer_number;
                        }
                    }
                }

                // Final fallback chain
                if (!entityName || entityName === "name") {
                    entityName =
                        row[entityNameField] ||
                        (row.name && row.name !== "name" ? row.name : null) ||
                        `Entity ${entityId || "Unknown"}`;
                }

                // When using views, preserve all original fields from the view
                // This allows dynamic columns to access all fields directly
                const transformedRow: any = {
                    // First, spread all original fields from the report (preserves all keys)
                    ...row,
                    // Then add/override specific fields
                    id: entityId,
                    name: entityName,
                };

                // Apply field mappings for backward compatibility
                if (fieldMappings) {
                    Object.entries(fieldMappings).forEach(
                        ([targetField, sourceFields]) => {
                            if (
                                targetField === "id" ||
                                targetField === "name"
                            ) {
                                // Already handled above
                                return;
                            }

                            const sourceFieldsArray = Array.isArray(
                                sourceFields
                            )
                                ? sourceFields
                                : [sourceFields];

                            if (!transformedRow[targetField]) {
                                const value = sourceFieldsArray.find(
                                    (field: string) => {
                                        if (field.includes(".")) {
                                            const parts = field.split(".");
                                            let value = row;
                                            for (const part of parts) {
                                                value = value?.[part];
                                            }
                                            return (
                                                value !== undefined &&
                                                value !== null
                                            );
                                        }
                                        return (
                                            row[field] !== undefined &&
                                            row[field] !== null
                                        );
                                    }
                                );

                                if (value) {
                                    if (value.includes(".")) {
                                        const parts = value.split(".");
                                        let fieldValue = row;
                                        for (const part of parts) {
                                            fieldValue = fieldValue?.[part];
                                        }
                                        transformedRow[targetField] =
                                            fieldValue || "";
                                    } else {
                                        transformedRow[targetField] =
                                            row[value] || "";
                                    }
                                }
                            }
                        }
                    );
                }

                // Store raw data for reference (deep copy to avoid reference issues)
                transformedRow.raw = JSON.parse(JSON.stringify(row));

                return transformedRow;
            });
        },
        [entityIdField, entityNameField, fieldMappings, tableName]
    );

    // Transform data to rows
    const rows = useMemo(() => {
        if (!rawData || rawData.length === 0) {
            return [];
        }
        const transformed = transformViewData(rawData);

        return transformed;
    }, [rawData, transformViewData]);

    // Client-side sorting for fields that can't be sorted on the server
    const sortedRows = useMemo(() => {
        const sortField = sortModel[0]?.field;
        const sortDirection = sortModel[0]?.sort;

        const needsClientSorting =
            clientSortFields && sortField
                ? clientSortFields.includes(sortField)
                : false;

        if (!needsClientSorting || !sortField || !sortDirection) {
            return rows;
        }

        return [...rows].sort((a, b) => {
            const aValue = a[sortField] ?? "";
            const bValue = b[sortField] ?? "";

            // String comparison for text fields
            if (typeof aValue === "string" && typeof bValue === "string") {
                // Special handling for collection_status: ensure Active appears first
                if (sortField === "collection_status") {
                    if (aValue === "Active" && bValue !== "Active") {
                        return sortDirection === "asc" ? -1 : 1;
                    }
                    if (aValue !== "Active" && bValue === "Active") {
                        return sortDirection === "asc" ? 1 : -1;
                    }
                }

                const comparison = aValue.localeCompare(bValue);
                return sortDirection === "asc" ? comparison : -comparison;
            }

            // Numeric comparison for other fields
            const aNum = Number(aValue) || 0;
            const bNum = Number(bValue) || 0;
            return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
        });
    }, [rows, sortModel, clientSortFields]);

    return {
        rows: sortedRows,
        transformViewData,
    };
}
