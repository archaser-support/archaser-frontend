"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Add as AddIcon, Edit as EditIcon } from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    FormControlLabel,
    Switch,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { ActivitySequenceForm } from "@/types/ActivitiesSequence";
import { ActivityTemplate } from "@/types/ActivitiesTemplate";
import { ACTIVITY_TYPE_OPTIONS } from "@/types/enums";

interface Option {
    value: string;
    label: string;
}

interface TemplateOption {
    label: string;
    value: string;
}

interface ActivityTypeOption {
    label: string;
    value: string;
}

interface StepTypeOption {
    label: string;
    value: "due" | "overdue";
}

// Memoized activity type options - filtered to exclude Call and Internal
const ACTIVITY_TYPE_OPTIONS_LOCAL: Option[] = ACTIVITY_TYPE_OPTIONS.filter(
    (option) => option.value !== "Call" && option.value !== "Internal"
).map((option) => ({
    value: option.value,
    label: option.label, // Just the label, we'll add namespace when translating
}));

interface ActivitySequenceStepModalProps {
    isOpen: boolean;
    activitySequence: any | null;
    closeModal: () => void;
    refreshList: () => void;
    activityTemplates: ActivityTemplate[];
    currentCategory?: string;
    sequenceContainerId?: number | null;
}

const DEFAULT_ACTIVITY_SEQUENCE: ActivitySequenceForm = {
    id: 0,
    step: null,
    activity_type: "Email",
    category: "",
    days_from_prev_step: null,
    step_type: null,
    days_before_due: null,
    account_id: "",
    activity_template_id: "",
    time_of_day: "09:00",
    active: true,
    lockedFields: [],
    send_to_standard_contacts: true,
    send_to_escalated_contacts: true,
};

