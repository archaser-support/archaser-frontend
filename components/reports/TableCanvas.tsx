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
    onTableRemove: (tableName: string) => void;
    onTableDrop: (table: Table) => void;
    onJoinCreate?: (join: Join) => void;
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
    onRemove: () => void;
    isDragging?: boolean;
}> = ({ table, onRemove, isDragging }) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["reports", "common"]);

    return (
        <Paper
            elevation={0}
            sx={{
                p: 1.5,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                minWidth: 200,
                maxWidth: 250,
                opacity: isDragging ? 0.5 : 1,
                bgcolor: "background.paper",
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
                        arrow
                        enterDelay={300}
                        leaveDelay={100}
                        placement="bottom"
                        PopperProps={{
                            sx: {
                                "& .MuiTooltip-tooltip": {
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                },
                                "& .MuiTooltip-arrow": {
                                    ...(i18n.language === "he" && {
                                        transform: "scaleX(-1)",
                                    }),
                                },
                            },
                        }}
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
        </Paper>
    );
};

const TableCanvas: React.FC<TableCanvasProps> = ({
    tables,
    joins,
    onTableRemove,
    onTableDrop,
}) => {
    const { t } = useTranslation(["reports", "common"]);
    const theme = useTheme();

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
                                        onRemove={() =>
                                            onTableRemove(table.name)
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
