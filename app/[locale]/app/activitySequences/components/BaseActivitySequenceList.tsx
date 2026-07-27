"use client";

import { Box, CircularProgress } from "@mui/material";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import api, { apiFetch } from "@/app/api";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
// Import shared components
import { ActivitySequenceForm } from "@/types/ActivitiesSequence";
import { ActivityTemplate } from "@/types/ActivitiesTemplate";
import { CategoryType } from "@/types/enums";

import ActivitySequenceStepModal from "./ActivitySequenceStepModal";
import ActivitySequenceTable from "./ActivitySequenceTable";

// Import types

interface BaseActivitySequenceListProps {
    accountId?: string | null;
    category: CategoryType;
    selectedSequenceId?: number | null;
    onSequenceChange?: (sequenceId: number | null) => void;
    onAddActivitySequence?: () => void;
    triggerAddActivitySequence?: {
        category: CategoryType | null;
        timestamp: number;
    };
    canManage?: boolean;
    canCreate?: boolean; // Specifically for create permission
    canEdit?: boolean; // Specifically for edit permission
    canDelete?: boolean; // Specifically for delete permission
    primaryColor?: string | null;
    secondaryColor?: string | null;
}

export default function BaseActivitySequenceList({
    accountId,
    category,
    selectedSequenceId,
    onAddActivitySequence: _onAddActivitySequence,
    triggerAddActivitySequence,
    canManage: _canManage = false,
    canCreate: _canCreate = false,
    canEdit = false,
    canDelete = false,
    primaryColor,
    secondaryColor,
}: BaseActivitySequenceListProps) {
    const { t, i18n } = useTranslation(["common", "activity_sequences"]);
    const { showToast } = useToast();

    // State management
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSequence, setSelectedSequence] = useState<any>(null);
    const [activitySequences, setActivitySequences] = useState<
        ActivitySequenceForm[]
    >([]);
    const [activityTemplates, setActivityTemplates] = useState<
        ActivityTemplate[]
    >([]);
    const [_filteredTemplatesMap, setFilteredTemplatesMap] = useState<
        Record<string, ActivityTemplate[]>
    >({});
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        id: number | null;
    }>({
        isOpen: false,
        id: null,
    });
    const lastProcessedTimestamp = useRef<number>(0);
    const tRef = useRef(t);
    tRef.current = t;
    const showToastRef = useRef(showToast);
    showToastRef.current = showToast;

    // Reset trigger processing when list unmounts (prevents stale trigger on tab change)
    useEffect(() => {
        return () => {
            lastProcessedTimestamp.current = 0;
        };
    }, []);
    // Note: modal open is controlled by parent trigger; do not block legitimate opens

    // Dynamic configuration based on category and permissions
    const config = useMemo(() => {
        const baseConfig = {
            enableStatusToggle: canEdit, // Only allow status toggle if user can edit
            enableDelete: canDelete, // Only allow delete if user has delete permission
            enableEdit: canEdit, // Only allow edit if user has edit permission
        };

        switch (category) {
            case "Automated":
                return {
                    ...baseConfig,
                    enableDragAndDrop: canEdit, // Only allow drag-and-drop if user can edit
                    enableAddButton: true,
                    showContactSwitches: true,
                };
            case "Promise_to_pay":
                return {
                    ...baseConfig,
                    enableDragAndDrop: false,
                    enableAddButton: false,
                    showContactSwitches: true,
                };
            case "Dispute":
                return {
                    ...baseConfig,
                    enableDragAndDrop: false,
                    enableAddButton: false,
                    showContactSwitches: true,
                };
            case "Agent":
                return {
                    ...baseConfig,
                    enableDragAndDrop: canEdit, // Only allow drag-and-drop if user can edit
                    enableAddButton: true,
                    showContactSwitches: true,
                };
            case "Legal":
                return {
                    ...baseConfig,
                    enableDragAndDrop: canEdit, // Only allow drag-and-drop if user can edit
                    enableAddButton: true,
                    showContactSwitches: true,
                };
            default:
                return {
                    ...baseConfig,
                    enableDragAndDrop: false,
                    enableAddButton: false,
                    showContactSwitches: false,
                };
        }
    }, [category, canEdit, canDelete]);

    // Memoize the category label map
    const _categoryLabelMap = useMemo<Record<CategoryType, string>>(
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

    // Memoize the base columns definition
    const baseColumns = useMemo(() => {
        const baseCols: Array<{
            key: string;
            label: string;
            tooltip?: string;
            width: string;
            minWidth: string;
            hideOnMobile?: boolean;
            hideOnTablet?: boolean;
            render?: (_sequence: ActivitySequenceForm) => React.ReactNode;
        }> = [];

        // Add step column only if category is not Dispute
        if (category !== "Dispute") {
            baseCols.push({
                key: "step",
                label: t("fields.activity_sequences_step", {
                    ns: "activity_sequences",
                }),
                width: "60px",
                minWidth: "50px",
                hideOnMobile: false,
                hideOnTablet: false,
            });
        }

        baseCols.push({
            key: "activity_type",
            label: t("fields.activity_sequences_activity_type", {
                ns: "activity_sequences",
            }),
            width: "120px",
            minWidth: "100px",
            hideOnMobile: false,
            hideOnTablet: false,
        });

        // Add timing columns based on category
        if (
            category === "Automated" ||
            category === "Agent" ||
            category === "Legal"
        ) {
            baseCols.push(
                ...(category === "Automated"
                    ? [
                        {
                            key: "step_type",
                            label: t(
                                "fields.activity_sequences_step_type",
                                { ns: "activity_sequences" }
                            ),
                            width: "90px",
                            minWidth: "76px",
                            hideOnMobile: true,
                            hideOnTablet: false,
                        },
                        {
                            key: "days_from_prev_step",
                            label: t(
                                "fields.activity_sequences_days_from_prev_step",
                                { ns: "activity_sequences" }
                            ),
                            tooltip: t(
                                "tooltips.activity_sequences_days_from_prev_step_tooltip",
                                { ns: "activity_sequences" }
                            ),
                            width: "140px",
                            minWidth: "120px",
                            hideOnMobile: true,
                            hideOnTablet: false,
                        },
                    ]
                    : [
                        {
                            key: "days_from_prev_step",
                            label: t(
                                "fields.activity_sequences_days_from_prev_step",
                                { ns: "activity_sequences" }
                            ),
                            tooltip: t(
                                "tooltips.activity_sequences_days_from_prev_step_tooltip",
                                { ns: "activity_sequences" }
                            ),
                            width: "140px",
                            minWidth: "120px",
                            hideOnMobile: true,
                            hideOnTablet: false,
                        },
                    ]),
                {
                    key: "time_of_day",
                    label: t("fields.activity_sequences_time_of_day", {
                        ns: "activity_sequences",
                    }),
                    width: "100px",
                    minWidth: "70px",
                    hideOnMobile: true,
                    hideOnTablet: false,
                }
            );
        } else if (category === "Promise_to_pay") {
            baseCols.push({
                key: "time_of_day",
                label: t("fields.activity_sequences_time_of_day", {
                    ns: "activity_sequences",
                }),
                width: "90px",
                minWidth: "70px",
                hideOnMobile: true,
                hideOnTablet: false,
            });
        }

        // Add contact switches if enabled
        if (config.showContactSwitches) {
            baseCols.push(
                {
                    key: "send_to_standard_contacts",
                    label: t(
                        "fields.activity_sequences_send_to_standard_contacts",
                        { ns: "activity_sequences" }
                    ),
                    width: "120px",
                    minWidth: "100px",
                    hideOnMobile: true,
                    hideOnTablet: true,
                },
                {
                    key: "send_to_escalated_contacts",
                    label: t(
                        "fields.activity_sequences_send_to_escalated_contacts",
                        { ns: "activity_sequences" }
                    ),
                    width: "120px",
                    minWidth: "100px",
                    hideOnMobile: true,
                    hideOnTablet: true,
                }
            );
        }

        baseCols.push({
            key: "ActivitiesTemplate.name",
            label: t("fields.activity_sequences_activity_template_name", {
                ns: "activity_sequences",
            }),
            width: "300px",
            minWidth: "250px",
            hideOnMobile: false,
            hideOnTablet: false,
        });

        return baseCols;
    }, [t, config.showContactSwitches, category]);

    // Data fetching functions
    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            // If no sequence is selected, don't fetch sequences
            if (!selectedSequenceId) {
                setActivitySequences([]);
                return;
            }
            const response = await api.get(
                `/activities/sequences?sequence_container_id=${selectedSequenceId}`
            );

            const {
                activitiesSequences,
            }: { activitiesSequences: ActivitySequenceForm[] } = response.data;

            if (!activitiesSequences || !Array.isArray(activitiesSequences)) {
                throw new Error("Invalid response format from API");
            }

            const sortedSequences = activitiesSequences
                .filter((seq) => !seq.deleted && seq.category === category)
                .sort((a, b) => {
                    if (a.active !== b.active) return a.active ? -1 : 1;
                    if (category === "Automated") {
                        const aIsDue = a.step_type === "due";
                        const bIsDue = b.step_type === "due";
                        if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;
                        if (aIsDue && bIsDue) {
                            return (
                                (b.days_before_due ?? -1) -
                                (a.days_before_due ?? -1)
                            );
                        }
                    }
                    return (a.step ?? Infinity) - (b.step ?? Infinity);
                });

            setActivitySequences(sortedSequences);
        } catch {
            showToastRef.current(
                tRef.current(
                    "messages.activity_sequences_sequence_container_error_loading_sequences",
                    { ns: "activity_sequences" }
                ),
                "error"
            );
            setActivitySequences([]);
        } finally {
            setIsLoading(false);
        }
    }, [category, selectedSequenceId]);

    const fetchActivityTemplates = useCallback(async () => {
        try {
            const response = await api.get(
                "/activities/templates?page=1&rowsPerPage=1000&query=&category=&active="
            );
            const { templates } = response.data;

            // Show all templates for the current category
            const categoryTemplates = templates.filter(
                (template: ActivityTemplate) => template.category === category
            );
            setActivityTemplates(categoryTemplates);

            const filteredMap: Record<string, ActivityTemplate[]> = {};
            categoryTemplates.forEach((template: ActivityTemplate) => {
                const categoryKey = template.category || "unknown";
                if (!filteredMap[categoryKey]) {
                    filteredMap[categoryKey] = [];
                }
                if (template.active !== false) {
                    filteredMap[categoryKey].push(template);
                }
            });

            setFilteredTemplatesMap(filteredMap);
        } catch {
            // Error handling can be added here if needed
        }
    }, [category]);

    // Memoized refresh function
    const refreshAll = useCallback(() => {
        fetchData();
        fetchActivityTemplates();
    }, [fetchData, fetchActivityTemplates]);

    // Initialize data
    useEffect(() => {
        fetchActivityTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category]); // Only fetch templates when category changes

    useEffect(() => {
        fetchData();
    }, [category, selectedSequenceId, fetchData]); // Only depend on the actual values that matter

    // Watch for trigger to open modal
    useEffect(() => {
        if (
            triggerAddActivitySequence?.category === category &&
            triggerAddActivitySequence?.timestamp > 0 &&
            triggerAddActivitySequence?.timestamp !==
            lastProcessedTimestamp.current
        ) {
            // Prevent opening modal for stale triggers (older than 10 seconds)
            // This prevents the modal from opening on page reload if the trigger state persists
            const isRecent =
                Date.now() - triggerAddActivitySequence.timestamp < 10000;

            // Mark this timestamp as processed regardless of age to avoid re-processing
            lastProcessedTimestamp.current =
                triggerAddActivitySequence.timestamp;

            if (!isRecent) {
                return;
            }

            // Ensure we have the latest data before calculating step number
            const calculateStepAndOpenModal = async () => {
                // If no sequence container is selected, we can't create sequences
                if (!selectedSequenceId) {
                    return;
                }

                try {
                    // Fetch fresh data to ensure we have the latest step numbers
                    const response = await api.get(
                        `/activities/sequences?sequence_container_id=${selectedSequenceId}`
                    );
                    const {
                        activitiesSequences,
                    }: { activitiesSequences: ActivitySequenceForm[] } =
                        response.data;

                    if (
                        !activitiesSequences ||
                        !Array.isArray(activitiesSequences)
                    ) {
                        throw new Error("Invalid response format from API");
                    }

                    const currentSequences = activitiesSequences
                        .filter(
                            (seq) => !seq.deleted && seq.category === category
                        )
                        .sort((a, b) => {
                            if (a.active !== b.active) return a.active ? -1 : 1;
                            if (category === "Automated") {
                                const aIsDue = a.step_type === "due";
                                const bIsDue = b.step_type === "due";
                                if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;
                                if (aIsDue && bIsDue) {
                                    return (
                                        (b.days_before_due ?? -1) -
                                        (a.days_before_due ?? -1)
                                    );
                                }
                            }
                            return (a.step ?? Infinity) - (b.step ?? Infinity);
                        });

                    // Calculate the next step number
                    const lastStep = Math.max(
                        ...currentSequences.map((s) => s.step || 0),
                        0
                    );

                    setSelectedSequence({
                        id: 0,
                        category: category,
                        step: lastStep + 1,
                        activity_type: "Email",
                        days_from_prev_step: null,
                        account_id: accountId || "0",
                        activity_template_id: "",
                        time_of_day: "09:00",
                        active: true,
                        lockedFields: ["category", "step"],
                        send_to_standard_contacts: true,
                        send_to_escalated_contacts: true,
                    });
                    setIsModalOpen(true);
                } catch {
                    // Fallback to using current state
                    const lastStep = Math.max(
                        ...activitySequences.map((s) => s.step || 0),
                        0
                    );
                    setSelectedSequence({
                        id: 0,
                        category: category,
                        step: lastStep + 1,
                        activity_type: "Email",
                        days_from_prev_step: null,
                        account_id: accountId || "0",
                        activity_template_id: "",
                        time_of_day: "09:00",
                        active: true,
                        lockedFields: ["category", "step"],
                        send_to_standard_contacts: true,
                        send_to_escalated_contacts: true,
                    });
                    setIsModalOpen(true);
                }
            };

            calculateStepAndOpenModal();
        }
    }, [
        triggerAddActivitySequence,
        category,
        selectedSequenceId,
        accountId,
        activitySequences,
    ]);

    // Memoized sorted sequences
    const sortedSequences = useMemo(() => {
        if (!activitySequences || !Array.isArray(activitySequences)) {
            return [];
        }

        return activitySequences.slice().sort((a, b) => {
            if (!a || !b) return 0;
            // First, sort by active status (active sequences first, then inactive)
            if (a.active !== b.active) {
                return a.active ? -1 : 1;
            }
            // For Automated: due steps first (by days_before_due desc), then overdue (by step)
            if (category === "Automated") {
                const aIsDue = a.step_type === "due";
                const bIsDue = b.step_type === "due";
                if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;
                if (aIsDue && bIsDue) {
                    return (
                        (b.days_before_due ?? -1) -
                        (a.days_before_due ?? -1)
                    );
                }
            }
            // If both have the same active status, sort by step
            return (a.step ?? Infinity) - (b.step ?? Infinity);
        });
    }, [activitySequences, category]);

    // Handle template editing
    const handleEditTemplate = useCallback(
        (templateId: number) => {
            const categoryMap: Record<string, string> = {
                Automated: "automated",
                Promise_to_pay: "promise-to-pay",
                Dispute: "dispute",
                Agent: "agent",
                Legal: "legal",
            };

            const settingsCategory =
                categoryMap[category] || category.toLowerCase();
            const tabParam = categoryMap[category] || category.toLowerCase();
            const backUrl = `/app/activitySequences?tab=${tabParam}`;
            const editUrl = `/app/settings/${settingsCategory}-templates/${templateId}?backUrl=${encodeURIComponent(backUrl)}`;
            window.open(editUrl, "_blank");
        },
        [category]
    );

    // Handle edit sequence
    const handleEdit = useCallback((sequence: ActivitySequenceForm) => {
        setSelectedSequence(sequence);
        setIsModalOpen(true);
    }, []);

    // Handle delete confirmation
    const handleDeleteConfirmation = useCallback(async () => {
        if (!deleteConfirmation.id) return;
        try {
            const response = await apiFetch(`/api/activities/sequences/${deleteConfirmation.id}`,
                {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to delete sequence");
            }

            showToast(
                t(
                    "messages.activity_sequences_activity_sequence_deleted_success",
                    { ns: "activity_sequences" }
                ),
                "success"
            );
            setDeleteConfirmation({ isOpen: false, id: null });
            refreshAll();
        } catch (error: any) {
            showToast(
                error.message ||
                t(
                    "messages.activity_sequences_error_deleting_activity_sequence",
                    { ns: "activity_sequences" }
                ),
                "error"
            );
        }
    }, [deleteConfirmation.id, showToast, t, refreshAll]);

    // Show loading spinner
    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 400,
                    width: "100%",
                }}
            >
                <CircularProgress color="primary" size={40} />
            </Box>
        );
    }

    // Show message when no sequence is selected
    if (!selectedSequenceId) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 400,
                    width: "100%",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                }}
            />
        );
    }

    return (
        <Box sx={{ bgcolor: "background.default", borderRadius: 2 }}>
            {/* Content Section */}
            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    overflow: "hidden",
                    minHeight: 400,
                }}
            >
                <ActivitySequenceTable
                    sequences={sortedSequences}
                    columns={baseColumns}
                    category={category}
                    config={config}
                    onSequenceUpdate={(updater) => {
                        if (typeof updater === "function") {
                            const newSequences = updater(activitySequences);
                            setActivitySequences(newSequences);
                        } else {
                            setActivitySequences(updater);
                        }
                    }}
                    onDelete={setDeleteConfirmation}
                    onEdit={handleEdit}
                    onEditTemplate={handleEditTemplate}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                />
            </Box>

            {/* Modals */}
            <ActivitySequenceStepModal
                isOpen={isModalOpen}
                activitySequence={selectedSequence}
                closeModal={() => setIsModalOpen(false)}
                refreshList={refreshAll}
                activityTemplates={activityTemplates}
                currentCategory={category}
                sequenceContainerId={selectedSequenceId}
            />

            <DeleteDialog
                isOpen={deleteConfirmation.isOpen}
                onClose={() =>
                    setDeleteConfirmation({ isOpen: false, id: null })
                }
                onConfirm={handleDeleteConfirmation}
                title={t("messages.delete_confirmation", {
                    ns: "activity_sequences",
                })}
                description={`${t("messages.activity_sequences_delete_activity_sequence_confirmation", { ns: "activity_sequences" })}\n\n${t("messages.activity_sequences_delete_activity_sequence_warning", { ns: "activity_sequences" })}`}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={false}
                type="delete"
                maxWidth="sm"
                locale={i18n.language}
            />
        </Box>
    );
}
