"use client";

import { Chip, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

export function billingSyncModeLabel(
    syncMode: string | null | undefined,
    t: (key: string) => string
): string {
    const mode = String(syncMode ?? "").toUpperCase();
    if (mode === "INCREMENTAL") {
        return t("billing_connector.sync_mode_incremental");
    }
    return t("billing_connector.sync_mode_backfill");
}

export interface BillingSyncModeChipProps {
    syncMode: string | null | undefined;
    isHebrew?: boolean;
}

/** Status chip for connector sync_mode (Backfill / Incremental). Visible to viewers. */
export default function BillingSyncModeChip({
    syncMode,
    isHebrew = false,
}: BillingSyncModeChipProps) {
    const { t } = useTranslation(["accounts"]);
    const label = billingSyncModeLabel(syncMode, t);

    return (
        <Tooltip
            title={t("billing_connector.sync_mode_label")}
            arrow
            enterDelay={300}
            leaveDelay={100}
            placement="bottom"
            PopperProps={{
                sx: {
                    "& .MuiTooltip-tooltip": {
                        direction: isHebrew ? "rtl" : "ltr",
                    },
                },
            }}
        >
            <Chip size="small" variant="outlined" label={label} />
        </Tooltip>
    );
}
