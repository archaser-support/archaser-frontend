"use client";

import { useTheme ,
    Chip,
    Tooltip,
    Card,
    CardContent,
    Box,
    Typography,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface FilterChipProps {
    type: "all" | "success" | "failed";
    count: number;
    filteredCount: number;
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactElement;
    title: string;
    description: string;
    color: "primary" | "success" | "error";
    showCondition?: boolean;
}

const FilterChip: React.FC<FilterChipProps> = ({
    type,
    count,
    filteredCount,
    isActive,
    onClick,
    icon,
    title,
    description,
    color,
    showCondition = true,
}) => {
    const theme = useTheme();
    const { i18n } = useTranslation(["import", "common"]);

    if (!showCondition) {
        return null;
    }

    const getColorConfig = () => {
        switch (color) {
            case "primary":
                return {
                    main: theme.palette.primary.main,
                    light: theme.palette.primary.light,
                    dark: theme.palette.primary.dark,
                    contrastText: theme.palette.primary.contrastText,
                    grey: theme.palette.grey[300],
                };
            case "success":
                return {
                    main: theme.palette.success.main,
                    light: theme.palette.success.light,
                    dark: theme.palette.success.dark,
                    contrastText: theme.palette.success.contrastText,
                    grey: theme.palette.success.light,
                };
            case "error":
                return {
                    main: theme.palette.error.main,
                    light: theme.palette.error.light,
                    dark: theme.palette.error.dark,
                    contrastText: theme.palette.error.contrastText,
                    grey: theme.palette.error.light,
                };
        }
    };

    const colors = getColorConfig();

    return (
        <Tooltip
            title={
                <Card
                    sx={{
                        maxWidth: { xs: 250, sm: 300 },
                        bgcolor: "background.paper",
                        color: "text.primary",
                        boxShadow: theme.shadows[4],
                        border: "none",
                        borderRadius: theme.shape.borderRadius,
                        position: "relative",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        "& .MuiCard-root": {
                            border: "none",
                        },
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderRadius: theme.shape.borderRadius,
                            background: `linear-gradient(135deg, ${colors.main}08 0%, ${colors.main}03 100%)`,
                            pointerEvents: "none",
                            zIndex: 0,
                        },
                    }}
                >
                    <CardContent
                        sx={{
                            p: { xs: 1.5, sm: 2 },
                            "&:last-child": { pb: { xs: 1.5, sm: 2 } },
                            position: "relative",
                            zIndex: 1,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mb: 1,
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {React.cloneElement(icon, {
                                sx: {
                                    fontSize: "1rem",
                                    color: colors.main,
                                },
                            })}
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontWeight: 600,
                                    color: colors.main,
                                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    direction: i18n.language === "he" ? "rtl" : "ltr",
                                    textAlign: i18n.language === "he" ? "right" : "left",
                                }}
                            >
                                {title}
                            </Typography>
                        </Box>

                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.primary",
                                lineHeight: 1.4,
                                fontSize: { xs: "0.7rem", sm: "0.8rem" },
                                wordBreak: "break-word",
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                textAlign: i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            {description}
                        </Typography>
                    </CardContent>
                </Card>
            }
            arrow
            placement="bottom"
            componentsProps={{
                tooltip: {
                    sx: {
                        bgcolor: "transparent",
                        p: 0,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        "& .MuiTooltip-arrow": {
                            color: "background.paper",
                            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                            ...(i18n.language === "he" && {
                                transform: "scaleX(-1)",
                            }),
                        },
                    },
                },
            }}
        >
            <Chip
                icon={icon}
                label={`${title}: ${isActive ? filteredCount : count}`}
                size="small"
                variant={isActive ? "filled" : "outlined"}
                onClick={onClick}
                sx={{
                    borderColor: isActive ? colors.main : colors.grey,
                    color: isActive ? colors.contrastText : colors.main,
                    backgroundColor: isActive ? colors.main : "transparent",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    height: 32,
                    cursor: "pointer",
                    borderRadius: theme.shape.borderRadius,
                    borderWidth: "1.5px",
                    transition: "all 0.2s ease-in-out",
                    minWidth: "fit-content",
                    maxWidth: "none",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                    "&:hover": {
                        backgroundColor: isActive
                            ? colors.dark
                            : `${colors.light}15`,
                        transform: "translateY(-1px)",
                        boxShadow: isActive
                            ? `0 4px 12px ${colors.main}4D`
                            : `0 2px 8px ${colors.main}26`,
                    },
                    "& .MuiChip-icon": {
                        fontSize: "1rem",
                        color: isActive ? colors.contrastText : colors.main,
                        order: i18n.language === "he" ? 2 : 1,
                    },
                    "& .MuiChip-label": {
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        px: 1,
                        whiteSpace: "nowrap",
                        overflow: "visible",
                        textOverflow: "clip",
                        order: i18n.language === "he" ? 1 : 2,
                        textAlign: i18n.language === "he" ? "right" : "left",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    },
                }}
            />
        </Tooltip>
    );
};

export default FilterChip;
