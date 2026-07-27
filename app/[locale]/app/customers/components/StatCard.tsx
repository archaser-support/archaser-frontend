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
    const { i18n } = useTranslation(["customers", "common"]);
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
                    theme.palette.secondary.light,
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

    const gradientColors = getGradientColors(status);
    const isRTL = i18n.language === "he";

    return (
        <Card
            sx={{
                height: "100px",
                cursor: "pointer",
                background: `linear-gradient(135deg, ${gradientColors[0]}08 0%, ${gradientColors[1]}05 100%)`,
                border: `1px solid ${gradientColors[0]}15`,
                borderRadius: theme.shape.borderRadius,
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
                    p: theme.spacing(2),
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
                        gap: theme.spacing(2),
                        flexDirection: "row",
                        direction: isRTL ? "rtl" : "ltr",
                    }}
                >
                    <Box
                        className="card-icon"
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: theme.shape.borderRadius,
                            background: `linear-gradient(135deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`,
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.3s ease",
                            boxShadow: `0 4px 12px ${gradientColors[0]}30`,
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

                    <Box sx={{ flex: 1 }}>
                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.secondary",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                lineHeight: 1.2,
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                            }}
                        >
                            {label}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ textAlign: "center", mt: theme.spacing(1) }}>
                    {isLoading ? (
                        <Skeleton variant="text" width={80} height={32} />
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
