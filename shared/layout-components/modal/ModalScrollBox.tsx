"use client";

import { Box, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import React from "react";

export interface ModalScrollBoxProps {
    /** Must match scrollContainerId passed to AppDialog for scroll prevention. */
    id: string;
    isRTL?: boolean;
    children: React.ReactNode;
    /** Merged with default scroll container sx; use for overrides (e.g. maxHeight). */
    sx?: SxProps<Theme>;
}

const ModalScrollBox: React.FC<ModalScrollBoxProps> = ({
    id,
    isRTL = false,
    children,
    sx = {},
}) => {
    const theme = useTheme();
    const baseSx: SxProps<Theme> = {
        flex: "1 1 auto",
        minHeight: 0,
        overflowY: "scroll",
        overflowX: "hidden",
        ...(isRTL ? { pl: 1 } : { pr: 1 }),
        direction: isRTL ? "rtl" : "ltr",
        scrollbarWidth: "thin",
        scrollbarColor: `${alpha(theme.palette.primary.main, 0.6)} ${alpha(theme.palette.primary.main, 0.1)}`,
        scrollbarGutter: "stable",
        "&::-webkit-scrollbar": {
            width: "12px",
        },
        "&::-webkit-scrollbar-track": {
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            borderRadius: "6px",
        },
        "&::-webkit-scrollbar-thumb": {
            backgroundColor: alpha(theme.palette.primary.main, 0.6),
            borderRadius: "6px",
            "&:hover": {
                backgroundColor: theme.palette.primary.main,
            },
        },
    };
    return (
        <Box id={id} sx={[baseSx, ...(Array.isArray(sx) ? sx : [sx])]}>
            {children}
        </Box>
    );
};

export default ModalScrollBox;
