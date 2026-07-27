import { useMemo, useCallback } from "react";
import { TableField, Table, isNumericField } from "@/utils/reportFieldUtils";
import { Field, getFieldOutputKey } from "@/utils/reportTableUtils";
import { getFieldTypeCategory, isIdField } from "@/utils/reportFieldUtils";

interface UseFieldFilteringProps {
    tables: Table[];
    selectedFields: Field[];
    searchQuery: string;
    typeFilter: string;
    getTableFields: (tableName: string) => TableField[];
}

export const useFieldFiltering = ({
    tables,
    selectedFields,
    searchQuery,
    typeFilter,
    getTableFields,
}: UseFieldFilteringProps) => {
    const selectedFieldKeys = useMemo(
        () => new Set(selectedFields.map((f) => getFieldOutputKey(f))),
        [selectedFields]
    );

    const filterFields = useCallback(
        (fields: TableField[], tableName: string): TableField[] => {
            return fields.filter((field) => {
                // Search filter
                const matchesSearch =
                    !searchQuery ||
                    field.label
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    field.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase());

                if (!matchesSearch) return false;

                // Type filter
                if (typeFilter === "all") return true;
                return getFieldTypeCategory(field.type) === typeFilter;
            });
        },
        [searchQuery, typeFilter]
    );

    const filteredFieldsByTable = useMemo(() => {
        return tables.reduce(
            (acc, table) => {
                const allFields = getTableFields(table.name);
                const baseFields = allFields.filter(
                    (field) => !isIdField(field.name)
                );
                const filtered = filterFields(baseFields, table.name);

                // Hide palette row only when all allowed output keys for this field are taken
                const available = filtered
                    .filter((f) => {
                        const base: Field = {
                            table: table.name,
                            field: f.name,
                        };
                        if (!isNumericField(f.type)) {
                            return !selectedFieldKeys.has(
                                getFieldOutputKey(base)
                            );
                        }
                        // Numeric: keep row visible so user can add more instances (e.g. second SUM);
                        // unique output keys are enforced by dedupeReportFieldOutputKeys on the builder.
                        return true;
                    })
                    .sort((a, b) => {
                        // Sort by field label (display name)
                        const labelA = (a.label || a.name).toLowerCase();
                        const labelB = (b.label || b.name).toLowerCase();
                        return labelA.localeCompare(labelB);
                    });

                acc[table.name] = available;
                return acc;
            },
            {} as Record<string, TableField[]>
        );
    }, [
        tables,
        searchQuery,
        typeFilter,
        selectedFieldKeys,
        getTableFields,
        filterFields,
    ]);

    return {
        selectedFieldKeys,
        filteredFieldsByTable,
    };
};
