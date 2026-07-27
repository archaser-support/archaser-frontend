import { Box, Card, CardContent, Skeleton, Typography, useTheme } from "@mui/material";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string; // Made optional since we calculate it from status
    bgColor?: string; // Made optional since we calculate it from status
    isLoading?: boolean;
    status?: "success" | "warning" | "error" | "info";
}

const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    icon,
    isLoading = false,
    status = "info",
}) => {
    const { i18n } = useTranslation(["common"]);
    const theme = useTheme();

    // Memoize gradient colors to prevent recalculation on every render
    const gradientColors = useMemo(() => {
        switch (status) {
            case "success":
                return [
                    theme.palette.secondary.light,
                    theme.palette.secondary.main,
                ];
            case "warning":
                return [
                    theme.palette.secondary.main,
                    theme.palette.secondary.dark,
                ];
            case "error":
                return [
                    theme.palette.secondary.dark,
                    theme.palette.secondary.main,
                ];
            default:
                return [
                    theme.palette.secondary.main,
                    theme.palette.secondary.dark,
                ];
        }
    }, [status, theme.palette.secondary]);

    // Memoize card styles for better performance
    const cardStyles = useMemo(() => ({
        height: { xs: "90px", sm: "100px" },
        cursor: "pointer",
        background: `linear-gradient(135deg, ${gradientColors[0]}08 0%, ${gradientColors[1]}05 100%)`,
        border: `1px solid ${gradientColors[0]}15`,
        borderRadius: theme.shape.borderRadius,
        boxShadow: `0 2px 8px ${gradientColors[0]}10`,
        transition: "all 0.3s ease",
        position: "relative" as const,
        overflow: "hidden",
        "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: `0 4px 16px ${gradientColors[0]}20`,
            "& .card-icon": {
                transform: "scale(1.1) rotate(5deg)",
            },
        },
        "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: `linear-gradient(90deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`,
        },
    }), [gradientColors, theme.shape.borderRadius]);

    return (
        <Card sx={cardStyles}>
            <CardContent
                sx={{
                    p: { xs: 1.5, sm: 2 },
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: { xs: 1, sm: 2 },
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Box
                        className="card-icon"
                        sx={{
                            width: { xs: 32, sm: 40 },
                            height: { xs: 32, sm: 40 },
                            borderRadius: theme.shape.borderRadius,
                            background: `linear-gradient(135deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`,
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.3s ease",
                            boxShadow: `0 4px 12px ${gradientColors[0]}30`,
                            flexShrink: 0,
                            "& .MuiSvgIcon-root": {
                                fontSize: { xs: "1rem", sm: "1.25rem" },
                            },
                        }}
                    >
                        {icon}
                    </Box>

                    <Box
                        sx={{
                            flex: 1,
                            textAlign: i18n.language === "he" ? "right" : "left",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.secondary",
                                fontWeight: 600,
                                fontSize: { xs: "0.7rem", sm: "0.75rem" },
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                lineHeight: 1.2,
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                textAlign: i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            {label}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ textAlign: "center", mt: { xs: 0.5, sm: 1 } }}>
                    {isLoading ? (
                        <Skeleton
                            variant="text"
                            sx={{
                                width: { xs: 60, sm: 80 },
                                height: { xs: 24, sm: 32 }
                            }}
                        />
                    ) : (
                        <Typography
                            className="card-value"
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                color: "#000000",
                                fontSize: { xs: "1.25rem", sm: "1.5rem" },
                                lineHeight: 1,
                                transition: "all 0.3s ease",
                            }}
                        >
                            {value}
                        </Typography>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

export default StatCard;
