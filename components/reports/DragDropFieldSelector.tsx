"use client";

import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    closestCenter,
    useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    DragIndicator,
    Numbers,
    CalendarToday,
    TextFields,
    List,
    Functions,
    Calculate,
    Search,
    ExpandMore,
    FilterList,
    Close,
    ArrowUpward,
    ArrowDownward,
} from "@mui/icons-material";
import {
    Box,
    Button,
    Paper,
    Typography,
    IconButton,
    Tooltip,
    Menu,
    MenuItem,
    Chip,
    TextField,
    InputAdornment,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Checkbox,
    Badge,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import React, { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useDragDropFields } from "@/hooks/useDragDropFields";
import { useFieldFiltering } from "@/hooks/useFieldFiltering";
import EmptyState from "@/shared/layout-components/grid/components/EmptyState";
import { buildColumnListItems } from "@/shared/reportFormula/columnOrder";
import type { ReportFormula } from "@/shared/reportFormula/types";
import {
    TableField,
    Table,
    getFieldTypeIcon,
    isNumericField,
    getTableFields as getTableFieldsUtil,
    getRTLTooltipProps,
} from "@/utils/reportFieldUtils";
import {
    Field,
    Relationship,
    getSelectedTableNames,
    canTableConnect,
    canAddFieldFromTable,
    getFieldOutputKey,
    resolveNextPaletteFieldCandidate,
} from "@/utils/reportTableUtils";

interface DragDropFieldSelectorProps {
    selectedTables: Array<{ name: string; label: string }>;
    tables: Table[];
    selectedFields: Field[];
    onFieldsChange: (fields: Field[]) => void;
    relationships?: Relationship[];
    sorting?: Array<{ field: string; direction: "ASC" | "DESC" }>;
    onSortingChange?: (sorting: Array<{ field: string; direction: "ASC" | "DESC" }>) => void;
    onAddFormula?: () => void;
    addFormulaDisabled?: boolean;
    addFormulaDisabledReason?: string;
    formulas?: ReportFormula[];
    columnOrder?: string[];
    onColumnOrderChange?: (order: string[], fields?: Field[]) => void;
    onFormulaEdit?: (formulaId: string) => void;
    onFormulaDelete?: (formulaId: string) => void;
    formulaValidationErrors?: Record<string, string>;
}

/** Numeric fields can appear many times (extra aggregations or same function twice); row stays draggable. */
function paletteAllowsAnotherInstance(fieldType: string): boolean {
    return isNumericField(fieldType);
}

interface DraggableFieldItemProps {
    field: TableField;
    tableName: string;
    tableLabel: string;
    isSelected: boolean;
    showCheckbox?: boolean;
    onCheckboxToggle?: () => void;
    disabled?: boolean;
    /** When true with showCheckbox, row stays draggable to add another column (e.g. second aggregation). */
    paletteAllowsDuplicateDrag?: boolean;
}

const DraggableFieldItem: React.FC<DraggableFieldItemProps> = React.memo(
    ({
        field,
        tableName,
        isSelected,
        showCheckbox = false,
        onCheckboxToggle,
        paletteAllowsDuplicateDrag = false,
    }) => {
        const theme = useTheme();
        const { i18n } = useTranslation();
        const isRTL = i18n?.language === "he";
        const dragFromListBlocked =
            showCheckbox && isSelected
                ? !paletteAllowsDuplicateDrag
                : isSelected;
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging,
        } = useSortable({
            id: `${tableName}.${field.name}`,
            disabled: dragFromListBlocked,
        });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        };

        const FieldTypeIcon = getFieldTypeIcon(field.type);

        // If showCheckbox is true, render as a tree view row
        if (showCheckbox) {
            return (
                <Box
                    ref={setNodeRef}
                    style={style}
                    {...(!dragFromListBlocked ? { ...attributes, ...listeners } : {})}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        p: 0.5,
                        borderRadius: 1,
                        cursor: dragFromListBlocked ? "default" : "grab",
                        "&:hover": {
                            bgcolor: "action.hover",
                        },
                        "&:active": {
                            cursor: dragFromListBlocked ? "default" : "grabbing",
                        },
                    }}
                >
                    <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onCheckboxToggle?.();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ p: 0.5 }}
                    />
                    <FieldTypeIcon
                        sx={{
                            fontSize: 18,
                            color: "text.secondary",
                        }}
                    />
                    <Typography
                        variant="body2"
                        sx={{
                            flex: 1,
                            textDecoration:
                                isSelected && !paletteAllowsDuplicateDrag
                                    ? "line-through"
                                    : "none",
                            color:
                                isSelected && !paletteAllowsDuplicateDrag
                                    ? "text.disabled"
                                    : "text.primary",
                        }}
                    >
                        {field.label}
                    </Typography>
                    <DragIndicator
                        sx={{
                            fontSize: 16,
                            color: "text.secondary",
                            opacity: dragFromListBlocked ? 0.15 : 0.5,
                        }}
                    />
                </Box>
            );
        }

        // Original Paper-based design for non-tree view usage
        return (
            <Paper
                ref={setNodeRef}
                style={style}
                elevation={0}
                {...(!isSelected ? { ...attributes, ...listeners } : {})}
                sx={{
                    p: 1,
                    cursor: isSelected ? "default" : "grab",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: `${theme.appButton.sizeMedium.borderRadius}px`,
                    bgcolor: "background.paper",
                    "&:hover": {
                        borderColor: "primary.light",
                    },
                    "&:active": {
                        cursor: isSelected ? "default" : "grabbing",
                    },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: 1,
                    width: "100%",
                }}
            >
                <DragIndicator
                    sx={{
                        color: "text.secondary",
                        opacity: 0.5,
                        fontSize: 18,
                        flexShrink: 0,
                    }}
                />
                    <Typography
                        variant="body2"
                        fontWeight={500}
                        noWrap
                        sx={{
                            flex: 1,
                            textAlign: isRTL ? "right" : "left",
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {field.label}
                    </Typography>
                <FieldTypeIcon
                    sx={{
                        color: "text.secondary",
                        opacity: 0.6,
                        fontSize: 18,
                        flexShrink: 0,
                    }}
                />
            </Paper>
        );
    }
);
DraggableFieldItem.displayName = "DraggableFieldItem";

interface SortableFieldCardProps {
    field: Field;
    index: number;
    selectedFields: Field[];
    sortableId?: string;
    fieldInfo?: TableField;
    onRemove: () => void;
    onUpdateField: (fieldKey: keyof Field, value: any) => void;
    getTableLabel: (tableName: string) => string;
    t: any;
    i18n: any;
    theme: any;
    isHovered?: boolean;
    isActive?: boolean;
    sorting?: Array<{ field: string; direction: "ASC" | "DESC" }>;
    onSortingChange?: (sorting: Array<{ field: string; direction: "ASC" | "DESC" }>) => void;
}

