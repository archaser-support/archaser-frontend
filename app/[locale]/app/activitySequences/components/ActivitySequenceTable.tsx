"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import DeleteIcon from "@mui/icons-material/Delete";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import EditIcon from "@mui/icons-material/Edit";
import HelpIcon from "@mui/icons-material/Help";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, Chip, IconButton, Switch, Tooltip, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ActivitySequenceForm } from "@/types/ActivitiesSequence";
import { CategoryType } from "@/types/enums";

interface ActivitySequenceTableProps {
    sequences: ActivitySequenceForm[];
    columns: Array<{
        key: string;
        label: string;
        tooltip?: string;
        width: string;
        minWidth: string;
        hideOnMobile?: boolean;
        hideOnTablet?: boolean;
        render?: (_sequence: ActivitySequenceForm) => React.ReactNode;
    }>;
    category: CategoryType;
    config: {
        enableDragAndDrop: boolean;
        enableStatusToggle: boolean;
        enableDelete: boolean;
        enableEdit: boolean;
        showContactSwitches: boolean;
    };
    onSequenceUpdate: (
        updater:
            | ActivitySequenceForm[]
            | ((
                prevSequences: ActivitySequenceForm[]
            ) => ActivitySequenceForm[])
    ) => void;
    onDelete: (_confirmation: { isOpen: boolean; id: number | null }) => void;
    onEdit: (_sequence: ActivitySequenceForm) => void;
    onEditTemplate: (templateId: number) => void;
    primaryColor?: string | null;
    secondaryColor?: string | null;
}

