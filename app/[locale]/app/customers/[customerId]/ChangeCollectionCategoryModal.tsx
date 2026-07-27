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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

interface ChangeCollectionCategoryModalProps {
    isOpen: boolean;
    closeModal: () => void;
    customerId: number;
    currentCategory: string | null;
    CustomerCollectionPeriodId: number;
    refreshdata: () => void;
}

const ChangeCollectionCategoryModal: React.FC<
    ChangeCollectionCategoryModalProps
> = ({
    isOpen,
    closeModal,
    currentCategory,
    CustomerCollectionPeriodId,
    refreshdata,
    customerId: _customerId,
}) => {
        const { t, i18n } = useTranslation(["customers", "common"]);
        const { showToast } = useToast();
        const theme = useTheme();
        const queryClient = useQueryClient();
        const isRTL = i18n.language === "he";

        const [selectedCategory, setSelectedCategory] = useState<string>("");
        const [isLoading, setIsLoading] = useState(false);

        const submitHandler = async () => {
            if (!selectedCategory) {
                showToast(t("messages.please_select_category"), "error");
                return;
            }

            setIsLoading(true);
            try {
                const response = await apiFetch(`/api/entities/customer-collection-period/${CustomerCollectionPeriodId}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            current_category: selectedCategory,
                            // Add flag to indicate this is a manual category change from UI
                            isManualCategoryChange: true,
                            // Add flag to indicate if we need to reset step to 0
                            resetStepToZero: selectedCategory === "Automated", // Changed from "Agent" to "Automated"
                        }),
                    }
                );

                if (response.ok) {
                    await response.json();
                    showToast(
                        t("messages.category_updated_successfully"),
                        "success"
                    );

                    // Invalidate dashboard cache to reflect category changes in Collection Statistics
                    queryClient.invalidateQueries({
                        queryKey: ["dashboardData"],
                    });
                    // Also refetch if dashboard is currently active
                    queryClient.refetchQueries({
                        queryKey: ["dashboardData"],
                    });

                    closeModal();
                    refreshdata();
                } else {
                    const errorData = await response.json();

                    // Handle the case where category is already set to the requested value
                    if (
                        errorData.error ===
                        "Category is already set to the requested value" &&
                        errorData.current_category
                    ) {
                        const categoryKey = `values.category_${errorData.current_category.toLowerCase().replace(/[_\s]/g, "_")}`;
                        const categoryLabel = t(categoryKey);
                        showToast(
                            t("messages.category_already_set", {
                                category: categoryLabel,
                            }),
                            "info"
                        );
                        closeModal();
                    } else {
                        showToast(
                            errorData.error || t("messages.category_update_failed"),
                            "error"
                        );
                    }
                }
            } catch (error) {
                showToast(t("messages.unexpected_error"), "error");
            } finally {
                setIsLoading(false);
            }
        };

        const handleCategoryChange = useCallback((category: string) => {
            setSelectedCategory(category);
        }, []);

        const categories = useMemo(() => {
            return ["Automated", "Agent", "Legal"].filter(
                (category) => category !== currentCategory
            );
        }, [currentCategory]);

        const getCategoryInfo = useCallback((category: string) => {
            switch (category) {
                case "Automated":
                    return {
                        icon: <AutoAwesome sx={{ fontSize: 20 }} />,
                        description: t("values.category_automated_description"),
                        color: "primary" as const,
                    };
                case "Agent":
                    return {
                        icon: <Person sx={{ fontSize: 20 }} />,
                        description: t("values.category_agent_description"),
                        color: "secondary" as const,
                    };
                case "Legal":
                    return {
                        icon: <Gavel sx={{ fontSize: 20 }} />,
                        description: t("values.category_legal_description"),
                        color: "error" as const,
                    };
                default:
                    return {
                        icon: null,
                        description: "",
                        color: "default" as const,
                    };
            }
        }, [t]);




        return (
            <AppDialog
                open={isOpen}
                onClose={closeModal}
                drag
                align
                slide
                isRTL={isRTL}
                paperWidth="400px"
                paperMaxHeight="90vh"
                title={t("actions.change_category")}
                titleIcon={<CategoryIcon aria-hidden="true" />}
                ariaLabelledBy="change-category-modal-title"
                ariaDescribedBy="dialog-description"
                keepMounted
                disableEnforceFocus={false}
                disableAutoFocus={false}
                actions={
                    <>
                        <Button
                            onClick={closeModal}
                            variant="outlined"
                            size="small"
                            className="cancel-button"
                            fullWidth={false}
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
                            disabled={isLoading || !selectedCategory}
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
                    sx={{
                        p: 1.5,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {/* Current Category Info */}
                    <Box
                        sx={{
                            mb: 3,
                            textAlign: "center",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                mb: 1,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign: "center",
                            }}
                        >
                            {t("fields.current_category")}:
                        </Typography>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 700,
                                color: "primary.main",
                                fontSize: "1.1rem",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign: "center",
                            }}
                        >
                            {currentCategory
                                ? t(
                                      `values.category_${currentCategory
                                          .toLowerCase()
                                          .replace(/[\s]/g, "_")}`
                                  )
                                : t("values.days_overdue_n_a")}
                        </Typography>
                    </Box>

                    {/* Category Selection */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{
                                mb: 2,
                                color: "text.primary",
                                fontWeight: 500,
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {t("fields.select_new_category")}
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
                                            p: 2,
                                            borderRadius: 1,
                                            cursor: "pointer",
                                            border: "1px solid",
                                            borderColor: isSelected
                                                ? "primary.main"
                                                : "divider",
                                            backgroundColor: isSelected
                                                ? "rgba(107, 70, 193, 0.04)"
                                                : "transparent",
                                            transition: "all 0.2s ease-in-out",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            flexDirection:
                                                i18n.language === "he"
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
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {t(
                                                `values.category_${category.toLowerCase()}`
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

                    {/* Impact Note */}
                    <Box
                        sx={{
                            p: 2,
                            backgroundColor: "rgba(107, 70, 193, 0.02)",
                            borderRadius: 1,
                            border: "1px solid rgba(107, 70, 193, 0.08)",
                            textAlign: "center",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "center",
                            }}
                        >
                            {t("values.category_change_impact")}
                        </Typography>
                    </Box>
                </Box>
            </AppDialog>
        );
    };

export default ChangeCollectionCategoryModal;