const SortableFieldCard: React.FC<SortableFieldCardProps> = React.memo(
    ({
        field,
        index,
        selectedFields,
        sortableId,
        fieldInfo,
        onRemove,
        onUpdateField,
        t,
        i18n,
        theme,
        isHovered = false,
        isActive = false,
        sorting = [],
        onSortingChange,
    }) => {
        const [aggregationMenuAnchor, setAggregationMenuAnchor] =
            React.useState<null | HTMLElement>(null);

        const { aggregationsTakenElsewhere, rawTakenElsewhere } =
            React.useMemo(() => {
                const aggs = new Set<NonNullable<Field["aggregation"]>>();
                let raw = false;
                for (let i = 0; i < selectedFields.length; i++) {
                    if (i === index) {
                        continue;
                    }
                    const f = selectedFields[i];
                    if (f.table !== field.table || f.field !== field.field) {
                        continue;
                    }
                    if (f.aggregation) {
                        aggs.add(f.aggregation);
                    } else {
                        raw = true;
                    }
                }
                return {
                    aggregationsTakenElsewhere: aggs,
                    rawTakenElsewhere: raw,
                };
            }, [selectedFields, index, field.table, field.field]);

        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging,
        } = useSortable({
            id: sortableId ?? `${field.table}.${field.field}-${index}`,
        });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition: isDragging
                ? transition
                : "transform 0.2s ease, opacity 0.2s ease",
            opacity: isDragging ? 0.5 : 1,
        };

        const fieldLabel = fieldInfo?.label || field.field;
        
        // Determine sort state for this field
        const fieldKey = getFieldOutputKey(field);
        const sortConfig = sorting.find((s) => s.field === fieldKey);
        const isSorted = !!sortConfig;
        const sortDirection = sortConfig?.direction;
        const isFirstField = index === 0;
        const isDefaultSort = isFirstField && (!sorting.length || (sorting.length > 0 && sorting[0].field === fieldKey));

        return (
            <Paper
                ref={setNodeRef}
                style={style}
                elevation={0}
                {...attributes}
                {...listeners}
                sx={{
                    p: 1,
                    border: isSorted
                        ? `2px solid ${theme.palette.primary.main}`
                        : isActive
                          ? `1px solid ${theme.palette.secondary.main}`
                          : isHovered
                            ? `1px solid ${theme.palette.primary.main}`
                            : `1px solid ${theme.palette.divider}`,
                    borderRadius: `${theme.appButton.sizeMedium.borderRadius}px`,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    minWidth: 200,
                    maxWidth: 300,
                    cursor: "grab",
                    bgcolor: isSorted
                        ? alpha(theme.palette.primary.main, 0.04)
                        : isActive
                          ? "action.selected"
                          : isHovered
                            ? "action.hover"
                            : "background.paper",
                    transition: "all 0.2s ease",
                    "&:active": {
                        cursor: "grabbing",
                    },
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: 1,
                    }}
                >
                    <DragIndicator
                        sx={{
                            color: "text.secondary",
                            opacity: 0.5,
                            fontSize: 18,
                            flexShrink: 0,
                        }}
                    />
                    <Typography
                        variant="body2"
                        fontWeight={500}
                        noWrap
                        sx={{ flex: 1 }}
                    >
                        {fieldLabel}
                    </Typography>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            ml: "auto",
                            height: 18,
                        }}
                    >
                        {/* Sort indicator */}
                        {onSortingChange && (
                            <Tooltip
                                title={
                                    isSorted
                                        ? t(
                                              "tooltips.click_to_change_sort",
                                              {
                                                  defaultValue: `Click to change sort direction (currently ${sortDirection})`,
                                              }
                                          )
                                        : isDefaultSort
                                          ? t(
                                                "tooltips.default_sort",
                                                "Default sort column"
                                            )
                                          : t("tooltips.click_to_sort", {
                                                defaultValue: "Click to set as sort column",
                                            })
                                }
                                {...(getRTLTooltipProps(i18n) as any)}
                            >
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isSorted) {
                                            // Toggle direction
                                            const newSorting = sorting.map((s) =>
                                                s.field === fieldKey
                                                    ? {
                                                          ...s,
                                                          direction: (s.direction === "ASC"
                                                              ? "DESC"
                                                              : "ASC") as "ASC" | "DESC",
                                                      }
                                                    : s
                                            );
                                            onSortingChange(newSorting);
                                        } else {
                                            // Add as new sort (replace existing if any)
                                            onSortingChange([
                                                {
                                                    field: fieldKey,
                                                    direction: "ASC",
                                                },
                                            ]);
                                        }
                                    }}
                                    sx={{
                                        width: 18,
                                        height: 18,
                                        padding: 0,
                                        color: isSorted
                                            ? theme.palette.primary.main
                                            : isDefaultSort
                                              ? alpha(
                                                    theme.palette.primary.main,
                                                    0.7
                                                )
                                              : alpha(
                                                    theme.palette.text.secondary,
                                                    0.6
                                                ),
                                        "&:hover": {
                                            bgcolor: alpha(
                                                theme.palette.primary.main,
                                                0.08
                                            ),
                                        },
                                        "& .MuiSvgIcon-root": {
                                            fontSize: 16,
                                        },
                                    }}
                                >
                                    {isSorted && sortDirection === "ASC" ? (
                                        <ArrowUpward fontSize="small" />
                                    ) : isSorted && sortDirection === "DESC" ? (
                                        <ArrowDownward fontSize="small" />
                                    ) : (
                                        <ArrowUpward
                                            fontSize="small"
                                            style={{ 
                                                opacity: isDefaultSort ? 0.7 : 0.3 
                                            }}
                                        />
                                    )}
                                </IconButton>
                            </Tooltip>
                        )}
                        
                        {isNumericField(fieldInfo?.type) && (
                            <>
                                {field.aggregation && (
                                    <Chip
                                        label={field.aggregation}
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: "0.7rem",
                                            bgcolor: alpha(
                                                theme.palette.primary.main,
                                                0.1
                                            ),
                                            color: theme.palette.primary.main,
                                            "& .MuiChip-label": {
                                                px: 0.75,
                                                lineHeight: 1.2,
                                            },
                                        }}
                                    />
                                )}
                                <Tooltip
                                    title={t(
                                        "fields.aggregation",
                                        "Aggregation"
                                    )}
                                    {...(getRTLTooltipProps(i18n) as any)}
                                >
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAggregationMenuAnchor(
                                                e.currentTarget
                                            );
                                        }}
                                        sx={{
                                            width: 18,
                                            height: 18,
                                            padding: 0,
                                            color: field.aggregation
                                                ? theme.palette.primary.main
                                                : alpha(
                                                      theme.palette.text
                                                          .secondary,
                                                      0.6
                                                  ),
                                            "&:hover": {
                                                bgcolor: alpha(
                                                    theme.palette.primary.main,
                                                    0.08
                                                ),
                                            },
                                            "& .MuiSvgIcon-root": {
                                                fontSize: 18,
                                            },
                                        }}
                                    >
                                        <Functions fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                            sx={{
                                width: 18,
                                height: 18,
                                padding: 0,
                                color: "error.main",
                                opacity: 0.7,
                                "&:hover": {
                                    bgcolor: "action.hover",
                                    color: "error.main",
                                    opacity: 1,
                                },
                                "& .MuiSvgIcon-root": {
                                    fontSize: 16,
                                },
                            }}
                        >
                            <Close fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                <Menu
                    anchorEl={aggregationMenuAnchor}
                    open={Boolean(aggregationMenuAnchor)}
                    onClose={() => setAggregationMenuAnchor(null)}
                    anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "left",
                    }}
                    transformOrigin={{
                        vertical: "top",
                        horizontal: "left",
                    }}
                >
                    <MenuItem
                        onClick={() => {
                            onUpdateField("aggregation", undefined);
                            setAggregationMenuAnchor(null);
                        }}
                        selected={!field.aggregation}
                        disabled={
                            rawTakenElsewhere &&
                            Boolean(field.aggregation)
                        }
                    >
                        {t("values.none", "None")}
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            onUpdateField("aggregation", "SUM");
                            setAggregationMenuAnchor(null);
                        }}
                        selected={field.aggregation === "SUM"}
                        disabled={aggregationsTakenElsewhere.has("SUM")}
                    >
                        {t("values.aggregation_sum", "SUM")}
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            onUpdateField("aggregation", "AVG");
                            setAggregationMenuAnchor(null);
                        }}
                        selected={field.aggregation === "AVG"}
                        disabled={aggregationsTakenElsewhere.has("AVG")}
                    >
                        {t("values.aggregation_avg", "AVG")}
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            onUpdateField("aggregation", "COUNT");
                            setAggregationMenuAnchor(null);
                        }}
                        selected={field.aggregation === "COUNT"}
                        disabled={aggregationsTakenElsewhere.has("COUNT")}
                    >
                        {t("values.aggregation_count", "COUNT")}
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            onUpdateField("aggregation", "MIN");
                            setAggregationMenuAnchor(null);
                        }}
                        selected={field.aggregation === "MIN"}
                        disabled={aggregationsTakenElsewhere.has("MIN")}
                    >
                        {t("values.aggregation_min", "MIN")}
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            onUpdateField("aggregation", "MAX");
                            setAggregationMenuAnchor(null);
                        }}
                        selected={field.aggregation === "MAX"}
                        disabled={aggregationsTakenElsewhere.has("MAX")}
                    >
                        {t("values.aggregation_max", "MAX")}
                    </MenuItem>
                </Menu>
            </Paper>
        );
    }
);
SortableFieldCard.displayName = "SortableFieldCard";

