import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface DisputeStatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    status: "info" | "success" | "error" | "warning";
    isLoading?: boolean;
}

const DisputeStatCard: React.FC<DisputeStatCardProps> = ({
    title,
    value,
    icon,
    status: _status,
    isLoading = false,
}) => {
    const theme = useTheme();
    const { i18n } = useTranslation(["disputes", "common"]);

    // Memoize card styles
    const cardStyles = useMemo(
        () => ({
            height: "100%",
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
            transition: "all 0.3s ease",
            maxWidth: "100%",
            overflow: "hidden",
            cursor: "pointer",
            boxShadow: "none",
            "&:hover": {
                boxShadow: "none",
                "& .card-icon": {
                    transform: "scale(1.1) rotate(5deg)",
                },
            },
        }),
        [theme.palette, theme.shadows, theme.shape]
    );

    return (
        <Card elevation={0} sx={cardStyles}>
            <CardContent
                sx={{
                    p: { xs: 1.5, sm: 2 },
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Header with icon and title */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        mb: { xs: 1.5, sm: 2 },
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Box
                        className="card-icon"
                        sx={{
                            width: { xs: 36, sm: 40 },
                            height: { xs: 36, sm: 40 },
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                            borderRadius: theme.shape.borderRadius,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            mr: i18n.language === "he" ? 0 : 1.5,
                            ml: i18n.language === "he" ? 1.5 : 0,
                            transition: "all 0.3s ease",
                            "& .MuiSvgIcon-root": {
                                fontSize: { xs: "1rem", sm: "1.25rem" },
                            },
                        }}
                    >
                        {icon}
                    </Box>
                    <Typography
                        variant={
                            i18n.language === "he" ? "hebrewCardTitle" : "body2"
                        }
                        sx={{
                            color: theme.palette.secondary.main,
                            fontSize: {
                                xs: "0.7rem",
                                sm:
                                    i18n.language === "he"
                                        ? "0.9rem"
                                        : "0.75rem",
                            },
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            flex: 1,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            textAlign:
                                i18n.language === "he" ? "right" : "left",
                        }}
                    >
                        {title}
                    </Typography>
                </Box>

                {/* Value */}
                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            color: "#000000",
                            fontSize: { xs: "1.25rem", sm: "1.5rem" },
                            lineHeight: 1.2,
                        }}
                    >
                        {isLoading ? "..." : value}
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};

export default DisputeStatCard;
