"use client";

import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    ArrowBack,
    ArrowForward,
    InfoOutlined,
    TrendingUp
} from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    Divider,
    FormControlLabel,
    IconButton,
    Paper,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import DragDropFieldSelector from "@/components/reports/DragDropFieldSelector";
import FilterBuilder from "@/components/reports/FilterBuilder";
import FormulaColumnEditor, {
    type FormulaColumnEditorHandle,
} from "@/components/reports/FormulaColumnEditor";
import GroupingBuilder from "@/components/reports/GroupingBuilder";
import { useSessionState } from "@/hooks/useSessionState";
import type { ReportConfig } from "@/server/services/ReportService";
import { findFormulasReferencingOperand } from "@/shared/reportFormula/findFormulasReferencingOperand";
import { MAX_FORMULAS_PER_REPORT } from "@/shared/reportFormula/types";
import {
    getFormulaOperandReference,
    isGroupedReportConfig,
    resolveReportColumnOrder,
    syncFieldsOrderFromColumnOrder,
} from "@/shared/reportFormula/columnOrder";
import {
    resolveFormulaValidationMessage,
    validateAllReportFormulas,
} from "@/shared/reportFormula/validateFormulaDraft";
import { getViewConfig, MAIN_REPORTS_MENU_CONTEXT } from "@/shared/utils/viewConfigs";
import {
    buildDashboardChartDetailsReturnPath,
    isDashboardChartDetailsReportContext,
} from "@/shared/dashboard/dashboardInvoiceBuilderReturn";
import {
    buildOperationDashboardDetailsReturnPath,
    isOperationDashboardDetailsReportContext,
} from "@/shared/dashboard/dashboardOperationBuilderReturn";
import {
    DASHBOARD_ACTIVITIES_CONTEXT,
    DASHBOARD_CUSTOMERS_CONTEXT,
    DASHBOARD_DISPUTES_CONTEXT,
    DASHBOARD_INVOICES_CONTEXT,
    DASHBOARD_PAYMENTS_CONTEXT,
    DASHBOARD_PROMISES_CONTEXT,
} from "@/shared/dashboard/dashboardInvoiceReportAccess";
import AppUrls from "@/utils/appUrls";
import { getRTLTooltipProps } from "@/utils/reportFieldUtils";
import {
    dedupeReportFieldOutputKeys,
    getFieldOutputKey,
    getForbiddenGroupingKeysForAggregatedFields,
    isReportFilterValueIncomplete,
} from "@/utils/reportTableUtils";

/** Same join inference as autoDetectJoins useMemo; used at hydrate time so we do not rely on selectedTables state. */
function inferAutoJoinsFromSelectedTables(
    selectedTables: Array<{ name: string; label: string }>,
    relationships: Array<{
        from: string;
        to: string;
        fromField?: string;
        toField?: string;
    }>
): NonNullable<ReportConfig["joins"]> {
    if (selectedTables.length < 2) {
        return [];
    }
    const joins: NonNullable<ReportConfig["joins"]> = [];
    for (let i = 0; i < selectedTables.length; i++) {
        for (let j = i + 1; j < selectedTables.length; j++) {
            const table1 = selectedTables[i];
            const table2 = selectedTables[j];
            const relationship = relationships.find(
                (rel: any) =>
                    (rel.from === table1.name && rel.to === table2.name) ||
                    (rel.from === table2.name && rel.to === table1.name)
            );
            if (relationship) {
                joins.push({
                    type: "LEFT",
                    from: relationship.from,
                    to: relationship.to,
                    on: relationship.fromField || relationship.toField || "",
                });
            }
        }
    }
    return joins;
}

