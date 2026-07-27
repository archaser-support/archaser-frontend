"use client";

import { Box, Paper, Typography, Tooltip } from "@mui/material";
import { DragIndicator, TableChart } from "@mui/icons-material";
import { useTheme, alpha } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";
import { useDraggable } from "@dnd-kit/core";

interface Table {
    name: string;
    label: string;
    icon?: React.ReactNode;
}

interface Relationship {
    from: string;
    to: string;
    fromField: string;
    toField: string;
    type?: string;
}

interface DragDropTableSelectorProps {
    availableTables: Table[];
    selectedTables: Table[];
    relationships?: Relationship[];
    onTablesChange: (tables: Table[]) => void;
    onTableDrop?: (table: Table) => void;
}

interface DraggableTableItemProps {
    table: Table;
    isSelected: boolean;
    isDisabled?: boolean;
    onRemove?: () => void;
}

const DraggableTableItem: React.FC<DraggableTableItemProps> = ({
    table,
    isSelected,
    isDisabled = false,
    onRemove,
}) => {
    const { t } = useTranslation(["reports"]);
    const theme = useTheme();
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: table.name,
            disabled: isSelected || isDisabled,
        });

    const style = {
        transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
        opacity: isDragging ? 0.5 : 1,
    };

    const paperContent = (
        <Paper
            ref={setNodeRef}
            style={style}
            elevation={0}
            {...(!isSelected && !isDisabled
                ? { ...attributes, ...listeners }
                : {})}
            sx={{
                p: 1,
                cursor: isSelected || isDisabled ? "not-allowed" : "grab",
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: `${theme.appButton.sizeMedium.borderRadius}px`,
                bgcolor: isDisabled
                    ? alpha(theme.palette.action.disabledBackground, 0.3)
                    : "background.paper",
                opacity: isDisabled ? 0.5 : 1,
                "&:hover": {
                    borderColor: isDisabled
                        ? theme.palette.divider
                        : theme.palette.primary.light,
                },
                "&:active": {
                    cursor:
                        isSelected || isDisabled ? "not-allowed" : "grabbing",
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
                    textAlign: "left",
                    color: isDisabled ? "text.disabled" : "text.primary",
                }}
            >
                {table.label}
            </Typography>
            <TableChart
                sx={{
                    color: "text.secondary",
                    opacity: 0.6,
                    fontSize: 18,
                    flexShrink: 0,
                }}
            />
        </Paper>
    );

    if (isDisabled) {
        return (
            <Tooltip
                title={t(
                    "messages.table_cannot_be_connected",
                    "This table cannot be connected to the selected tables. Maximum 2 tables allowed."
                )}
                arrow
                enterDelay={300}
                leaveDelay={100}
            >
                {paperContent}
            </Tooltip>
        );
    }

    return paperContent;
};

const DragDropTableSelector: React.FC<DragDropTableSelectorProps> = ({
    availableTables,
    selectedTables,
    relationships = [],
    onTablesChange,
    onTableDrop,
}) => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const theme = useTheme();

    const selectedTableNames = new Set(selectedTables.map((t) => t.name));
    const unselectedTables = availableTables.filter(
        (t) => !selectedTableNames.has(t.name)
    );

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
        const selectedNames = selectedTables.map((t) => t.name);
        return relationships.some(
            (rel) =>
                (rel.from === tableName && selectedNames.includes(rel.to)) ||
                (rel.to === tableName && selectedNames.includes(rel.from))
        );
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                height: "100%",
            }}
        >
            <Box
                sx={{
                    maxHeight: 600,
                    overflowY: "auto",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                }}
            >
                {unselectedTables.length === 0 ? (
                <Paper
                    elevation={0}
                    sx={{
                        p: 3,
                        textAlign: "center",
                        bgcolor: "background.paper",
                        border: 1,
                        borderColor: "divider",
                        borderStyle: "dashed",
                    }}
                >
                        <Typography variant="body2" color="text.secondary">
                            {t(
                                "messages.no_tables_available",
                                "No tables available"
                            )}
                        </Typography>
                    </Paper>
                ) : (
                    unselectedTables.map((table) => {
                        const isDisabled = !canTableBeConnected(table.name);
                        return (
                            <DraggableTableItem
                                key={table.name}
                                table={table}
                                isSelected={false}
                                isDisabled={isDisabled}
                            />
                        );
                    })
                )}
            </Box>
        </Box>
    );
};

export default DragDropTableSelector;
