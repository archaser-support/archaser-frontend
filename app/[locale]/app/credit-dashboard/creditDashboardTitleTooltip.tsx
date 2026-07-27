"use client";

import InfoOutlined from "@mui/icons-material/InfoOutlined";
import {
    Box,
    Tooltip,
    type SxProps,
    type Theme,
    type TooltipProps,
} from "@mui/material";
import type { ReactNode } from "react";

/**
 * MUI Tooltip positions from the trigger’s bounding box. `display: block` in a wide
 * grid/flex cell makes the anchor the full column width, so the arrow centers under
 * empty space in RTL. Use `inline-block` + `maxWidth: 100%` on the trigger Typography.
 */
export const creditDashboardTitleTooltipTriggerSx: SxProps<Theme> = {
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "middle",
};

/** Compact hit target for the chart/card title info icon (tooltip anchor). */
export const creditDashboardTitleInfoIconTriggerSx: SxProps<Theme> = {
    ...creditDashboardTitleTooltipTriggerSx,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "action.active",
    marginInlineStart: "0.25em",
};

/**
 * Credit dashboard chart/card title tooltips: below the title, with delays and RTL text
 * from `.cursor/rules/frontend-tooltips.mdc` (placement is `bottom` per product request).
 */
export function creditDashboardTitleTooltipProps(
    isHebrewUser: boolean
): Pick<TooltipProps, "arrow" | "enterDelay" | "leaveDelay" | "placement" | "PopperProps"> {
    return {
        arrow: true,
        enterDelay: 300,
        leaveDelay: 100,
        placement: "bottom",
        PopperProps: {
            sx: {
                "& .MuiTooltip-tooltip": {
                    direction: isHebrewUser ? "rtl" : "ltr",
                    maxWidth: 360,
                    whiteSpace: "pre-line",
                },
            },
        },
    };
}

export function CreditDashboardTitleInfoIcon({
    isRtl,
    title,
    ariaLabel,
}: {
    isRtl: boolean;
    title: ReactNode;
    ariaLabel: string;
}) {
    return (
        <Tooltip title={title} describeChild {...creditDashboardTitleTooltipProps(isRtl)}>
            <Box
                component="span"
                sx={creditDashboardTitleInfoIconTriggerSx}
                aria-label={ariaLabel}
            >
                <InfoOutlined sx={{ fontSize: 16 }} />
            </Box>
        </Tooltip>
    );
}