export default function ActivitySequenceTable({
    sequences,
    columns,
    category,
    config,
    onSequenceUpdate,
    onDelete,
    onEdit,
    onEditTemplate,
    primaryColor: _primaryColor,
    secondaryColor: _secondaryColor,
}: ActivitySequenceTableProps) {
    const { t, i18n } = useTranslation(["common", "activity_sequences"]);
    const { showToast } = useToast();
    const theme = useTheme();
    const [, setIsDragging] = useState(false);

    const firstColumnSx = useMemo(
        () => ({
            padding: {
                xs: "2px 4px",
                sm: "4px 6px",
                md: "6px 8px",
            },
            fontSize: {
                xs: "0.75rem",
                sm: "0.8rem",
                md: "0.875rem",
            },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: { xs: "30px", sm: "40px" },
            minWidth: { xs: "30px", sm: "40px" },
            maxWidth: { xs: "30px", sm: "40px" },
            height: "100%",
            boxSizing: "border-box" as const,
            flexShrink: 0,
            position: "relative" as const,
            outline: "none",
            boxShadow: "none",
            "&:focus": { outline: "none", boxShadow: "none" },
            "&:focus-visible": { outline: "none", boxShadow: "none" },
            "& *": { outline: "none", boxShadow: "none" },
            "& *:focus": { outline: "none", boxShadow: "none" },
            "& *:focus-visible": { outline: "none", boxShadow: "none" },
            "&::after": {
                content: '""',
                position: "absolute",
                insetInlineEnd: 0,
                top: 0,
                bottom: 0,
                width: "2px",
                backgroundColor: theme.palette.divider,
                pointerEvents: "none",
            },
        }),
        [theme.palette.divider]
    );

    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const isTablet = useMediaQuery(theme.breakpoints.down("md"));

    const firstOverdueStepId = useMemo(() => {
        const firstOverdue = sequences.find((seq) => seq.step_type === "overdue");
        return firstOverdue ? firstOverdue.id : null;
    }, [sequences]);

    const visibleColumns = useMemo(() => {
        return columns.filter((column) => {
            if (isMobile && column.hideOnMobile) return false;
            if (isTablet && column.hideOnTablet) return false;
            return true;
        });
    }, [columns, isMobile, isTablet]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const saveSequenceOrder = useCallback(
        async (updatedSequences: { id: number; step: number | null }[]) => {
            const updatePromises = updatedSequences.map(async (sequence) => {
                let retryCount = 0;
                const maxRetries = 3;

                while (retryCount < maxRetries) {
                    try {
                        const response = await apiFetch(`/api/activities/sequences/${sequence.id}/step`,
                            {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    id: sequence.id,
                                    step: sequence.step,
                                }),
                            }
                        );

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(
                                errorData.error ||
                                `Failed to update step for ID ${sequence.id}`
                            );
                        }

                        return;
                    } catch (error) {
                        retryCount++;
                        if (retryCount === maxRetries) throw error;
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1000)
                        );
                    }
                }
            });

            await Promise.all(updatePromises);

            if (updatedSequences.length > 0) {
                const category = "Automated";
                const firstSequence = updatedSequences[0];
                const response = await apiFetch(`/api/activities/sequences/${firstSequence.id}`,
                    {
                        method: "GET",
                    }
                );

                if (response.ok) {
                    const sequenceData = await response.json();
                    const account_id = sequenceData.account_id;

                    await apiFetch(`/api/activities/sequences/0/updateLastStepFlag`,
                        {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                account_id,
                                category,
                                sequence_container_id:
                                    sequenceData.sequence_container_id,
                            }),
                        }
                    );
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
        },
        []
    );

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const { active, over } = event;

            if (!over || active.id === over.id) return;

            setIsDragging(true);

            try {
                const updatedSequences = await new Promise<
                    ActivitySequenceForm[]
                >((resolve) => {
                    onSequenceUpdate((currentSequences) => {
                        if (!Array.isArray(currentSequences)) {
                            resolve(currentSequences);
                            return currentSequences;
                        }

                        const sourceIndex = currentSequences.findIndex(
                            (item: ActivitySequenceForm) =>
                                String(item.id) === active.id
                        );
                        const destIndex = currentSequences.findIndex(
                            (item: ActivitySequenceForm) =>
                                String(item.id) === over.id
                        );

                        if (
                            sourceIndex === destIndex ||
                            sourceIndex === -1 ||
                            destIndex === -1
                        ) {
                            resolve(currentSequences);
                            return currentSequences;
                        }

                        const sourceSequence = currentSequences[sourceIndex];
                        const destSequence = currentSequences[destIndex];

                        if (
                            !sourceSequence ||
                            !destSequence ||
                            !sourceSequence.category ||
                            !destSequence.category
                        ) {
                            resolve(currentSequences);
                            return currentSequences;
                        }

        if (sourceSequence.category === "Automated") {
                            const sourceIsDue =
                                sourceSequence.step_type === "due";
                            const destIsDue = destSequence.step_type === "due";
                            if (sourceIsDue && !destIsDue) {
                                showToast(t("messages.cannot_move_due_below_overdue", { ns: "activity_sequences" }), "warning");
                                resolve(currentSequences);
                                return currentSequences;
                            }
                            if (!sourceIsDue && destIsDue) {
                                showToast(t("messages.cannot_move_overdue_above_due", { ns: "activity_sequences" }), "warning");
                                resolve(currentSequences);
                                return currentSequences;
                            }

                            const newTempSequences = arrayMove(
                                currentSequences,
                                sourceIndex,
                                destIndex
                            );

                            if (sourceIsDue && destIsDue) {
                                const dueSteps = newTempSequences.filter(s => s.active && s.step_type === "due");
                                for (let i = 0; i < dueSteps.length - 1; i++) {
                                    const currentDays = dueSteps[i].days_before_due ?? 0;
                                    const nextDays = dueSteps[i + 1].days_before_due ?? 0;
                                    if (currentDays <= nextDays) {
                                        showToast(t("messages.due_steps_must_be_descending", { ns: "activity_sequences" }), "warning");
                                        resolve(currentSequences);
                                        return currentSequences;
                                    }
                                }
                            }
                        }

                        const newSequences = arrayMove(
                            currentSequences,
                            sourceIndex,
                            destIndex
                        );
                        const activeSequences = newSequences.filter(
                            (seq) => seq.active
                        );
                        const isAutomated = sourceSequence.category === "Automated";
                        const activeOverdueOnly = isAutomated
                            ? activeSequences.filter((s) => s.step_type !== "due")
                            : activeSequences;

                        const updatedSequences = newSequences.map(
                            (seq: ActivitySequenceForm) => {
                                if (seq.active) {
                                    const updatedLockedFields = [
                                        ...(seq.lockedFields || []),
                                    ];
                                    if (
                                        !updatedLockedFields.includes(
                                            "category"
                                        )
                                    ) {
                                        updatedLockedFields.push("category");
                                    }
                                    if (!updatedLockedFields.includes("step")) {
                                        updatedLockedFields.push("step");
                                    }

                                    let newStep: number | null;
                                    if (
                                        isAutomated &&
                                        seq.step_type === "due"
                                    ) {
                                        newStep = null;
                                    } else if (isAutomated) {
                                        const overdueIndex =
                                            activeOverdueOnly.findIndex(
                                                (s) => s.id === seq.id
                                            );
                                        newStep =
                                            overdueIndex >= 0
                                                ? overdueIndex + 1
                                                : seq.step;
                                    } else {
                                        const activeIndex =
                                            activeSequences.findIndex(
                                                (activeSeq) =>
                                                    activeSeq.id === seq.id
                                            );
                                        newStep = activeIndex + 1;
                                    }

                                    return {
                                        ...seq,
                                        step: newStep,
                                        lockedFields: updatedLockedFields,
                                    };
                                }
                                return seq;
                            }
                        );

                        resolve(updatedSequences);
                        return updatedSequences;
                    });
                });

                const activeSequences = updatedSequences.filter(
                    (seq) => seq.active
                );
                const sequencesToUpdate = (() => {
                    const isAutomated =
                        activeSequences[0]?.category === "Automated";
                    if (!isAutomated) {
                        return activeSequences.map((seq, index) => ({
                            id: seq.id,
                            step: index + 1,
                        }));
                    }
                    return activeSequences.map((seq) => ({
                        id: seq.id,
                        step:
                            seq.step_type === "due" ? null : (seq.step ?? 0),
                    }));
                })();

                await saveSequenceOrder(sequencesToUpdate);
                showToast(
                    t("messages.activity_sequences_sequence_container_update_success", {
                        ns: "activity_sequences",
                    }),
                    "success"
                );
            } catch (error) {
                showToast(
                    t("messages.activity_sequences_sequence_container_error_updating_sequence", {
                        ns: "activity_sequences",
                    }),
                    "error"
                );
            } finally {
                setIsDragging(false);
            }
        },
        [onSequenceUpdate, saveSequenceOrder, showToast, t]
    );

    const SortableRow = React.memo(
        ({
            sequence,
            children,
        }: {
            sequence: ActivitySequenceForm;
            children: React.ReactNode;
        }) => {
            const { attributes, listeners, setNodeRef, transform, isDragging } =
                useSortable({
                    id: String(sequence.id),
                    disabled:
                        sequence.step_type === "due" ||
                        (sequence.step === 1 &&
                            sequence.id !== firstOverdueStepId),
                });

            const style: React.CSSProperties = {
                transition: "transform 0.2s ease, opacity 0.2s ease",
                transform: CSS.Transform.toString(transform),
                opacity: isDragging ? 0.5 : undefined,
                backgroundColor: isDragging ? "#f0f0f0" : "inherit",
            };

            return (
                <Box
                    ref={setNodeRef}
                    style={style}
                    sx={{
                        display: "flex",
                        height: "48px",
                        minHeight: "48px",
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        backgroundColor: isDragging
                            ? theme.palette.action.hover
                            : "inherit",
                        width: "100%",
                        outline: "none",
                        "&:focus": { outline: "none" },
                        "&:focus-visible": { outline: "none" },
                    }}
                    data-dragging={isDragging}
                    {...attributes}
                    {...listeners}
                >
                    {children}
                </Box>
            );
        }
    );
    SortableRow.displayName = "SortableRow";

    const InactiveRow = React.memo(
        ({ children }: { children: React.ReactNode }) => (
            <Box
                sx={{
                    display: "flex",
                    height: "48px",
                    minHeight: "48px",
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    width: "100%",
                }}
            >
                {children}
            </Box>
        )
    );
    InactiveRow.displayName = "InactiveRow";

    const renderCellContent = useCallback(
        (
            sequence: ActivitySequenceForm,
            column: ActivitySequenceTableProps["columns"][number]
        ) => {
            const { key } = column;

            const isFixedWidthColumn =
                key === "step" ||
                key === "activity_type" ||
                key === "step_type" ||
                key === "time_of_day";
            const wrapInBox = (content: React.ReactNode, title?: string) => (
                <Box
                    sx={{
                        padding: {
                            xs: "2px 4px",
                            sm: "4px 6px",
                            md: "6px 8px",
                        },
                        fontSize: {
                            xs: "0.75rem",
                            sm: "0.8rem",
                            md: "0.875rem",
                        },
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        ...(isFixedWidthColumn
                            ? {
                                  width: column.width,
                                  flex: "0 0 auto",
                                  minWidth: column.minWidth,
                              }
                            : {
                                  flex: 1,
                                  minWidth: column.minWidth,
                              }),
                        height: "100%",
                        borderInlineEnd: `2px solid ${theme.palette.divider}`,
                        boxSizing: "border-box",
                        flexShrink: 0,
                    }}
                    title={title}
                >
                    {content}
                </Box>
            );

            switch (key) {
                case "step":
                    return wrapInBox(
                        sequence.step_type === "due" ? "--" : sequence.step,
                        t("fields.activity_sequences_step", {
                            ns: "activity_sequences",
                        })
                    );

                case "activity_type":
                    return wrapInBox(
                        <div className="flex items-center gap-2 p-2 min-h-[32px]">
                            <Tooltip
                                title={sequence.activity_type}
                                arrow
                                placement="bottom"
                            >
                                <span className="flex-grow">
                                    {sequence.activity_type || (
                                        <span>&nbsp;</span>
                                    )}
                                </span>
                            </Tooltip>
                        </div>,
                        t("fields.activity_sequences_activity_type", {
                            ns: "activity_sequences",
                        })
                    );

                case "step_type":
                    return wrapInBox(
                        <div className="p-2">
                            {sequence.step_type === "due"
                                ? t("values.activity_sequences_due", {
                                    ns: "activity_sequences",
                                })
                                : sequence.step_type === "overdue"
                                    ? t("values.activity_sequences_overdue", {
                                        ns: "activity_sequences",
                                    })
                                    : "--"}
                        </div>,
                        t("fields.activity_sequences_step_type", {
                            ns: "activity_sequences",
                        })
                    );

                case "days_from_prev_step": {
                    if (sequence.step_type === "due") {
                        const days = sequence.days_before_due;
                        const dueColor = theme.palette.chartPalette.main;
                        return wrapInBox(
                            <div className="p-2">
                                {days !== null && days !== undefined ? (
                                    <Chip
                                        label={`${days} ${t("values.activity_sequences_days_before_due_short", { ns: "activity_sequences" })}`}
                                        size="small"
                                        sx={{
                                            fontWeight: "bold",
                                            borderRadius: "4px",
                                            bgcolor: alpha(dueColor, 0.08),
                                            color: dueColor,
                                            border: `1px solid ${alpha(dueColor, 0.3)}`,
                                            height: "24px",
                                            whiteSpace: "nowrap"
                                        }}
                                    />
                                ) : (
                                    "--"
                                )}
                            </div>,
                            t("fields.activity_sequences_days_before_due", { ns: "activity_sequences" })
                        );
                    }
                    const overdueColor = theme.palette.chartPalette.dark;
                    const isFirstOverdue = sequence.id === firstOverdueStepId;

                    return wrapInBox(
                        sequence.step === 1 && !isFirstOverdue ? (
                            <div className="p-2">--</div>
                        ) : (
                            <div className="p-2">
                                {sequence.days_from_prev_step !== null && sequence.days_from_prev_step !== undefined ? (
                                    <Chip
                                        label={`${isFirstOverdue ? "" : ""}${sequence.days_from_prev_step
                                            } ${isFirstOverdue
                                                ? t("values.activity_sequences_overdue_date_short", {
                                                    ns: "activity_sequences",
                                                    defaultValue: "from overdue date",
                                                })
                                                : t("values.activity_sequences_days_from_prev_short", {
                                                    ns: "activity_sequences",
                                                })
                                            }`}
                                        size="small"
                                        sx={{
                                            fontWeight: "bold",
                                            borderRadius: "4px",
                                            bgcolor: alpha(overdueColor, 0.08),
                                            color: overdueColor,
                                            border: `1px solid ${alpha(overdueColor, 0.3)}`,
                                            height: "24px",
                                            whiteSpace: "nowrap"
                                        }}
                                    />
                                ) : (
                                    "--"
                                )}
                            </div>
                        ),
                        t("fields.activity_sequences_days_from_prev_step", {
                            ns: "activity_sequences",
                        })
                    );
                }

                case "time_of_day":
                    return wrapInBox(
                        <div className="p-2">
                            {sequence.time_of_day || "09:00"}
                        </div>,
                        t("fields.activity_sequences_time_of_day", {
                            ns: "activity_sequences",
                        })
                    );

                case "send_to_standard_contacts":
                case "send_to_escalated_contacts": {
                    const isStandard = key === "send_to_standard_contacts";
                    const checked = isStandard
                        ? sequence.send_to_standard_contacts
                        : sequence.send_to_escalated_contacts;
                    const tooltipKey = isStandard
                        ? "fields.activity_sequences_send_to_standard_contacts"
                        : "fields.activity_sequences_send_to_escalated_contacts";

                    return wrapInBox(
                        <div className="p-1 rounded">
                            <Switch
                                checked={checked}
                                disabled
                                {...(i18n.language === "he" && {
                                    "data-rtl": true,
                                })}
                            />
                        </div>,
                        t(tooltipKey, { ns: "activity_sequences" })
                    );
                }

                case "ActivitiesTemplate.name":
                    return wrapInBox(
                        <div
                            className="p-2 min-h-[32px]"
                            style={{ width: "100%", minWidth: 0 }}
                        >
                            <div
                                style={{
                                    position: "relative",
                                    width: "100%",
                                }}
                            >
                                <div
                                    className="rounded p-1"
                                    style={{
                                        [i18n.language === "he"
                                            ? "paddingLeft"
                                            : "paddingRight"]: "40px",
                                    }}
                                >
                                    <Tooltip
                                        title={
                                            sequence.ActivitiesTemplate?.name ||
                                            ""
                                        }
                                        arrow
                                        placement="bottom"
                                    >
                                        <span>
                                            {sequence.ActivitiesTemplate
                                                ?.name || "--"}
                                        </span>
                                    </Tooltip>
                                </div>
                                {sequence.ActivitiesTemplate && (
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            right:
                                                i18n.language === "he"
                                                    ? "auto"
                                                    : "8px",
                                            left:
                                                i18n.language === "he"
                                                    ? "8px"
                                                    : "auto",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                        }}
                                    >
                                        <Tooltip
                                            title={t(
                                                "actions.activity_sequences_edit_activity_template",
                                                { ns: "activity_sequences" }
                                            )}
                                            placement="bottom"
                                        >
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onEditTemplate(
                                                        Number(
                                                            sequence.activity_template_id
                                                        )
                                                    );
                                                }}
                                                sx={{
                                                    padding: "4px",
                                                }}
                                                color="primary"
                                            >
                                                <OpenInNewIcon
                                                    sx={{ fontSize: "1.25rem" }}
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                )}
                            </div>
                        </div>,
                        t("fields.activity_sequences_activity_template_name", {
                            ns: "activity_sequences",
                        })
                    );

                default: {
                    if (column.render) {
                        return wrapInBox(column.render(sequence));
                    }
                    const value = sequence[key as keyof ActivitySequenceForm];
                    return wrapInBox(
                        value !== null && value !== undefined
                            ? String(value)
                            : ""
                    );
                }
            }
        },
        [theme.palette.divider, t, i18n.language, onEditTemplate, firstOverdueStepId]
    );

    const renderStatusCell = useCallback(
        (sequence: ActivitySequenceForm) => (
            <Box
                sx={{
                    padding: { xs: "2px 4px", sm: "4px 6px", md: "6px 8px" },
                    fontSize: { xs: "0.75rem", sm: "0.8rem", md: "0.875rem" },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: { xs: "60px", sm: "80px" },
                    minWidth: { xs: "60px", sm: "80px" },
                    maxWidth: { xs: "60px", sm: "80px" },
                    height: "100%",
                    borderInlineEnd: `2px solid ${theme.palette.divider}`,
                    boxSizing: "border-box",
                    flexShrink: 0,
                }}
            >
                <Switch
                    checked={sequence.active}
                    disabled
                    {...(i18n.language === "he" && { "data-rtl": true })}
                />
            </Box>
        ),
        [theme.palette.divider, i18n.language]
    );

    const renderDragHandleCell = useCallback(
        (sequence: ActivitySequenceForm) => {
            const isDue = sequence.step_type === "due";
            const isFirstOverdue = sequence.id === firstOverdueStepId;

            if (isDue) {
                return (
                    <Box
                        sx={{
                            ...firstColumnSx,
                            cursor: "not-allowed",
                        }}
                    >
                        <Tooltip
                            title={t("messages.due_steps_must_be_descending", {
                                ns: "activity_sequences",
                            })}
                            placement="bottom"
                        >
                            <span style={{ display: "inline-flex", opacity: 0.4 }}>
                                <DragHandleIcon
                                    sx={{
                                        color: theme.palette.action.disabled,
                                    }}
                                />
                            </span>
                        </Tooltip>
                    </Box>
                );
            }

            const isDraggable =
                sequence.active && (sequence.step !== 1 || isFirstOverdue);

            if (!isDraggable) {
                return (
                    <Box
                        sx={{
                            ...firstColumnSx,
                            cursor: "not-allowed",
                        }}
                    >
                        <Tooltip
                            title={
                                sequence.step === 1 && !isFirstOverdue
                                    ? t("messages.cannot_delete_first_step", {
                                          ns: "activity_sequences",
                                      })
                                    : t("tooltips.activity_sequences_drag_to_reorder", {
                                          ns: "activity_sequences",
                                      })
                            }
                            placement="bottom"
                        >
                            <span style={{ display: "inline-flex", opacity: 0.4 }}>
                                <DragHandleIcon
                                    sx={{
                                        color: theme.palette.action.disabled,
                                    }}
                                />
                            </span>
                        </Tooltip>
                    </Box>
                );
            }

            return (
                <Box
                    sx={{
                        ...firstColumnSx,
                        cursor: "grab",
                        opacity: 1,
                    }}
                    title={t("tooltips.activity_sequences_drag_to_reorder", {
                        ns: "activity_sequences",
                    })}
                >
                    <DragHandleIcon sx={{ color: theme.palette.primary.main }} />
                </Box>
            );
        },
        [
            firstColumnSx,
            theme.palette.action.disabled,
            theme.palette.primary.main,
            t,
            firstOverdueStepId,
        ]
    );

    const renderActionsCell = useCallback(
        (sequence: ActivitySequenceForm) => (
            <Box
                sx={{
                    padding: { xs: "2px 4px", sm: "4px 6px", md: "6px 8px" },
                    fontSize: { xs: "0.75rem", sm: "0.8rem", md: "0.875rem" },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: { xs: "80px", sm: "120px" },
                    minWidth: { xs: "80px", sm: "120px" },
                    maxWidth: { xs: "80px", sm: "120px" },
                    height: "100%",
                    boxSizing: "border-box",
                    gap: 1,
                    flexShrink: 0,
                }}
            >
                {config.enableEdit && (
                    <Tooltip
                        title={t(
                            "actions.activity_sequences_edit_activity_template",
                            { ns: "activity_sequences" }
                        )}
                        placement="bottom"
                    >
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEdit(sequence);
                            }}
                            sx={{
                                padding: "4px",
                            }}
                            color="primary"
                        >
                            <EditIcon sx={{ fontSize: "1.25rem" }} />
                        </IconButton>
                    </Tooltip>
                )}
                {config.enableDelete && (
                    <Tooltip
                        title={
                            sequence.step === 1
                                ? t("messages.cannot_delete_first_step", {
                                    ns: "activity_sequences",
                                })
                                : sequence.active
                                    ? t(
                                        "messages.activity_sequences_cannot_delete_active",
                                        { ns: "activity_sequences" }
                                    )
                                    : t("actions.delete", { ns: "common" })
                        }
                        placement="bottom"
                    >
                        <span>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!sequence.active) {
                                        onDelete({
                                            isOpen: true,
                                            id: sequence.id,
                                        });
                                    }
                                }}
                                disabled={
                                    sequence.active || sequence.step === 1
                                }
                                sx={{
                                    padding: "4px",
                                }}
                                color="primary"
                            >
                                <DeleteIcon sx={{ fontSize: "1.25rem" }} />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
            </Box>
        ),
        [onEdit, onDelete, t, config.enableEdit, config.enableDelete]
    );

    const renderTableHeader = useMemo(
        () => (
            <Box
                sx={{
                    display: "flex",
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    bgcolor: "background.paper",
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    height: "48px",
                    minHeight: "48px",
                    width: "100%",
                }}
            >
                {config.enableDragAndDrop ? (
                    <Box
                        sx={{
                            ...firstColumnSx,
                            fontWeight: 600,
                            flex: "0 0 auto",
                        }}
                    >
                    </Box>
                ) : (
                    <Box
                        sx={{
                            ...firstColumnSx,
                            fontWeight: 600,
                            flex: "0 0 auto",
                        }}
                        aria-hidden
                    />
                )}

                <Box
                    sx={{
                        padding: {
                            xs: "2px 4px",
                            sm: "4px 6px",
                            md: "6px 8px",
                        },
                        fontSize: {
                            xs: "0.75rem",
                            sm: "0.8rem",
                            md: "0.875rem",
                        },
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "flex-start",
                        flex: "0 0 auto",
                        width: { xs: "60px", sm: "80px" },
                        height: "100%",
                        borderInlineEnd: `2px solid ${theme.palette.divider}`,
                        boxSizing: "border-box",
                    }}
                >
                    {t("fields.activity_sequences_status", {
                        ns: "activity_sequences",
                    })}
                </Box>

                {visibleColumns.map((col) => {
                    const isFixedWidthCol =
                        col.key === "step" ||
                        col.key === "activity_type" ||
                        col.key === "step_type" ||
                        col.key === "time_of_day";
                    return (
                    <Box
                        key={col.key}
                        sx={{
                            padding: {
                                xs: "2px 4px",
                                sm: "4px 6px",
                                md: "6px 8px",
                            },
                            fontSize: {
                                xs: "0.75rem",
                                sm: "0.8rem",
                                md: "0.875rem",
                            },
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "flex-start",
                            ...(isFixedWidthCol
                                ? {
                                      width: col.width,
                                      flex: "0 0 auto",
                                      minWidth: col.minWidth,
                                  }
                                : {
                                      flex: 1,
                                      minWidth: col.minWidth,
                                  }),
                            height: "100%",
                            borderInlineEnd: `2px solid ${theme.palette.divider}`,
                            boxSizing: "border-box",
                            flexShrink: 0,
                        }}
                    >
                        <div className="flex items-start gap-1">
                            <span
                                className="whitespace-normal break-words"
                                style={{
                                    wordWrap: "break-word",
                                    wordBreak: "break-word",
                                    hyphens: "auto",
                                    lineHeight: "1.2",
                                    fontSize: "0.875rem",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {col.label}
                            </span>
                            {col.tooltip && (
                                <Tooltip
                                    title={col.tooltip}
                                    arrow
                                    placement="bottom"
                                >
                                    <HelpIcon
                                        sx={{
                                            fontSize: "1rem",
                                            color: "rgb(var(--primary-rgb))",
                                            cursor: "default",
                                            opacity: 0.7,
                                            "&:hover": {
                                                opacity: 1,
                                            },
                                            flexShrink: 0,
                                        }}
                                    />
                                </Tooltip>
                            )}
                        </div>
                    </Box>
                    );
                })}

                <Box
                    sx={{
                        padding: {
                            xs: "2px 4px",
                            sm: "4px 6px",
                            md: "6px 8px",
                        },
                        fontSize: {
                            xs: "0.75rem",
                            sm: "0.8rem",
                            md: "0.875rem",
                        },
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        width: { xs: "80px", sm: "120px" },
                        minWidth: { xs: "80px", sm: "120px" },
                        maxWidth: { xs: "80px", sm: "120px" },
                        height: "100%",
                        boxSizing: "border-box",
                        flexShrink: 0,
                    }}
                >
                    {t("actions.actions", { ns: "common" })}
                </Box>
            </Box>
        ),
        [
            config.enableDragAndDrop,
            firstColumnSx,
            visibleColumns,
            theme.palette.divider,
            t,
        ]
    );

    const renderTableRow = (
        sequence: ActivitySequenceForm,
        isActive: boolean
    ) => {
        const rowContent = (
            <>
                {config.enableDragAndDrop ? (
                    renderDragHandleCell(sequence)
                ) : (
                    <Box sx={firstColumnSx} aria-hidden>
                        <div style={{ width: "24px", height: "24px" }} />
                    </Box>
                )}
                {renderStatusCell(sequence)}
                {visibleColumns.map((column) => (
                    <React.Fragment key={column.key}>
                        {renderCellContent(sequence, column)}
                    </React.Fragment>
                ))}
                {renderActionsCell(sequence)}
            </>
        );

        if (isActive && config.enableDragAndDrop) {
            return <SortableRow sequence={sequence}>{rowContent}</SortableRow>;
        } else {
            return <InactiveRow>{rowContent}</InactiveRow>;
        }
    };

    const renderTableBody = () => (
        <Box>
            {sequences.length > 0 ? (
                sequences.map((sequence, index) => {
                    const rowComponent = renderTableRow(
                        sequence,
                        sequence.active
                    );
                    return React.cloneElement(
                        rowComponent as React.ReactElement,
                        {
                            key: String(sequence.id),
                            sx: {
                                ...(rowComponent as React.ReactElement).props
                                    .sx,
                                backgroundColor:
                                    index % 2 === 0
                                        ? theme.palette.background.paper
                                        : theme.palette.action.hover,
                                "&:hover": {
                                    backgroundColor:
                                        theme.palette.action.selected,
                                },
                            },
                        }
                    );
                })
            ) : (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "200px",
                        color: "text.secondary",
                    }}
                >
                    {t("messages.activity_sequences_no_results", {
                        ns: "activity_sequences",
                    })}
                </Box>
            )}
        </Box>
    );

    const isRtl = i18n.language === "he";
    const tableContent = (
        <Box
            sx={{
                width: "100%",
                borderRadius: theme.shape.borderRadius,
                overflow: "hidden",
                position: "relative",
                isolation: "isolate",
                overflowX: { xs: "auto", sm: "visible" },
                minWidth: { xs: "600px", sm: "auto" },
                maxWidth: "100%",
                height: {
                    xs: theme.spacing(50),
                    sm: theme.spacing(55),
                    md: theme.spacing(66),
                },
                overflowY: "auto",
                direction: isRtl ? "rtl" : "ltr",
            }}
        >
            {renderTableHeader}
            {renderTableBody()}
        </Box>
    );

    if (
        config.enableDragAndDrop &&
        category !== "Dispute" &&
        category !== "Promise_to_pay"
    ) {
        const allActiveItems = sequences
            .filter((item) => item.active)
            .map((item) => String(item.id));

        return (
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
            >
                <SortableContext
                    items={allActiveItems}
                    strategy={verticalListSortingStrategy}
                >
                    {tableContent}
                </SortableContext>
            </DndContext>
        );
    }

    return tableContent;
}
