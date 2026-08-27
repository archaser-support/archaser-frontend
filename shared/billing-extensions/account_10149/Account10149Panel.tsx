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
            (DEBIT = C) have their amounts multiplied by -1, and currency labels
            are rewritten before save (ש'ח / ש"ח → ILS, $ → USD). Reconciled
            receipts (recon number + linked invoice +
            zero balance) close the invoice; if cash is short, a virtual payment
            fills the gap. Invoice-side positive debit recon lines are skipped.
            Helam cancel lines (negative debit) import as absolute closing
            payments against the linked invoice when included in the Payment
            pull filter (FNCPATNAME חלמ). Negative payments on credit invoices
            are applied as absolute amounts so those credits can close.
            Already-saved rows are left unchanged.
        </Alert>
    );
}
