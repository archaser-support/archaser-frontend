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
            are rewritten before save (ש&apos;ח / ש&quot;ח → ILS, $ → USD). Every
            reconciled IDG_ARFNCITEMS4 line (recon number + linked invoice + zero
            balance) queues a virtual payment for that invoice so remaining unpaid
            amount closes. Rows with a customer id (IDG_CUSTNAME, else
            IDC_CUSTNAMEIV) import as real payments — including VAT/tax ledger
            lines — and count in paid/collected totals; virtual fill covers any
            shortfall. Helam two-invoice offsets (cancel IVNUM differs from
            FNCIREF1) queue virtual close for both invoice numbers with no
            stamp-close. Invoice-side positive debits and credit-note (CR*) recon
            lines are not imported as cash. Single-invoice Helam cancels (IVNUM
            equals FNCIREF1) still import as payments with absolute amounts when
            they qualify as cash. Already-saved rows are left unchanged.
        </Alert>
    );
}