export default function ActivitySequenceStepModal({
    isOpen,
    activitySequence: initialActivitySequence,
    closeModal,
    refreshList,
    activityTemplates,
    currentCategory,
    sequenceContainerId,
}: ActivitySequenceStepModalProps) {
    const { t, i18n } = useTranslation([
        "common",
        "activity_sequences",
        "activities",
    ]);
    const { showToast } = useToast();
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const [activitySequence, setActivitySequence] =
        useState<ActivitySequenceForm>(DEFAULT_ACTIVITY_SEQUENCE);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        if (initialActivitySequence) {
            const sequenceData = {
                ...DEFAULT_ACTIVITY_SEQUENCE,
                ...initialActivitySequence,
                // Ensure time_of_day has a default value if not provided
                time_of_day: initialActivitySequence.time_of_day || "09:00",
                // For Automated: infer step_type only for existing records (legacy data).
                // New sequences (id 0) keep step_type null so the user must choose.
                step_type:
                    initialActivitySequence.category === "Automated"
                        ? initialActivitySequence.step_type ??
                        (initialActivitySequence.id && initialActivitySequence.id > 0
                            ? initialActivitySequence.days_before_due != null
                                ? "due"
                                : "overdue"
                            : undefined)
                        : undefined,
            };
            // Ensure step 1 is always active, but not for Dispute or Promise_to_pay categories
            if (
                sequenceData.step === 1 &&
                sequenceData.category !== "Dispute" &&
                sequenceData.category !== "Promise_to_pay"
            ) {
                sequenceData.active = true;
            }
            setActivitySequence(sequenceData);
        } else if (isOpen) {
            resetFields();
            // Preselect category based on current tab if no initial sequence
            if (currentCategory) {
                setActivitySequence((prev) => ({
                    ...prev,
                    category: currentCategory,
                }));
            }
        }

        setErrors({});
    }, [initialActivitySequence, isOpen, currentCategory]);

    // Ensure step 1 is always active, but not for Dispute or Promise_to_pay categories
    useEffect(() => {
        if (
            activitySequence.step === 1 &&
            !activitySequence.active &&
            activitySequence.category !== "Dispute" &&
            activitySequence.category !== "Promise_to_pay" &&
            activitySequence.category !== "Automated"
        ) {
            setActivitySequence((prev) => ({
                ...prev,
                active: true,
            }));
        }
    }, [
        activitySequence.step,
        activitySequence.active,
        activitySequence.category,
    ]);

    const resetFields = () => {
        setActivitySequence(DEFAULT_ACTIVITY_SEQUENCE);
        setErrors({});
    };

    const getHighestActiveStep = useCallback(
        async (
            accountId: string | number,
            category: string,
            containerId?: number | null,
            currentSequenceId?: number | null
        ): Promise<number> => {
            try {
                const queryParams = new URLSearchParams({
                    account_id: String(accountId),
                });

                if (containerId) {
                    queryParams.append(
                        "sequence_container_id",
                        String(containerId)
                    );
                }

                const response = await apiFetch(`/api/activities/sequences?${queryParams.toString()}`
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch sequences");
                }

                const data = await response.json();
                const sequences = data.activitiesSequences || [];

                // Filter for active sequences with the same category, excluding the current sequence
                const activeSequences = sequences.filter(
                    (seq: any) =>
                        seq.active === true &&
                        seq.category === category &&
                        seq.step !== null &&
                        seq.step !== undefined &&
                        (!currentSequenceId || seq.id !== currentSequenceId)
                );

                if (activeSequences.length === 0) {
                    return 1; // If no active sequences, start at step 1
                }

                // Find the highest step
                const maxStep = Math.max(
                    ...activeSequences.map((seq: any) => Number(seq.step))
                );

                return maxStep + 1;
            } catch (error) {
                console.error("Error fetching highest active step:", error);
                // Return 1 as fallback
                return 1;
            }
        },
        []
    );

    const validateFields = useCallback((): Record<string, string> => {
        const newErrors: Record<string, string> = {};

        // Step is only required if the sequence is active
        const requiredFields: (keyof ActivitySequenceForm)[] = [
            "activity_type",
            "category",
            "activity_template_id",
        ];

        // Add step to required fields only for overdue (Automated + step_type "overdue") or non-Automated active sequences.
        // Automated + step_type "due" uses step: null by design (no sequential step number).
        if (
            activitySequence.active &&
            !(
                activitySequence.category === "Automated" &&
                activitySequence.step_type === "due"
            )
        ) {
            requiredFields.push("step");
        }

        // Add time_of_day to required fields only if category is not Dispute
        if (activitySequence.category !== "Dispute") {
            requiredFields.push("time_of_day");
        }

        requiredFields.forEach((field) => {
            const value = activitySequence[field];
            // Special handling for time_of_day - check if it's a valid time string
            if (field === "time_of_day") {
                if (
                    !value ||
                    (typeof value === "string" &&
                        (!value.trim() || value.trim().length === 0))
                ) {
                    newErrors[field] = t("validation.required", {
                        ns: "common",
                    });
                }
            } else {
                if (!value || (typeof value === "string" && !value.trim())) {
                    newErrors[field] = t("validation.required", {
                        ns: "common",
                    });
                }
            }
        });

        // For Automated category: require step_type when adding/editing
        if (
            activitySequence.category === "Automated" &&
            activitySequence.active
        ) {
            if (!activitySequence.step_type) {
                newErrors.step_type = t("validation.required", {
                    ns: "common",
                });
            } else if (activitySequence.step_type === "due") {
                if (
                    activitySequence.days_before_due === null ||
                    activitySequence.days_before_due === undefined ||
                    activitySequence.days_before_due < 0 ||
                    isNaN(Number(activitySequence.days_before_due))
                ) {
                    newErrors.days_before_due = t("validation.required", {
                        ns: "common",
                    });
                }
            } else if (activitySequence.step_type === "overdue") {
                if (
                    activitySequence.step &&
                    activitySequence.step > 1 &&
                    (activitySequence.days_from_prev_step === null ||
                        activitySequence.days_from_prev_step === undefined ||
                        !activitySequence.days_from_prev_step ||
                        isNaN(Number(activitySequence.days_from_prev_step)))
                ) {
                    newErrors.days_from_prev_step = t("validation.required", {
                        ns: "common",
                    });
                }
            }
        }

        // Special validation for days_from_prev_step - only required if step > 1 and category is not Dispute or Promise_to_pay and sequence is active (non-Automated or overdue)
        if (
            activitySequence.active &&
            activitySequence.step &&
            activitySequence.step > 1 &&
            activitySequence.category !== "Dispute" &&
            activitySequence.category !== "Promise_to_pay" &&
            activitySequence.category !== "Automated"
        ) {
            if (
                activitySequence.days_from_prev_step === null ||
                activitySequence.days_from_prev_step === undefined ||
                !activitySequence.days_from_prev_step ||
                isNaN(Number(activitySequence.days_from_prev_step))
            ) {
                newErrors.days_from_prev_step = t("validation.required", {
                    ns: "common",
                });
            }
        }

        return newErrors;
    }, [activitySequence, t]);

    const handleBlur = useCallback(
        (field: string) => {
            const value = activitySequence[field as keyof ActivitySequenceForm];

            // Skip validation for days_from_prev_step if step is 1 or category is Dispute or Promise_to_pay
            if (
                field === "days_from_prev_step" &&
                (activitySequence.step === 1 ||
                    activitySequence.category === "Dispute" ||
                    activitySequence.category === "Promise_to_pay")
            ) {
                setErrors((prevErrors) => {
                    const updatedErrors = { ...prevErrors };
                    delete updatedErrors[field];
                    return updatedErrors;
                });
                return;
            }

            // Skip validation for time_of_day if category is Dispute
            if (
                field === "time_of_day" &&
                activitySequence.category === "Dispute"
            ) {
                setErrors((prevErrors) => {
                    const updatedErrors = { ...prevErrors };
                    delete updatedErrors[field];
                    return updatedErrors;
                });
                return;
            }

            // Special handling for time_of_day - ensure it has a valid time value
            let isEmpty: boolean;
            if (field === "time_of_day") {
                isEmpty =
                    value === null ||
                    value === undefined ||
                    value === "" ||
                    (typeof value === "string" &&
                        (!value.trim() || value.trim().length === 0));
            } else {
                isEmpty =
                    value === null ||
                    value === undefined ||
                    value === "" ||
                    (typeof value === "string" && !value.trim());
            }

            setErrors((prevErrors) => {
                if (isEmpty) {
                    return {
                        ...prevErrors,
                        [field]: t("validation.required", { ns: "common" }),
                    };
                } else {
                    const updatedErrors = { ...prevErrors };
                    delete updatedErrors[field];
                    return updatedErrors;
                }
            });
        },
        [activitySequence, t]
    );

    const submitHandler = useCallback(async () => {
        const fieldErrors = validateFields();
        if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            return;
        }

        setIsLoading(true);
        try {
            const { account_id: _, id: __, ...sequenceData } = activitySequence;
            const payload: any = {
                active: activitySequence.active,
                activity_type: activitySequence.activity_type,
                category: activitySequence.category,
                activity_template_id: activitySequence.activity_template_id
                    ? parseInt(activitySequence.activity_template_id.toString())
                    : null,
                // Set step to null if inactive, otherwise use the step value
                step:
                    activitySequence.active && activitySequence.step
                        ? parseInt(activitySequence.step.toString())
                        : null,
                days_from_prev_step: activitySequence.days_from_prev_step
                    ? parseInt(activitySequence.days_from_prev_step.toString())
                    : null,
                step_type: activitySequence.step_type || null,
                days_before_due: activitySequence.days_before_due !== null &&
                    activitySequence.days_before_due !== undefined
                    ? parseInt(activitySequence.days_before_due.toString())
                    : null,
                time_of_day: activitySequence.time_of_day || "09:00",
                send_to_standard_contacts:
                    activitySequence.send_to_standard_contacts ?? true,
                send_to_escalated_contacts:
                    activitySequence.send_to_escalated_contacts ?? true,
                sequence_container_id: sequenceContainerId || null,
            };

            // Only include id for updates
            if (initialActivitySequence?.id) {
                payload.id = initialActivitySequence.id;
            }

            const url = initialActivitySequence?.id
                ? `/api/activities/sequences/${initialActivitySequence.id}`
                : `/api/activities/sequences`;
            const method = initialActivitySequence?.id ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorResponse = await response.json();
                const errorMessage =
                    errorResponse.error ||
                    errorResponse.message ||
                    t("messages.error", { ns: "common" });
                console.error("API Error:", {
                    status: response.status,
                    error: errorResponse,
                    payload,
                });
                throw new Error(errorMessage);
            }

            showToast(
                initialActivitySequence?.id
                    ? t(
                        "messages.activity_sequences_sequence_container_update_success",
                        { ns: "activity_sequences" }
                    )
                    : t(
                        "messages.activity_sequences_activity_sequence_create_success",
                        { ns: "activity_sequences" }
                    ),
                "success"
            );

            closeModal();
            refreshList();
        } catch (error: any) {
            showToast(
                error.message || t("messages.error", { ns: "common" }),
                "error"
            );
        } finally {
            setIsLoading(false);
        }
    }, [
        activitySequence,
        initialActivitySequence,
        sequenceContainerId,
        validateFields,
        showToast,
        t,
        closeModal,
        refreshList,
    ]);

    // Memoize active templates to avoid unnecessary re-renders
    const activeTemplates = useMemo(
        () => activityTemplates.filter((template) => template.active !== false),
        [activityTemplates]
    );

    // Memoize category label map for translation
    const categoryLabelMap = useMemo<Record<string, string>>(
        () => ({
            Automated: t("values.activity_sequences_automated", {
                ns: "activity_sequences",
            }),
            Promise_to_pay: t("values.activity_sequences_promise_to_pay", {
                ns: "activity_sequences",
            }),
            Dispute: t("values.activity_sequences_dispute", {
                ns: "activity_sequences",
            }),
            Agent: t("values.activity_sequences_agent", {
                ns: "activity_sequences",
            }),
            Legal: t("values.activity_sequences_legal", {
                ns: "activity_sequences",
            }),
        }),
        [t]
    );

    // Get translated category label
    const getTranslatedCategory = useCallback(
        (category: string | null | undefined): string => {
            if (!category) return "";
            return categoryLabelMap[category] || category;
        },
        [categoryLabelMap]
    );

    // Memoize activity type options with translations
    const activityTypeOptions = useMemo<ActivityTypeOption[]>(
        () =>
            ACTIVITY_TYPE_OPTIONS_LOCAL.map((option) => ({
                label: t(`values.${option.label}`, { ns: "activities" }),
                value: option.value,
            })),
        [t]
    );

    return (
        <AppDialog
            open={isOpen}
            onClose={closeModal}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="420px"
            paperMaxHeight="90vh"
            title={
                initialActivitySequence?.id
                    ? t(
                        "actions.activity_sequences_edit_activity_sequence",
                        { ns: "activity_sequences" }
                    )
                    : t(
                        "actions.activity_sequences_add_activity_sequence",
                        { ns: "activity_sequences" }
                    )
            }
            titleIcon={
                initialActivitySequence?.id ? (
                    <EditIcon aria-hidden="true" />
                ) : (
                    <AddIcon aria-hidden="true" />
                )
            }
            ariaLabelledBy="activity-step-dialog-title"
            ariaDescribedBy="activity-step-dialog-description"
            actions={
                <>
                    <Button
                        onClick={closeModal}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        disabled={isLoading}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        type="submit"
                        form="activity-step-form"
                        disabled={isLoading}
                        variant="contained"
                        size="small"
                        className="save-button"
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {t("actions.save", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <form
                id="activity-step-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    submitHandler();
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: theme.spacing(1.5),
                        maxWidth: "420px",
                        mx: "auto",
                    }}
                >
                    {/* Activity Details Section */}
                    <Box sx={{ mt: theme.spacing(2) }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: theme.spacing(1),
                                mb: theme.spacing(0.5),
                                color: theme.palette.primary.main,
                            }}
                        >
                            <Typography variant="subtitle2">
                                {t("sections.activity_details", {
                                    ns: "activities",
                                })}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: "grid",
                                gap: theme.spacing(2),
                                bgcolor: theme.palette.background.default,
                                borderRadius: theme.shape.borderRadius,
                                "@media (min-width: 600px)": {
                                    gridTemplateColumns: "repeat(2, 1fr)",
                                    padding: theme.spacing(1),
                                },
                                "@media (max-width: 599px)": {
                                    gridTemplateColumns: "1fr",
                                    padding: theme.spacing(0.75),
                                },
                            }}
                        >
                            {/* Step Type - Only for Automated category */}
                            {activitySequence.category ===
                                "Automated" && (
                                    <Box sx={{ width: "100%" }}>
                                        <Autocomplete<StepTypeOption>
                                            value={
                                                activitySequence.step_type
                                                    ? {
                                                        label: t(
                                                            `values.activity_sequences_${activitySequence.step_type}`,
                                                            {
                                                                ns: "activity_sequences",
                                                            }
                                                        ),
                                                        value: activitySequence.step_type,
                                                    }
                                                    : null
                                            }
                                            onChange={(
                                                _event,
                                                newValue: StepTypeOption | null
                                            ) => {
                                                setActivitySequence(
                                                    (prev) => ({
                                                        ...prev,
                                                        step_type: newValue
                                                            ? newValue.value
                                                            : null,
                                                    })
                                                );
                                                if (errors.step_type) {
                                                    setErrors((prev) => {
                                                        const next = {
                                                            ...prev,
                                                        };
                                                        delete next.step_type;
                                                        return next;
                                                    });
                                                }
                                            }}
                                            onBlur={() =>
                                                handleBlur("step_type")
                                            }
                                            options={[
                                                {
                                                    label: t(
                                                        "values.activity_sequences_due",
                                                        {
                                                            ns: "activity_sequences",
                                                        }
                                                    ),
                                                    value: "due",
                                                },
                                                {
                                                    label: t(
                                                        "values.activity_sequences_overdue",
                                                        {
                                                            ns: "activity_sequences",
                                                        }
                                                    ),
                                                    value: "overdue",
                                                },
                                            ]}
                                            getOptionLabel={(
                                                option: StepTypeOption
                                            ) => option.label}
                                            isOptionEqualToValue={(
                                                option: StepTypeOption,
                                                value: StepTypeOption
                                            ) =>
                                                option.value ===
                                                value.value
                                            }
                                            dir={
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr"
                                            }
                                            {...(i18n.language ===
                                                "he" && {
                                                "data-hebrew": true,
                                                "data-rtl": true,
                                            })}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={`${t(
                                                        "fields.activity_sequences_step_type",
                                                        {
                                                            ns: "activity_sequences",
                                                        }
                                                    )} *`}
                                                    InputLabelProps={{
                                                        shrink: true,
                                                    }}
                                                    size="small"
                                                    error={
                                                        !!errors.step_type
                                                    }
                                                    helperText={
                                                        errors.step_type
                                                    }
                                                    dir={
                                                        i18n.language ===
                                                            "he"
                                                            ? "rtl"
                                                            : "ltr"
                                                    }
                                                />
                                            )}
                                            renderOption={(
                                                props,
                                                option: StepTypeOption
                                            ) => (
                                                <Box
                                                    component="li"
                                                    {...props}
                                                    key={option.value}
                                                    sx={{
                                                        fontSize:
                                                            theme.typography
                                                                .body2
                                                                .fontSize ||
                                                            "0.875rem",
                                                        color: theme
                                                            .palette
                                                            .text
                                                            .primary,
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                        textAlign:
                                                            i18n.language ===
                                                                "he"
                                                                ? "right"
                                                                : "left",
                                                        "&.Mui-focused":
                                                        {
                                                            backgroundColor:
                                                                theme.palette.action.hover,
                                                        },
                                                        "&:hover": {
                                                            backgroundColor:
                                                                theme.palette.action.hover,
                                                        },
                                                        "&.Mui-selected":
                                                        {
                                                            backgroundColor:
                                                                theme.palette.action.selected,
                                                        },
                                                    }}
                                                >
                                                    {option.label}
                                                </Box>
                                            )}
                                        />
                                    </Box>
                                )}
                            <Autocomplete<ActivityTypeOption>
                                value={
                                    activityTypeOptions.find(
                                        (opt) =>
                                            opt.value ===
                                            activitySequence.activity_type
                                    ) || null
                                }
                                onChange={(
                                    event,
                                    newValue: ActivityTypeOption | null
                                ) => {
                                    if (newValue) {
                                        setActivitySequence((prev) => ({
                                            ...prev,
                                            activity_type: newValue.value,
                                        }));
                                    }
                                    if (errors.activity_type) {
                                        setErrors((prev) => {
                                            const updated = { ...prev };
                                            delete updated.activity_type;
                                            return updated;
                                        });
                                    }
                                }}
                                onBlur={() => handleBlur("activity_type")}
                                options={activityTypeOptions}
                                getOptionLabel={(
                                    option: ActivityTypeOption
                                ) => option.label}
                                isOptionEqualToValue={(
                                    option: ActivityTypeOption,
                                    value: ActivityTypeOption
                                ) => option.value === value.value}
                                dir={i18n.language === "he" ? "rtl" : "ltr"}
                                {...(i18n.language === "he" && {
                                    "data-hebrew": true,
                                    "data-rtl": true,
                                })}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={`${t(
                                            "fields.activity_sequences_activity_type",
                                            { ns: "activity_sequences" }
                                        )} *`}
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                        size="small"
                                        error={!!errors.activity_type}
                                        helperText={
                                            errors.activity_type
                                        }
                                        dir={
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr"
                                        }
                                    />
                                )}
                                renderOption={(
                                    props,
                                    option: ActivityTypeOption
                                ) => (
                                    <Box
                                        component="li"
                                        {...props}
                                        key={option.value}
                                        sx={{
                                            fontSize:
                                                theme.typography.body2
                                                    .fontSize || "0.875rem",
                                            color: theme.palette.text
                                                .primary,
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            "&.Mui-focused": {
                                                backgroundColor:
                                                    theme.palette.action
                                                        .hover,
                                            },
                                            "&:hover": {
                                                backgroundColor:
                                                    theme.palette.action
                                                        .hover,
                                            },
                                            "&.Mui-selected": {
                                                backgroundColor:
                                                    theme.palette.action
                                                        .selected,
                                                "&:hover": {
                                                    backgroundColor:
                                                        theme.palette.action
                                                            .selected,
                                                },
                                            },
                                        }}
                                    >
                                        <Typography variant="body2">
                                            {option.label}
                                        </Typography>
                                    </Box>
                                )}
                                sx={{
                                    width: "100%",
                                    "& .MuiOutlinedInput-root": {
                                        fontSize: "0.875rem",
                                        "& fieldset": {
                                            borderColor:
                                                theme.palette.divider,
                                        },
                                        "&:hover fieldset": {
                                            borderColor:
                                                theme.palette.primary.main,
                                        },
                                        "&.Mui-focused fieldset": {
                                            borderColor:
                                                theme.palette.primary.main,
                                            borderWidth: 2,
                                        },
                                    },
                                    "& .MuiAutocomplete-input": {
                                        fontSize: "0.875rem",
                                        color: theme.palette.text.primary,
                                    },
                                    // RTL support for dropdown icon positioning
                                    ...(i18n.language === "he" && {
                                        "& .MuiOutlinedInput-root": {
                                            paddingRight:
                                                theme.spacing(1.875),
                                            paddingLeft: theme.spacing(4.5),
                                        },
                                        "& .MuiAutocomplete-inputRoot": {
                                            paddingRight:
                                                theme.spacing(1.875),
                                            paddingLeft: theme.spacing(4.5),
                                        },
                                        "& .MuiAutocomplete-endAdornment": {
                                            right: "auto",
                                            left: theme.spacing(1.5),
                                        },
                                    }),
                                    "& .MuiAutocomplete-paper": {
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        borderRadius:
                                            theme.shape.borderRadius,
                                        boxShadow: theme.shadows[8],
                                        border: `1px solid ${theme.palette.divider}`,
                                        "& .MuiAutocomplete-listbox": {
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            padding: theme.spacing(0.5),
                                        },
                                    },
                                }}
                            />
                        </Box>

                        {/* Activity Template Name - Separate Row */}
                        <Box
                            sx={{
                                width: "100%",
                                ml: 0,
                                mr: 0,
                                "@media (min-width: 600px)": {
                                    px: 1,
                                },
                                "@media (max-width: 599px)": {
                                    px: 0.75,
                                },
                            }}
                        >
                            <Autocomplete<TemplateOption>
                                value={(() => {
                                    const selectedTemplate =
                                        activeTemplates.find(
                                            (t) =>
                                                String(t.id) ===
                                                String(
                                                    activitySequence.activity_template_id
                                                )
                                        );
                                    return selectedTemplate
                                        ? {
                                            label: selectedTemplate.name,
                                            value: selectedTemplate.id.toString(),
                                        }
                                        : null;
                                })()}
                                onChange={(
                                    event,
                                    newValue: TemplateOption | null
                                ) => {
                                    if (newValue) {
                                        setActivitySequence((prev) => ({
                                            ...prev,
                                            activity_template_id:
                                                newValue.value,
                                        }));
                                    }
                                }}
                                options={activeTemplates.map(
                                    (template) => ({
                                        label: template.name,
                                        value: template.id.toString(),
                                    })
                                )}
                                getOptionLabel={(option: TemplateOption) =>
                                    option.label
                                }
                                isOptionEqualToValue={(
                                    option: TemplateOption,
                                    value: TemplateOption
                                ) => option.value === value.value}
                                dir={i18n.language === "he" ? "rtl" : "ltr"}
                                {...(i18n.language === "he" && {
                                    "data-hebrew": true,
                                    "data-rtl": true,
                                })}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={`${t(
                                            "fields.activity_sequences_activity_template_name",
                                            { ns: "activity_sequences" }
                                        )} *`}
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                        size="small"
                                        error={
                                            !!errors.activity_template_id
                                        }
                                        helperText={
                                            errors.activity_template_id
                                        }
                                        dir={
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr"
                                        }
                                    />
                                )}
                                renderOption={(
                                    props,
                                    option: TemplateOption
                                ) => (
                                    <Box
                                        component="li"
                                        {...props}
                                        key={option.value}
                                        sx={{
                                            fontSize:
                                                theme.typography.body2
                                                    .fontSize || "0.875rem",
                                            color: theme.palette.text
                                                .primary,
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            "&.Mui-focused": {
                                                backgroundColor:
                                                    theme.palette.action
                                                        .hover,
                                            },
                                            "&:hover": {
                                                backgroundColor:
                                                    theme.palette.action
                                                        .hover,
                                            },
                                            "&.Mui-selected": {
                                                backgroundColor:
                                                    theme.palette.action
                                                        .selected,
                                                "&:hover": {
                                                    backgroundColor:
                                                        theme.palette.action
                                                            .selected,
                                                },
                                            },
                                        }}
                                    >
                                        <Typography variant="body2">
                                            {option.label}
                                        </Typography>
                                    </Box>
                                )}
                                sx={{
                                    width: "100%",
                                    "& .MuiOutlinedInput-root": {
                                        fontSize: "0.875rem",
                                        "& fieldset": {
                                            borderColor:
                                                theme.palette.divider,
                                        },
                                        "&:hover fieldset": {
                                            borderColor:
                                                theme.palette.primary.main,
                                        },
                                        "&.Mui-focused fieldset": {
                                            borderColor:
                                                theme.palette.primary.main,
                                            borderWidth: 2,
                                        },
                                    },
                                    "& .MuiAutocomplete-input": {
                                        fontSize: "0.875rem",
                                        color: theme.palette.text.primary,
                                    },
                                    // RTL support for dropdown icon positioning
                                    ...(i18n.language === "he" && {
                                        "& .MuiOutlinedInput-root": {
                                            paddingRight:
                                                theme.spacing(1.875),
                                            paddingLeft: theme.spacing(4.5),
                                        },
                                        "& .MuiAutocomplete-inputRoot": {
                                            paddingRight:
                                                theme.spacing(1.875),
                                            paddingLeft: theme.spacing(4.5),
                                        },
                                        "& .MuiAutocomplete-endAdornment": {
                                            right: "auto",
                                            left: theme.spacing(1.5),
                                        },
                                    }),
                                    "& .MuiAutocomplete-paper": {
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        borderRadius:
                                            theme.shape.borderRadius,
                                        boxShadow: theme.shadows[8],
                                        border: `1px solid ${theme.palette.divider}`,
                                        "& .MuiAutocomplete-listbox": {
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            padding: theme.spacing(0.5),
                                        },
                                    },
                                }}
                            />
                        </Box>

                        {/* Contact Switches Row */}
                        <Box
                            sx={{
                                display: "flex",
                                gap: theme.spacing(2),
                                bgcolor: theme.palette.background.default,
                                borderRadius: theme.shape.borderRadius,
                                padding: theme.spacing(1),
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                            }}
                        >
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={
                                            activitySequence.send_to_standard_contacts ||
                                            false
                                        }
                                        onChange={(e) =>
                                            setActivitySequence((prev) => ({
                                                ...prev,
                                                send_to_standard_contacts:
                                                    e.target.checked,
                                            }))
                                        }
                                        color="primary"
                                        {...(i18n.language === "he" && {
                                            "data-rtl": true,
                                        })}
                                    />
                                }
                                label={
                                    <Typography
                                        variant="body2"
                                        sx={{ color: "text.secondary" }}
                                    >
                                        {t(
                                            "fields.activity_sequences_send_to_standard_contacts",
                                            { ns: "activity_sequences" }
                                        )}
                                    </Typography>
                                }
                                labelPlacement={
                                    i18n.language === "he" ? "start" : "end"
                                }
                                sx={{
                                    margin: 0,
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                    "& .MuiFormControlLabel-label": {
                                        fontSize: "0.875rem",
                                        marginLeft:
                                            i18n.language === "he"
                                                ? 0
                                                : theme.spacing(1),
                                        marginRight:
                                            i18n.language === "he"
                                                ? theme.spacing(1)
                                                : 0,
                                    },
                                }}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={
                                            activitySequence.send_to_escalated_contacts ||
                                            false
                                        }
                                        onChange={(e) =>
                                            setActivitySequence((prev) => ({
                                                ...prev,
                                                send_to_escalated_contacts:
                                                    e.target.checked,
                                            }))
                                        }
                                        color="primary"
                                        {...(i18n.language === "he" && {
                                            "data-rtl": true,
                                        })}
                                    />
                                }
                                label={
                                    <Typography
                                        variant="body2"
                                        sx={{ color: "text.secondary" }}
                                    >
                                        {t(
                                            "fields.activity_sequences_send_to_escalated_contacts",
                                            { ns: "activity_sequences" }
                                        )}
                                    </Typography>
                                }
                                labelPlacement={
                                    i18n.language === "he" ? "start" : "end"
                                }
                                sx={{
                                    margin: 0,
                                    direction:
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr",
                                    "& .MuiFormControlLabel-label": {
                                        fontSize: "0.875rem",
                                        marginLeft:
                                            i18n.language === "he"
                                                ? 0
                                                : theme.spacing(1),
                                        marginRight:
                                            i18n.language === "he"
                                                ? theme.spacing(1)
                                                : 0,
                                    },
                                }}
                            />
                        </Box>
                    </Box>

                    {/* Timing Section - Hidden for Dispute category */}
                    {activitySequence.category !== "Dispute" && (
                        <Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 0.5,
                                    color: "primary.main",
                                }}
                            >
                                <Typography variant="subtitle2">
                                    {t("sections.timing", {
                                        ns: "activities",
                                    })}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 2,
                                    bgcolor: "background.default",
                                    borderRadius: 1,
                                    "@media (min-width: 600px)": {
                                        gridTemplateColumns:
                                            "repeat(2, 1fr)",
                                        padding: "8px",
                                    },
                                    "@media (max-width: 599px)": {
                                        gridTemplateColumns: "1fr",
                                        padding: "6px",
                                    },
                                }}
                            >
                                {/* Days before due - Only for Automated + step_type=due */}
                                {activitySequence.category ===
                                    "Automated" &&
                                    activitySequence.step_type ===
                                    "due" && (
                                        <TextField
                                            label={`${t("fields.activity_sequences_days_before_due", { ns: "activity_sequences" })} *`}
                                            InputLabelProps={{
                                                shrink: true,
                                            }}
                                            type="number"
                                            size="small"
                                            value={
                                                activitySequence.days_before_due ??
                                                ""
                                            }
                                            onChange={(e) =>
                                                setActivitySequence(
                                                    (prev) => ({
                                                        ...prev,
                                                        days_before_due:
                                                            e.target.value !==
                                                                ""
                                                                ? Number(
                                                                    e.target
                                                                        .value
                                                                )
                                                                : null,
                                                    })
                                                )
                                            }
                                            onBlur={() =>
                                                handleBlur("days_before_due")
                                            }
                                            fullWidth
                                            error={
                                                !!errors.days_before_due
                                            }
                                            helperText={
                                                errors.days_before_due
                                            }
                                            inputProps={{ min: 0 }}
                                            dir={
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr"
                                            }
                                            {...(i18n.language === "he" && {
                                                "data-hebrew": true,
                                            })}
                                        />
                                    )}
                                {/* Days from prev step - For Overdue (Automated) or non-Automated */}
                                {((activitySequence.category ===
                                    "Automated" &&
                                    activitySequence.step_type ===
                                    "overdue") ||
                                    (activitySequence.category !==
                                        "Dispute" &&
                                        activitySequence.category !==
                                        "Promise_to_pay" &&
                                        activitySequence.category !==
                                        "Automated")) && (
                                        <TextField
                                            label={
                                                activitySequence.step === 1
                                                    ? t(
                                                        "fields.activity_sequences_days_from_prev_step",
                                                        {
                                                            ns: "activity_sequences",
                                                        }
                                                    )
                                                    : `${t("fields.activity_sequences_days_from_prev_step", { ns: "activity_sequences" })} *`
                                            }
                                            InputLabelProps={{
                                                shrink: true,
                                            }}
                                            type="number"
                                            size="small"
                                            value={
                                                activitySequence.days_from_prev_step ||
                                                ""
                                            }
                                            onChange={(e) =>
                                                setActivitySequence(
                                                    (prev) => ({
                                                        ...prev,
                                                        days_from_prev_step:
                                                            e.target.value
                                                                ? Number(
                                                                    e.target
                                                                        .value
                                                                )
                                                                : null,
                                                    })
                                                )
                                            }
                                            onBlur={() =>
                                                handleBlur(
                                                    "days_from_prev_step"
                                                )
                                            }
                                            fullWidth
                                            disabled={
                                                activitySequence.step ===
                                                1 &&
                                                !(
                                                    activitySequence.category ===
                                                    "Automated" &&
                                                    activitySequence.step_type ===
                                                    "overdue"
                                                )
                                            }
                                            error={
                                                !!errors.days_from_prev_step
                                            }
                                            helperText={
                                                activitySequence.step === 1
                                                    ? ""
                                                    : errors.days_from_prev_step
                                            }
                                            inputProps={{ min: 0 }}
                                            dir={
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr"
                                            }
                                            {...(i18n.language === "he" && {
                                                "data-hebrew": true,
                                            })}
                                        />
                                    )}
                                <TextField
                                    label={`${t("fields.activity_sequences_time_of_day", { ns: "activity_sequences" })} *`}
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                    type="time"
                                    size="small"
                                    value={
                                        activitySequence.time_of_day ||
                                        "09:00"
                                    }
                                    onChange={(e) => {
                                        const timeValue =
                                            e.target.value || "09:00";
                                        setActivitySequence((prev) => ({
                                            ...prev,
                                            time_of_day: timeValue,
                                        }));
                                        // Clear error when user types/changes value
                                        if (
                                            errors.time_of_day &&
                                            timeValue
                                        ) {
                                            setErrors((prevErrors) => {
                                                const updated = {
                                                    ...prevErrors,
                                                };
                                                delete updated.time_of_day;
                                                return updated;
                                            });
                                        }
                                    }}
                                    onBlur={() => handleBlur("time_of_day")}
                                    fullWidth
                                    error={!!errors.time_of_day}
                                    helperText={errors.time_of_day}
                                    dir={
                                        i18n.language === "he"
                                            ? "rtl"
                                            : "ltr"
                                    }
                                    {...(i18n.language === "he" && {
                                        "data-hebrew": true,
                                    })}
                                />
                            </Box>
                        </Box>
                    )}

                    {/* Status Section - Hidden for Dispute and Promise_to_pay categories */}
                    {activitySequence.category !== "Dispute" &&
                        activitySequence.category !== "Promise_to_pay" && (
                            <Box>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: theme.spacing(1),
                                        mb: theme.spacing(0.5),
                                        color: theme.palette.primary.main,
                                    }}
                                >
                                    <Typography variant="subtitle2">
                                        {t(
                                            "fields.activity_sequences_status",
                                            { ns: "activity_sequences" }
                                        )}
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: theme.spacing(2),
                                        bgcolor:
                                            theme.palette.background
                                                .default,
                                        borderRadius:
                                            theme.shape.borderRadius,
                                        padding: theme.spacing(1),
                                    }}
                                >
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={
                                                    activitySequence.active
                                                }
                                                onChange={async (e) => {
                                                    const newActiveValue =
                                                        e.target.checked;
                                                    const wasInactive =
                                                        !activitySequence.active;
                                                    const isBecomingActive =
                                                        wasInactive &&
                                                        newActiveValue;

                                                    // For first overdue items, just toggle status without step recalculation
                                                    // For step 1 items (like first overdue), just toggle status without step recalculation
                                                    if (Number(activitySequence.step) === 1) {
                                                        setActivitySequence(
                                                            (prev) => ({
                                                                ...prev,
                                                                active: newActiveValue,
                                                            })
                                                        );
                                                        return;
                                                    } else if (
                                                        isBecomingActive &&
                                                        activitySequence.account_id &&
                                                        activitySequence.category
                                                    ) {
                                                        // When changing from inactive to active,
                                                        // find the highest active step and add 1
                                                        try {
                                                            const nextStep =
                                                                await getHighestActiveStep(
                                                                    activitySequence.account_id,
                                                                    activitySequence.category,
                                                                    sequenceContainerId ||
                                                                    null,
                                                                    activitySequence.id ||
                                                                    initialActivitySequence?.id ||
                                                                    null
                                                                );
                                                            setActivitySequence(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    active: newActiveValue,
                                                                    step: nextStep,
                                                                })
                                                            );
                                                        } catch (error) {
                                                            console.error(
                                                                "Error fetching highest active step:",
                                                                error
                                                            );
                                                            showToast(
                                                                t(
                                                                    "messages.error",
                                                                    {
                                                                        ns: "common",
                                                                    }
                                                                ),
                                                                "error"
                                                            );
                                                            // Still update active status even if step fetch fails
                                                            setActivitySequence(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    active: newActiveValue,
                                                                })
                                                            );
                                                        }
                                                    } else {
                                                        // For other cases, just update active status
                                                        setActivitySequence(
                                                            (prev) => ({
                                                                ...prev,
                                                                active: newActiveValue,
                                                            })
                                                        );
                                                    }
                                                }}
                                                color="primary"
                                                disabled={false


                                                }
                                                {...(i18n.language ===
                                                    "he" && {
                                                    "data-rtl": true,
                                                })}
                                            />
                                        }
                                        label={
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: "text.secondary",
                                                }}
                                            >
                                                {t("values.status_active", {
                                                    ns: "common",
                                                })}
                                            </Typography>
                                        }
                                        labelPlacement={
                                            i18n.language === "he"
                                                ? "start"
                                                : "end"
                                        }
                                        sx={{
                                            margin: 0,
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            "& .MuiFormControlLabel-label":
                                            {
                                                fontSize: "0.875rem",
                                                marginLeft:
                                                    i18n.language ===
                                                        "he"
                                                        ? 0
                                                        : theme.spacing(
                                                            1
                                                        ),
                                                marginRight:
                                                    i18n.language ===
                                                        "he"
                                                        ? theme.spacing(
                                                            1
                                                        )
                                                        : 0,
                                            },
                                        }}
                                    />
                                </Box>
                            </Box>
                        )}
                </Box>
            </form>
        </AppDialog>
    );
}
