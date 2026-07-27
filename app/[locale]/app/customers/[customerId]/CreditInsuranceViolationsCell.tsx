"use client";

import { Warning } from "@mui/icons-material";
import { Box, Tooltip } from "@mui/material";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
    getInvoiceFieldFromGridRow,
    INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS,
    isTruthyFlag,
} from "@/shared/utils/invoiceGridRowFields";

interface CreditInsuranceViolationsCellProps {
    row: Record<string, unknown>;
}

export function CreditInsuranceViolationsCell({
    row,
}: CreditInsuranceViolationsCellProps) {
    const { t } = useTranslation(["customers"]);

    const activeCauses = useMemo(() => {
        const causes: string[] = [];
        for (const { field, labelKey } of INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS) {
            const v = getInvoiceFieldFromGridRow(row, field);
            if (isTruthyFlag(v)) {
                causes.push(t(labelKey, { ns: "customers" }));
            }
        }
        return causes;
    }, [row, t]);

    if (activeCauses.length === 0) {
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

    const title = (
        <Box component="ul" sx={{ m: 0, pl: 2, maxWidth: 280 }}>
            {activeCauses.map((line, i) => (
                <Box component="li" key={`${i}-${line}`} sx={{ typography: "caption" }}>
                    {line}
                </Box>
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
            <Tooltip title={title} arrow placement="bottom">
                <Box
                    component="span"
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        cursor: "default",
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
