"use client";

import {
    AutoAwesome as AutomatedIcon,
    Gavel as DisputeIcon,
    Handshake as PromiseToPayIcon,
    ViewList as ViewListIcon,
} from "@mui/icons-material";
import { Box, Tab, Tabs } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import Seo from "@/shared/layout-components/seo/seo";
import { CategoryType } from "@/types/enums";
import { SequenceContainer } from "@/types/SequenceContainer";

import BaseActivitySequenceList from "./components/BaseActivitySequenceList";
import SequenceSelector from "./components/SequenceSelector";

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel = React.memo<TabPanelProps>(
    ({ children, value, index, ...other }) => (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`activity-sequence-tabpanel-${index}`}
            aria-labelledby={`activity-sequence-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ height: "100%", width: "100%", py: 2 }}>
                    {children}
                </Box>
            )}
        </div>
    )
);
TabPanel.displayName = "TabPanel";

export default function ActivitySequencesPage() {
    const { t, i18n } = useTranslation(["common", "activity_sequences"]);
    const theme = useTheme();
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [value, setValue] = useState(0);

    // State for selected sequences per category
    const [selectedSequences, setSelectedSequences] = useState<
        Record<CategoryType, number | null>
    >({
        Automated: null,
        Promise_to_pay: null,
        Dispute: null,
        Agent: null,
        Legal: null,
    });

    // State to trigger add activity sequence modal
    const [triggerAddActivitySequence, setTriggerAddActivitySequence] =
        useState<{
            category: CategoryType | null;
            timestamp: number;
        }>({ category: null, timestamp: 0 });

    const accountId = session?.user?.account_id?.toString() || "";

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
        ],
        queryFn: async () => {
            const response = await api.get("/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        refetchOnWindowFocus: false, // Prevent refetch on tab focus to avoid list refresh
    });

    const userPermissions = userPermissionsData?.permissions || [];

    // Permission checks for activity sequences management
    const hasManageActivitySequencePermission = userPermissions.includes(
        "manage_activity_sequence"
    );

    // Permission checks for sequence containers management
    const hasManageSequenceContainerPermission = userPermissions.includes(
        "manage_sequence_container"
    );

    // User can manage if they have the manage permission
    const canManage = hasManageActivitySequencePermission;

    // Handle tab parameter from URL
    useEffect(() => {
        if (searchParams) {
            const tabParam = searchParams.get("tab");
            if (tabParam) {
                const tabIndexMap: Record<string, number> = {
                    automated: 0,
                    "promise-to-pay": 1,
                    dispute: 2,
                };
                const tabIndex = tabIndexMap[tabParam];
                if (tabIndex !== undefined) {
                    setValue(tabIndex);
                }
            }
        }
    }, [searchParams]);

    // Memoized handlers
    const handleSequenceChange = useCallback(
        (category: CategoryType, sequenceId: number | null) => {
            setSelectedSequences((prev) => ({
                ...prev,
                [category]: sequenceId,
            }));
        },
        []
    );

    // Create stable callback for each category
    const handleAutomatedSequenceChange = useCallback(
        (sequenceId: number | null) => {
            handleSequenceChange("Automated", sequenceId);
        },
        [handleSequenceChange]
    );

    const handlePromiseToPaySequenceChange = useCallback(
        (sequenceId: number | null) => {
            handleSequenceChange("Promise_to_pay", sequenceId);
        },
        [handleSequenceChange]
    );

    const handleDisputeSequenceChange = useCallback(
        (sequenceId: number | null) => {
            handleSequenceChange("Dispute", sequenceId);
        },
        [handleSequenceChange]
    );

    const fetchSequencesForCategory = useCallback(
        async (category: CategoryType) => {
            try {
                const response = await api.get(
                    `/sequenceContainers?category=${category}&includeInactive=true`
                );
                if (response.data?.data) {
                    // If no sequence is selected, select the default one
                    setSelectedSequences((prev) => {
                        if (!prev[category] && response.data.data.length > 0) {
                            const defaultSequence = response.data.data.find(
                                (seq: SequenceContainer) => seq.is_default
                            );
                            const sequenceId = defaultSequence
                                ? defaultSequence.id
                                : response.data.data[0].id;
                            return {
                                ...prev,
                                [category]: sequenceId,
                            };
                        }
                        return prev;
                    });
                }
            } catch {
                // Error handling can be added here if needed
            }
        },
        []
    );

    // Load sequences for all categories on mount; batch into a single state update to avoid multiple re-renders
    useEffect(() => {
        if (!accountId) return;

        let cancelled = false;
        const categories: CategoryType[] = [
            "Automated",
            "Promise_to_pay",
            "Dispute",
        ];

        Promise.all(
            categories.map(async (category: CategoryType) => {
                try {
                    const response = await api.get(
                        `/sequenceContainers?category=${category}&includeInactive=true`
                    );
                    const data = response.data?.data;
                    if (!data?.length) return { category, id: null as number | null };
                    const defaultSequence = data.find(
                        (seq: SequenceContainer) => seq.is_default
                    );
                    const sequenceId = defaultSequence
                        ? defaultSequence.id
                        : data[0].id;
                    return { category, id: sequenceId };
                } catch {
                    return { category, id: null as number | null };
                }
            })
        ).then((results) => {
            if (cancelled) return;
            setSelectedSequences((prev) => {
                const next = { ...prev };
                results.forEach(({ category, id }) => {
                    if (id != null && !prev[category]) next[category] = id;
                });
                return next;
            });
        });

        return () => {
            cancelled = true;
        };
    }, [accountId]);

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);

        // Clear any pending add-sequence trigger to avoid re-opening on tab switch
        setTriggerAddActivitySequence({ category: null, timestamp: 0 });

        const tabNames = ["automated", "promise-to-pay", "dispute"];
        const selectedTab = tabNames[newValue];
        if (selectedTab) {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set("tab", selectedTab);
            router.push(currentUrl.toString(), { scroll: false });
        }
    };

    const handleCreateSequence = useCallback(
        (sequenceId: number) => {
            const currentCategory = getCategoryForTab(value);
            handleSequenceChange(currentCategory, sequenceId);
            fetchSequencesForCategory(currentCategory);
        },
        [value, handleSequenceChange, fetchSequencesForCategory]
    );

    // Memoized a11y props function
    const a11yProps = (index: number) => ({
        id: `activity-sequence-tab-${index}`,
        "aria-controls": `activity-sequence-tabpanel-${index}`,
    });

    // Memoized category mapping
    const getCategoryForTab = (tabIndex: number): CategoryType => {
        const categoryMap: Record<number, CategoryType> = {
            0: "Automated",
            1: "Promise_to_pay",
            2: "Dispute",
        };
        return categoryMap[tabIndex] || "Automated";
    };

    const handleAddActivitySequence = useCallback((category: CategoryType) => {
        setTriggerAddActivitySequence({
            category,
            timestamp: Date.now(),
        });
    }, []);

    // Memoized tab configuration
    const tabConfig = useMemo(
        () => [
            {
                label: t("values.activity_sequences_automated", {
                    ns: "activity_sequences",
                }).toUpperCase(),
                icon: (
                    <AutomatedIcon
                        sx={{
                            mb: 0.5,
                            mr: i18n.language === "he" ? 0 : 1,
                            ml: i18n.language === "he" ? 1 : 0,
                        }}
                    />
                ),
                category: "Automated" as CategoryType,
            },
            {
                label: t("values.activity_sequences_promise_to_pay", {
                    ns: "activity_sequences",
                }).toUpperCase(),
                icon: (
                    <PromiseToPayIcon
                        sx={{
                            mb: 0.5,
                            mr: i18n.language === "he" ? 0 : 1,
                            ml: i18n.language === "he" ? 1 : 0,
                        }}
                    />
                ),
                category: "Promise_to_pay" as CategoryType,
            },
            {
                label: t("values.activity_sequences_dispute", {
                    ns: "activity_sequences",
                }).toUpperCase(),
                icon: (
                    <DisputeIcon
                        sx={{
                            mb: 0.5,
                            mr: i18n.language === "he" ? 0 : 1,
                            ml: i18n.language === "he" ? 1 : 0,
                        }}
                    />
                ),
                category: "Dispute" as CategoryType,
            },
        ],
        [t, i18n.language]
    );

    return (
        <>
            <Seo
                title={t("sections.activity_sequences_title", {
                    ns: "activity_sequences",
                })}
            />
            <InternalPageWrapper>
                <Box sx={{ bgcolor: "background.default", borderRadius: 2 }}>
                    {/* Header Section with Title and Subtitle */}
                    <PageHeader
                        title={t("sections.activity_sequences_title", {
                            ns: "activity_sequences",
                        })}
                        description={t(
                            "sections.activity_sequences_description",
                            { ns: "activity_sequences" }
                        )}
                    />

                    {/* Tabs Section */}
                    <Box
                        sx={{
                            borderBottom: 1,
                            borderColor: "divider",
                            bgcolor: "background.paper",
                            borderRadius: "8px 8px 0 0",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                            mb: 2,
                        }}
                    >
                        <Tabs
                            value={value}
                            onChange={handleChange}
                            aria-label="activity sequence tabs"
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{
                                px: 2,
                                minHeight: "unset",
                                "& .MuiTabs-indicator": {
                                    height: 2,
                                    borderRadius: "3px 3px 0 0",
                                    backgroundColor: "primary.main",
                                },
                                "& .MuiTab-root": {
                                    textTransform: "none",
                                    fontWeight: 500,
                                    minWidth: 120,
                                    py: 1,
                                    px: { xs: 1.5, sm: 2 },
                                    minHeight: "unset",
                                    height: "40px",
                                    color: "text.secondary",
                                    transition: "all 0.2s ease-in-out",
                                    "&:hover": {
                                        color: "primary.main",
                                        backgroundColor: "action.hover",
                                    },
                                    "&.Mui-selected": {
                                        color: "primary.main",
                                        fontWeight: 600,
                                    },
                                    "& .MuiSvgIcon-root": {
                                        fontSize: "1.1rem",
                                        mb: 0.25,
                                    },
                                },
                            }}
                        >
                            {tabConfig.map((tab, index) => (
                                <Tab
                                    key={tab.category}
                                    label={tab.label}
                                    {...a11yProps(index)}
                                    icon={tab.icon}
                                    iconPosition="start"
                                />
                            ))}
                        </Tabs>
                    </Box>

                    {/* Tab Content */}
                    <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
                        {tabConfig.map(
                            (tab, index) =>
                                value === index && (
                                    <TabPanel
                                        key={tab.category}
                                        value={value}
                                        index={index}
                                    >
                                        <SequenceSelector
                                            category={tab.category}
                                            accountId={accountId}
                                            selectedSequenceId={
                                                selectedSequences[tab.category]
                                            }
                                            onSequenceChange={
                                                tab.category === "Automated"
                                                    ? handleAutomatedSequenceChange
                                                    : tab.category ===
                                                        "Promise_to_pay"
                                                        ? handlePromiseToPaySequenceChange
                                                        : handleDisputeSequenceChange
                                            }
                                            onCloneSequence={
                                                tab.category === "Automated"
                                                    ? (sequenceId) =>
                                                        handleCreateSequence(
                                                            sequenceId
                                                        )
                                                    : undefined
                                            }
                                            onAddActivitySequence={() =>
                                                handleAddActivitySequence(
                                                    tab.category
                                                )
                                            }
                                            canManage={canManage}
                                            canCreate={
                                                hasManageActivitySequencePermission
                                            }
                                            canCloneSequenceContainer={
                                                hasManageSequenceContainerPermission
                                            }
                                            canEditSequenceContainer={
                                                hasManageSequenceContainerPermission
                                            }
                                            canDeleteSequenceContainer={
                                                hasManageSequenceContainerPermission
                                            }
                                        />
                                        <BaseActivitySequenceList
                                            accountId={accountId}
                                            category={tab.category}
                                            selectedSequenceId={
                                                selectedSequences[tab.category]
                                            }
                                            onSequenceChange={
                                                tab.category === "Automated"
                                                    ? handleAutomatedSequenceChange
                                                    : tab.category ===
                                                        "Promise_to_pay"
                                                        ? handlePromiseToPaySequenceChange
                                                        : handleDisputeSequenceChange
                                            }
                                            triggerAddActivitySequence={
                                                triggerAddActivitySequence
                                            }
                                            canManage={canManage}
                                            canCreate={
                                                hasManageActivitySequencePermission
                                            }
                                            canEdit={
                                                hasManageActivitySequencePermission
                                            }
                                            canDelete={
                                                hasManageActivitySequencePermission
                                            }
                                            primaryColor={session?.user?.primary_color}
                                            secondaryColor={session?.user?.secondary_color}
                                        />
                                    </TabPanel>
                                )
                        )}
                    </Box>
                </Box>
            </InternalPageWrapper>
        </>
    );
}
