"use client";

import { Alert } from "@mui/material";

import type { BillingExtensionPanelProps } from "../types";

/**
 * Account 10149 extension panel. English labels hardcoded pending i18n permission.
 */
export default function Account10149Panel(_props: BillingExtensionPanelProps) {
    return (
        <Alert severity="info">
            Account 10149 extension is attached. On ERP sync, credit invoices
            (DEBIT = C) have their amounts multiplied by -1, and Hebrew shekel
            labels (ש'ח / ש"ח) on invoices and payments are rewritten to ILS
            before save. A payment whose method is חלמ marks the invoice Paid
            and clears outstanding, even if the payment amount does not cover
            the invoice. Negative payments on credit invoices are applied as
            absolute amounts so those credits can close. Already-saved rows are
            left unchanged.
        </Alert>
    );
}