interface SortableFormulaCardProps {
    formula: ReportFormula;
    sortableId: string;
    onEdit: () => void;
    onDelete: () => void;
    validationError?: string;
    t: any;
    theme: any;
    isHovered?: boolean;
    isActive?: boolean;
}

const SortableFormulaCard: React.FC<SortableFormulaCardProps> = React.memo(
    ({
        formula,
        sortableId,
        onEdit,
        onDelete,
        validationError,
        t,
        theme,
        isHovered = false,
        isActive = false,
    }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            setActivatorNodeRef,
            transform,
            transition,
            isDragging,
        } = useSortable({ id: sortableId });

        React.useEffect(() => {
            if (isDragging && document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        }, [isDragging]);

        const style = {
            transform: CSS.Transform.toString(transform),
            transition: isDragging
                ? transition
                : "transform 0.2s ease, opacity 0.2s ease",
            opacity: isDragging ? 0.5 : 1,
        };

        return (
            <Box>
                <Paper
                    ref={setNodeRef}
                    style={style}
                    elevation={0}
                    onClick={onEdit}
                    sx={{
                        p: 1,
                        border: isActive
                            ? `1px solid ${theme.palette.secondary.main}`
                            : isHovered
                              ? `1px solid ${theme.palette.primary.main}`
                              : `1px solid ${theme.palette.divider}`,
                        borderRadius: `${theme.appButton.sizeMedium.borderRadius}px`,
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        minWidth: 200,
                        maxWidth: 300,
                        cursor: "pointer",
                        bgcolor: isActive
                            ? "action.selected"
                            : isHovered
                              ? "action.hover"
                              : "background.paper",
                        transition: "all 0.2s ease",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            flex: 1,
                            minWidth: 0,
                        }}
                    >
                        <Box
                            component="span"
                            ref={setActivatorNodeRef}
                            {...listeners}
                            {...attributes}
                            aria-label={t("tooltips.drag_to_reorder", {
                                defaultValue: "Drag to reorder",
                            })}
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                color: "text.secondary",
                                opacity: 0.5,
                                fontSize: 18,
                                flexShrink: 0,
                                cursor: "grab",
                                "&:active": { cursor: "grabbing" },
                            }}
                        >
                            <DragIndicator
                                aria-hidden
                                sx={{ fontSize: 18 }}
                            />
                        </Box>
                        <Calculate
                            fontSize="small"
                            sx={{
                                color: theme.palette.primary.main,
                                flexShrink: 0,
                            }}
                        />
                        <Typography
                            variant="body2"
                            fontWeight={500}
                            noWrap
                            sx={{ flex: 1 }}
                        >
                            {formula.label}
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        aria-label={t("actions.delete", {
                            ns: "common",
                            defaultValue: "Delete",
                        })}
                        sx={{
                            width: 18,
                            height: 18,
                            padding: 0,
                            color: "error.main",
                            opacity: 0.7,
                            flexShrink: 0,
                            "&:hover": {
                                bgcolor: "action.hover",
                                color: "error.main",
                                opacity: 1,
                            },
                            "& .MuiSvgIcon-root": {
                                fontSize: 16,
                            },
                        }}
                    >
                        <Close fontSize="small" />
                    </IconButton>
                </Paper>
                {validationError && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                        {validationError}
                    </Typography>
                )}
            </Box>
        );
    }
);
SortableFormulaCard.displayName = "SortableFormulaCard";

