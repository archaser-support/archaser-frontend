"use client";

import {
    Alert,
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Autocomplete,
    Box,
    Card,
    CardContent,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    ExpandMore as ExpandMoreIcon,
    Info as InfoIcon,
    Settings as SettingsIcon,
} from "@mui/icons-material";
import { memo, type ComponentType, type ReactNode } from "react";

import type { BillingExtensionPanelProps } from "@/shared/billing-extensions/types";
import type { UpsertBillingConnectorPayload } from "@/shared/services/billingConnectorService";
import {
    formatPaidTolerance,
    parsePaidToleranceInput,
    PAID_TOLERANCE_MAX,
    PAID_TOLERANCE_MIN,
    SCHEDULE_PRESET_OPTIONS,
    WEEKDAY_OPTIONS,
    type ExtensionKeyOption,
    type SchedulePresetValue,
} from "./billingIntegrationConstants";
import { getBillingAccordionStyles } from "./billingAccordionStyles";
import {
    accountCardSx,
    accountCardTitleSx,
    accountSectionIconSx,
} from "../accountCardStyles";

/** Info icon sits after the control (outside the input), matching Customer autocomplete. */
function FieldWithTrailingInfoTooltip({
    isHebrew,
    title,
    children,
}: {
    isHebrew: boolean;
    title: string;
    children: ReactNode;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                width: "100%",
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
            <Tooltip
                title={title}
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
                <InfoIcon
                    fontSize="small"
                    color="action"
                    sx={{ cursor: "help", flexShrink: 0 }}
                />
            </Tooltip>
        </Box>
    );
}

export interface BillingScheduleSectionProps {
    canManage: boolean;
    isHebrew: boolean;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    syncEnabled: boolean;
    onSyncEnabledChange: (value: boolean) => void;
    scheduleSummary: string | null | undefined;
    extensionKey: string;
    onExtensionKeyChange: (value: string) => void;
    schedulePreset: SchedulePresetValue;
    onSchedulePresetChange: (value: SchedulePresetValue) => void;
    syncCron: string;
    onSyncCronChange: (value: string) => void;
    dailyTimeUtc: string;
    onDailyTimeUtcChange: (value: string) => void;
    weeklyDay: number;
    onWeeklyDayChange: (value: number) => void;
    scheduleWarning: string | null | undefined;
    nextScheduledSyncAtUtc: string | null | undefined;
    invoicePaidTolerance: string;
    onInvoicePaidToleranceChange: (value: string) => void;
    invoicePaidToleranceError: string | null;
    onInvoicePaidToleranceErrorChange: (value: string | null) => void;
    persistPaidTolerance: (value: number) => void | Promise<void>;
    hasCredentials: boolean;
    allEnabledMappingsComplete: boolean;
    backfillStartDate: string;
    onBackfillStartDateChange: (value: string) => void;
    mepBreachStartDate: string;
    onMepBreachStartDateChange: (value: string) => void;
    includeOlderOpenInvoices: boolean;
    onIncludeOlderOpenInvoicesChange: (value: boolean) => void;
    skipReportingBreachOnBackfill: boolean;
    onSkipReportingBreachOnBackfillChange: (value: boolean) => void;
    backfillOptionsLocked: boolean;
    persistCutoverOptions: (patch: UpsertBillingConnectorPayload) => void | Promise<void>;
    extensionKeyOptions: ExtensionKeyOption[];
    selectedExtensionOption: ExtensionKeyOption;
    extensionConfig: Record<string, unknown>;
    onExtensionConfigChange: (value: Record<string, unknown>) => void;
    accountId: number;
    ExtensionPanel: ComponentType<BillingExtensionPanelProps> | undefined;
    extensionRegistrationKey: string | undefined;
}

