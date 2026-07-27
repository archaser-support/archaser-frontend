import { SvgIconComponent } from "@mui/icons-material";
import { Box, Typography, SxProps, Theme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface NoRecordsOverlayProps {
    icon?: SvgIconComponent;
    title: string | { key: string; default?: string };
    description?: string | { key: string; default?: string };
    iconColor?:
        | "primary"
        | "secondary"
        | "error"
        | "warning"
        | "info"
        | "success";
    animationDelay?: number;
    maxWidth?: {
        xs?: string;
        sm?: string;
        md?: string;
    };
    sx?: SxProps<Theme>;
}

const NoRecordsOverlay: React.FC<NoRecordsOverlayProps> = ({
    icon: IconComponent,
    title,
    iconColor = "secondary",
    sx,
}) => {
    const { t } = useTranslation(["common"]);
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                py: 1,
                px: 2,
                ...sx,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1.5,
                    p: 1.5,
                    color: "text.secondary",
                    width: "100%",
                    maxWidth: { xs: "100%", sm: "400px", md: "500px" },
                }}
            >
                {IconComponent && (
                    <IconComponent
                        sx={{
                            color: `${iconColor}.main`,
                            fontSize: "1.125rem",
                        }}
                    />
                )}
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 500,
                        color: "text.secondary",
                        fontSize: { xs: "0.875rem", sm: "1rem" },
                    }}
                >
                    {typeof title === "string"
                        ? title
                        : t(title.key, { defaultValue: title.default })}
                </Typography>
            </Box>
        </Box>
    );
};

export default NoRecordsOverlay;
