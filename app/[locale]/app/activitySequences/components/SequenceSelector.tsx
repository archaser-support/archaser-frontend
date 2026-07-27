"use client";

import {
    Add as AddIcon,
    ContentCopy as CloneIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Star as StarIcon,
} from "@mui/icons-material";
import {
    Box,
    Button,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { CategoryType, SequenceContainer } from "@/types/SequenceContainer";

import SequenceDetailsModal from "./SequenceDetailsModal";

interface SequenceSelectorProps {
    category: CategoryType;
    accountId: string;
    selectedSequenceId: number | null;
    onSequenceChange: (_sequenceId: number | null) => void;
    onCloneSequence?: (_sequenceId: number) => void;
    onAddActivitySequence?: () => void;
    canManage?: boolean; // Whether user can create/edit/delete sequences
    canCreate?: boolean; // Specifically for create permission
    canCloneSequenceContainer?: boolean; // Whether user can clone sequence containers
    canEditSequenceContainer?: boolean; // Whether user can edit sequence containers
    canDeleteSequenceContainer?: boolean; // Whether user can delete sequence containers
}

export default function SequenceSelector({
    category,
    accountId: _accountId,
    selectedSequenceId,
    onSequenceChange,
    onCloneSequence,
    onAddActivitySequence,
    canManage: _canManage = false,
    canCreate = false,
    canCloneSequenceContainer = false,
    canEditSequenceContainer = false,
    canDeleteSequenceContainer = false,
}: SequenceSelectorProps) {
    const { t, i18n } = useTranslation(["common", "activity_sequences"]);
    const { showToast } = useToast();
    const theme = useTheme();
    const isRTL = i18n.language === "he";
    const [sequences, setSequences] = useState<SequenceContainer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        id: number | null;
    }>({
        isOpen: false,
        id: null,
    });
    const [replacementSequenceId, setReplacementSequenceId] = useState<
        number | null
    >(null);
    const [deleteError, setDeleteError] = useState<string>("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [sequenceUsage, setSequenceUsage] = useState<{
        connectedCustomers: any[];
    } | null>(null);
    const [cloneModal, setCloneModal] = useState<{
        isOpen: boolean;
        id: number | null;
        name: string;
    }>({ isOpen: false, id: null, name: "" });
    const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

    const fetchSequences = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get(
                `/sequenceContainers?category=${category}&includeInactive=true`
            );

            if (response.data?.data) {
                const data = response.data.data;
                setSequences(data);

                // Only select default sequence on initial load when nothing is selected
                if (
                    !hasInitiallyLoaded &&
                    !selectedSequenceId &&
                    data.length > 0
                ) {
                    const defaultSequence = data.find(
                        (seq: SequenceContainer) => seq.is_default
                    );
                    const sequenceId = defaultSequence
                        ? defaultSequence.id
                        : data[0].id;
                    onSequenceChange(sequenceId);
                    setHasInitiallyLoaded(true);
                }
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : String(err);
            setError(
                errorMessage ||
                t(
                    "messages.activity_sequences_sequence_container_error_loading_sequences",
                    { ns: "activity_sequences" }
                )
            );
            showToast(
                t(
                    "messages.activity_sequences_sequence_container_error_loading_sequences",
                    { ns: "activity_sequences" }
                ),
                "error"
            );
        } finally {
            setLoading(false);
        }
    }, [
        category,
        onSequenceChange,
        showToast,
        t,
        selectedSequenceId,
        hasInitiallyLoaded,
    ]);

    // Reset hasInitiallyLoaded when category changes
    useEffect(() => {
        setHasInitiallyLoaded(false);
    }, [category]);

    useEffect(() => {
        fetchSequences();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category]);

    const handleSequenceChange = useCallback(
        (newValue: any) => {
            const sequenceId = newValue?.id || null;
            onSequenceChange(sequenceId);
        },
        [onSequenceChange]
    );

    const handleCloneSequence = useCallback(
        async (sequenceId: number) => {
            const sequence = sequences.find((s) => s.id === sequenceId);
            if (!sequence) return;

            const defaultName = `${sequence.name} (Copy)`;
            setCloneModal({
                isOpen: true,
                id: sequenceId,
                name: defaultName,
            });
        },
        [sequences]
    );

    const handleCloneConfirmation = useCallback(async () => {
        if (!cloneModal.id || !cloneModal.name.trim()) return;

        try {
            const response = await api.post(
                `/sequenceContainers/${cloneModal.id}`,
                {
                    action: "clone",
                    new_name: cloneModal.name.trim(),
                    set_as_default: false,
                }
            );

            if (response.data?.data) {
                showToast(
                    t(
                        "messages.activity_sequences_sequence_container_clone_success",
                        { ns: "activity_sequences" }
                    ),
                    "success"
                );

                await fetchSequences();

                if (onCloneSequence) {
                    onCloneSequence(response.data.data.id);
                }
            }
        } catch {
            showToast(
                t(
                    "messages.activity_sequences_sequence_container_error_cloning_sequence",
                    { ns: "activity_sequences" }
                ),
                "error"
            );
        } finally {
            setCloneModal({ isOpen: false, id: null, name: "" });
        }
    }, [cloneModal, showToast, t, fetchSequences, onCloneSequence]);

    const handleCloseCloneModal = useCallback(() => {
        setCloneModal({ isOpen: false, id: null, name: "" });
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleSetAsDefault = useCallback(
        async (sequenceId: number) => {
            try {
                await api.post(`/sequenceContainers/${sequenceId}`, {
                    action: "setDefault",
                });

                showToast(
                    t(
                        "messages.activity_sequences_sequence_container_set_default_success",
                        { ns: "activity_sequences" }
                    ),
                    "success"
                );

                await fetchSequences();
            } catch {
                showToast(
                    t(
                        "messages.activity_sequences_sequence_container_error_setting_default",
                        { ns: "activity_sequences" }
                    ),
                    "error"
                );
            }
        },
        [showToast, t, fetchSequences]
    );

    const handleDeleteSequence = async (
        sequenceId: number,
        replacementId: number | null
    ) => {
        // Only require replacement if sequence is being used by customers
        const needsReplacement =
            sequenceUsage?.connectedCustomers &&
            sequenceUsage.connectedCustomers.length > 0;

        if (needsReplacement && !replacementId) {
            setDeleteError(
                t(
                    "validation.activity_sequences_sequence_container_replacement_sequence_required",
                    { ns: "activity_sequences" }
                )
            );
            return;
        }

        try {
            setIsDeleting(true);
            setDeleteError("");

            if (needsReplacement) {
                // If connected, migrate customers to replacement sequence
                await api.post(`/sequenceContainers/${sequenceId}`, {
                    action: "deleteWithReplacement",
                    replacement_sequence_id: replacementId,
                });

                showToast(
                    t(
                        "messages.activity_sequences_sequence_container_delete_with_replacement_success",
                        { ns: "activity_sequences" }
                    ),
                    "success"
                );
            } else {
                // If not connected, proceed with normal deletion
                await api.delete(`/sequenceContainers/${sequenceId}`);

                showToast(
                    t(
                        "messages.activity_sequences_sequence_container_delete_success",
                        { ns: "activity_sequences" }
                    ),
                    "success"
                );
            }

            // Refresh sequences
            await fetchSequences();

            // If the deleted sequence was selected, clear the selection
            if (selectedSequenceId === sequenceId) {
                onSequenceChange(null);
            }

            // Close the modal
            setDeleteConfirmation({ isOpen: false, id: null });
            setReplacementSequenceId(null);
        } catch (err: any) {
            const errorMessage =
                err?.response?.data?.error ||
                (err instanceof Error ? err.message : String(err)) ||
                t(
                    "messages.activity_sequences_sequence_container_error_deleting_sequence",
                    { ns: "activity_sequences" }
                );
            setDeleteError(errorMessage);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteConfirmation = useCallback(async () => {
        if (!deleteConfirmation.id) return;

        await handleDeleteSequence(
            deleteConfirmation.id,
            replacementSequenceId
        );
    }, [deleteConfirmation.id, replacementSequenceId, handleDeleteSequence]);

    const handleCloseDeleteModal = useCallback(() => {
        setDeleteConfirmation({ isOpen: false, id: null });
        setReplacementSequenceId(null);
        setDeleteError("");
        setSequenceUsage(null);
    }, []);

    const handleOpenDeleteModal = useCallback(async (sequenceId: number) => {
        try {
            const checkResponse = await api.get(
                `/sequenceContainers/${sequenceId}?usage=true`
            );
            setSequenceUsage(checkResponse.data.data);
            setDeleteConfirmation({ isOpen: true, id: sequenceId });
        } catch {
            setSequenceUsage(null);
            setDeleteConfirmation({ isOpen: true, id: sequenceId });
        }
    }, []);

    const selectedSequence = sequences.find((s) => s.id === selectedSequenceId);

    // Memoized toolbar styles
    const toolbarStyles = useMemo(
        () => ({
            padding: {
                xs: theme.spacing(0.75, 1),
                sm: theme.spacing(1, 1.5),
                md: theme.spacing(1.5, 2),
            },
            marginBottom: theme.spacing(2),
            display: "flex",
            flexDirection: "row" as const,
            gap: theme.spacing(0.5),
            alignItems: "center",
            minHeight: { xs: "32px", sm: "36px", md: "40px" },
            direction:
                i18n.language === "he" ? ("rtl" as const) : ("ltr" as const),
            flexWrap: "nowrap" as const,
            overflow: "visible",
            justifyContent: "space-between",
            width: "100%",
            boxSizing: "border-box",
        }),
        [theme, i18n.language]
    );

    // Memoized sequence options
    const sequenceOptions = useMemo(
        () =>
            sequences.map((sequence) => ({
                id: sequence.id,
                label: sequence.name,
                value: sequence,
                is_default: sequence.is_default,
                active: sequence.active,
            })),
        [sequences]
    );

    const allOptions = sequenceOptions;
    const currentValue =
        sequenceOptions.find((option) => option.id === selectedSequenceId) ||
        null;

    if (loading) {
        return null;
    }

    if (error) {
        return (
            <Box
                sx={{
                    p: 2,
                    bgcolor: "background.paper",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                }}
            >
                <Typography variant="body2" color="error">
                    {error}
                </Typography>
            </Box>
        );
    }

    return (
        <>
            <Box sx={toolbarStyles} className="endless-scroll-toolbar">
                {/* Left Section: Add Activity Sequence Button */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: theme.spacing(0.5),
                        flexShrink: 0,
                    }}
                >
                    {onAddActivitySequence &&
                        selectedSequenceId &&
                        canCreate &&
                        category !== "Promise_to_pay" &&
                        category !== "Dispute" && (
                            <Tooltip
                                title={t(
                                    "actions.activity_sequences_add_activity_sequence",
                                    { ns: "activity_sequences" }
                                )}
                            >
                                <IconButton
                                    color="primary"
                                    size="small"
                                    className="toolbar-button"
                                    onClick={onAddActivitySequence}
                                >
                                    <AddIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                </Box>

                {/* Right Section: Sequence Selector and Action Buttons */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: theme.spacing(0.5),
                        flex: 1,
                        minWidth: 0,
                        justifyContent: "flex-end",
                    }}
                >
                    {category === "Automated" ? (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: theme.spacing(1),
                                flexShrink: 0,
                            }}
                        >
                            <Box
                                sx={{
                                    width: { xs: 240, sm: 300, md: 360 },
                                    minWidth: { xs: 240, sm: 300, md: 360 },
                                    maxWidth: { xs: 240, sm: 300, md: 360 },
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    height: "100%",
                                    "& .MuiFormControl-root": {
                                        width: "100% !important",
                                        minWidth: "100% !important",
                                        maxWidth: "100% !important",
                                    },
                                    "& .MuiAutocomplete-root": {
                                        width: "100% !important",
                                        minWidth: "100% !important",
                                    },
                                    "& .MuiInputBase-root": {
                                        overflow: "hidden !important",
                                        whiteSpace: "nowrap !important",
                                    },
                                    "& .MuiInputBase-input": {
                                        overflow: "hidden !important",
                                        whiteSpace: "nowrap !important",
                                        textOverflow: "ellipsis !important",
                                    },
                                }}
                            >
                                <ToolbarDropdownFilter
                                    value={currentValue}
                                    onChange={handleSequenceChange}
                                    options={allOptions}
                                    getOptionLabel={(option: any) =>
                                        option.active === false
                                            ? `${option.label} (${t("values.status_inactive", { ns: "common" })})`
                                            : option.label
                                    }
                                    isOptionEqualToValue={(
                                        option: any,
                                        value: any
                                    ) => option.id === value.id}
                                    renderOption={(_props, option) => (
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                width: "100%",
                                                p: 1,
                                            }}
                                        >
                                            {option.is_default && (
                                                <StarIcon
                                                    sx={{
                                                        fontSize: "1rem",
                                                        color: theme.palette
                                                            .primary.main,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            )}
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    flex: 1,
                                                    color:
                                                        option.active === false
                                                            ? "text.secondary"
                                                            : "text.primary",
                                                }}
                                            >
                                                {option.label}
                                            </Typography>
                                            {option.active === false && (
                                                <Typography
                                                    component="span"
                                                    variant="caption"
                                                    sx={{
                                                        color: "text.secondary",
                                                        fontStyle: "italic",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    ({t("values.status_inactive", { ns: "common" })})
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                />
                            </Box>
                        </Box>
                    ) : // For non-Automated categories, show nothing (no label, no dropdown)
                        null}

                    {selectedSequence && (
                        <>
                            {canCloneSequenceContainer &&
                                category === "Automated" && (
                                    <Tooltip
                                        title={t(
                                            "actions.activity_sequences_sequence_container_clone",
                                            { ns: "activity_sequences" }
                                        )}
                                    >
                                        <IconButton
                                            color="primary"
                                            size="small"
                                            className="toolbar-button"
                                            onClick={() =>
                                                handleCloneSequence(
                                                    selectedSequence.id
                                                )
                                            }
                                        >
                                            <CloneIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}

                            {selectedSequenceId &&
                                category === "Automated" &&
                                canEditSequenceContainer && (
                                    <Tooltip
                                        title={t(
                                            "actions.activity_sequences_sequence_container_manage",
                                            { ns: "activity_sequences" }
                                        )}
                                    >
                                        <IconButton
                                            color="primary"
                                            size="small"
                                            className="toolbar-button"
                                            onClick={() =>
                                                setDetailsModalOpen(true)
                                            }
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}

                            {selectedSequenceId &&
                                category === "Automated" &&
                                canDeleteSequenceContainer && (
                                    <Tooltip
                                        title={
                                            selectedSequence?.is_default
                                                ? t(
                                                    "messages.activity_sequences_sequence_container_cannot_delete_default",
                                                    {
                                                        ns: "activity_sequences",
                                                    }
                                                )
                                                : t(
                                                    "actions.activity_sequences_sequence_container_delete",
                                                    {
                                                        ns: "activity_sequences",
                                                    }
                                                )
                                        }
                                    >
                                        <span>
                                            <IconButton
                                                color="primary"
                                                size="small"
                                                className="toolbar-button"
                                                onClick={() =>
                                                    handleOpenDeleteModal(
                                                        selectedSequenceId
                                                    )
                                                }
                                                disabled={
                                                    selectedSequence?.is_default
                                                }
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                )}
                        </>
                    )}

                    {sequences.length === 0 && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ whiteSpace: "nowrap" }}
                        >
                            {t(
                                "messages.activity_sequences_sequence_container_no_sequences",
                                { ns: "activity_sequences" }
                            )}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Sequence Details Modal */}
            <SequenceDetailsModal
                isOpen={detailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                sequence={selectedSequence || null}
                category={category}
                onSave={fetchSequences}
                allSequences={sequences}
            />

            {/* Delete Confirmation Dialog */}
            <DeleteDialog
                isOpen={deleteConfirmation.isOpen}
                onClose={handleCloseDeleteModal}
                onConfirm={handleDeleteConfirmation}
                title={t(
                    "sections.activity_sequences_sequence_container_delete_sequence_title",
                    { ns: "activity_sequences" }
                )}
                description={
                    <Box sx={{ pt: 1 }}>
                        {sequenceUsage?.connectedCustomers &&
                            sequenceUsage.connectedCustomers.length > 0 ? (
                            <Typography variant="body1" sx={{ mb: 3, mt: 2 }}>
                                {t(
                                    "messages.activity_sequences_sequence_container_delete_confirmation",
                                    { ns: "activity_sequences" }
                                )}
                            </Typography>
                        ) : (
                            <Typography variant="body1" sx={{ mb: 3, mt: 2 }}>
                                {t(
                                    "messages.activity_sequences_sequence_container_delete_confirmation_simple",
                                    { ns: "activity_sequences" }
                                ) ||
                                    "Are you sure you want to delete this sequence?"}
                            </Typography>
                        )}

                        {sequenceUsage?.connectedCustomers &&
                            sequenceUsage.connectedCustomers.length > 0 && (
                                <FormControl
                                    fullWidth
                                    size="small"
                                    error={
                                        !!deleteError && !replacementSequenceId
                                    }
                                    sx={{ mb: 2 }}
                                >
                                    <InputLabel size="small">
                                        {t(
                                            "fields.activity_sequences_sequence_container_replacement_sequence",
                                            { ns: "activity_sequences" }
                                        )}{" "}
                                        *
                                    </InputLabel>
                                    <Select
                                        size="small"
                                        value={replacementSequenceId || ""}
                                        onChange={(e) => {
                                            setReplacementSequenceId(
                                                e.target.value as number
                                            );
                                            setDeleteError("");
                                        }}
                                        label={`${t("fields.activity_sequences_sequence_container_replacement_sequence", { ns: "activity_sequences" })} *`}
                                        dir={
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr"
                                        }
                                    >
                                        {sequences
                                            .filter(
                                                (seq) =>
                                                    seq.id !==
                                                    deleteConfirmation.id &&
                                                    seq.active
                                            )
                                            .map((sequence) => (
                                                <MenuItem
                                                    key={sequence.id}
                                                    value={sequence.id}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 1,
                                                            width: "100%",
                                                        }}
                                                    >
                                                        {sequence.is_default && (
                                                            <StarIcon
                                                                fontSize="small"
                                                                color="primary"
                                                            />
                                                        )}
                                                        <Typography
                                                            variant="body2"
                                                            sx={{ flex: 1 }}
                                                        >
                                                            {sequence.name}
                                                        </Typography>
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                    </Select>
                                    {deleteError && !replacementSequenceId && (
                                        <FormHelperText>
                                            {deleteError}
                                        </FormHelperText>
                                    )}
                                </FormControl>
                            )}

                        {deleteError && replacementSequenceId && (
                            <Typography
                                variant="body2"
                                color="error"
                                sx={{ mt: 1 }}
                            >
                                {deleteError}
                            </Typography>
                        )}
                    </Box>
                }
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={isDeleting}
                confirmDisabled={
                    !!(
                        sequenceUsage?.connectedCustomers &&
                        sequenceUsage.connectedCustomers.length > 0 &&
                        !replacementSequenceId
                    )
                }
                type="delete"
                maxWidth="sm"
                locale={i18n.language}
            />

            {/* Clone Modal */}
            <AppDialog
                open={cloneModal.isOpen}
                onClose={handleCloseCloneModal}
                drag
                align
                slide
                isRTL={isRTL}
                paperWidth="360px"
                paperMaxHeight="90vh"
                title={t(
                    "actions.activity_sequences_sequence_container_clone_sequence",
                    { ns: "activity_sequences" }
                )}
                titleIcon={<CloneIcon aria-hidden="true" />}
                ariaLabelledBy="clone-sequence-dialog-title"
                ariaDescribedBy="clone-sequence-dialog-description"
                actions={
                    <>
                        <Button
                            onClick={handleCloseCloneModal}
                            variant="outlined"
                            size="small"
                            className="cancel-button"
                            sx={{
                                mr: isRTL ? 0 : theme.spacing(1),
                                ml: isRTL ? theme.spacing(1) : 0,
                            }}
                        >
                            {t("actions.cancel", { ns: "common" })}
                        </Button>
                        <Button
                            onClick={handleCloneConfirmation}
                            variant="contained"
                            size="small"
                            className="save-button"
                            disabled={!cloneModal.name.trim()}
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                            }}
                        >
                            {t(
                                "actions.activity_sequences_sequence_container_clone",
                                { ns: "activity_sequences" }
                            )}
                        </Button>
                    </>
                }
            >
                <Typography
                        variant="body1"
                        sx={{
                            mb: 3,
                            mt: 2,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {t(
                            "messages.activity_sequences_sequence_container_clone_description",
                            { ns: "activity_sequences" }
                        )}
                    </Typography>

                    <TextField
                        fullWidth
                        label={t(
                            "fields.activity_sequences_sequence_container_sequence_name",
                            { ns: "activity_sequences" }
                        )}
                        value={cloneModal.name}
                        onChange={(e) =>
                            setCloneModal((prev) => ({
                                ...prev,
                                name: e.target.value,
                            }))
                        }
                        variant="outlined"
                        required
                        dir={i18n.language === "he" ? "rtl" : "ltr"}
                        sx={{
                            mb: 2,
                            "& .MuiInputBase-root": {
                                height: "40px",
                            },
                        }}
                    />
            </AppDialog>
        </>
    );
}