// Drop zone component for before first and after last
const DropZone: React.FC<{
    id: string;
    isActive: boolean;
    position: "left" | "right" | "between";
    theme: any;
}> = ({ id, isActive, position, theme }) => {
    const { setNodeRef } = useDroppable({ id });

    const sx =
        position === "left"
            ? {
                  position: "absolute" as const,
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: isActive ? 4 : 0,
                  bgcolor: theme.palette.primary.main,
                  borderRadius: 1,
                  transition: "width 0.2s ease",
                  zIndex: 10,
              }
            : position === "right"
              ? {
                    position: "absolute" as const,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: isActive ? 4 : 0,
                    bgcolor: theme.palette.primary.main,
                    borderRadius: 1,
                    transition: "width 0.2s ease",
                    zIndex: 10,
                }
              : {
                    width: isActive ? 4 : 0,
                    bgcolor: theme.palette.primary.main,
                    borderRadius: 1,
                    transition: "width 0.2s ease",
                    alignSelf: "stretch",
                };

    return <Box ref={setNodeRef} sx={sx} />;
};

const DroppableFieldsArea: React.FC<{
    children: React.ReactNode;
    isOver?: boolean;
    hasFields?: boolean;
}> = ({ children, isOver, hasFields }) => {
    const { setNodeRef } = useDroppable({
        id: "fields-area",
    });

    return (
        <Box
            ref={setNodeRef}
            sx={{
                minHeight: hasFields ? "auto" : 200,
                border: 2,
                borderStyle: "dashed",
                borderColor: isOver ? "primary.main" : "divider",
                borderRadius: 2,
                p: 2,
                bgcolor: isOver
                    ? "action.hover"
                    : "background.default",
                transition: "all 0.2s ease",
                position: "relative",
                "&:hover": {
                    borderColor: "primary.light",
                    bgcolor: "action.hover",
                },
            }}
        >
            {children}
        </Box>
    );
};

