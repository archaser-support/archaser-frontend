"use client";

import { Alert, TextField, Typography } from "@mui/material";

import type { BillingExtensionPanelProps } from "../types";

/**
 * Minimal sample/no-op extension panel — status + optional note in config.
 * English labels hardcoded pending i18n permission.
 */
export default function SampleNoopPanel({
    extensionConfig,
    canManage,
    onConfigChange,
}: BillingExtensionPanelProps) {
    const note =
        typeof extensionConfig.note === "string" ? extensionConfig.note : "";

    return (
        <>
            <Alert severity="info" sx={{ mb: 2 }}>
                Sample (no-op) extension is attached. Sync still uses the
                standard Priority path in this release.
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Optional note (stored in extension config)
            </Typography>
            <TextField
                fullWidth
                size="small"
                label="Note"
                value={note}
                disabled={!canManage}
                onChange={(event) =>
                    onConfigChange({
                        ...extensionConfig,
                        note: event.target.value,
                    })
                }
            />
        </>
    );
}
