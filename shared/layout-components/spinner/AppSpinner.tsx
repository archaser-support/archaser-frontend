"use client";

import { Box, Typography, type TypographyProps } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import React from "react";

import ArchaserTrackRunner from "@/shared/components/ArchaserTrackRunner";

type AppSpinnerColor =
    | "primary"
    | "secondary"
    | "error"
    | "warning"
    | "info"
    | "success"
    | "inherit";

type AppSpinnerProps = {
    /** Logo height in px (same meaning as MUI CircularProgress `size`). */
    size?: number;
    color?: AppSpinnerColor;
    /** Text after the spinner. With `color="inherit"` it inherits the surrounding font and color. */
    label?: React.ReactNode;
    /** Typography variant for `label`; defaults to `body2` (or `inherit` with `color="inherit"`). */
    labelVariant?: TypographyProps["variant"];
    sx?: SxProps<Theme>;
    "aria-label"?: string;
};

/**
 * The app's only loading indicator (track-runner mark). Use for inline, button and
 * section loading; page-level loading uses `PageLoader` (shared overlay).
 */
const AppSpinner = ({
    size = 48,
    color = "primary",
    label,
    labelVariant,
    sx,
    "aria-label": ariaLabel,
}: AppSpinnerProps) => {
    const isInherit = color === "inherit";
    const logoColor = isInherit ? "inherit" : `${color}.main`;
    const sxList = Array.isArray(sx) ? sx : [sx];

    if (label == null) {
        return (
            <Box
                component="span"
                role="progressbar"
                aria-label={ariaLabel}
                sx={[
                    {
                        display: "inline-flex",
                        verticalAlign: "middle",
                        lineHeight: 0,
                        color: logoColor,
                    },
                    ...sxList,
                ]}
            >
                <ArchaserTrackRunner height={size} />
            </Box>
        );
    }

    return (
        <Box
            component="span"
            role="progressbar"
            aria-label={ariaLabel}
            sx={[
                {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    verticalAlign: "middle",
                },
                ...sxList,
            ]}
        >
            <Box
                component="span"
                sx={{ display: "inline-flex", lineHeight: 0, color: logoColor }}
            >
                <ArchaserTrackRunner height={size} />
            </Box>
            <Typography
                component="span"
                variant={labelVariant ?? (isInherit ? "inherit" : "body2")}
                sx={{
                    color: isInherit ? "inherit" : "text.secondary",
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </Typography>
        </Box>
    );
};

export default AppSpinner;
