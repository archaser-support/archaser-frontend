"use client";

import { Close as CloseIcon } from "@mui/icons-material";
import {
    Box,
    Typography,
    IconButton,
    alpha,
    CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";

interface ViewAsBannerProps {
    currentViewAsUserName: string | null;
    onClearViewAs: () => void;
    isHebrewUser?: boolean;
    isViewAsActive?: boolean;
}

const ViewAsBanner: React.FC<ViewAsBannerProps> = ({
    currentViewAsUserName,
    onClearViewAs,
    isHebrewUser = false,
    isViewAsActive = false,
}) => {
    const theme = useTheme();
    const { t } = useTranslation(["common"]);

    // Show banner if view-as is active, even if name is still loading
    if (!isViewAsActive) {
        return null;
    }

    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                width: "100%",
                zIndex: (theme) => theme.zIndex.drawer + 1,
                backgroundColor: alpha(theme.palette.error.main, 0.95),
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                borderBottom: `1px solid ${alpha(theme.palette.error.light, 0.3)}`,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    px: { xs: 2, sm: 3, md: 4 },
                    py: 0.75,
                    minHeight: "40px",
                    height: "40px",
                    direction: isHebrewUser ? "rtl" : "ltr",
                    maxWidth: "100%",
                }}
            >
                {/* Centered Content */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        flexDirection: isHebrewUser ? "row-reverse" : "row",
                        justifyContent: "center",
                        height: "100%",
                    }}
                >
                    <Box
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: "white",
                            animation: "pulse 2s infinite",
                            "@keyframes pulse": {
                                "0%": { opacity: 1 },
                                "50%": { opacity: 0.5 },
                                "100%": { opacity: 1 },
                            },
                        }}
                    />
                    <Typography
                        variant="body2"
                        sx={{
                            color: "white",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            textAlign: "center",
                            ...(isHebrewUser && {
                                direction: "rtl",
                            }),
                        }}
                    >
                        <span>{t("actions.view_as")}:</span>
                        {currentViewAsUserName ? (
                            <span>{currentViewAsUserName}</span>
                        ) : (
                            <>
                                <CircularProgress size={14} sx={{ color: "white" }} />
                                <span style={{ opacity: 0.8 }}>Loading...</span>
                            </>
                        )}
                    </Typography>
                </Box>
                {/* Close Button - Positioned absolutely on the right */}
                <IconButton
                    onClick={onClearViewAs}
                    sx={{
                        position: "absolute",
                        [isHebrewUser ? "left" : "right"]: { xs: 1, sm: 2, md: 3 },
                        color: "white",
                        p: 0.5,
                        "&:hover": {
                            backgroundColor: alpha(theme.palette.common.white, 0.2),
                        },
                    }}
                    aria-label="Stop viewing as user"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
        </Box>
    );
};

export default ViewAsBanner;

