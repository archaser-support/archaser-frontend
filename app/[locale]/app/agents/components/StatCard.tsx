import {
    Box,
    Card,
    CardContent,
    Skeleton,
    Typography,
    useTheme,
} from "@mui/material";
import React from "react";
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
    const { i18n } = useTranslation(["agents", "common"]);
    const theme = useTheme();
    const getGradientColors = (status: string) => {
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
    };

    return (
        <Card
            sx={{
                height: "80px",
                cursor: "pointer",
                background: `linear-gradient(135deg, ${getGradientColors(status)[0]}08 0%, ${getGradientColors(status)[1]}05 100%)`,
                border: `1px solid ${getGradientColors(status)[0]}15`,
                borderRadius: "12px",
                boxShadow: `0 2px 8px ${getGradientColors(status)[0]}10`,
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
                "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: `0 4px 16px ${getGradientColors(status)[0]}20`,
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
                    background: `linear-gradient(90deg, ${getGradientColors(status)[0]} 0%, ${getGradientColors(status)[1]} 100%)`,
                },
            }}
        >
            <CardContent
                sx={{
                    p: 2,
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                {/* Left side - Icon and Label */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        flexDirection: "row",
                        // Ensure consistent spacing regardless of language
                        "& > *:first-of-type": {
                            mr: i18n.language === "he" ? 0 : 2,
                            ml: i18n.language === "he" ? 2 : 0,
                        },
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Box
                        className="card-icon"
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: "10px",
                            background: `linear-gradient(135deg, ${getGradientColors(status)[0]} 0%, ${getGradientColors(status)[1]} 100%)`,
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.3s ease",
                            boxShadow: `0 4px 12px ${getGradientColors(status)[0]}30`,
                            order: i18n.language === "he" ? 2 : 1,
                            "& .MuiSvgIcon-root": {
                                fontSize: "1.25rem",
                            },
                            "&:hover": {
                                transform: "scale(1.1) rotate(5deg)",
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
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.secondary",
                                fontWeight: 600,
                                fontSize: "0.75rem",
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
                    </Box>
                </Box>

                {/* Right side - Value */}
                <Box
                    sx={{
                        textAlign: i18n.language === "he" ? "left" : "right",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {isLoading ? (
                        <Skeleton variant="text" width={60} height={32} />
                    ) : (
                        <Typography
                            className="card-value"
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                color: "#000000",
                                fontSize: "1.5rem",
                                lineHeight: 1,
                                transition: "all 0.3s ease",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "left" : "right",
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
