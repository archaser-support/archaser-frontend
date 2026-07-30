"use client";

import { Business as BusinessIcon } from "@mui/icons-material";
import { Avatar, Box, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getPortalLogoAvatarSx } from "@/app/theme/portalCard";
import { PORTAL_LOGO_AVATAR_BORDER_RADIUS_PX } from "@/app/theme/constants";
import { FileUploadServiceClient } from "@/lib/fileUploadServiceClient";
import { logoCache } from "@/utils/logoCache";
import { createLogoDataUrl } from "@/utils/logoUtils";

import PortalDesktopMenu from "./PortalDesktopMenu";
import PortalHamburgerMenu from "./PortalHamburgerMenu";

type PortalHeaderProps = {
    customerName: string | null;
    logo?: string | null;
    className?: string;
    customerUUID?: string;
};

const PortalHeader: React.FC<PortalHeaderProps> = ({
    logo,
    customerName,
    className = "",
    customerUUID,
}) => {
    const [logoError, setLogoError] = useState(false);
    const [processedLogo, setProcessedLogo] = useState<string | null>(null);
    const { i18n } = useTranslation(["portal", "common"]);

    // Process logo when it changes
    useEffect(() => {
        const processLogo = async () => {
            if (!logo) {
                setProcessedLogo(null);
                return;
            }

            try {
                // If it's already a data URL, use it directly
                if (typeof logo === "string" && logo.startsWith("data:")) {
                    setProcessedLogo(logo);
                    return;
                }

                // If it's a public folder path, use it directly
                if (typeof logo === "string" && logo.startsWith("public/")) {
                    setProcessedLogo(logo);
                    return;
                }

                // The portal API signs the logo server-side, since an anonymous
                // visitor cannot call the authenticated presign endpoint.
                if (typeof logo === "string" && /^https?:\/\//i.test(logo)) {
                    setProcessedLogo(logo);
                    return;
                }

                // If it's an S3 file path, get presigned URL (with caching)
                if (
                    typeof logo === "string" &&
                    FileUploadServiceClient.isS3File(logo)
                ) {
                    try {
                        // Check cache first
                        let presignedUrl = logoCache.getCachedUrl(logo);

                        if (!presignedUrl) {
                            // Cache miss - fetch new presigned URL
                            presignedUrl =
                                await FileUploadServiceClient.getFileUrl(logo);
                            // Cache the new URL
                            logoCache.setCachedUrl(logo, presignedUrl);
                        }

                        setProcessedLogo(presignedUrl);
                    } catch (_error) {
                        setProcessedLogo(null);
                    }
                    return;
                }

                // If it's binary data, convert to data URL
                const processed = createLogoDataUrl(logo);
                setProcessedLogo(processed);
            } catch (_error) {
                setProcessedLogo(null);
            }
        };

        processLogo();
    }, [logo]);

    const handleLogoError = () => {
        // If it's an S3 file and we get an error, invalidate the cache
        if (
            logo &&
            typeof logo === "string" &&
            FileUploadServiceClient.isS3File(logo)
        ) {
            logoCache.removeCached(logo);
        }
        setLogoError(true);
    };

    return (
        <Box
            sx={(theme) => ({
                position: "relative",
                display: "flex",
                alignItems: "center",
                minHeight: { xs: 56, sm: 72, md: 80 },
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                color: theme.palette.primary.contrastText,
                padding: "8px 8px 8px 4px",
                boxShadow: `0 8px 16px -4px ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)"}`,
                gap: theme.spacing(2),
                direction: i18n.language === "he" ? "rtl" : "ltr",
            })}
            className={className}
        >
            {/* Logo - on mobile: absolute left for Hebrew, right for English; flex flow on larger screens */}
            <Box
                sx={(theme) => ({
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    zIndex: 1,
                    position: { xs: "absolute", sm: "relative" },
                    left: {
                        xs: i18n.language === "he" ? theme.spacing(1.5) : "auto",
                        sm: "auto",
                    },
                    right: {
                        xs: i18n.language === "he" ? "auto" : theme.spacing(1.5),
                        sm: "auto",
                    },
                })}
            >
                <Avatar
                    variant="square"
                    src={processedLogo && !logoError ? processedLogo : undefined}
                    alt="Company Logo"
                    onError={handleLogoError}
                    sx={(theme) => ({
                        ...getPortalLogoAvatarSx(theme),
                        width: { xs: "50px", sm: "66px", md: "84px" },
                        height: { xs: "40px", sm: "56px", md: "64px" },
                        backgroundColor: theme.palette.common.white,
                        color: theme.palette.primary.main,
                        boxShadow: `0 4px 6px -1px ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        border: `2px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.2)"}`,
                        maxWidth: { xs: "50px", sm: "66px", md: "100px" },
                        maxHeight: { xs: "40px", sm: "56px", md: "80px" },
                        minWidth: { xs: "50px", sm: "66px", md: "84px" },
                        minHeight: { xs: "40px", sm: "56px", md: "64px" },
                        "& img": {
                            borderRadius: `${PORTAL_LOGO_AVATAR_BORDER_RADIUS_PX}px`,
                            objectFit: "contain",
                            width: "100%",
                            height: "100%",
                        },
                    })}
                >
                    {(!processedLogo || logoError) && (
                        <BusinessIcon
                            sx={{
                                fontSize: { xs: 28, sm: 36, md: 44 },
                            }}
                        />
                    )}
                </Avatar>
            </Box>

            {/* Hamburger - on mobile: absolute right for Hebrew, left for English; flex flow on larger screens */}
            {customerUUID && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        flexShrink: 0,
                        zIndex: 1,
                        position: { xs: "absolute", sm: "relative" },
                        left: { xs: i18n.language === "he" ? "auto" : 0, sm: "auto" },
                        right: { xs: i18n.language === "he" ? 0 : "auto", sm: "auto" },
                    }}
                >
                    <PortalHamburgerMenu
                        customerUUID={customerUUID}
                        customerName={customerName}
                        logo={processedLogo && !logoError ? processedLogo : null}
                    />
                </Box>
            )}

            {/* Center: Account name and Desktop Menu - absolutely centered on mobile */}
            <Box
                sx={{
                    position: { xs: "absolute", sm: "relative" },
                    left: { xs: "50%", sm: "auto" },
                    transform: { xs: "translateX(-50%)", sm: "none" },
                    width: { xs: "100%", sm: "auto" },
                    maxWidth: { xs: "calc(100% - 120px)", sm: "none" },
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    flex: { xs: "none", sm: 1 },
                    minWidth: 0,
                    overflow: "hidden",
                    gap: 0.5,
                }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        fontSize: {
                            xs: "1.5rem",
                            sm: "1.75rem",
                            md: "2rem",
                            lg: "2.25rem",
                        },
                        fontWeight: 700,
                        color: (theme) => theme.palette.primary.contrastText,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textShadow: (theme) =>
                            `0 2px 4px ${theme.palette.mode === "dark" ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)"}`,
                        marginBottom: { md: 0.5, lg: 0.75 },
                    }}
                >
                    {customerName || ""}
                </Typography>

                {/* Desktop Menu */}
                {customerUUID && (
                    <PortalDesktopMenu customerUUID={customerUUID} />
                )}
            </Box>
        </Box>
    );
};

export default PortalHeader;
