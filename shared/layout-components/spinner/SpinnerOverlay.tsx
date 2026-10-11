"use client";

import { Box, Modal, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";

import ArchaserLogo from "@/shared/components/ArchaserLogo";

import { useSpinner } from "./SpinnerProvider";

const MARK_HEIGHT_PX = 56;
const LABEL_GAP_PX = 16;

type PageLoadingOverlayProps = {
    open: boolean;
    label?: string;
};

/**
 * Presentational page-loading overlay. Inside the app use `PageLoader` (or the
 * request counter); render this directly only above `SpinnerProvider`.
 * The Modal portals to document.body, so the mark is centered on the viewport
 * regardless of the sidebar, header, scroll position or direction.
 */
export const PageLoadingOverlay = ({ open, label }: PageLoadingOverlayProps) => {
    const { t, i18n } = useTranslation(["common"]);

    return (
        <Modal
            open={open}
            disableEscapeKeyDown
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: (theme) => theme.zIndex.modal + 1,
            }}
            slotProps={{
                backdrop: {
                    sx: {
                        backgroundColor: (theme) =>
                            alpha(theme.palette.background.default, 0.72),
                    },
                },
            }}
        >
            <Box
                role="status"
                aria-live="polite"
                tabIndex={-1}
                sx={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    color: (theme) =>
                        theme.palette.mode === "dark"
                            ? theme.palette.primary.light
                            : theme.palette.primary.main,
                    outline: 0,
                }}
            >
                <ArchaserLogo
                    variant="mark"
                    animated
                    height={MARK_HEIGHT_PX}
                />
                <Typography
                    variant="body2"
                    dir={i18n.dir()}
                    sx={{
                        position: "absolute",
                        top: `calc(100% + ${LABEL_GAP_PX}px)`,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "max-content",
                        maxWidth: "calc(100vw - 32px)",
                        textAlign: "center",
                        color: "text.secondary",
                    }}
                >
                    {label ?? t("messages.loading", { ns: "common" })}
                </Typography>
            </Box>
        </Modal>
    );
};

const SpinnerOverlay = () => {
    const { isVisible, label } = useSpinner();

    return <PageLoadingOverlay open={isVisible} label={label} />;
};

export default SpinnerOverlay;