const BillingScheduleSection = memo(function BillingScheduleSection(props: BillingScheduleSectionProps) {
    const {
        canManage,
        isHebrew,
        expanded,
        onExpandedChange,
        syncEnabled,
        onSyncEnabledChange,
        scheduleSummary,
        extensionKey,
        onExtensionKeyChange,
        schedulePreset,
        onSchedulePresetChange,
        syncCron,
        onSyncCronChange,
        dailyTimeUtc,
        onDailyTimeUtcChange,
        weeklyDay,
        onWeeklyDayChange,
        scheduleWarning,
        nextScheduledSyncAtUtc,
        invoicePaidTolerance,
        onInvoicePaidToleranceChange,
        invoicePaidToleranceError,
        onInvoicePaidToleranceErrorChange,
        persistPaidTolerance,
        hasCredentials,
        allEnabledMappingsComplete,
        backfillStartDate,
        onBackfillStartDateChange,
        mepBreachStartDate,
        onMepBreachStartDateChange,
        includeOlderOpenInvoices,
        onIncludeOlderOpenInvoicesChange,
        skipReportingBreachOnBackfill,
        onSkipReportingBreachOnBackfillChange,
        backfillOptionsLocked,
        persistCutoverOptions,
        extensionKeyOptions,
        selectedExtensionOption,
        extensionConfig,
        onExtensionConfigChange,
        accountId,
        ExtensionPanel,
        extensionRegistrationKey,
    } = props;

    const theme = useTheme();
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
    const {
        accordionSx: billingAccordionSx,
        summarySx: billingAccordionSummarySx,
        detailsSx: billingAccordionDetailsSx,
        contentSx: billingAccordionContentSx,
    } = getBillingAccordionStyles(pillRadiusPx);

    return (
                    <Card elevation={0} sx={accountCardSx}>
                        <Accordion
                            disableGutters
                            elevation={0}
                            expanded={expanded}
                            onChange={(_, next) => onExpandedChange(next)}
                            sx={billingAccordionSx}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={billingAccordionSummarySx(expanded)}
                            >
                                <SettingsIcon sx={accountSectionIconSx} />
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography
                                        variant="subtitle1"
                                        sx={accountCardTitleSx}
                                    >
                                        Sync Settings
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mt: 0.25 }}
                                    >
                                        {syncEnabled
                                            ? scheduleSummary
                                                ? `Sync: Enabled · ${scheduleSummary}`
                                                : "Sync: Enabled · choose how often sync runs."
                                            : "Sync: disabled"}
                                        {extensionKey
                                            ? ` · Extension: ${extensionKey}`
                                            : ""}
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={billingAccordionDetailsSx}>
                        <CardContent sx={billingAccordionContentSx}>
                            <Grid container spacing={2} alignItems="flex-start">
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={syncEnabled}
                                                onChange={(e) =>
                                                    onSyncEnabledChange(e.target.checked)
                                                }
                                                disabled={!canManage}
                                                color="primary"
                                                {...(isHebrew && { "data-rtl": true })}
                                            />
                                        }
                                        label="Sync Enabled"
                                        sx={{
                                            alignItems: "center",
                                            mt: 0.5,
                                            "& .MuiFormControlLabel-label": {
                                                fontSize: "0.875rem",
                                                fontWeight: 500,
                                                lineHeight: 1.4,
                                                ml: 1,
                                            },
                                        }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <FormControl
                                        fullWidth
                                        size="small"
                                        disabled={!canManage}
                                    >
                                        <InputLabel id="billing-schedule-preset-label">
                                            Sync Schedule
                                        </InputLabel>
                                        <Select
                                            labelId="billing-schedule-preset-label"
                                            label="Sync Schedule"
                                            value={schedulePreset}
                                            onChange={(e) => {
                                                const value = e.target
                                                    .value as SchedulePresetValue;
                                                onSchedulePresetChange(value);
                                            }}
                                        >
                                            {SCHEDULE_PRESET_OPTIONS.map((opt) => (
                                                <MenuItem
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    {opt.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                {schedulePreset === "custom" ? (
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Cron Expression (UTC)"
                                            value={syncCron}
                                            onChange={(e) => {
                                                onSyncCronChange(e.target.value);
                                                onSchedulePresetChange("custom");
                                            }}
                                            disabled={!canManage}
                                        />
                                    </Grid>
                                ) : null}
                                {(schedulePreset === "daily" ||
                                    schedulePreset === "weekly") && (
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Time (UTC)"
                                            type="time"
                                            value={dailyTimeUtc}
                                            onChange={(e) =>
                                                onDailyTimeUtcChange(e.target.value || "03:00")
                                            }
                                            disabled={!canManage}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                )}
                                {schedulePreset === "weekly" && (
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <FormControl
                                            fullWidth
                                            size="small"
                                            disabled={!canManage}
                                        >
                                            <InputLabel id="billing-weekly-day-label">
                                                Day of Week (UTC)
                                            </InputLabel>
                                            <Select
                                                labelId="billing-weekly-day-label"
                                                label="Day of Week (UTC)"
                                                value={weeklyDay}
                                                onChange={(e) =>
                                                    onWeeklyDayChange(Number(e.target.value))
                                                }
                                            >
                                                {WEEKDAY_OPTIONS.map((opt) => (
                                                    <MenuItem
                                                        key={opt.value}
                                                        value={opt.value}
                                                    >
                                                        {opt.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}
        
                                {scheduleWarning ? (
                                    <Grid size={{ xs: 12 }}>
                                        <Alert severity="warning">
                                            {scheduleWarning}
                                        </Alert>
                                    </Grid>
                                ) : null}
        
                                {(nextScheduledSyncAtUtc ||
                                    syncEnabled) && (
                                    <Grid size={{ xs: 12 }}>
                                        {nextScheduledSyncAtUtc ? (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                Next scheduled sync (UTC):{" "}
                                                {new Date(
                                                    nextScheduledSyncAtUtc
                                                )
                                                    .toISOString()
                                                    .replace("T", " ")
                                                    .replace(/\.\d{3}Z$/, " UTC")}
                                            </Typography>
                                        ) : syncEnabled ? (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                Next scheduled sync (UTC): —
                                            </Typography>
                                        ) : null}
                                    </Grid>
                                )}
        
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <FieldWithTrailingInfoTooltip
                                        isHebrew={isHebrew}
                                        title="Leftover in each invoice's customer currency. Paid when leftover is within +/- this amount. 0 means leftover must be exactly 0. Saving does not restamp invoices until the next connector sync or nightly leftover job."
                                    >
                                        <TextField
                                            fullWidth
                                            required
                                            label="Paid leftover tolerance"
                                            type="number"
                                            size="small"
                                            value={invoicePaidTolerance}
                                            onChange={(e) => {
                                                onInvoicePaidToleranceChange(e.target.value);
                                                onInvoicePaidToleranceErrorChange(null);
                                            }}
                                            onBlur={() => {
                                                const parsed = parsePaidToleranceInput(
                                                    invoicePaidTolerance
                                                );
                                                if (parsed == null) {
                                                    onInvoicePaidToleranceErrorChange("Enter a number from 0 to 10 (two decimals). 0 means leftover must be exactly 0.");
                                                    return;
                                                }
                                                onInvoicePaidToleranceChange(formatPaidTolerance(parsed));
                                                onInvoicePaidToleranceErrorChange(null);
                                                if (hasCredentials) {
                                                    void persistPaidTolerance(parsed);
                                                }
                                            }}
                                            disabled={!canManage}
                                            error={Boolean(invoicePaidToleranceError)}
                                            helperText={invoicePaidToleranceError ?? undefined}
                                            inputProps={{
                                                min: PAID_TOLERANCE_MIN,
                                                max: PAID_TOLERANCE_MAX,
                                                step: 0.01,
                                            }}
                                        />
                                    </FieldWithTrailingInfoTooltip>
                                </Grid>
        
                                {hasCredentials &&
                                    allEnabledMappingsComplete && (
                                        <>
                                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                                <FieldWithTrailingInfoTooltip
                                                    isHebrew={isHebrew}
                                                    title={
                                                        backfillOptionsLocked
                                                            ? "Locked after backfill started. Reset backfill to change the start date."
                                                            : "Optional. Invoices and payments created on/after this account-local day. Leave blank for full history. Customers and contacts always pull full history."
                                                    }
                                                >
                                                    <TextField
                                                        fullWidth
                                                        label="Backfill Start Date"
                                                        type="date"
                                                        size="small"
                                                        value={backfillStartDate}
                                                        onChange={(e) => {
                                                            const next = e.target.value;
                                                            onBackfillStartDateChange(next);
                                                            void persistCutoverOptions({
                                                                backfill_start_date:
                                                                    next.trim() || null,
                                                            });
                                                        }}
                                                        disabled={
                                                            !canManage ||
                                                            backfillOptionsLocked
                                                        }
                                                        InputLabelProps={{ shrink: true }}
                                                    />
                                                </FieldWithTrailingInfoTooltip>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                                <FieldWithTrailingInfoTooltip
                                                    isHebrew={isHebrew}
                                                    title={
                                                        backfillOptionsLocked
                                                            ? "Locked after backfill started. Reset backfill to change the MEP breach start date."
                                                            : "Optional. Invoices issued before this day are excluded from MEP breach evaluation. Leave blank to evaluate all history. Commonly set to the backfill start date."
                                                    }
                                                >
                                                    <TextField
                                                        fullWidth
                                                        label="MEP Breach Start Date"
                                                        type="date"
                                                        size="small"
                                                        value={mepBreachStartDate}
                                                        onChange={(e) => {
                                                            const next = e.target.value;
                                                            onMepBreachStartDateChange(next);
                                                            void persistCutoverOptions({
                                                                mep_breach_start_date:
                                                                    next.trim() || null,
                                                            });
                                                        }}
                                                        disabled={
                                                            !canManage ||
                                                            backfillOptionsLocked
                                                        }
                                                        InputLabelProps={{ shrink: true }}
                                                    />
                                                </FieldWithTrailingInfoTooltip>
                                            </Grid>
                                            {Boolean(backfillStartDate.trim()) && (
                                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={
                                                                    includeOlderOpenInvoices
                                                                }
                                                                onChange={(e) => {
                                                                    const next =
                                                                        e.target
                                                                            .checked;
                                                                    onIncludeOlderOpenInvoicesChange(next);
                                                                    void persistCutoverOptions(
                                                                        {
                                                                            include_older_open_invoices:
                                                                                next,
                                                                        }
                                                                    );
                                                                }}
                                                                disabled={
                                                                    !canManage ||
                                                                    backfillOptionsLocked
                                                                }
                                                            />
                                                        }
                                                        label={
                                                            <Box
                                                                sx={{
                                                                    display: "flex",
                                                                    alignItems:
                                                                        "center",
                                                                    gap: 0.5,
                                                                }}
                                                            >
                                                                Include older open
                                                                invoices
                                                                <Tooltip
                                                                    title={
                                                                        backfillOptionsLocked
                                                                            ? "Locked after backfill started. Reset backfill to change this option."
                                                                            : "When on, also pull unpaid invoices created before the start date and payments linked to those invoices (any payment date). Default on."
                                                                    }
                                                                    arrow
                                                                    enterDelay={300}
                                                                    leaveDelay={100}
                                                                    placement="bottom"
                                                                    PopperProps={{
                                                                        sx: {
                                                                            "& .MuiTooltip-tooltip":
                                                                                {
                                                                                    direction:
                                                                                        isHebrew
                                                                                            ? "rtl"
                                                                                            : "ltr",
                                                                                },
                                                                        },
                                                                    }}
                                                                >
                                                                    <InfoIcon
                                                                        fontSize="small"
                                                                        color="action"
                                                                        sx={{
                                                                            cursor: "help",
                                                                        }}
                                                                    />
                                                                </Tooltip>
                                                            </Box>
                                                        }
                                                        sx={{
                                                            alignItems: "center",
                                                            mt: 0.5,
                                                            "& .MuiFormControlLabel-label":
                                                                {
                                                                    fontSize:
                                                                        "0.875rem",
                                                                    fontWeight: 500,
                                                                    lineHeight: 1.4,
                                                                    ml: 1,
                                                                },
                                                        }}
                                                    />
                                                </Grid>
                                            )}
                                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={
                                                                skipReportingBreachOnBackfill
                                                            }
                                                            onChange={(e) => {
                                                                const next =
                                                                    e.target.checked;
                                                                onSkipReportingBreachOnBackfillChange(next);
                                                                void persistCutoverOptions(
                                                                    {
                                                                        skip_reporting_breach_on_backfill:
                                                                            next,
                                                                    }
                                                                );
                                                            }}
                                                            disabled={
                                                                !canManage ||
                                                                backfillOptionsLocked
                                                            }
                                                        />
                                                    }
                                                    label={
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 0.5,
                                                            }}
                                                        >
                                                            Skip reporting breach during
                                                            backfill
                                                            <Tooltip
                                                                title={
                                                                    backfillOptionsLocked
                                                                        ? "Locked after backfill started. Reset backfill to change this option."
                                                                        : "Only affects connector backfill import. Incremental sync and the overnight reporting-breach job still run as usual."
                                                                }
                                                                arrow
                                                                enterDelay={300}
                                                                leaveDelay={100}
                                                                placement="bottom"
                                                                PopperProps={{
                                                                    sx: {
                                                                        "& .MuiTooltip-tooltip":
                                                                            {
                                                                                direction:
                                                                                    isHebrew
                                                                                        ? "rtl"
                                                                                        : "ltr",
                                                                            },
                                                                    },
                                                                }}
                                                            >
                                                                <InfoIcon
                                                                    fontSize="small"
                                                                    color="action"
                                                                    sx={{
                                                                        cursor: "help",
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                        </Box>
                                                    }
                                                    sx={{
                                                        alignItems: "center",
                                                        mt: 0.5,
                                                        "& .MuiFormControlLabel-label":
                                                            {
                                                                fontSize: "0.875rem",
                                                                fontWeight: 500,
                                                                lineHeight: 1.4,
                                                                ml: 1,
                                                            },
                                                    }}
                                                />
                                            </Grid>
                                            {backfillOptionsLocked && (
                                                <Grid size={{ xs: 12 }}>
                                                    <Alert severity="warning">
                                                        Cutover options are locked
                                                        because backfill has started.
                                                        Use Reset backfill to unlock the
                                                        start date and switches before
                                                        changing them.
                                                    </Alert>
                                                </Grid>
                                            )}
                                        </>
                                    )}
        
                                {canManage && (
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <FieldWithTrailingInfoTooltip
                                            isHebrew={isHebrew}
                                            title="Optional. Attach a registered extension for account-specific import logic. Use the account Save button to persist this field."
                                        >
                                            <Autocomplete
                                                id="billing-extension-key"
                                                options={extensionKeyOptions}
                                                value={selectedExtensionOption}
                                                disableClearable
                                                fullWidth
                                                size="small"
                                                getOptionLabel={(option) =>
                                                    option.label
                                                }
                                                isOptionEqualToValue={(option, value) =>
                                                    option.key === value.key
                                                }
                                                onChange={(_event, next) => {
                                                    const nextKey = next?.key ?? "";
                                                    onExtensionKeyChange(nextKey);
                                                    if (!nextKey) {
                                                        onExtensionConfigChange({});
                                                    }
                                                }}
                                                dir={isHebrew ? "rtl" : "ltr"}
                                                {...(isHebrew && {
                                                    "data-hebrew": true,
                                                    "data-rtl": true,
                                                })}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Extension Key"
                                                        variant="outlined"
                                                        size="small"
                                                        fullWidth
                                                        dir={isHebrew ? "rtl" : "ltr"}
                                                        {...(isHebrew && {
                                                            "data-hebrew": true,
                                                        })}
                                                    />
                                                )}
                                                renderOption={(props, option) => {
                                                    const { key, ...otherProps } = props;
                                                    return (
                                                        <Box
                                                            key={key}
                                                            component="li"
                                                            {...otherProps}
                                                            sx={{
                                                                direction: isHebrew
                                                                    ? "rtl"
                                                                    : "ltr",
                                                                textAlign: isHebrew
                                                                    ? "right"
                                                                    : "left",
                                                            }}
                                                        >
                                                            <Typography
                                                                sx={{
                                                                    direction: isHebrew
                                                                        ? "rtl"
                                                                        : "ltr",
                                                                    textAlign: isHebrew
                                                                        ? "right"
                                                                        : "left",
                                                                    width: "100%",
                                                                }}
                                                            >
                                                                {option.label}
                                                            </Typography>
                                                        </Box>
                                                    );
                                                }}
                                            />
                                        </FieldWithTrailingInfoTooltip>
                                    </Grid>
                                )}
        
                                {Boolean(extensionKey.trim()) &&
                                    ExtensionPanel &&
                                    extensionRegistrationKey && (
                                    <Grid size={{ xs: 12 }}>
                                        <ExtensionPanel
                                            accountId={accountId}
                                            extensionKey={extensionRegistrationKey}
                                            extensionConfig={extensionConfig}
                                            canManage={canManage}
                                            onConfigChange={onExtensionConfigChange}
                                        />
                                    </Grid>
                                )}
                            </Grid>
                        </CardContent>
                            </AccordionDetails>
                        </Accordion>
                    </Card>
    );
});

export default BillingScheduleSection;