const ReportBuilderPage: React.FC = () => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const locale = (params?.locale as string) || "en";
    const theme = useTheme();
    const { session } = useSessionState();
    const queryClient = useQueryClient();

    const reportId = searchParams?.get("id")
        ? parseInt(searchParams.get("id") as string, 10)
        : null;

    const isClone = searchParams?.get("clone") === "true";
    const contextFromUrl = searchParams?.get("context") || "";

    // Master admin account (10013): chart builder step, system report flags, etc.
    const isAdminAccount = session?.user?.account_id === 10013;

    // Common context values for different pages
    const contextOptions = [
        "customers",
        "agents",
        "invoices",
        "disputes",
        "legal",
        "promise-to-pay",
        "activity-sequences",
        "reports",
        "dashboard",
        DASHBOARD_INVOICES_CONTEXT,
        DASHBOARD_CUSTOMERS_CONTEXT,
        DASHBOARD_PAYMENTS_CONTEXT,
        DASHBOARD_ACTIVITIES_CONTEXT,
        DASHBOARD_DISPUTES_CONTEXT,
        DASHBOARD_PROMISES_CONTEXT,
        "control-center",
        "activity-templates",
        "dispute-reasons",
        "settings",
    ];

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [context, setContext] = useState(
        contextFromUrl || MAIN_REPORTS_MENU_CONTEXT
    );
    const prevUrlContextRef = useRef<string | null>(null);

    // Sync context state from URL only when the URL's context param actually changes
    // (e.g. user navigated to a different page). Do not overwrite user's Location
    // selection when URL has no context param.
    useEffect(() => {
        const urlContext = searchParams?.get("context") || "";
        if (urlContext !== prevUrlContextRef.current) {
            prevUrlContextRef.current = urlContext;
            if (urlContext) {
                setContext(urlContext);
            }
        }
    }, [searchParams]);
    const [isSystem, setIsSystem] = useState(false);
    const [isDefault, setIsDefault] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [selectedTables, setSelectedTables] = useState<
        Array<{ name: string; label: string }>
    >([]);
    const [reportConfig, setReportConfig] = useState<ReportConfig>({
        tables: [],
        fields: [],
        filters: [],
        grouping: [],
    });
    const [filterValidationErrors, setFilterValidationErrors] = useState<
        Record<number, string>
    >({});
    const [formulaValidationErrors, setFormulaValidationErrors] = useState<
        Record<string, string>
    >({});
    const [activeId, setActiveId] = useState<string | null>(null);
    const [draggedTable, setDraggedTable] = useState<{
        name: string;
        label: string;
    } | null>(null);

    // Track which report we've loaded to avoid overwriting user changes on query refetch
    const initializedReportIdRef = useRef<number | null>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const formulaEditorRef = useRef<FormulaColumnEditorHandle>(null);

    // Fetch metadata
    const { data: metadata, isLoading: metadataLoading } = useQuery({
        queryKey: ["report-metadata"],
        queryFn: async () => {
            try {
                const response = await api.get("/api/reports/metadata");
                return response.data;
            } catch (error: any) {
                const errorMessage = error.response?.data?.error
                    || error.message
                    || "Failed to fetch report metadata";
                console.error("[ReportBuilder] Error fetching metadata:", {
                    message: errorMessage,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                });
                throw new Error(errorMessage);
            }
        },
    });

    // Fetch existing report data if editing or cloning
    const { data: existingReport, isLoading: reportLoading } = useQuery({
        queryKey: ["report", reportId],
        queryFn: async () => {
            const response = await api.get(`/api/reports/${reportId}`);
            return response.data.report;
        },
        enabled: !!reportId && !isNaN(reportId),
    });

    const relationships = useMemo(() => {
        return metadata?.relationships || [];
    }, [metadata]);

    const tables = useMemo(() => {
        if (!metadata?.tables) return [];

        // Get all tables (excluding hidden ones)
        let availableTables = metadata.tables
            .filter((table: any) => !table.hidden)
            .map((table: any) => ({
                name: table.name,
                label: table.label,
                fields: table.fields || [],
            }));

        // If context is provided, filter to show only context table and its parent table
        // Read context directly from URL to ensure we get the latest value
        const urlContext = searchParams?.get("context") || "";
        const effectiveContext = urlContext || contextFromUrl || context;
        if (effectiveContext && effectiveContext.trim() !== "") {
            const viewConfig = getViewConfig(effectiveContext);

            if (viewConfig) {
                const contextTableName = viewConfig.tableName;

                // Find parent table from relationships
                // Look for relationships where the context table is the "from" table
                // This indicates a parent-child relationship (e.g., Invoice -> Customer via customer_id)
                let parentTableName: string | null = null;
                if (relationships && relationships.length > 0) {
                    // Find relationships where the context table references another table via a foreign key
                    // Priority: Look for common parent relationships (Customer, Account, etc.)
                    // For Invoice, we want to find Invoice -> Customer via customer_id
                    const commonParentTables = ["Customer", "Account"];

                    // First, try to find a relationship to a common parent table
                    const matchingRelationships = relationships.filter((rel: any) =>
                        rel.from === contextTableName &&
                        rel.fromField?.endsWith("_id")
                    );

                    // Prioritize Customer over Account for Invoice and similar tables
                    // Look for customer_id field first (Invoice -> Customer)
                    let parentRelationship = matchingRelationships.find((rel: any) =>
                        rel.fromField === "customer_id" && rel.to === "Customer"
                    );

                    // If not found, look for other Customer relationships
                    if (!parentRelationship) {
                        parentRelationship = matchingRelationships.find((rel: any) =>
                            rel.to === "Customer"
                        );
                    }

                    // If still not found, look for Account relationships
                    if (!parentRelationship) {
                        parentRelationship = matchingRelationships.find((rel: any) =>
                            rel.to === "Account"
                        );
                    }

                    // If still not found, use the first relationship with _id field (foreign key)
                    if (!parentRelationship && matchingRelationships.length > 0) {
                        parentRelationship = matchingRelationships[0];
                    }

                    parentTableName = parentRelationship ? parentRelationship.to : null;
                }

                // Filter to only include context table and parent table
                availableTables = availableTables.filter(
                    (table: any) =>
                        table.name === contextTableName ||
                        (parentTableName && table.name === parentTableName)
                );
            }
        }

        return availableTables;
    }, [metadata, context, contextFromUrl, searchParams, relationships]);

    // Keep all tables (including hidden ones) for field access
    const allTables = useMemo(() => {
        if (!metadata?.tables) return [];
        return metadata.tables.map((table: any) => ({
            name: table.name,
            label: table.label,
            fields: table.fields || [],
        }));
    }, [metadata]);

    // Auto-detect joins when tables are added
    const autoDetectJoins = useMemo(() => {
        if (selectedTables.length < 2) {
            return [];
        }

        const joins: Array<{
            type: "INNER" | "LEFT" | "RIGHT";
            from: string;
            to: string;
            fromField: string;
            toField: string;
        }> = [];

        for (let i = 0; i < selectedTables.length; i++) {
            for (let j = i + 1; j < selectedTables.length; j++) {
                const table1 = selectedTables[i];
                const table2 = selectedTables[j];

                // Find relationship between these two tables (check both directions)
                const relationship = relationships.find(
                    (rel: any) =>
                        (rel.from === table1.name && rel.to === table2.name) ||
                        (rel.from === table2.name && rel.to === table1.name)
                );

                if (relationship) {
                    // Use the relationship direction as defined in the schema
                    const join = {
                        type: "LEFT" as const, // Default to LEFT join
                        from: relationship.from,
                        to: relationship.to,
                        fromField: relationship.fromField || "",
                        toField: relationship.toField || "",
                        relationshipType: relationship.type as
                            | "one-to-one"
                            | "one-to-many"
                            | "many-to-many"
                            | undefined,
                    };
                    joins.push(join);
                }
            }
        }

        return joins;
    }, [selectedTables, relationships]);

    // Merge auto-detected joins with existing joins from report config
    const displayJoins = useMemo(() => {
        const existingJoins = reportConfig.joins || [];
        const autoDetected = autoDetectJoins;
        const selectedTableNames = selectedTables.map((t) => t.name);

        // Convert existing joins (with "on" field) to display format (with fromField/toField)
        // Only include existing joins that are between currently selected tables
        const convertedExistingJoins = existingJoins
            .filter((join: any) => {
                return (
                    selectedTableNames.includes(join.from) &&
                    selectedTableNames.includes(join.to)
                );
            })
            .map((join: any) => {
                // Try to find the relationship to determine field names
                const relationship = relationships.find(
                    (rel: any) =>
                        (rel.from === join.from && rel.to === join.to) ||
                        (rel.from === join.to && rel.to === join.from)
                );

                return {
                    type: join.type,
                    from: join.from,
                    to: join.to,
                    fromField: relationship?.fromField || join.on || "",
                    toField: relationship?.toField || join.on || "",
                    relationshipType: relationship?.type as
                        | "one-to-one"
                        | "one-to-many"
                        | "many-to-many"
                        | undefined,
                };
            });

        // Merge: combine existing joins (that are relevant) with auto-detected joins
        // Remove duplicates by checking if a join between the same two tables already exists
        const allJoins = [...convertedExistingJoins, ...autoDetected];
        const uniqueJoins = allJoins.filter((join, index, self) => {
            return (
                self.findIndex(
                    (j) =>
                        (j.from === join.from && j.to === join.to) ||
                        (j.from === join.to && j.to === join.from)
                ) === index
            );
        });

        return uniqueJoins;
    }, [reportConfig.joins, autoDetectJoins, relationships, selectedTables]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Handle drag start
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id.toString());
        const table = tables.find(
            (t: { name: string; label: string }) => t.name === active.id
        );
        if (table) {
            setDraggedTable(table);
        }
    };

    // Handle drag over for better visual feedback
    const handleDragOver = (event: DragOverEvent) => {
        // This helps with drop detection
    };

    // Handle drag end in parent context
    const handleParentDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        // Reset drag state
        setActiveId(null);
        setDraggedTable(null);

        if (!over) {
            return;
        }

        // Check if dropped on canvas
        if (over.id !== "canvas") {
            return;
        }

        const table = tables.find(
            (t: { name: string; label: string }) => t.name === active.id
        );
        if (!table) {
            return;
        }

        const isSelected = selectedTables.some((t) => t.name === table.name);
        if (!isSelected) {
            handleTableDrop(table);
        }
    };

    // Check if a table can be connected to the selected tables
    const canTableBeConnected = (tableName: string): boolean => {
        // If no tables are selected, any table can be added (first table)
        if (selectedTables.length === 0) {
            return true;
        }

        // If already at max (2 tables), cannot add more
        if (selectedTables.length >= 2) {
            return false;
        }

        // Check if there's a relationship between this table and any selected table
        const selectedTableNames = selectedTables.map((t) => t.name);
        return relationships.some(
            (rel: any) =>
                (rel.from === tableName &&
                    selectedTableNames.includes(rel.to)) ||
                (rel.to === tableName && selectedTableNames.includes(rel.from))
        );
    };

    const handleTableDrop = (table: { name: string; label: string }) => {
        // Check if table is already selected
        if (selectedTables.find((t) => t.name === table.name)) {
            return;
        }

        // Check limit (max 2 tables)
        if (selectedTables.length >= 2) {
            return;
        }

        // Check if table can be connected
        if (!canTableBeConnected(table.name)) {
            return;
        }

        setSelectedTables([...selectedTables, table]);
        setReportConfig((prev) => ({
            ...prev,
            tables: [...prev.tables, table.name],
        }));
    };

    const handleTableRemove = (tableName: string) => {
        setSelectedTables(selectedTables.filter((t) => t.name !== tableName));
        setReportConfig((prev) => ({
            ...prev,
            tables: prev.tables.filter((t) => t !== tableName),
            fields: prev.fields?.filter((f) => f.table !== tableName) || [],
            filters: prev.filters?.filter((f) => f.table !== tableName) || [],
            // Remove joins that reference the removed table
            joins:
                prev.joins?.filter(
                    (j) => j.from !== tableName && j.to !== tableName
                ) || [],
        }));
    };

    const handleFieldsChange = (
        fields: ReportConfig["fields"],
        columnOrderOverride?: string[]
    ) => {
        const normalizedFields = dedupeReportFieldOutputKeys(fields || []);
        // Extract unique table names from fields
        const activeTables = Array.from(
            new Set(normalizedFields.map((f) => f.table))
        );

        setReportConfig((prev) => {
            const prevFields = prev.fields || [];
            const nextFieldKeys = new Set(
                normalizedFields.map((f) => getFieldOutputKey(f))
            );
            const removedFields = prevFields.filter(
                (f) => !nextFieldKeys.has(getFieldOutputKey(f))
            );
            const formulas = prev.formulas || [];
            const dependentFormulas = removedFields.flatMap((f) =>
                findFormulasReferencingOperand(
                    formulas,
                    getFormulaOperandReference(f)
                )
            );
            if (dependentFormulas.length > 0) {
                const names = Array.from(
                    new Set(dependentFormulas.map((f) => f.label))
                );
                window.alert(
                    t("formulas.remove_dependency_blocked", {
                        defaultValue:
                            "Cannot remove this field because formulas depend on it: {{labels}}",
                        labels: names.join(", "),
                    })
                );
                return prev;
            }

            // Identify tables that are being removed
            const tablesToRemove = prev.tables.filter(
                (t) => !activeTables.includes(t)
            );

            // Clean up filters that reference removed tables
            const cleanedFilters = (prev.filters || []).filter((filter: any) =>
                activeTables.includes(filter.table)
            );

            // Clean up joins that reference removed tables
            const cleanedJoins = (prev.joins || []).filter(
                (join: any) =>
                    activeTables.includes(join.from) &&
                    activeTables.includes(join.to)
            );

            // Clean up grouping: keys are output keys (alias or table.field), not always "table.field"
            const cleanedGrouping = (prev.grouping || []).filter(
                (groupKey: string) => {
                    const matched = normalizedFields.find(
                        (f) => getFieldOutputKey(f) === groupKey
                    );
                    if (matched) {
                        return activeTables.includes(matched.table);
                    }
                    const firstDot = groupKey.indexOf(".");
                    if (firstDot !== -1) {
                        const tableName = groupKey.substring(0, firstDot);
                        return activeTables.includes(tableName);
                    }
                    return false;
                }
            );

            // Aggregated columns must not appear in GROUP BY (legacy `table.field` can linger
            // because cleanedGrouping keeps unknown keys when the table is still selected).
            // Uses all aggregation suffix variants so SUM→MAX (etc.) does not leave stale keys.
            const groupingKeysFromAggregatedFields =
                getForbiddenGroupingKeysForAggregatedFields(normalizedFields);
            const cleanedGroupingWithoutAggregatedSources = cleanedGrouping.filter(
                (k) => !groupingKeysFromAggregatedFields.has(k)
            );

            // When any column uses aggregation, SQL requires every non-aggregated selected
            // column in GROUP BY. Append missing keys in canvas order so step 4 stays valid.
            const hasAggregatedField = normalizedFields.some((f) => !!f.aggregation);
            let nextGrouping = cleanedGroupingWithoutAggregatedSources;
            if (hasAggregatedField && normalizedFields.length > 0) {
                const groupingKeys = new Set(cleanedGroupingWithoutAggregatedSources);
                nextGrouping = [...cleanedGroupingWithoutAggregatedSources];
                for (const f of normalizedFields) {
                    if (f.aggregation) {
                        continue;
                    }
                    const key = getFieldOutputKey(f);
                    if (!groupingKeys.has(key)) {
                        groupingKeys.add(key);
                        nextGrouping.push(key);
                    }
                }
            }

            // Auto-set first field as default sort if no sorting is defined
            // or if the current sort field is no longer in the fields array
            let updatedSorting = prev.sorting || [];

            if (normalizedFields.length > 0) {
                const firstField = normalizedFields[0];
                const sortFieldKey = getFieldOutputKey(firstField);

                // Check if current sort field still exists in fields
                const currentSortField = updatedSorting[0]?.field;
                const sortFieldExists = currentSortField && normalizedFields.some(
                    (f: any) =>
                        f.alias === currentSortField ||
                        getFieldOutputKey(f) === currentSortField ||
                        `${f.table}.${f.field}` === currentSortField ||
                        f.field === currentSortField
                );

                // If no sorting or current sort field doesn't exist, set first field as default
                if (updatedSorting.length === 0 || !sortFieldExists) {
                    updatedSorting = [{
                        field: sortFieldKey,
                        direction: "ASC" as const,
                    }];
                }
            } else {
                // No fields, clear sorting
                updatedSorting = [];
            }

            return {
                ...prev,
                fields: normalizedFields,
                tables: activeTables,
                filters: cleanedFilters,
                joins: cleanedJoins,
                grouping: nextGrouping,
                sorting: updatedSorting,
                columnOrder:
                    columnOrderOverride ??
                    resolveReportColumnOrder(
                        normalizedFields,
                        prev.formulas || [],
                        prev.columnOrder
                    ),
            };
        });

        // Update selectedTables to match active tables
        const updatedSelectedTables = activeTables
            .map((tableName) => {
                const tableMetadata = metadata?.tables?.find(
                    (t: any) => t.name === tableName
                );
                if (tableMetadata) {
                    return {
                        name: tableMetadata.name,
                        label: tableMetadata.label,
                    };
                }
                return null;
            })
            .filter(
                (table): table is { name: string; label: string } =>
                    table !== null
            );

        setSelectedTables(updatedSelectedTables);
    };

    const handleColumnOrderChange = (
        columnOrder: string[],
        fieldsOverride?: ReportConfig["fields"]
    ) => {
        if (fieldsOverride) {
            handleFieldsChange(fieldsOverride, columnOrder);
            return;
        }
        setReportConfig((prev) => {
            const fields = prev.fields || [];
            return {
                ...prev,
                columnOrder,
                fields: syncFieldsOrderFromColumnOrder(fields, columnOrder),
            };
        });
    };

    const handleFiltersChange = (filters: ReportConfig["filters"]) => {
        setReportConfig((prev) => ({ ...prev, filters }));
        // Clear validation errors when filters change
        setFilterValidationErrors({});
    };

    const handleGroupingChange = (grouping: string[]) => {
        setReportConfig((prev) => ({ ...prev, grouping }));
    };

    const handleChartChange = (chart: ReportConfig["chart"]) => {
        setReportConfig((prev) => ({ ...prev, chart }));
    };

    // When leaving edit mode (new report / no id), allow re-init next time we open a report
    useEffect(() => {
        if (reportId == null || Number.isNaN(reportId)) {
            initializedReportIdRef.current = null;
        }
    }, [reportId]);

    // Load existing report data when editing (only on first load, not on refetch)
    // Prevents overwriting user's unsaved filter changes when React Query refetches
    useEffect(() => {
        if (!existingReport || !metadata?.tables || !reportId) return;

        const prevRef = initializedReportIdRef.current;
        const willSkip = prevRef === reportId;

        // Skip if we've already initialized for this report - don't overwrite user changes
        if (willSkip) {
            return;
        }
        initializedReportIdRef.current = reportId;

        // Set report name - append "(copy)" if cloning
        const baseName = existingReport.name || "";
        setName(isClone ? `${baseName} (copy)` : baseName);
        // Set report description
        setDescription(existingReport.description || "");
        // Set report context
        setContext(existingReport.context || MAIN_REPORTS_MENU_CONTEXT);
        // Set is_system flag - always false when cloning
        setIsSystem(isClone ? false : existingReport.is_system || false);
        // Set is_default flag - always false when cloning
        setIsDefault(isClone ? false : existingReport.is_default || false);

        // Set report config
        const config = existingReport.report_config || {
            tables: [],
            fields: [],
            filters: [],
            grouping: [],
        };

        // Map table names to table objects for selectedTables
        const tableNames = config.tables || [];
        const mappedTables = tableNames
            .map((tableName: string) => {
                const tableMetadata = metadata.tables.find(
                    (t: any) => t.name === tableName
                );
                if (tableMetadata) {
                    return {
                        name: tableMetadata.name,
                        label: tableMetadata.label,
                    };
                }
                return null;
            })
            .filter((table: any) => table !== null) as Array<{
                name: string;
                label: string;
            }>;

        // Infer joins from API tables + metadata in the same tick as grouping hydrate.
        // Avoids a race where the separate join effect spread a stale prev (empty grouping)
        // before hydrate's setReportConfig was applied.
        const inferredJoins = inferAutoJoinsFromSelectedTables(
            mappedTables,
            relationships
        );
        const mergedJoins =
            config.joins && config.joins.length > 0
                ? config.joins
                : inferredJoins.length > 0
                  ? inferredJoins
                  : config.joins || [];

        const hydratedConfig: ReportConfig = {
            ...config,
            fields: config.fields ?? [],
            filters: config.filters ?? [],
            grouping: Array.isArray(config.grouping) ? config.grouping : [],
            joins: mergedJoins,
        };
        setReportConfig(hydratedConfig);

        setSelectedTables(mappedTables);
    }, [existingReport, metadata, isClone, reportId, relationships]);

    // Update joins when auto-detected joins change — new reports only.
    // Edit mode: joins + grouping are set atomically in the hydrate effect above.
    useEffect(() => {
        if (reportId) {
            return;
        }
        if (autoDetectJoins.length > 0) {
            setReportConfig((prev) => {
                const shouldUpdateJoins =
                    !prev.joins || prev.joins.length === 0;

                if (shouldUpdateJoins) {
                    return {
                        ...prev,
                        joins: autoDetectJoins.map((join) => ({
                            type: join.type,
                            from: join.from,
                            to: join.to,
                            on: join.fromField || join.toField,
                        })),
                    };
                }
                return prev;
            });
        }
    }, [autoDetectJoins, reportId]);

    // Generate human-readable description based on selected tables and filters
    const generateHumanReadableDescription = (
        tables: Array<{ name: string; label: string }>,
        filters: ReportConfig["filters"]
    ): string => {
        if (tables.length === 0) return "";

        // Get table names in lowercase for matching
        const tableNames = tables.map((t) => t.name.toLowerCase());

        // Check for "Current User" filters
        const currentUserFilters = (filters || []).filter(
            (f) =>
                f.value === "__CURRENT_USER__" ||
                (Array.isArray(f.value) && f.value.includes("__CURRENT_USER__"))
        );

        // Determine the primary table label
        const getPrimaryLabel = () => {
            if (tables.length === 1) {
                return tables[0].label.toLowerCase();
            }
            // For multi-table, find the main subject
            const sorted = [...tableNames].sort();
            const key = sorted.join(",");

            const subjectMap: Record<string, string> = {
                "customer,dispute": "disputes",
                "customer,invoice": "invoices",
                "customer,payment": "payments",
                "customer,contact": "contacts",
                "customer,activity": "activities",
                "dispute,invoice": "invoices",
                "invoice,payment": "payments",
            };

            return (
                subjectMap[key] || tables[tables.length - 1].label.toLowerCase()
            );
        };

        const primaryLabel = getPrimaryLabel();

        // If there are Current User filters, generate personalized description
        if (currentUserFilters.length > 0) {
            const filter = currentUserFilters[0];
            const fieldName = filter.field?.toLowerCase() || "";

            // Check for specific filter types and generate appropriate descriptions
            if (
                fieldName === "assigned_to" ||
                fieldName === "owner" ||
                fieldName === "owner_id"
            ) {
                // "assigned_to" or "owner" -> "My disputes", "Disputes assigned to me"
                return `My ${primaryLabel}`;
            } else if (fieldName === "created_by") {
                // "created_by" -> "Disputes I created", "My created disputes"
                return `${primaryLabel.charAt(0).toUpperCase() + primaryLabel.slice(1)} I created`;
            } else if (fieldName === "modified_by") {
                // "modified_by" -> "Disputes I modified"
                return `${primaryLabel.charAt(0).toUpperCase() + primaryLabel.slice(1)} I modified`;
            }

            // Generic fallback for other current user filters
            return `My ${primaryLabel}`;
        }

        // No current user filters - generate standard description
        if (tables.length === 1) {
            return `All ${primaryLabel}`;
        }

        if (tables.length === 2) {
            const sorted = [...tableNames].sort();
            const combinations: Record<string, string> = {
                "customer,dispute": "All customer disputes",
                "customer,invoice": "All customer invoices",
                "customer,payment": "All customer payments",
                "customer,contact": "All customer contacts",
                "customer,activity": "All customer activities",
                "dispute,invoice": "All disputed invoices",
                "invoice,payment": "All invoice payments",
                "activity,customer": "All customer activities",
                "contact,customer": "All customer contacts",
            };

            const key = sorted.join(",");
            if (combinations[key]) {
                return combinations[key];
            }

            // Fallback: use first table as qualifier, second as subject
            const primary = tables[0].label.toLowerCase().replace(/s$/, ""); // Remove trailing 's'
            const secondary = tables[1].label.toLowerCase();
            return `All ${primary} ${secondary}`;
        }

        // For 3+ tables (if ever supported), list them naturally
        const labels = tables.map((t) => t.label.toLowerCase());
        return `All ${labels.join(", ")}`;
    };

    // Update description to include table names and filter context when they change
    useEffect(() => {
        if (selectedTables.length > 0) {
            const humanReadableDesc = generateHumanReadableDescription(
                selectedTables,
                reportConfig.filters
            );

            // Only auto-update if description is empty or was previously auto-generated
            // Auto-generated descriptions start with "All " or "My " or end with "I created/modified"
            setDescription((prevDescription) => {
                const isAutoGenerated =
                    !prevDescription ||
                    prevDescription.startsWith("All ") ||
                    prevDescription.startsWith("My ") ||
                    prevDescription.endsWith(" I created") ||
                    prevDescription.endsWith(" I modified");

                if (isAutoGenerated) {
                    return humanReadableDesc;
                }
                return prevDescription;
            });
        }
    }, [selectedTables, reportConfig.filters]);

    const handleSave = async () => {
        if (!name.trim()) {
            alert(t("validation.name_required"));
            return;
        }

        if (!context || !context.trim()) {
            alert(
                t(
                    "validation.location_required",
                    "Location is required. Please specify which page this report should appear on."
                )
            );
            return;
        }

        if (reportConfig.tables.length === 0) {
            alert(
                t(
                    "validation.tables_required",
                    "Please select at least one table"
                )
            );
            return;
        }

        if (!reportConfig.fields || reportConfig.fields.length === 0) {
            alert(
                t(
                    "validation.fields_required",
                    "Please select at least one field"
                )
            );
            return;
        }

        const incompleteColumns = reportConfig.fields.filter(
            (f) => !f.table?.trim() || !f.field?.trim()
        );
        if (incompleteColumns.length > 0) {
            alert(
                t(
                    "validation.report_columns_incomplete",
                    "Every selected column must have a table and field. Remove incomplete columns or finish selecting them."
                )
            );
            setActiveStep(1);
            return;
        }

        const selectedFields = reportConfig.fields || [];
        const groupingKeys = new Set(reportConfig.grouping || []);
        const hasAggregatedField = selectedFields.some((field) => !!field.aggregation);
        if (hasAggregatedField) {
            const missingGroupingFields = selectedFields.filter((field) => !field.aggregation).filter((field) => {
                const fieldOutputKey = getFieldOutputKey(field);
                return !groupingKeys.has(fieldOutputKey);
            });

            if (missingGroupingFields.length > 0) {
                alert(
                    t(
                        "validation.grouping_required_for_non_aggregated_fields",
                        "When aggregation is used, every non-aggregated selected field must also be included in Grouping."
                    )
                );
                setActiveStep(3);
                return;
            }
        }

        const tablesMetadata = (metadata?.tables || []) as Array<{
            name: string;
            fields: Array<{ name: string; type: string; label?: string }>;
        }>;
        const formulaFailures = validateAllReportFormulas(
            reportConfig.formulas || [],
            {
                locale: i18n.language,
                reportTableNames: reportConfig.tables || [],
                tablesMetadata,
                isGrouped: isGroupedReportConfig(reportConfig),
            }
        );
        if (Object.keys(formulaFailures).length > 0) {
            const messages: Record<string, string> = {};
            for (const [formulaId, failure] of Object.entries(formulaFailures)) {
                messages[formulaId] = resolveFormulaValidationMessage(
                    t,
                    failure
                );
            }
            setFormulaValidationErrors(messages);
            setActiveStep(1);
            return;
        }
        setFormulaValidationErrors({});

        // Validate filters have values when required (between, in, equals, etc.)
        const errors: Record<number, string> = {};
        if (reportConfig.filters && reportConfig.filters.length > 0) {
            reportConfig.filters.forEach((filter, index) => {
                if (!filter.table?.trim() || !filter.field?.trim()) {
                    errors[index] = t(
                        "validation.filter_field_required",
                        "Please choose a table and field for every filter, or remove unused filters."
                    );
                    return;
                }
                if (!isReportFilterValueIncomplete(filter)) {
                    return;
                }
                if (filter.operator === "between") {
                    errors[index] = t(
                        "validation.between_filter_incomplete",
                        "Filter with 'between' operator requires both start and end values to be filled"
                    );
                } else {
                    errors[index] = t(
                        "validation.filter_value_required",
                        "Every filter must have a value. Choose values, switch to \"Is empty\" or \"Is not empty\" if appropriate, or remove the filter."
                    );
                }
            });
        }

        if (Object.keys(errors).length > 0) {
            setFilterValidationErrors(errors);
            // Scroll to filters step if not already there
            setActiveStep(2);
            return;
        }

        // Clear validation errors if validation passes
        setFilterValidationErrors({});

        try {
            // When cloning, always create a new report (ignore reportId)
            const effectiveReportId = isClone ? null : reportId;
            const url = effectiveReportId
                ? `/api/reports/${effectiveReportId}`
                : "/api/reports";
            const method = effectiveReportId ? "PUT" : "POST";
            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    description: description || undefined,
                    report_config: reportConfig,
                    context:
                        context && context.trim() ? context.trim() : undefined,
                    is_system: isAdminAccount ? isSystem : undefined,
                    is_default:
                        isAdminAccount && isSystem ? isDefault : undefined,
                }),
            });

            if (!response.ok) {
                let errorMessage = `Failed to ${reportId ? "update" : "create"} report`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;

                    // Handle duplicate name error specifically
                    if (
                        errorData.errorCode === "DUPLICATE_REPORT_NAME" ||
                        errorMessage.includes("already exists")
                    ) {
                        errorMessage = t(
                            "messages.duplicate_report_name",
                            "A report with this name already exists. Please choose a different name."
                        );
                    }
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const savedReportId = data.report.id;

            // Invalidate reports query to refresh the grid
            queryClient.invalidateQueries({ queryKey: ["reports"] });

            // Invalidate the specific report query to refresh the report viewer
            queryClient.invalidateQueries({
                queryKey: ["report", savedReportId],
            });

            // If updating an existing report, also invalidate the old report ID
            if (reportId && reportId !== savedReportId) {
                queryClient.invalidateQueries({
                    queryKey: ["report", reportId],
                });
            }

            // Invalidate report execution queries (for the report viewer data)
            // Use predicate to match all report-execution queries for this reportId
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    if (!Array.isArray(key) || key.length < 2) return false;
                    if (key[0] !== "report-execution") return false;
                    const params = key[1];
                    return (
                        typeof params === "object" &&
                        params !== null &&
                        (params as any).reportId === savedReportId
                    );
                },
            });

            // Invalidate report chart data query
            queryClient.invalidateQueries({
                queryKey: ["report-chart-data", savedReportId],
            });

            // If context is provided, redirect back to the context page
            const effectiveContext = contextFromUrl || context;
            if (effectiveContext && effectiveContext.trim() !== "") {
                // Get customerId and tab from URL if available (for customer-specific contexts)
                const customerId = searchParams?.get("customerId");
                const tab = searchParams?.get("tab");

                // Map contexts to their respective pages
                if (effectiveContext === "customers") {
                    router.push(`/${locale}${AppUrls.CUSTOMERS}?reportId=${savedReportId}`);
                } else if (effectiveContext === "disputes") {
                    router.push(`/${locale}${AppUrls.DISPUTES}?reportId=${savedReportId}`);
                } else if (effectiveContext === "invoices") {
                    router.push(`/${locale}${AppUrls.CUSTOMERS}/invoices?reportId=${savedReportId}`);
                } else if (effectiveContext === "agents") {
                    router.push(`/${locale}${AppUrls.AGENTS}?reportId=${savedReportId}`);
                } else if (effectiveContext === MAIN_REPORTS_MENU_CONTEXT) {
                    router.push(`/${locale}${AppUrls.REPORT_DETAILS(savedReportId)}`);
                } else if (isDashboardChartDetailsReportContext(effectiveContext)) {
                    router.push(
                        buildDashboardChartDetailsReturnPath(
                            locale,
                            searchParams ?? new URLSearchParams(),
                            savedReportId,
                            effectiveContext
                        )
                    );
                } else if (
                    isOperationDashboardDetailsReportContext(effectiveContext)
                ) {
                    router.push(
                        buildOperationDashboardDetailsReturnPath(
                            locale,
                            searchParams ?? new URLSearchParams(),
                            savedReportId,
                            effectiveContext
                        )
                    );
                } else if (effectiveContext.startsWith("customer_") && customerId) {
                    // Redirect back to customer detail page with tab and reportId if available
                    const queryParams = new URLSearchParams();
                    if (tab) {
                        queryParams.set("tab", tab);
                    }
                    queryParams.set("reportId", savedReportId.toString());
                    const queryString = queryParams.toString();
                    const url = `/${locale}${AppUrls.Customer_DETAILS(customerId)}${queryString ? `?${queryString}` : ""}`;
                    router.push(url);
                } else {
                    // Default: redirect to report details
                    router.push(`/${locale}${AppUrls.REPORT_DETAILS(savedReportId)}`);
                }
            } else {
                // No context: redirect to report details
                router.push(`/${locale}${AppUrls.REPORT_DETAILS(savedReportId)}`);
            }
        } catch (error) {
            alert(
                error instanceof Error
                    ? error.message
                    : t(
                        `messages.error_${reportId ? "updating" : "creating"}_report`
                    )
            );
        }
    };

    const isHebrew = i18n.language === "he";
    const isRTL = isHebrew;

    const pageShellSx = {
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        m: 0,
        p: 0,
        mt: { xs: -1, sm: -1.5 },
        mx: { xs: -1, sm: -1.5 },
        width: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
        maxWidth: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
        direction: isRTL ? "rtl" : "ltr",
    } as const;

    const stickyHeaderSx = {
        position: "sticky",
        top: { xs: "-8px", sm: "-12px" },
        left: 0,
        right: 0,
        zIndex: 30,
        bgcolor: "background.paper",
        flexShrink: 0,
        px: { xs: 1, sm: 1.5 },
        pt: { xs: 2, sm: 2.5 },
        pb: 0,
        m: 0,
        mt: 0,
        backgroundColor: "background.paper",
        width: "100%",
        maxWidth: "100%",
    } as const;

    const pageContentSx = {
        flex: 1,
        width: "100%",
        position: "relative",
        px: { xs: 1, sm: 1.5 },
        display: "flex",
        flexDirection: "column",
    } as const;

    const steps = [
        {
            label: t("sections.step_basic_info", "1. Basic Information"),
            component: (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        p: 2,
                        direction: isRTL ? "rtl" : "ltr",
                        textAlign: isRTL ? "right" : "left",
                    }}
                >
                    <TextField
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        label={t("fields.name", "Name")}
                        placeholder={t(
                            "fields.report_name_placeholder",
                            "Enter report name"
                        )}
                        required
                        {...(isHebrew && { "data-hebrew": true })}
                        dir={isRTL ? "rtl" : "ltr"}
                        sx={{ maxWidth: 400 }}
                    />
                    <TextField
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        label={t("fields.description", "Description")}
                        placeholder={t(
                            "fields.description_placeholder",
                            "Enter report description (optional)"
                        )}
                        multiline
                        rows={3}
                        {...(isHebrew && { "data-hebrew": true })}
                        dir={isRTL ? "rtl" : "ltr"}
                        sx={{ maxWidth: 400 }}
                    />
                    {isAdminAccount && (
                        <>
                            <Autocomplete
                                freeSolo
                                value={context}
                                onChange={(event, newValue) => {
                                    setContext(newValue || "");
                                }}
                                inputValue={context}
                                onInputChange={(event, newInputValue) => {
                                    setContext(newInputValue);
                                }}
                                isOptionEqualToValue={(option, value) => option === value}
                                options={contextOptions}
                                dir={isRTL ? "rtl" : "ltr"}
                                {...(isHebrew && {
                                    "data-hebrew": true,
                                    "data-rtl": true,
                                })}
                                sx={{
                                    maxWidth: 400,
                                }}
                                renderOption={(props, option) => {
                                    const { key, ...otherProps } = props;
                                    return (
                                        <li
                                            key={key}
                                            {...otherProps}
                                            style={{
                                                direction: isRTL ? "rtl" : "ltr",
                                                textAlign: isRTL ? "right" : "left",
                                                paddingRight: isRTL ? "16px" : "14px",
                                                paddingLeft: isRTL ? "14px" : "16px",
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    direction: isRTL ? "rtl" : "ltr",
                                                    textAlign: isRTL ? "right" : "left",
                                                    width: "100%",
                                                }}
                                            >
                                                {option}
                                            </Typography>
                                        </li>
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={t("fields.location", "Location")}
                                        placeholder={t(
                                            "fields.location_placeholder",
                                            "Select or type a page location"
                                        )}
                                        required
                                        {...(isHebrew && { "data-hebrew": true })}
                                        dir={isRTL ? "rtl" : "ltr"}
                                        sx={{
                                            maxWidth: 400,
                                            "& .MuiInputBase-root": {
                                                direction: isRTL ? "rtl" : "ltr",
                                            }
                                        }}
                                    />
                                )}
                            />
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    maxWidth: 400,
                                    direction: isRTL ? "rtl" : "ltr",
                                }}
                            >
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={isSystem}
                                            onChange={(e) =>
                                                setIsSystem(e.target.checked)
                                            }
                                            {...(isHebrew && { "data-rtl": true })}
                                        />
                                    }
                                    label={t(
                                        "fields.is_system",
                                        "System Report"
                                    )}
                                    sx={{
                                        direction: isRTL ? "rtl" : "ltr",
                                        "& .MuiFormControlLabel-label": {
                                            marginLeft: isRTL ? 0 : theme.spacing(1),
                                            marginRight: isRTL ? theme.spacing(1) : 0,
                                        },
                                    }}
                                />
                                <Tooltip
                                    title={t(
                                        "tooltips.system_report",
                                        "System reports are automatically available to all accounts in the system. They cannot be deleted or modified by regular users."
                                    )}
                                    {...getRTLTooltipProps(i18n)}
                                >
                                    <IconButton
                                        size="small"
                                        sx={{
                                            p: 0.5,
                                            color: theme.palette.text.secondary,
                                            "&:hover": {
                                                color: theme.palette.primary
                                                    .main,
                                                bgcolor: alpha(
                                                    theme.palette.primary.main,
                                                    0.08
                                                ),
                                            },
                                        }}
                                    >
                                        <InfoOutlined
                                            sx={{
                                                fontSize: "1rem",
                                            }}
                                        />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            {isSystem && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        maxWidth: 400,
                                        direction: isRTL ? "rtl" : "ltr",
                                    }}
                                >
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={isDefault}
                                                onChange={(e) =>
                                                    setIsDefault(
                                                        e.target.checked
                                                    )
                                                }
                                                {...(isHebrew && { "data-rtl": true })}
                                            />
                                        }
                                        label={t(
                                            "fields.is_default",
                                            "Set as Default"
                                        )}
                                        sx={{
                                            direction: isRTL ? "rtl" : "ltr",
                                            "& .MuiFormControlLabel-label": {
                                                marginLeft: isRTL ? 0 : theme.spacing(1),
                                                marginRight: isRTL ? theme.spacing(1) : 0,
                                            },
                                        }}
                                    />
                                    <Tooltip
                                        title={t(
                                            "tooltips.set_as_default",
                                            "When enabled, this report will be set as the default for this page. All other reports for this page will be unset as default."
                                        )}
                                        {...getRTLTooltipProps(i18n)}
                                    >
                                        <IconButton
                                            size="small"
                                            sx={{
                                                p: 0.5,
                                                color: "text.secondary",
                                                "&:hover": {
                                                    color: "primary.main",
                                                    bgcolor: "action.hover",
                                                },
                                            }}
                                        >
                                            <InfoOutlined
                                                sx={{
                                                    fontSize: "1rem",
                                                }}
                                            />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            ),
        },
        {
            label: t(
                "sections.step_tables_fields",
                "2. Select Tables & Fields"
            ),
            component: (
                <Box>
                    <DragDropFieldSelector
                        selectedTables={selectedTables}
                        tables={tables}
                        selectedFields={reportConfig.fields || []}
                        onFieldsChange={handleFieldsChange}
                        relationships={relationships}
                        sorting={reportConfig.sorting || []}
                        onSortingChange={(sorting) => {
                            setReportConfig((prev) => ({
                                ...prev,
                                sorting: sorting,
                            }));
                        }}
                        formulas={reportConfig.formulas || []}
                        columnOrder={reportConfig.columnOrder}
                        onColumnOrderChange={handleColumnOrderChange}
                        formulaValidationErrors={formulaValidationErrors}
                        onFormulaEdit={(formulaId) =>
                            formulaEditorRef.current?.openEdit(formulaId)
                        }
                        onFormulaDelete={(formulaId) =>
                            formulaEditorRef.current?.requestDelete(formulaId)
                        }
                        onAddFormula={() => formulaEditorRef.current?.openAdd()}
                        addFormulaDisabled={
                            (reportConfig.formulas?.length ?? 0) >=
                                MAX_FORMULAS_PER_REPORT ||
                            (reportConfig.fields?.length ?? 0) === 0
                        }
                        addFormulaDisabledReason={
                            (reportConfig.fields?.length ?? 0) === 0
                                ? t("formulas.no_fields", {
                                      defaultValue:
                                          "Add at least one field before creating a formula",
                                  })
                                : t("formulas.max_reached", {
                                      max: MAX_FORMULAS_PER_REPORT,
                                      defaultValue: `Maximum of ${MAX_FORMULAS_PER_REPORT} formulas allowed`,
                                  })
                        }
                    />
                    <FormulaColumnEditor
                        ref={formulaEditorRef}
                        reportConfig={reportConfig}
                        tablesMetadata={(metadata?.tables || []) as any}
                        onConfigChange={(patch) => {
                            setReportConfig((prev) => ({ ...prev, ...patch }));
                            if (patch.formulas) {
                                setFormulaValidationErrors({});
                            }
                        }}
                    />
                </Box>
            ),
        },
        {
            label: t("sections.step_filters", "3. Add Filters"),
            component: (
                <FilterBuilder
                    selectedTables={reportConfig.tables}
                    tables={allTables}
                    filters={reportConfig.filters || []}
                    onFiltersChange={handleFiltersChange}
                    validationErrors={filterValidationErrors}
                />
            ),
        },
        {
            label: t("sections.step_grouping", "4. Grouping"),
            component: (
                <GroupingBuilder
                    selectedFields={reportConfig.fields || []}
                    tables={allTables}
                    grouping={reportConfig.grouping || []}
                    onGroupingChange={handleGroupingChange}
                />
            ),
        },
        {
            label: t("sections.step_chart", "5. Chart"),
            component: (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 400,
                        p: 4,
                        textAlign: "center",
                    }}
                >
                    <Box
                        sx={{
                            fontSize: 120,
                            mb: 3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <TrendingUp
                            sx={{
                                fontSize: 120,
                                color: "primary.main",
                                opacity: 0.3,
                            }}
                        />
                    </Box>
                    <Typography
                        variant="h5"
                        fontWeight={600}
                        color="text.primary"
                        sx={{ mb: 1 }}
                    >
                        {t(
                            "messages.chart_under_construction",
                            "📈 Our charts are still collecting data! 💸"
                        )}
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ maxWidth: 500 }}
                    >
                        {t(
                            "messages.chart_funny",
                            "We're working on making your collection data look as beautiful as a fully paid invoice. The charts are coming soon - and unlike some payments, they'll arrive on time! 🎯"
                        )}
                    </Typography>
                </Box>
            ),
        },
    ];

    // Grouping (step 3) for all users; chart (step 4) only for master account 10013
    const visibleSteps = useMemo(() => {
        return steps.filter((step, index) => {
            if (index < 3) {
                return true;
            }
            if (index === 3) {
                return true;
            }
            if (index === 4) {
                return isAdminAccount;
            }
            return false;
        });
    }, [steps, isAdminAccount]);

    if (metadataLoading || (reportId && reportLoading)) {
        return (
            <Box sx={pageShellSx}>
                <Box ref={headerRef} sx={stickyHeaderSx}>
                    <Box sx={{ "& .MuiPaper-root": { mb: 0 } }}>
                        <PageHeader
                            title={t("sections.builder_title")}
                            description={t(
                                "sections.builder_title_description"
                            )}
                            sticky={false}
                        />
                    </Box>
                </Box>
                <Box
                    sx={{
                        ...pageContentSx,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        minHeight: { xs: "300px", sm: "400px" },
                    }}
                >
                    <CircularProgress color="primary" size={48} />
                </Box>
            </Box>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleParentDragEnd}
        >
            <Box sx={pageShellSx}>
                <Box ref={headerRef} sx={stickyHeaderSx}>
                    <Box sx={{ "& .MuiPaper-root": { mb: 0 } }}>
                        <PageHeader
                            title={
                                name
                                    ? `${t("sections.builder_title")} (${name})`
                                    : t("sections.builder_title")
                            }
                            description={t(
                                "sections.builder_title_description"
                            )}
                            sticky={false}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    ml: {
                                        xs: 0,
                                        sm: i18n.language === "he" ? 0 : "auto",
                                    },
                                    mr: {
                                        xs: 0,
                                        sm: i18n.language === "he" ? "auto" : 0,
                                    },
                                    mt: { xs: 2, sm: 0 },
                                }}
                            >
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    className="edit-action-button-group"
                                    sx={{
                                        direction: isRTL ? "rtl" : "ltr",
                                    }}
                                >
                                    <Button
                                        variant="outlined"
                                        className="cancel-button"
                                        onClick={() => router.back()}
                                    >
                                        {t("actions.cancel", { ns: "common" })}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="save-button"
                                        onClick={handleSave}
                                        disabled={
                                            !name.trim() ||
                                            !context.trim() ||
                                            reportConfig.tables.length === 0 ||
                                            !reportConfig.fields ||
                                            reportConfig.fields.length === 0
                                        }
                                        sx={{
                                            "& .MuiButton-endIcon": {
                                                marginRight:
                                                    i18n.language === "he"
                                                        ? theme.spacing(1)
                                                        : undefined,
                                                marginLeft:
                                                    i18n.language !== "he"
                                                        ? undefined
                                                        : theme.spacing(1),
                                            },
                                            "& .MuiButton-startIcon": {
                                                marginRight: isRTL
                                                    ? 0
                                                    : theme.spacing(1),
                                                marginLeft: isRTL
                                                    ? theme.spacing(1)
                                                    : 0,
                                            },
                                        }}
                                    >
                                        {t("actions.save")}
                                    </Button>
                            </Stack>
                        </Box>
                        </PageHeader>
                    </Box>
                </Box>

                <Box sx={pageContentSx}>
                        {/* Step Navigation */}
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                mb: 3,
                                pt: 2,
                                position: "relative",
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    width: "70%",
                                    mx: "auto",
                                }}
                            >
                                {/* Circles and Lines Row */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        width: "100%",
                                        direction: isRTL ? "rtl" : "ltr",
                                        flexDirection: isRTL ? "row-reverse" : "row",
                                    }}
                                >
                                    {(isRTL ? [...visibleSteps].reverse() : visibleSteps).map((step, originalIndex) => {
                                        // Calculate the actual index for RTL (reversed array)
                                        const index = isRTL ? visibleSteps.length - 1 - originalIndex : originalIndex;
                                        const isActive = activeStep === index;
                                        const isCompleted = activeStep > index;
                                        const isDisabled =
                                            index === 2 &&
                                            (!reportConfig.fields ||
                                                reportConfig.fields.length ===
                                                0);

                                        const canNavigate =
                                            !isDisabled ||
                                            isCompleted ||
                                            isActive;

                                        return (
                                            <React.Fragment key={index}>
                                                <Box
                                                    sx={{
                                                        position: "relative",
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: "50%",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        bgcolor:
                                                            isActive ||
                                                                isCompleted
                                                                ? theme.palette
                                                                    .primary
                                                                    .main
                                                                : theme.palette
                                                                    .grey[300],
                                                        color:
                                                            isActive ||
                                                                isCompleted
                                                                ? "white"
                                                                : theme.palette
                                                                    .grey[600],
                                                        fontWeight: 600,
                                                        fontSize: "12px",
                                                        transition:
                                                            "all 0.3s ease",
                                                        cursor: canNavigate
                                                            ? "pointer"
                                                            : "default",
                                                        "&:hover": canNavigate
                                                            ? {
                                                                transform:
                                                                    "scale(1.1)",
                                                            }
                                                            : {},
                                                    }}
                                                    onClick={() =>
                                                        canNavigate &&
                                                        setActiveStep(index)
                                                    }
                                                >
                                                    <Typography
                                                        variant="body1"
                                                        sx={{
                                                            fontWeight: 600,
                                                            fontSize: "12px",
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </Typography>
                                                </Box>
                                                {/* Connecting Line */}
                                                {originalIndex < visibleSteps.length - 1 && (
                                                    <Box
                                                        sx={{
                                                            flex: 1,
                                                            height: 2,
                                                            mx: 2,
                                                            bgcolor: isCompleted
                                                                ? theme.palette
                                                                    .primary
                                                                    .main
                                                                : theme.palette
                                                                    .grey[300],
                                                            transition:
                                                                "background-color 0.3s ease",
                                                        }}
                                                    />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </Box>
                                {/* Labels Row */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        width: "100%",
                                        mt: 1,
                                        direction: isRTL ? "rtl" : "ltr",
                                        flexDirection: isRTL ? "row-reverse" : "row",
                                    }}
                                >
                                    {(isRTL ? [...visibleSteps].reverse() : visibleSteps).map((step, originalIndex) => {
                                        // Calculate the actual index for RTL (reversed array)
                                        const index = isRTL ? visibleSteps.length - 1 - originalIndex : originalIndex;
                                        const isActive = activeStep === index;
                                        const isCompleted = activeStep > index;

                                        return (
                                            <React.Fragment key={index}>
                                                <Box
                                                    sx={{
                                                        width: 28,
                                                        display: "flex",
                                                        justifyContent:
                                                            "center",
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontSize: "14px",
                                                            fontWeight:
                                                                isActive ||
                                                                    isCompleted
                                                                    ? 600
                                                                    : 400,
                                                            color:
                                                                isActive ||
                                                                    isCompleted
                                                                    ? theme
                                                                        .palette
                                                                        .text
                                                                        .primary
                                                                    : theme
                                                                        .palette
                                                                        .text
                                                                        .secondary,
                                                            textAlign: "center",
                                                            direction: isRTL ? "rtl" : "ltr",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        {step.label
                                                            .replace(
                                                                /^\d+\.\s*/,
                                                                ""
                                                            )
                                                            .replace(
                                                                /^(Select|Add)\s+/i,
                                                                ""
                                                            )}
                                                    </Typography>
                                                </Box>
                                                {originalIndex < visibleSteps.length - 1 && (
                                                    <Box
                                                        sx={{
                                                            flex: 1,
                                                            mx: 2,
                                                        }}
                                                    />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </Box>
                            </Box>
                            {/* Navigation Buttons - Aligned to right side of page */}
                            <Box
                                sx={{
                                    position: "absolute",
                                    right: isRTL ? "auto" : 0,
                                    left: isRTL ? 0 : "auto",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    display: "flex",
                                    flexDirection: "row",
                                    gap: 0.5,
                                    alignItems: "center",
                                    direction: isRTL ? "rtl" : "ltr",
                                }}
                            >
                                <Tooltip
                                    title={
                                        t("actions.back", { ns: "common" }) ||
                                        "Back"
                                    }
                                    {...getRTLTooltipProps(i18n)}
                                >
                                    <span>
                                        <IconButton
                                            color="primary"
                                            size="small"
                                            onClick={() => {
                                                if (activeStep > 0) {
                                                    setActiveStep(
                                                        activeStep - 1
                                                    );
                                                }
                                            }}
                                            disabled={activeStep === 0}
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                bgcolor: "primary.main",
                                                color: "white",
                                                boxShadow: 2,
                                                direction: isRTL ? "rtl" : "ltr",
                                                "&:hover": {
                                                    bgcolor: "primary.dark",
                                                },
                                                "&.Mui-disabled": {
                                                    bgcolor:
                                                        "action.disabledBackground",
                                                    color: "action.disabled",
                                                },
                                            }}
                                        >
                                            {isRTL ? (
                                                <ArrowForward fontSize="small" />
                                            ) : (
                                                <ArrowBack fontSize="small" />
                                            )}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Tooltip
                                    title={
                                        t("actions.next", { ns: "common" }) ||
                                        "Next"
                                    }
                                    {...getRTLTooltipProps(i18n)}
                                >
                                    <span>
                                        <IconButton
                                            color="primary"
                                            size="small"
                                            onClick={() => {
                                                if (
                                                    activeStep <
                                                    visibleSteps.length - 1
                                                ) {
                                                    setActiveStep(
                                                        activeStep + 1
                                                    );
                                                }
                                            }}
                                            disabled={
                                                activeStep === visibleSteps.length - 1
                                            }
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                bgcolor: "primary.main",
                                                color: "white",
                                                boxShadow: 2,
                                                direction: isRTL ? "rtl" : "ltr",
                                                "&:hover": {
                                                    bgcolor: "primary.dark",
                                                },
                                                "&.Mui-disabled": {
                                                    bgcolor:
                                                        "action.disabledBackground",
                                                    color: "action.disabled",
                                                },
                                            }}
                                        >
                                            {isRTL ? (
                                                <ArrowBack fontSize="small" />
                                            ) : (
                                                <ArrowForward fontSize="small" />
                                            )}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: 3 }} />

                        {/* Step Content */}
                        <Box
                            sx={{
                                flex: 1,
                                overflow: "auto",
                                position: "relative",
                                minHeight: 400,
                            }}
                        >
                            <Box
                                key={activeStep}
                                sx={{
                                    animation:
                                        i18n.language === "he"
                                            ? "slideInFromRight 0.3s ease-out"
                                            : "slideInFromLeft 0.3s ease-out",
                                    direction: isRTL ? "rtl" : "ltr",
                                    "@keyframes slideInFromLeft": {
                                        "0%": {
                                            transform: "translateX(-100%)",
                                            opacity: 0,
                                        },
                                        "100%": {
                                            transform: "translateX(0)",
                                            opacity: 1,
                                        },
                                    },
                                    "@keyframes slideInFromRight": {
                                        "0%": {
                                            transform: "translateX(100%)",
                                            opacity: 0,
                                        },
                                        "100%": {
                                            transform: "translateX(0)",
                                            opacity: 1,
                                        },
                                    },
                                }}
                            >
                                {visibleSteps[activeStep].component}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            <DragOverlay>
                {activeId && draggedTable ? (
                    <Paper
                        sx={{
                            p: 1.5,
                            border: `2px solid ${theme.palette.primary.main}`,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            boxShadow: 4,
                            minWidth: 150,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Typography variant="body1" fontWeight={600}>
                            {draggedTable.label}
                        </Typography>
                    </Paper>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default ReportBuilderPage;
