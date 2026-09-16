"use client";

import {
    Box,
    Paper,
    Typography,
    Chip,
    IconButton,
    Tooltip,
} from "@mui/material";
import { Close, DragIndicator } from "@mui/icons-material";
import { useTheme, alpha } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";
import { useDroppable } from "@dnd-kit/core";
import { getRTLTooltipProps } from "@/utils/reportFieldUtils";

interface Table {
    name: string;
    label: string;
}

interface Join {
    from: string;
    to: string;
    fromField: string;
    toField: string;
    type: "INNER" | "LEFT" | "RIGHT";
    relationshipType?:
        | "one-to-one"
        | "one-to-many"
        | "many-to-one"
        | "many-to-many";
}

interface TableCanvasProps {
    tables: Table[];
    joins: Join[];
    /** Explicit report grain; falls back to tables[0] when unset. */
    primaryTable?: string | null;
    onTableRemove: (tableName: string) => void;
    onTableDrop: (table: Table) => void;
    onJoinCreate?: (join: Join) => void;
    /** Set another selected table as report grain without removing fields. */
    onSetPrimary?: (tableName: string) => void;
}

const DroppableCanvas: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: "canvas",
    });
    const theme = useTheme();

    return (
        <Box
            ref={setNodeRef}
            sx={{
                minHeight: 150,
                width: "100%",
                border: `2px dashed ${isOver ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 2,
                p: 2,
                bgcolor: isOver
                    ? alpha(theme.palette.primary.main, 0.05)
                    : "background.default",
                transition: "all 0.2s ease",
            }}
        >
            {children}
        </Box>
    );
};

const TableCard: React.FC<{
    table: Table;
    isPrimary: boolean;
    canSetPrimary: boolean;
    onRemove: () => void;
    onSetPrimary?: () => void;
    isDragging?: boolean;
}> = ({
    table,
    isPrimary,
    canSetPrimary,
    onRemove,
    onSetPrimary,
    isDragging,
}) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["reports", "common"]);

    return (
        <Paper
            elevation={0}
            sx={{
                p: 1.5,
                border: `1px solid ${
                    isPrimary
                        ? theme.palette.primary.main
                        : theme.palette.divider
                }`,
                borderRadius: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                minWidth: 200,
                maxWidth: 250,
                opacity: isDragging ? 0.5 : 1,
                bgcolor: isPrimary
                    ? alpha(theme.palette.primary.main, 0.04)
                    : "background.paper",
                transition: "all 0.2s ease",
                "&:hover": {
                    borderColor: theme.palette.primary.main,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
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
                        color: alpha(theme.palette.text.secondary, 0.5),
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
                    {table.label}
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        ml: "auto",
                    }}
                >
                    <Tooltip
                        title={t("actions.remove_table", "Remove table")}
                        {...getRTLTooltipProps(i18n)}
                    >
                        <IconButton
                            size="small"
                            onClick={onRemove}
                            sx={{
                                color: theme.palette.error.main,
                                "&:hover": {
                                    bgcolor: alpha(
                                        theme.palette.error.main,
                                        0.1
                                    ),
                                },
                            }}
                        >
                            <Close fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    width: "100%",
                    flexWrap: "wrap",
                }}
            >
                {isPrimary ? (
                    <Tooltip
                        title={t(
                            "tooltips.primary_table",
                            "This table is the report grain (one row per record)."
                        )}
                        {...getRTLTooltipProps(i18n)}
                    >
                        <Chip
                            label={t("labels.primary_table", "Primary")}
                            size="small"
                            color="primary"
                            variant="outlined"
                        />
                    </Tooltip>
                ) : canSetPrimary && onSetPrimary ? (
                    <Tooltip
                        title={t(
                            "tooltips.set_as_primary",
                            "Use this table as the report grain without removing fields."
                        )}
                        {...getRTLTooltipProps(i18n)}
                    >
                        <Chip
                            label={t(
                                "actions.set_as_primary",
                                "Set as primary"
                            )}
                            size="small"
                            variant="outlined"
                            onClick={onSetPrimary}
                            clickable
                        />
                    </Tooltip>
                ) : null}
            </Box>
        </Paper>
    );
};

const TableCanvas: React.FC<TableCanvasProps> = ({
    tables,
    primaryTable,
    onTableRemove,
    onSetPrimary,
}) => {
    const { t } = useTranslation(["reports", "common"]);
    const resolvedPrimary =
        primaryTable && tables.some((table) => table.name === primaryTable)
            ? primaryTable
            : tables[0]?.name;
    const canSetPrimary = tables.length > 1 && !!onSetPrimary;

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: "100%",
            }}
        >
            <DroppableCanvas>
                {tables.length === 0 ? (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 150,
                            textAlign: "center",
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                whiteSpace: "normal",
                                wordWrap: "break-word",
                            }}
                        >
                            {t(
                                "messages.canvas_empty",
                                "Start building your report by dragging tables from the sidebar. Joins will be created automatically based on relationships."
                            )}
                        </Typography>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                        }}
                    >
                        {/* Tables Row */}
                        <Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    color="text.secondary"
                                    sx={{
                                        fontSize: "0.75rem",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                    }}
                                >
                                    {t(
                                        "sections.selected_tables",
                                        "Selected Tables"
                                    )}
                                </Typography>
                                <Chip
                                    label={tables.length}
                                    size="small"
                                    sx={{
                                        height: 20,
                                        fontSize: "0.6875rem",
                                        fontWeight: 600,
                                    }}
                                />
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 1,
                                }}
                            >
                                {tables.map((table) => (
                                    <TableCard
                                        key={table.name}
                                        table={table}
                                        isPrimary={
                                            table.name === resolvedPrimary
                                        }
                                        canSetPrimary={canSetPrimary}
                                        onRemove={() =>
                                            onTableRemove(table.name)
                                        }
                                        onSetPrimary={
                                            onSetPrimary
                                                ? () =>
                                                      onSetPrimary(table.name)
                                                : undefined
                                        }
                                    />
                                ))}
                            </Box>
                        </Box>
                    </Box>
                )}
            </DroppableCanvas>
        </Box>
    );
};

export default TableCanvas;
