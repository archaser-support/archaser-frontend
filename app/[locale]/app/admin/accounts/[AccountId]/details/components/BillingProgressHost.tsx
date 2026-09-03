"use client";

import {
    Box,
    Button,
    CircularProgress,
    Tooltip,
    Typography,
} from "@mui/material";
import type { ImportType } from "@/types/db";
import { memo, type ReactNode } from "react";

import type {
    ConnectorSyncStatePublic,
    SyncRunSummary,
} from "@/shared/services/billingConnectorService";
import type { BackfillActionStageView } from "@/shared/services/billingConnectorSyncActions";
import { getResetBackfillPurpose } from "@/shared/services/billingConnectorSyncActions";
import BackfillImportProgress from "./BackfillImportProgress";
import BillingCustomerAutocomplete, {
    type BillingCustomerOption,
} from "./BillingCustomerAutocomplete";

export interface BillingProgressHostProps {
    canManage: boolean;
    isHebrew: boolean;
    accountId: number;
    displayProgressRun: SyncRunSummary | null;
    enabledEntities: ImportType[];
    displaySyncStates: ConnectorSyncStatePublic[] | undefined;
    expectDeletingStep: boolean;
    pendingArPostIngestCustomers: number | undefined;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    allEnabledMappingsComplete: boolean;
    showPrimaryAction: boolean;
    actionStage: BackfillActionStageView | null;
    primaryTooltipTitle: ReactNode;
    primaryDisabledReason: string | null;
    primaryPending: boolean;
    primaryButtonLabel: string;
    onPrimaryAction: () => void;
    importBusy: boolean;
    importBusyTooltipTitle: ReactNode;
    resetBackfillDisabledReason: string | null;
    resetBackfillPending: boolean;
    onOpenResetDialog: () => void;
    clearBeforeImportCustomerId: number | null;
    onClearBeforeImportCustomerChange: (
        customerId: number | null,
        option: BillingCustomerOption | null
    ) => void;
    clearBeforeImportCustomerError: string | null;
}

const BillingProgressHost = memo(function BillingProgressHost({
    canManage,
    isHebrew,
    accountId,
    displayProgressRun,
    enabledEntities,
    displaySyncStates,
    expectDeletingStep,
    pendingArPostIngestCustomers,
    expanded,
    onExpandedChange,
    allEnabledMappingsComplete,
    showPrimaryAction,
    actionStage,
    primaryTooltipTitle,
    primaryDisabledReason,
    primaryPending,
    primaryButtonLabel,
    onPrimaryAction,
    importBusy,
    importBusyTooltipTitle,
    resetBackfillDisabledReason,
    resetBackfillPending,
    onOpenResetDialog,
    clearBeforeImportCustomerId,
    onClearBeforeImportCustomerChange,
    clearBeforeImportCustomerError,
}: BillingProgressHostProps) {
    return (
        <BackfillImportProgress
            run={displayProgressRun}
            enabledEntities={enabledEntities}
            syncStates={displaySyncStates}
            expectDeletingStep={expectDeletingStep}
            pendingArPostIngestCustomers={pendingArPostIngestCustomers}
            expanded={expanded}
            onExpandedChange={onExpandedChange}
            actions={
                allEnabledMappingsComplete ? (
                    <Box
                        sx={{
                            display: "flex",
                            gap: 2,
                            flexWrap: "wrap",
                            alignItems: "center",
                            width: "100%",
                        }}
                    >
                        {showPrimaryAction && actionStage ? (
                            <Tooltip
                                title={primaryTooltipTitle}
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                            >
                                <span>
                                    <Button
                                        variant="contained"
                                        color={
                                            actionStage.primaryAction === "stop"
                                                ? "error"
                                                : "primary"
                                        }
                                        className={
                                            actionStage.primaryAction === "stop"
                                                ? undefined
                                                : "save-button"
                                        }
                                        size={
                                            actionStage.primaryAction === "stop"
                                                ? "small"
                                                : undefined
                                        }
                                        onClick={onPrimaryAction}
                                        disabled={Boolean(
                                            primaryDisabledReason ||
                                                primaryPending
                                        )}
                                        startIcon={
                                            primaryPending ? (
                                                <CircularProgress
                                                    size={16}
                                                    color="inherit"
                                                />
                                            ) : undefined
                                        }
                                    >
                                        {primaryButtonLabel}
                                    </Button>
                                </span>
                            </Tooltip>
                        ) : importBusy ? (
                            <Tooltip
                                title={importBusyTooltipTitle}
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                            >
                                <span>
                                    <CircularProgress size={24} />
                                </span>
                            </Tooltip>
                        ) : null}
                        {actionStage?.showReset ? (
                            <Tooltip
                                title={
                                    resetBackfillDisabledReason ? (
                                        <Box>
                                            <Typography variant="body2">
                                                {getResetBackfillPurpose()}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                sx={{ mt: 1 }}
                                            >
                                                {resetBackfillDisabledReason}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        getResetBackfillPurpose()
                                    )
                                }
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                            >
                                <span>
                                    <Button
                                        variant="outlined"
                                        color="warning"
                                        size="small"
                                        onClick={() => onOpenResetDialog()}
                                        disabled={Boolean(
                                            resetBackfillDisabledReason
                                        )}
                                    >
                                        {resetBackfillPending
                                            ? "Resetting..."
                                            : "Reset backfill"}
                                    </Button>
                                </span>
                            </Tooltip>
                        ) : null}
                        <BillingCustomerAutocomplete
                            accountId={accountId}
                            value={clearBeforeImportCustomerId}
                            onChange={onClearBeforeImportCustomerChange}
                            error={clearBeforeImportCustomerError}
                            disabled={!canManage || importBusy}
                            label="Customer"
                            isHebrew={isHebrew}
                            helperTooltip="Limits Run preview and Start backfill to that customer for all enabled entities. Delete switches still control wipe. Leave empty for the whole account. Resume ignores this field."
                        />
                    </Box>
                ) : undefined
            }
        />
    );
});

export default BillingProgressHost;
