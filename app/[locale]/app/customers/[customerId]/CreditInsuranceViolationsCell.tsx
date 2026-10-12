"use client";

import { Warning } from "@mui/icons-material";
import { Box, Divider, Tooltip, Typography } from "@mui/material";
import { useSession } from "next-auth/react";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatDateOnlyYmdForSession } from "@/utils/datetimeOperations";
import { getRTLTooltipProps } from "@/utils/reportFieldUtils";

import { buildCreditInsuranceViolationSections } from "./creditInsuranceViolationSections";

interface CreditInsuranceViolationsCellProps {
    row: Record<string, unknown>;
    /** Same formatter as the grid amount columns. */
    formatAmount: (value: number, currency: string) => string;
}

export function CreditInsuranceViolationsCell({
    row,
    formatAmount,
}: CreditInsuranceViolationsCellProps) {
    const { t, i18n } = useTranslation(["customers"]);
    const { data: session } = useSession();

    const sections = useMemo(
        () =>
            buildCreditInsuranceViolationSections(
                row,
                t,
                (ymd) => formatDateOnlyYmdForSession(ymd, session),
                formatAmount
            ),
        [row, t, session, formatAmount]
    );

    if (sections.length === 0) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    width: "100%",
                }}
            />
        );
    }

    const tooltipProps = getRTLTooltipProps(i18n);

    const title = (
        <Box>
            {sections.map((section, i) => (
                <React.Fragment key={section.field}>
                    {i > 0 && (
                        <Divider
                            sx={{ my: 0.75, borderColor: "currentColor", opacity: 0.2 }}
                        />
                    )}
                    <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
                        {section.title}
                    </Typography>
                    {section.rows.map((detail) => (
                        <Typography key={detail.label} variant="caption" component="div">
                            {detail.label}: <bdi>{detail.value}</bdi>
                        </Typography>
                    ))}
                </React.Fragment>
            ))}
        </Box>
    );

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                width: "100%",
            }}
        >
            <Tooltip
                title={title}
                {...tooltipProps}
                PopperProps={{
                    sx: {
                        "& .MuiTooltip-tooltip": {
                            ...tooltipProps.PopperProps.sx["& .MuiTooltip-tooltip"],
                            maxWidth: 320,
                        },
                    },
                }}
            >
                <Box
                    component="span"
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        cursor: "help",
                    }}
                >
                    <Warning
                        sx={{
                            fontSize: 20,
                            color: (theme) => theme.palette.error.main,
                        }}
                    />
                </Box>
            </Tooltip>
        </Box>
    );
}
