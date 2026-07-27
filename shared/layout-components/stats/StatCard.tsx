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

export type StatCardProps = {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string;
    bgColor?: string;
    isLoading?: boolean;
    status?: "success" | "warning" | "error" | "info";
    height?: number;
    layout?: "vertical" | "horizontal";
};

export type StatCardGridProps = {
    children: React.ReactNode;
    columns?: {
        xs?: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
    };
    gap?: number;
    marginBottom?: number;
    animationDelay?: number;
};

const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    icon,
    color,
    bgColor,
    isLoading = false,
    status = "info",
    height = 80,
    layout = "vertical",
}) => {
    const { i18n } = useTranslation(["common"]);
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

    const isHorizontal = layout === "horizontal";

    return (
        <Card
            elevation={0}
            sx={{
                height: height,
                cursor: "pointer",
                background: `linear-gradient(135deg, ${getGradientColors(status)[0]}08 0%, ${getGradientColors(status)[1]}05 100%)`,
                border: `1px solid ${getGradientColors(status)[0]}15`,
                borderRadius: theme.shape.borderRadius,
                boxShadow: "none",
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
                "&:hover": {
                    boxShadow: "none",
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
                    px: 1.5,
                    pt: 1.5,
                    pb: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: isHorizontal ? "row" : "column",
                    alignItems: isHorizontal ? "center" : "flex-start",
                    justifyContent: isHorizontal
                        ? "space-between"
                        : "space-between",
                }}
            >
                <Box
                    sx={{
                        position: "relative",
                        mb: 0.5,
                    }}
                >
                    <Box
                        className="card-icon"
                        sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "4px",
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.3s ease",
                            boxShadow: "none",
                            position: "absolute",
                            top: 0,
                            left: i18n.language === "he" ? "auto" : 0,
                            right: i18n.language === "he" ? 0 : "auto",
                            "& .MuiSvgIcon-root": {
                                fontSize: "1.1rem",
                            },
                            "&:hover": {
                                transform: "scale(1.1) rotate(5deg)",
                            },
                        }}
                    >
                        {icon}
                    </Box>

                    <Typography
                        variant={i18n.language === "he" ? "hebrewCardTitle" : "body2"}
                        sx={{
                            color: "text.secondary",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            lineHeight: 1.2,
                            fontSize: "0.7rem",
                            ml: i18n.language === "he" ? 0 : 6.5,
                            mr: i18n.language === "he" ? 6.5 : 0,
                        }}
                    >
                        {label}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        textAlign: "center",
                        mt: isHorizontal ? 0 : 0.5,
                        width: "100%",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {isLoading ? (
                        <Skeleton
                            variant="text"
                            width={isHorizontal ? 60 : 80}
                            height={28}
                        />
                    ) : (
                        <Typography
                            className="card-value"
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                color: "#000000",
                                fontSize: "1.25rem",
                                lineHeight: 1,
                                transition: "all 0.3s ease",
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                textAlign: "center",
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

// Grid container component for multiple stat cards
export const StatCardGrid: React.FC<StatCardGridProps> = ({
    children,
    columns = { xs: 1, sm: 2, md: 2, lg: 4 },
    gap = 3,
    marginBottom = 4,
    animationDelay = 0.2,
}) => {
    return (
        <Box
            sx={{
                mb: marginBottom,
                animation: `slideUpStats 0.8s ease-out ${animationDelay}s forwards`,
                opacity: 0,
                transform: "translateY(20px)",
                position: "relative",
                isolation: "isolate",
                "@keyframes slideUpStats": {
                    "0%": {
                        opacity: 0,
                        transform: "translateY(20px)",
                    },
                    "100%": {
                        opacity: 1,
                        transform: "translateY(0)",
                    },
                },
            }}
        >
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: `repeat(${columns.xs || 1}, 1fr)`,
                        sm: `repeat(${columns.sm || 2}, 1fr)`,
                        md: `repeat(${columns.md || 2}, 1fr)`,
                        lg: `repeat(${columns.lg || 4}, 1fr)`,
                        xl: `repeat(${columns.xl || columns.lg || 4}, 1fr)`,
                    },
                    gap: { xs: gap - 1, sm: gap - 1, md: gap },
                    mb: marginBottom,
                }}
            >
                {children}
            </Box>
        </Box>
    );
};

export default StatCard;
