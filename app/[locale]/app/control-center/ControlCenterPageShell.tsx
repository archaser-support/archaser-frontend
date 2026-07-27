"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";

import { getMetricStatCardBorderRadius } from "@/app/theme/metricStatCard";

type ControlCenterPageShellProps = {
    children: ReactNode;
};

/** Client shell so theme-based `sx` is not passed from Server Components. */
export default function ControlCenterPageShell({
    children,
}: ControlCenterPageShellProps) {
    return (
        <Box
            sx={(theme) => ({
                bgcolor: "background.default",
                borderRadius: getMetricStatCardBorderRadius(theme),
                width: "100%",
                maxWidth: "100%",
                overflow: "hidden",
                position: "relative",
                isolation: "isolate",
            })}
        >
            {children}
        </Box>
    );
}