const DragDropFieldSelector: React.FC<DragDropFieldSelectorProps> = ({
    selectedTables,
    tables,
    selectedFields,
    onFieldsChange,
    relationships = [],
    sorting = [],
    onSortingChange,
    onAddFormula,
    addFormulaDisabled,
    addFormulaDisabledReason,
    formulas = [],
    columnOrder,
    onColumnOrderChange,
    onFormulaEdit,
    onFormulaDelete,
    formulaValidationErrors = {},
}) => {
    const { t, i18n } = useTranslation([
        "reports",
        "common",
        "customers",
        "invoices",
        "disputes",
        "activities",
        "contacts",
        "companies",
        "accounts",
    ]);
    const theme = useTheme();
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
    const isHebrew = i18n.language === "he";
    const isRTL = isHebrew;

    // Search and filter state
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedTypeFilter, setSelectedTypeFilter] =
        React.useState<string>("all");
    // Initialize expanded tables as empty (all tables collapsed by default)
    // Users can expand them as needed
    const [expandedTables, setExpandedTables] = React.useState<Set<string>>(
        new Set()
    );

    // Ref for scrollable container to check dimensions
    const scrollableContainerRef = React.useRef<HTMLDivElement>(null);

    // Memoize table fields getter
    const getTableFields = useCallback(
        (tableName: string) => getTableFieldsUtil(tableName, tables, t),
        [tables, t]
    );

    // Memoize selected table names
    const selectedTableNames = useMemo(
        () => getSelectedTableNames(selectedFields),
        [selectedFields]
    );

    // Memoize table connectivity
    const tableConnectivity = useMemo(() => {
        return tables.reduce(
            (acc, table) => {
                acc[table.name] = {
                    canConnect: canTableConnect(
                        table.name,
                        selectedTableNames,
                        relationships
                    ),
                    canAdd: canAddFieldFromTable(
                        table.name,
                        selectedTableNames
                    ),
                };
                return acc;
            },
            {} as Record<string, { canConnect: boolean; canAdd: boolean }>
        );
    }, [tables, selectedTableNames, relationships]);

    // Memoize canTableConnect and canAddFieldFromTable functions
    const canTableConnectMemo = useCallback(
        (tableName: string) => {
            return tableConnectivity[tableName]?.canConnect ?? false;
        },
        [tableConnectivity]
    );

    const canAddFieldFromTableMemo = useCallback(
        (tableName: string) => {
            return tableConnectivity[tableName]?.canAdd ?? false;
        },
        [tableConnectivity]
    );

    // Use field filtering hook
    const { selectedFieldKeys, filteredFieldsByTable } = useFieldFiltering({
        tables,
        selectedFields,
        searchQuery,
        typeFilter: selectedTypeFilter,
        getTableFields,
    });

    // Use drag and drop hook
    const unifiedConfig = useMemo(() => {
        if (!onColumnOrderChange) {
            return undefined;
        }
        return {
            columnOrder: columnOrder || [],
            formulas,
            onColumnOrderChange,
        };
    }, [columnOrder, formulas, onColumnOrderChange]);

    const {
        activeId,
        draggedField,
        draggedFormulaLabel,
        isOver,
        hoveredFieldId,
        insertIndex,
        columnListItems,
        isUnified,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
    } = useDragDropFields({
        selectedFields,
        onFieldsChange,
        tables,
        getTableFields,
        selectedFieldKeys,
        canAddFieldFromTable: canAddFieldFromTableMemo,
        unified: unifiedConfig,
    });

    const displayColumnItems = useMemo(() => {
        if (isUnified) {
            return columnListItems;
        }
        return buildColumnListItems(selectedFields, [], columnOrder);
    }, [columnListItems, columnOrder, isUnified, selectedFields]);

    const hasCanvasItems = isUnified
        ? displayColumnItems.length > 0
        : selectedFields.length > 0;

    // Track previous search query to detect when it's cleared
    const prevSearchQueryRef = React.useRef<string>(searchQuery);

    // Collapse all tables when search is cleared (changed from non-empty to empty)
    React.useEffect(() => {
        const prevSearchQuery = prevSearchQueryRef.current;
        const wasSearching =
            prevSearchQuery && prevSearchQuery.trim().length > 0;
        const isSearchCleared =
            wasSearching && (!searchQuery || searchQuery.trim().length === 0);

        if (isSearchCleared && expandedTables.size > 0) {
            // When search is cleared (changed from non-empty to empty), collapse all tables
            setExpandedTables(new Set());
        }

        // Update ref for next render
        prevSearchQueryRef.current = searchQuery;
    }, [searchQuery, expandedTables.size]);

    // Automatically expand tables that have matching fields when searching
    React.useEffect(() => {
        if (!searchQuery) {
            // Don't auto-expand when there's no search query
            return;
        }

        const newExpanded = new Set(expandedTables);
        let hasChanges = false;

        tables.forEach((table) => {
            const tableCanConnect = canTableConnectMemo(table.name);
            const canAddFromTable = canAddFieldFromTableMemo(table.name);
            const isTableDisabled = !tableCanConnect || !canAddFromTable;

            // Skip disabled tables
            if (isTableDisabled) {
                return;
            }

            // Check if this table has matching fields
            const matchingFields = filteredFieldsByTable[table.name] || [];
            const hasMatchingFields = matchingFields.length > 0;

            // If table has matching fields and is not expanded, expand it
            if (hasMatchingFields && !newExpanded.has(table.name)) {
                newExpanded.add(table.name);
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setExpandedTables(newExpanded);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        searchQuery,
        filteredFieldsByTable,
        tables,
        canTableConnectMemo,
        canAddFieldFromTableMemo,
    ]);

    // Automatically collapse disabled tables
    React.useEffect(() => {
        const newExpanded = new Set(expandedTables);
        let hasChanges = false;

        tables.forEach((table) => {
            const tableCanConnect = canTableConnectMemo(table.name);
            const canAddFromTable = canAddFieldFromTableMemo(table.name);
            const isTableDisabled = !tableCanConnect || !canAddFromTable;

            // If table is disabled and expanded, collapse it
            if (isTableDisabled && newExpanded.has(table.name)) {
                newExpanded.delete(table.name);
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setExpandedTables(newExpanded);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectedFields,
        selectedTables,
        tables,
        relationships,
        canTableConnectMemo,
        canAddFieldFromTableMemo,
    ]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Track if content exceeds container to force scrollbar visibility
    const [contentExceedsContainer, setContentExceedsContainer] =
        React.useState(false);

    // Check if content exceeds container and update state
    React.useEffect(() => {
        const container = scrollableContainerRef.current;
        if (!container) return;

        const checkContentExceeds = () => {
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const exceeds = scrollHeight > clientHeight;
            setContentExceedsContainer(exceeds);
        };

        // Check after layout is complete
        const timeoutId = setTimeout(checkContentExceeds, 300);
        const resizeObserver = new ResizeObserver(checkContentExceeds);
        resizeObserver.observe(container);

        return () => {
            clearTimeout(timeoutId);
            resizeObserver.disconnect();
        };
    }, [tables.length, expandedTables.size]);

    // Handle field selection via checkbox
    const handleFieldToggle = useCallback(
        (tableName: string, fieldName: string) => {
            const hasAnyForBase = selectedFields.some(
                (f) => f.table === tableName && f.field === fieldName
            );

            if (hasAnyForBase) {
                onFieldsChange(
                    selectedFields.filter(
                        (f) =>
                            !(f.table === tableName && f.field === fieldName)
                    )
                );
            } else {
                if (!canAddFieldFromTableMemo(tableName)) {
                    return;
                }

                const table = tables.find((t) => t.name === tableName);
                const field = getTableFields(tableName).find(
                    (f) => f.name === fieldName
                );
                if (!table || !field) {
                    return;
                }

                const baseField: Field = {
                    table: tableName,
                    field: fieldName,
                };
                const toAdd = resolveNextPaletteFieldCandidate(
                    baseField,
                    field.type,
                    selectedFieldKeys
                );
                if (!toAdd) {
                    return;
                }

                onFieldsChange([...selectedFields, toAdd]);
            }
        },
        [
            selectedFieldKeys,
            selectedFields,
            onFieldsChange,
            tables,
            getTableFields,
            canAddFieldFromTableMemo,
        ]
    );

    // Handle accordion expansion
    const handleAccordionChange = useCallback((tableName: string) => {
        setExpandedTables((prev) => {
            const newExpanded = new Set(prev);
            if (newExpanded.has(tableName)) {
                newExpanded.delete(tableName);
            } else {
                newExpanded.add(tableName);
            }
            return newExpanded;
        });
    }, []);

    const getTableLabel = useCallback(
        (tableName: string) => {
            const table = tables.find((t) => t.name === tableName);
            if (!table) return tableName;

            // Map table names to translation strategies (try multiple approaches)
            const tableTranslationMap: Record<
                string,
                Array<{ key: string; ns: string }>
            > = {
                Customer: [
                    { key: "sections.title", ns: "customers" },
                    { key: "tables.customers", ns: "reports" },
                    { key: "navigation_customers", ns: "common" },
                ],
                Invoice: [
                    { key: "sections.title", ns: "invoices" },
                    { key: "tables.invoices", ns: "reports" },
                ],
                Dispute: [
                    { key: "sections.title", ns: "disputes" },
                    { key: "tables.disputes", ns: "reports" },
                    { key: "navigation_disputes", ns: "common" },
                ],
                Activity: [
                    { key: "sections.title", ns: "activities" },
                    { key: "tables.activities", ns: "reports" },
                ],
                InvoicePayment: [
                    { key: "tables.invoice_payments", ns: "reports" },
                ],
                CustomerCollectionPeriod: [
                    { key: "tables.collection_periods", ns: "reports" },
                ],
                Contact: [
                    { key: "sections.title", ns: "contacts" },
                    { key: "tables.contacts", ns: "reports" },
                ],
                Company: [
                    { key: "sections.title", ns: "companies" },
                    { key: "tables.companies", ns: "reports" },
                ],
            };

            const translationConfigs = tableTranslationMap[tableName];
            if (translationConfigs) {
                // Try each translation strategy in order
                for (const config of translationConfigs) {
                    const translation = t(config.key, {
                        ns: config.ns,
                        defaultValue: "",
                    });
                    // Check if translation was found (not the key itself and not empty)
                    if (
                        translation &&
                        translation !== config.key &&
                        translation.trim() !== ""
                    ) {
                        return translation;
                    }
                }
            }

            // Fallback: Try to use table name directly in common namespace
            const tableNameLower = tableName.toLowerCase();
            const directTranslation = t(`navigation_${tableNameLower}`, {
                ns: "common",
                defaultValue: "",
            });
            if (
                directTranslation &&
                directTranslation !== `navigation_${tableNameLower}` &&
                directTranslation.trim() !== ""
            ) {
                return directTranslation;
            }

            // Final fallback to table label from metadata
            return table.label;
        },
        [tables, t]
    );

    const handleRemoveField = useCallback(
        (index: number) => {
            onFieldsChange(selectedFields.filter((_, i) => i !== index));
        },
        [selectedFields, onFieldsChange]
    );

    const handleUpdateField = useCallback(
        (index: number, field: keyof Field, value: any) => {
            const updated = [...selectedFields];
            const currentField = updated[index];

            // If updating the field name or table, check if the new field type is numeric
            // If not, clear aggregation
            if (field === "field" || field === "table") {
                const newTable = field === "table" ? value : currentField.table;
                const newFieldName =
                    field === "field" ? value : currentField.field;

                const fieldInfo = getTableFields(newTable).find(
                    (f) => f.name === newFieldName
                );

                // Clear aggregation if the new field is not numeric
                if (fieldInfo && !isNumericField(fieldInfo.type)) {
                    updated[index] = {
                        ...currentField,
                        [field]: value,
                        aggregation: undefined,
                    };
                } else {
                    updated[index] = { ...currentField, [field]: value };
                }
            } else {
                updated[index] = { ...currentField, [field]: value };
            }

            onFieldsChange(updated);
        },
        [selectedFields, onFieldsChange, getTableFields]
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
        >
            <Box sx={{ display: "flex", gap: 3, width: "100%" }}>
                {/* Available Fields - Searchable Tree View on Left */}
                <Box
                    sx={{
                        width: 320,
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        maxHeight: "calc(100vh - 200px)",
                    }}
                >
                    {/* Search Bar */}
                    <TextField
                        fullWidth
                        size="small"
                        placeholder={t(
                            "fields.search_fields",
                            "Search fields..."
                        )}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        {...(isHebrew && { "data-hebrew": true })}
                        dir={isRTL ? "rtl" : "ltr"}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search
                                        sx={{
                                            color: theme.palette.text.secondary,
                                        }}
                                    />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery ? (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={() => setSearchQuery("")}
                                        sx={{
                                            width: 20,
                                            height: 20,
                                            p: 0.5,
                                            color: theme.palette.text.secondary,
                                            "&:hover": {
                                                color: theme.palette.text
                                                    .primary,
                                                bgcolor: alpha(
                                                    theme.palette.action.hover,
                                                    0.5
                                                ),
                                            },
                                        }}
                                    >
                                        <Close sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </InputAdornment>
                            ) : undefined,
                        }}
                        sx={{ mb: 2 }}
                    />

                    {/* Type Filter Chips — reuse endless-scroll toolbar icon button styles */}
                    <Box
                        className="endless-scroll-toolbar"
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.5,
                            mb: 2,
                        }}
                    >
                        {[
                            {
                                value: "all",
                                label: t("fields.filter_all", "All"),
                                icon: FilterList,
                            },
                            {
                                value: "number",
                                label: t("fields.filter_numbers", "Numbers"),
                                icon: Numbers,
                            },
                            {
                                value: "date",
                                label: t("fields.filter_dates", "Dates"),
                                icon: CalendarToday,
                            },
                            {
                                value: "string",
                                label: t("fields.filter_strings", "Strings"),
                                icon: TextFields,
                            },
                            {
                                value: "enum",
                                label: t("fields.filter_enums", "Enums"),
                                icon: List,
                            },
                        ].map((filter) => {
                            const FilterIcon = filter.icon;
                            const isSelected =
                                selectedTypeFilter === filter.value;

                            return (
                                <Tooltip
                                    key={filter.value}
                                    title={filter.label}
                                    {...getRTLTooltipProps(i18n)}
                                >
                                    <IconButton
                                        color="primary"
                                        size="small"
                                        className="toolbar-button"
                                        aria-pressed={isSelected}
                                        onClick={() =>
                                            setSelectedTypeFilter(filter.value)
                                        }
                                    >
                                        <FilterIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            );
                        })}
                    </Box>

                    {/* Tree View with Accordions */}
                    <Box
                        ref={scrollableContainerRef}
                        className="report-builder-tables-scrollable"
                        sx={{
                            flex: 1,
                            minHeight: 0, // Critical for flex scrolling - allows flex child to shrink
                            maxHeight: "calc(100vh - 300px)", // Constrain height based on viewport
                            overflowY: contentExceedsContainer
                                ? "scroll"
                                : "auto", // Force scrollbar when content exceeds
                            overflowX: "hidden",
                            width: "100%",
                            pr: 1,
                            // Override global scrollbar hiding - make scrollbar visible
                            scrollbarWidth: "thin !important" as any,
                            scrollbarColor: `${alpha(theme.palette.primary.main, 0.6)} ${alpha(theme.palette.primary.main, 0.1)} !important`,
                            scrollbarGutter: "stable !important" as any, // Reserve space for scrollbar
                            msOverflowStyle: "scroll !important" as any, // Always show in IE/Edge
                            "&::-webkit-scrollbar": {
                                display: "block !important",
                                width: "12px !important",
                                WebkitAppearance: "none !important" as any,
                            },
                            "&::-webkit-scrollbar-track": {
                                display: "block !important",
                                backgroundColor: `${alpha(theme.palette.primary.main, 0.1)} !important`,
                                borderRadius: "6px !important",
                                WebkitBoxShadow:
                                    "inset 0 0 6px rgba(0, 0, 0, 0.1) !important" as any,
                            },
                            "&::-webkit-scrollbar-thumb": {
                                display: "block !important",
                                backgroundColor: `${alpha(theme.palette.primary.main, 0.6)} !important`,
                                borderRadius: "6px !important",
                                WebkitBoxShadow:
                                    "inset 0 0 6px rgba(0, 0, 0, 0.3) !important" as any,
                                "&:hover": {
                                    backgroundColor: `${theme.palette.primary.main} !important`,
                                },
                            },
                        }}
                    >
                        {tables
                            .filter((table) => {
                                // Filter out hidden tables (Company) from display
                                // They are still accessible via Customer table fields
                                return (
                                    table.name !== "Person" &&
                                    table.name !== "Company"
                                );
                            })
                            .sort((a, b) => {
                                // Sort: enabled tables first, disabled tables last
                                const aTableCanConnect = canTableConnectMemo(
                                    a.name
                                );
                                const aCanAddFromTable =
                                    canAddFieldFromTableMemo(a.name);
                                const aIsDisabled =
                                    !aTableCanConnect || !aCanAddFromTable;

                                const bTableCanConnect = canTableConnectMemo(
                                    b.name
                                );
                                const bCanAddFromTable =
                                    canAddFieldFromTableMemo(b.name);
                                const bIsDisabled =
                                    !bTableCanConnect || !bCanAddFromTable;

                                // Enabled tables (false) come before disabled tables (true)
                                if (aIsDisabled === bIsDisabled) {
                                    return 0; // Keep original order for same disabled state
                                }
                                return aIsDisabled ? 1 : -1;
                            })
                            .map((table) => {
                                const availableBaseFields =
                                    filteredFieldsByTable[table.name] || [];

                                const totalAvailable =
                                    availableBaseFields.length;

                                // Hide tables with no matching fields
                                // When searching, hide tables that don't match
                                // When not searching, hide tables with no available fields
                                if (totalAvailable === 0) {
                                    return null;
                                }

                                const isExpanded = expandedTables.has(
                                    table.name
                                );

                                // Check if table can be used (connectivity and 2-table limit)
                                const tableCanConnect = canTableConnectMemo(
                                    table.name
                                );
                                const canAddFromTable =
                                    canAddFieldFromTableMemo(table.name);
                                const isTableDisabled =
                                    !tableCanConnect || !canAddFromTable;

                                return (
                                    <Accordion
                                        key={table.name}
                                        expanded={isExpanded}
                                        disableGutters
                                        onChange={() => {
                                            if (!isTableDisabled) {
                                                handleAccordionChange(
                                                    table.name
                                                );
                                            }
                                        }}
                                        elevation={0}
                                        disabled={isTableDisabled}
                                        sx={{
                                            mb: 1,
                                            border: `1px solid ${theme.palette.divider}`,
                                            borderRadius: pillRadiusPx,
                                            overflow: "hidden",
                                            opacity: isTableDisabled ? 0.5 : 1,
                                            "&:before": { display: "none" },
                                            // MUI gutters / :first-of-type reset top corners — force pill on every item
                                            "&:first-of-type, &:last-of-type, &:not(:first-of-type)":
                                                {
                                                    borderRadius: pillRadiusPx,
                                                },
                                            "&.Mui-expanded": {
                                                margin: 0,
                                                marginBottom: 1,
                                            },
                                            "&.Mui-disabled": {
                                                opacity: 0.5,
                                            },
                                        }}
                                    >
                                        <AccordionSummary
                                            expandIcon={<ExpandMore />}
                                            sx={{
                                                minHeight: 36,
                                                py: 0,
                                                bgcolor: "background.paper",
                                                borderTopLeftRadius: pillRadiusPx,
                                                borderTopRightRadius: pillRadiusPx,
                                                borderBottomLeftRadius: isExpanded
                                                    ? 0
                                                    : pillRadiusPx,
                                                borderBottomRightRadius: isExpanded
                                                    ? 0
                                                    : pillRadiusPx,
                                                "&.Mui-expanded": {
                                                    minHeight: 36,
                                                    borderTopLeftRadius: pillRadiusPx,
                                                    borderTopRightRadius: pillRadiusPx,
                                                    borderBottomLeftRadius: 0,
                                                    borderBottomRightRadius: 0,
                                                },
                                                "& .MuiAccordionSummary-content": {
                                                    my: 0,
                                                },
                                                direction: isRTL ? "rtl" : "ltr",
                                                "& .MuiAccordionSummary-expandIconWrapper": {
                                                    marginLeft: isRTL ? 0 : undefined,
                                                    marginRight: isRTL ? theme.spacing(1) : undefined,
                                                },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent:
                                                        "space-between",
                                                    width: "100%",
                                                    pr: isRTL ? 0 : 1,
                                                    pl: isRTL ? 1 : 0,
                                                    direction: isRTL ? "rtl" : "ltr",
                                                }}
                                            >
                                                <Typography
                                                    variant="subtitle2"
                                                    fontWeight={600}
                                                    sx={{
                                                        direction: isRTL ? "rtl" : "ltr",
                                                        textAlign: isRTL ? "right" : "left",
                                                        flex: 1,
                                                    }}
                                                >
                                                    {getTableLabel(table.name)}
                                                </Typography>
                                                {totalAvailable > 0 && (
                                                    <Badge
                                                        badgeContent={
                                                            totalAvailable
                                                        }
                                                        color="primary"
                                                        sx={{
                                                            ml: isRTL ? theme.spacing(1) : 0,
                                                            mr: isRTL ? 0 : theme.spacing(1),
                                                            "& .MuiBadge-badge":
                                                                {
                                                                    fontSize:
                                                                        "0.7rem",
                                                                    height: 18,
                                                                    minWidth: 18,
                                                                },
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails
                                            sx={{
                                                pt: 1,
                                                pb: 1,
                                                bgcolor: "background.paper",
                                                borderBottomLeftRadius: pillRadiusPx,
                                                borderBottomRightRadius: pillRadiusPx,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 1,
                                                }}
                                            >
                                                {/* All fields (including merged Company fields for Customer) */}
                                                {availableBaseFields.map(
                                                    (field) => {
                                                        const fieldKey = `${table.name}.${field.name}`;
                                                        const fieldDisabled =
                                                            isTableDisabled ||
                                                            !canAddFieldFromTableMemo(
                                                                table.name
                                                            );

                                                        const rowSelected =
                                                            selectedFields.some(
                                                                (f) =>
                                                                    f.table ===
                                                                        table.name &&
                                                                    f.field ===
                                                                        field.name
                                                            );
                                                        return (
                                                            <DraggableFieldItem
                                                                key={fieldKey}
                                                                field={field}
                                                                tableName={
                                                                    table.name
                                                                }
                                                                tableLabel={
                                                                    getTableLabel(table.name)
                                                                }
                                                                isSelected={
                                                                    rowSelected
                                                                }
                                                                paletteAllowsDuplicateDrag={paletteAllowsAnotherInstance(
                                                                    field.type
                                                                )}
                                                                showCheckbox={
                                                                    true
                                                                }
                                                                disabled={
                                                                    fieldDisabled
                                                                }
                                                                onCheckboxToggle={() =>
                                                                    handleFieldToggle(
                                                                        table.name,
                                                                        field.name
                                                                    )
                                                                }
                                                            />
                                                        );
                                                    }
                                                )}
                                            </Box>
                                        </AccordionDetails>
                                    </Accordion>
                                );
                            })}
                    </Box>
                </Box>

                {/* Selected Fields Area - Drop Zone on Right */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <DroppableFieldsArea
                        isOver={isOver}
                        hasFields={hasCanvasItems}
                    >
                        {!hasCanvasItems ? (
                            <EmptyState
                                noRowsMessage={t(
                                    "messages.drop_fields_here",
                                    "Drop fields here"
                                )}
                                noRowsDescription={t(
                                    "messages.fields_area_empty",
                                    "Drag fields from above to build your report columns"
                                )}
                                language={i18n.language}
                                height={{
                                    xs: "150px",
                                    sm: "150px",
                                    md: "150px",
                                }}
                            />
                        ) : (
                            <Box>
                                <SortableContext
                                    items={
                                        isUnified
                                            ? displayColumnItems.map(
                                                  (item) => item.outputKey
                                              )
                                            : selectedFields.map(
                                                  (f, i) =>
                                                      `${f.table}.${f.field}-${i}`
                                              )
                                    }
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 1,
                                            alignItems: "flex-start",
                                            position: "relative",
                                        }}
                                    >
                                        <DropZone
                                            id="drop-before-first"
                                            isActive={insertIndex === 0}
                                            position="left"
                                            theme={theme}
                                        />

                                        {displayColumnItems.map((item, index) => {
                                            const itemId =
                                                isUnified || item.kind === "formula"
                                                    ? item.outputKey
                                                    : `${item.field.table}.${item.field.field}-${item.fieldIndex}`;

                                            return (
                                                <React.Fragment key={itemId}>
                                                    {index > 0 && (
                                                        <DropZone
                                                            id={`drop-between-${index}`}
                                                            isActive={
                                                                insertIndex ===
                                                                index
                                                            }
                                                            position="between"
                                                            theme={theme}
                                                        />
                                                    )}
                                                    <Box data-id={itemId}>
                                                        {item.kind === "field" ? (
                                                            <SortableFieldCard
                                                                field={item.field}
                                                                index={
                                                                    item.fieldIndex
                                                                }
                                                                sortableId={
                                                                    isUnified
                                                                        ? item.outputKey
                                                                        : undefined
                                                                }
                                                                selectedFields={
                                                                    selectedFields
                                                                }
                                                                fieldInfo={getTableFields(
                                                                    item.field.table
                                                                ).find(
                                                                    (f) =>
                                                                        f.name ===
                                                                        item.field
                                                                            .field
                                                                )}
                                                                onRemove={() =>
                                                                    handleRemoveField(
                                                                        item.fieldIndex
                                                                    )
                                                                }
                                                                onUpdateField={(
                                                                    fieldKey,
                                                                    value
                                                                ) =>
                                                                    handleUpdateField(
                                                                        item.fieldIndex,
                                                                        fieldKey,
                                                                        value
                                                                    )
                                                                }
                                                                getTableLabel={
                                                                    getTableLabel
                                                                }
                                                                t={t}
                                                                i18n={i18n}
                                                                theme={theme}
                                                                isHovered={
                                                                    hoveredFieldId ===
                                                                        itemId &&
                                                                    activeId !==
                                                                        itemId
                                                                }
                                                                isActive={
                                                                    activeId ===
                                                                    itemId
                                                                }
                                                                sorting={sorting}
                                                                onSortingChange={
                                                                    onSortingChange
                                                                }
                                                            />
                                                        ) : (
                                                            <SortableFormulaCard
                                                                formula={
                                                                    item.formula
                                                                }
                                                                sortableId={
                                                                    item.outputKey
                                                                }
                                                                onEdit={() =>
                                                                    onFormulaEdit?.(
                                                                        item.formula
                                                                            .id
                                                                    )
                                                                }
                                                                onDelete={() =>
                                                                    onFormulaDelete?.(
                                                                        item.formula
                                                                            .id
                                                                    )
                                                                }
                                                                validationError={
                                                                    formulaValidationErrors[
                                                                        item
                                                                            .formula
                                                                            .id
                                                                    ]
                                                                }
                                                                t={t}
                                                                theme={theme}
                                                                isHovered={
                                                                    hoveredFieldId ===
                                                                        itemId &&
                                                                    activeId !==
                                                                        itemId
                                                                }
                                                                isActive={
                                                                    activeId ===
                                                                    itemId
                                                                }
                                                            />
                                                        )}
                                                    </Box>
                                                </React.Fragment>
                                            );
                                        })}

                                        <DropZone
                                            id="drop-after-last"
                                            isActive={
                                                insertIndex ===
                                                displayColumnItems.length
                                            }
                                            position="between"
                                            theme={theme}
                                        />
                                    </Box>
                                </SortableContext>
                            </Box>
                        )}
                    </DroppableFieldsArea>
                    {onAddFormula && (
                        <Box sx={{ mt: 1.5 }}>
                            <Tooltip
                                title={
                                    addFormulaDisabled && addFormulaDisabledReason
                                        ? addFormulaDisabledReason
                                        : t("formulas.add", {
                                              defaultValue: "Add formula",
                                          })
                                }
                                {...getRTLTooltipProps(i18n)}
                            >
                                <span>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={
                                            <Calculate fontSize="small" />
                                        }
                                        disabled={addFormulaDisabled}
                                        onClick={onAddFormula}
                                        sx={{
                                            direction: isRTL ? "rtl" : "ltr",
                                            "& .MuiButton-startIcon": {
                                                marginRight: isRTL
                                                    ? 0
                                                    : theme.spacing(1),
                                                marginLeft: isRTL
                                                    ? theme.spacing(1)
                                                    : 0,
                                            },
                                            "&.Mui-disabled": {
                                                border: `1px solid ${theme.appButton.toolbarControl.borderColor}`,
                                                color: "rgba(0, 0, 0, 0.38)",
                                                backgroundColor:
                                                    "rgba(0, 0, 0, 0.12)",
                                            },
                                        }}
                                    >
                                        {t("formulas.add", {
                                            defaultValue: "Add formula",
                                        })}
                                    </Button>
                                </span>
                            </Tooltip>
                        </Box>
                    )}
                </Box>
            </Box>

            <DragOverlay>
                {(draggedField || draggedFormulaLabel) ? (
                    <Paper
                        elevation={0}
                        sx={{
                            p: 1.5,
                            border: 2,
                            borderColor: "secondary.main",
                            borderRadius: `${theme.appButton.sizeMedium.borderRadius}px`,
                            bgcolor: "action.selected",
                            minWidth: 200,
                            maxWidth: 300,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: 1,
                            boxShadow: 8,
                        }}
                    >
                        <DragIndicator
                            sx={{
                                color: alpha(theme.palette.text.secondary, 0.5),
                                fontSize: 18,
                                flexShrink: 0,
                            }}
                        />
                        {draggedFormulaLabel ? (
                            <Calculate
                                fontSize="small"
                                sx={{ color: theme.palette.primary.main }}
                            />
                        ) : null}
                        <Typography
                            variant="body2"
                            fontWeight={500}
                            noWrap
                            sx={{ flex: 1 }}
                        >
                            {draggedFormulaLabel ?? draggedField?.field.label}
                        </Typography>
                    </Paper>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default DragDropFieldSelector;
