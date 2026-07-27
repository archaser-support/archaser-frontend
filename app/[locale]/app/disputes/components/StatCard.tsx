import {
    Box,
    Card,
    CardContent,
    Skeleton,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

type StatCardProps = {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    isLoading?: boolean;
    status?: "success" | "warning" | "error" | "info";
};

const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    icon,
    color: _color,
    bgColor: _bgColor,
    isLoading = false,
    status = "info",
}) => {
    const { i18n } = useTranslation(["disputes", "common"]);
    const theme = useTheme();

    // Memoize gradient colors
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

    return (
        <Card
            sx={{
                height: { xs: "90px", sm: "100px" },
                cursor: "pointer",
                background: `linear-gradient(135deg, ${gradientColors[0]}08 0%, ${gradientColors[1]}05 100%)`,
                border: `1px solid ${gradientColors[0]}15`,
                borderRadius: "12px",
                boxShadow: `0 2px 8px ${gradientColors[0]}10`,
                transition: "all 0.3s ease",
                position: "relative",
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
            }}
        >
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
                        gap: { xs: 1.5, sm: 2 },
                        flexDirection: "row",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Box
                        className="card-icon"
                        sx={{
                            width: { xs: 36, sm: 40 },
                            height: { xs: 36, sm: 40 },
                            borderRadius: "10px",
                            background: `linear-gradient(135deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`,
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.3s ease",
                            boxShadow: `0 4px 12px ${gradientColors[0]}30`,
                            order: i18n.language === "he" ? 2 : 1,
                            "& .MuiSvgIcon-root": {
                                fontSize: { xs: "1rem", sm: "1.25rem" },
                            },
                        }}
                    >
                        {icon}
                    </Box>

                    <Box
                        sx={{
                            order: i18n.language === "he" ? 1 : 2,
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            flex: 1,
                            minWidth: 0,
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.secondary",
                                fontWeight: 600,
                                fontSize: { xs: "0.65rem", sm: "0.75rem" },
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                lineHeight: 1.2,
                                mb: 0.5,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            {label}
                        </Typography>

                        {isLoading ? (
                            <Skeleton variant="text" width="80%" height={24} />
                        ) : (
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 700,
                                    color: "#000000",
                                    fontSize: { xs: "1.25rem", sm: "1.5rem" },
                                    lineHeight: 1,
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                    textAlign:
                                        i18n.language === "he"
                                            ? "right"
                                            : "left",
                                }}
                            >
                                {value}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

export default StatCard;
