"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    AutoAwesome,
    Category as CategoryIcon,
    Gavel,
    Person,
} from "@mui/icons-material";
import {
    Box,
    Button,
    Typography,
    useTheme,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

interface CustomerRow {
    id: number;
    collection_status?: "Active" | "Inactive";
    raw?: {
        CustomerCollectionPeriod?: Array<{
            id: number;
            current_category: string;
        }>;
        id?: number;
        current_category?: string | null;
        customer_id?: number;
        collection_period_id?: number;
        collection_status?: "Active" | "Inactive";
        [key: string]: any; // Allow additional properties for different page structures
    };
}

interface MassUpdateCategoryModalProps {
    isOpen: boolean;
    closeModal: () => void;
    selectedRows: CustomerRow[];
    onUpdateComplete: () => void;
    currentCategory?: string; // Optional: filter out this category from options
}

const MassUpdateCategoryModal: React.FC<MassUpdateCategoryModalProps> = ({
    isOpen,
    closeModal,
    selectedRows,
    onUpdateComplete,
    currentCategory,
}) => {
    const { t, i18n } = useTranslation(["customers", "activities", "common"]);
    const { showToast } = useToast();
    const theme = useTheme();
    const queryClient = useQueryClient();

    const isRTL = useMemo(() => i18n.language === "he", [i18n.language]);

    // Filter active customers (only explicitly "Inactive" are excluded)
    const activeRows = useMemo(() => {
        return selectedRows.filter((row) => {
            const collectionStatus =
                row.collection_status || row.raw?.collection_status;
            return collectionStatus !== "Inactive";
        });
    }, [selectedRows]);
    const inactiveCount = useMemo(
        () => selectedRows.length - activeRows.length,
        [selectedRows.length, activeRows.length]
    );

    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

    const extractCollectionPeriodData = useCallback(
        async (
            row: CustomerRow
        ): Promise<{
            customerId: number;
            collectionPeriodId: number;
            currentCategory: string;
        } | null> => {
            const raw = row.raw;

            // Try CustomerCollectionPeriod array structure (customers page)
            const collectionPeriod = row.raw?.CustomerCollectionPeriod?.[0];
            if (collectionPeriod?.id && collectionPeriod?.current_category) {
                return {
                    customerId: row.id,
                    collectionPeriodId: collectionPeriod.id,
                    currentCategory: collectionPeriod.current_category,
                };
            }

            // Try direct collection period structure (agents/legal pages)
            if (raw) {
                // Check if raw has collection_period_id (legal page structure)
                if (raw.collection_period_id && raw.current_category) {
                    return {
                        customerId: raw.customer_id || row.id,
                        collectionPeriodId: raw.collection_period_id,
                        currentCategory: raw.current_category,
                    };
                }

                // Check if raw has id and current_category (agents page structure - direct collection period)
                if (raw.id && raw.current_category) {
                    return {
                        customerId: raw.customer_id || row.id,
                        collectionPeriodId: raw.id,
                        currentCategory: raw.current_category,
                    };
                }

                // Fallback: If we have customer_id but missing collection period data, try to fetch it
                const customerId = raw.customer_id || row.id;
                if (
                    customerId &&
                    !raw.collection_period_id &&
                    !raw.current_category
                ) {
                    try {
                        const cpResponse = await apiFetch(`/api/entities/customers/${customerId}?include=collectionPeriod`
                        );
                        if (cpResponse.ok) {
                            const cpData = await cpResponse.json();
                            const fetchedCollectionPeriod =
                                cpData?.data?.CustomerCollectionPeriod?.[0] ||
                                cpData?.CustomerCollectionPeriod?.[0];
                            if (
                                fetchedCollectionPeriod?.id &&
                                fetchedCollectionPeriod?.current_category
                            ) {
                                return {
                                    customerId: customerId,
                                    collectionPeriodId:
                                        fetchedCollectionPeriod.id,
                                    currentCategory:
                                        fetchedCollectionPeriod.current_category,
                                };
                            }
                        }
                    } catch {
                        // Silently handle fetch errors
                    }
                }
            }

            return null;
        },
        []
    );

    const submitHandler = async () => {
        if (!selectedCategory) {
            showToast(
                t("messages.please_select_category", { ns: "activities" }),
                "error"
            );
            return;
        }

        if (selectedRows.length === 0) {
            showToast(
                t("messages.please_select_customers", { ns: "activities" }),
                "error"
            );
            return;
        }

        setIsLoading(true);
        try {
            // If all selected customers are inactive, return early
            if (activeRows.length === 0) {
                setIsLoading(false);
                return;
            }

            // If some customers are inactive but we have active ones, show info
            if (inactiveCount > 0) {
                showToast(
                    `${inactiveCount} inactive customer(s) ignored`,
                    "info"
                );
            }

            // Process rows sequentially to handle async fallback fetches
            const validCustomers: Array<{
                customerId: number;
                collectionPeriodId: number;
                currentCategory: string;
            }> = [];

            for (const row of activeRows) {
                const result = await extractCollectionPeriodData(row);
                if (result) {
                    validCustomers.push(result);
                }
            }

            if (validCustomers.length === 0) {
                showToast(
                    t("messages.mass_update_failed", { ns: "activities" }),
                    "error"
                );
                setIsLoading(false);
                return;
            }

            // Update categories for all valid customers
            const updatePromises = validCustomers.map(
                async ({ collectionPeriodId }) => {
                    try {
                        const response = await apiFetch(`/api/entities/customer-collection-period/${collectionPeriodId}`,
                            {
                                method: "PUT",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    current_category: selectedCategory,
                                    isManualCategoryChange: true,
                                    resetStepToZero:
                                        selectedCategory === "Automated",
                                }),
                            }
                        );

                        if (!response.ok) {
                            let errorData: { error?: string };
                            try {
                                errorData = await response.json();
                            } catch {
                                const text = await response.text();
                                errorData = {
                                    error:
                                        text ||
                                        `HTTP ${response.status}: ${response.statusText}`,
                                };
                            }

                            // Handle the case where category is already set
                            if (
                                errorData.error ===
                                "Category is already set to the requested value" ||
                                errorData.error?.includes(
                                    "already set to the requested value"
                                )
                            ) {
                                return { success: true, skipped: true };
                            }
                            throw new Error(
                                errorData.error ||
                                `Failed to update collection period ${collectionPeriodId}`
                            );
                        }

                        await response.json();
                        return { success: true, skipped: false };
                    } catch (error) {
                        return {
                            success: false,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        };
                    }
                }
            );

            const results = await Promise.all(updatePromises);

            const successCount = results.filter(
                (r) => r.success && !r.skipped
            ).length;
            const skippedCount = results.filter(
                (r) => r.success && r.skipped
            ).length;
            const failedCount = results.filter((r) => !r.success).length;
            const failedResults = results.filter((r) => !r.success);

            if (successCount === validCustomers.length) {
                const message =
                    inactiveCount > 0
                        ? `Successfully updated ${successCount} customer(s). ${inactiveCount} inactive customer(s) ignored.`
                        : t("messages.mass_update_success", {
                            count: successCount,
                            ns: "activities",
                        });
                showToast(message, "success");
            } else if (successCount > 0 || skippedCount > 0) {
                // Show appropriate message based on results
                if (
                    skippedCount > 0 &&
                    successCount === 0 &&
                    failedCount === 0
                ) {
                    // All were skipped (already set), none failed
                    const categoryKey = `values.category_${selectedCategory.toLowerCase().replace(/[_\s]/g, "_")}`;
                    const categoryLabel = t(categoryKey, { ns: "customers" });
                    showToast(
                        t("messages.category_already_set", {
                            category: categoryLabel,
                            ns: "activities",
                        }),
                        "info"
                    );
                } else if (
                    successCount > 0 &&
                    skippedCount > 0 &&
                    failedCount > 0
                ) {
                    // Some succeeded, some skipped, some failed
                    showToast(
                        t("messages.mass_update_partial_with_both", {
                            successCount,
                            totalCount: validCustomers.length,
                            skippedCount,
                            failedCount,
                            ns: "activities",
                        }),
                        "warning"
                    );
                } else if (successCount > 0 && skippedCount > 0) {
                    // Some succeeded, some skipped, none failed
                    showToast(
                        t("messages.mass_update_partial_with_skipped", {
                            successCount,
                            totalCount: validCustomers.length,
                            skippedCount,
                            ns: "activities",
                        }),
                        "warning"
                    );
                } else if (successCount > 0 && failedCount > 0) {
                    // Some succeeded, some failed, none skipped
                    showToast(
                        t("messages.mass_update_partial_success", {
                            successCount,
                            totalCount: validCustomers.length,
                            failedCount,
                            ns: "activities",
                        }),
                        "warning"
                    );
                } else {
                    showToast(
                        t("messages.mass_update_failed", { ns: "activities" }),
                        "error"
                    );
                }
            } else {
                // All failed
                const errorMessages = failedResults
                    .map((r) => r.error)
                    .filter(Boolean);

                // Show detailed error message if available
                const errorMessage =
                    errorMessages.length > 0
                        ? `${t("messages.mass_update_failed", { ns: "activities" })}: ${errorMessages[0]}`
                        : t("messages.mass_update_failed", {
                            ns: "activities",
                        });

                showToast(errorMessage, "error");
            }

            // Invalidate dashboard cache to reflect category changes in Collection Statistics
            queryClient.invalidateQueries({
                queryKey: ["dashboardData"],
            });
            queryClient.refetchQueries({
                queryKey: ["dashboardData"],
            });

            closeModal();
            setSelectedCategory("");
            onUpdateComplete();
        } catch {
            showToast(
                t("messages.unexpected_error", { ns: "customers" }),
                "error"
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleCategoryChange = useCallback((category: string) => {
        setSelectedCategory(category);
    }, []);

    const categories = useMemo(() => {
        const allCategories = ["Automated", "Agent", "Legal"];
        if (!currentCategory) return allCategories;
        return allCategories.filter((cat) => cat !== currentCategory);
    }, [currentCategory]);

    const getCategoryInfo = useCallback(
        (category: string) => {
            switch (category) {
                case "Automated":
                    return {
                        icon: <AutoAwesome sx={{ fontSize: 20 }} />,
                        description: t(
                            "values.category_automated_description",
                            {
                                ns: "customers",
                            }
                        ),
                        color: "primary" as const,
                    };
                case "Agent":
                    return {
                        icon: <Person sx={{ fontSize: 20 }} />,
                        description: t("values.category_agent_description", {
                            ns: "customers",
                        }),
                        color: "secondary" as const,
                    };
                case "Legal":
                    return {
                        icon: <Gavel sx={{ fontSize: 20 }} />,
                        description: t("values.category_legal_description", {
                            ns: "customers",
                        }),
                        color: "error" as const,
                    };
                default:
                    return {
                        icon: null,
                        description: "",
                        color: "default" as const,
                    };
            }
        },
        [t]
    );

    const handleClose = useCallback(() => {
        setSelectedCategory("");
        closeModal();
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement?.blur) {
            activeElement.blur();
        }
    }, [closeModal]);

    return (
        <AppDialog
            open={isOpen}
            onClose={handleClose}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="400px"
            paperMaxHeight="95vh"
            title={
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: theme.spacing(1),
                    }}
                >
                    <CategoryIcon aria-hidden="true" />
                    {t("actions.mass_update_category", { ns: "activities" })}
                </Box>
            }
            titleIcon={null}
            ariaLabelledBy="mass-update-category-modal-title"
            ariaDescribedBy="mass-update-category-modal-description"
            actions={
                <>
                    <Button
                        onClick={handleClose}
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
                        variant="contained"
                        size="small"
                        className="save-button"
                        onClick={submitHandler}
                        disabled={
                            isLoading ||
                            !selectedCategory ||
                            activeRows.length === 0
                        }
                        sx={{
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {t("actions.update", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <Box
                id="mass-update-category-modal-description"
                component="div"
                sx={{
                    p: 0,
                    direction: isRTL ? "rtl" : "ltr",
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "auto",
                }}
            >
                <Box
                    sx={{
                        p: 1,
                        direction: isRTL ? "rtl" : "ltr",
                    }}
                >
                    {inactiveCount > 0 && (
                        <Box
                            sx={{
                                p: 1.5,
                                mb: 1.5,
                                backgroundColor: "rgba(255, 152, 0, 0.1)",
                                borderRadius: 1,
                                border: "1px solid rgba(255, 152, 0, 0.3)",
                                direction: isRTL ? "rtl" : "ltr",
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: 500,
                                    color: "warning.main",
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                }}
                            >
                                {t(
                                    "messages.inactive_customers_will_be_ignored",
                                    { count: inactiveCount, ns: "activities" }
                                )}
                            </Typography>
                        </Box>
                    )}

                    <Box
                        sx={{
                            p: 2,
                            mb: 2,
                            backgroundColor: "rgba(107, 70, 193, 0.08)",
                            borderRadius: 1,
                            border: "1px solid rgba(107, 70, 193, 0.2)",
                            textAlign: "center",
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: 500,
                                color: "primary.main",
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "center",
                            }}
                        >
                            {t("values.category_change_impact", {
                                ns: "activities",
                            })}
                        </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{
                                mb: 1.5,
                                color: "text.primary",
                                fontWeight: 500,
                                textAlign: isRTL ? "right" : "left",
                                direction: isRTL ? "rtl" : "ltr",
                            }}
                        >
                            {t("fields.select_new_category", {
                                ns: "activities",
                            })}
                        </Typography>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                            }}
                        >
                            {categories.map((category) => {
                                const categoryInfo = getCategoryInfo(category);
                                const isSelected =
                                    selectedCategory === category;
                                return (
                                    <Box
                                        key={category}
                                        onClick={() =>
                                            handleCategoryChange(category)
                                        }
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 2,
                                            p: 1.5,
                                            borderRadius:
                                                theme.appButton.borderRadius,
                                            cursor: "pointer",
                                            border: "1px solid",
                                            borderColor: isSelected
                                                ? "primary.main"
                                                : "divider",
                                            backgroundColor: isSelected
                                                ? "rgba(107, 70, 193, 0.04)"
                                                : "transparent",
                                            transition: "all 0.2s ease-in-out",
                                            direction: isRTL ? "rtl" : "ltr",
                                            flexDirection: isRTL
                                                ? "row-reverse"
                                                : "row",
                                            "&:hover": {
                                                backgroundColor: isSelected
                                                    ? "rgba(107, 70, 193, 0.06)"
                                                    : "rgba(107, 70, 193, 0.02)",
                                                borderColor: "primary.main",
                                            },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                width: 24,
                                                height: 24,
                                                color: isSelected
                                                    ? "primary.main"
                                                    : "text.secondary",
                                            }}
                                        >
                                            {categoryInfo.icon}
                                        </Box>

                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontWeight: isSelected
                                                    ? 600
                                                    : 400,
                                                color: isSelected
                                                    ? "primary.main"
                                                    : "text.primary",
                                                flex: 1,
                                                textAlign: isRTL
                                                    ? "right"
                                                    : "left",
                                                direction: isRTL
                                                    ? "rtl"
                                                    : "ltr",
                                            }}
                                        >
                                            {t(
                                                `values.category_${category.toLowerCase().replace(/[_\s]/g, "_")}`,
                                                { ns: "customers" }
                                            )}
                                        </Typography>

                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: "50%",
                                                border: "2px solid",
                                                borderColor: isSelected
                                                    ? "primary.main"
                                                    : "divider",
                                                backgroundColor: isSelected
                                                    ? "primary.main"
                                                    : "transparent",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            {isSelected && (
                                                <Box
                                                    sx={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        backgroundColor:
                                                            "white",
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </AppDialog>
    );
};

export default MassUpdateCategoryModal;
