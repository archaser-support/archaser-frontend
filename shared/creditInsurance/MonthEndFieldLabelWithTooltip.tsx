"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Tooltip } from "@mui/material";
import React from "react";

type MonthEndFieldLabelWithTooltipProps = {
    label: string;
    tooltip: string;
    isRtl: boolean;
};

/** Label plus info-icon tooltip for MEP/Reporting month-end fields. */
export function MonthEndFieldLabelWithTooltip({
    label,
    tooltip,
    isRtl,
}: MonthEndFieldLabelWithTooltipProps): React.ReactElement {
    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                maxWidth: "100%",
            }}
        >
            <Box component="span">{label}</Box>
            <Tooltip
                title={tooltip}
                arrow
                enterDelay={300}
                leaveDelay={100}
                placement="bottom"
                PopperProps={{
                    sx: {
                        "& .MuiTooltip-tooltip": {
                            direction: isRtl ? "rtl" : "ltr",
                        },
                    },
                }}
            >
                <InfoOutlinedIcon
                    color="action"
                    fontSize="inherit"
                    sx={{ fontSize: 14, cursor: "help", flexShrink: 0 }}
                />
            </Tooltip>
        </Box>
    );
}
