"use client";

import { Alert, Stack } from "@mui/material";

import Account10149Panel from "../account_10149/Account10149Panel";
import type { BillingExtensionPanelProps } from "../types";

/**
 * Account 10151 extension panel — Priority IDG (10149) plus demo name rename.
 */
export default function Account10151Panel(props: BillingExtensionPanelProps) {
    return (
        <Stack spacing={1}>
            <Account10149Panel {...props} />
            <Alert severity="info" icon={false}>
                New customers created by ERP sync are renamed to Demo Customer
                NNNN (4-digit counter, continuing after existing Demo Company /
                Demo Customer names). Existing customers keep their current
                name from the import mapping.
            </Alert>
        </Stack>
    );
}
