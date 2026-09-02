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
            IDG_ARFNCITEMS4 lines (recon number + linked invoice + zero balance)
            close invoices with one of two rules: (1) Helam offset stamps where
            cancel IVNUM differs from FNCIREF1 — both invoices are stamped Paid
            with no payment import and no virtual fill; (2) otherwise, if there
            is no real payment (or cash is short), a virtual payment fills the
            remaining amount. Invoice-side positive debit lines are not imported
            as payments; their invoice numbers are queued for virtual close
            unless they belong to a Helam offset pair. Single-invoice Helam
            cancels (IVNUM equals FNCIREF1) still import as payments with
            absolute amounts. Already-saved rows are left unchanged.
        </Alert>
    );
}
