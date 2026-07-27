"use client";

import {
    AccountBalance as AccountBalanceIcon,
    AttachMoney as AttachMoneyIcon,
    Business as BusinessIcon,
    CurrencyExchange as CurrencyExchangeIcon,
    Description as DescriptionIcon,
    Gavel as GavelIcon,
    Person as PersonIcon,
    Security as SecurityIcon,
    Settings as SettingsIcon,
    Tune as TuneIcon,
} from "@mui/icons-material";
import {
    Box,
    Fade,
    Slide,
    Tab,
    Tabs,
    useTheme
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { BusinessUnits } from "@/app/[locale]/app/admin/accounts/[AccountId]/details/components/BusinessUnits";
import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import UserList from "@/shared/components/UserList";
import Seo from "@/shared/layout-components/seo/seo";

import { BankAccountList } from "./BankAccountList";
import { CreditInsuranceSettings } from "./CreditInsuranceSettings";
import { CurrencyRateSettingsList } from "./CurrencyRateSettingsList";
import DisputeSettings from "./DisputeSettings";
import { GenericFieldsList } from "./GenericFieldsList";
import SecurityRolesList from "./SecurityRolesList";
import TemplateSettings from "./TemplateSettings";

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, index, ...other } = props;

    // Only render the active tab to prevent all tabs from mounting simultaneously
    // Since we're now conditionally rendering at the parent level, this is just a wrapper
    return (
        <Box
            component="div"
            role="tabpanel"
            id={`settings-tabpanel-${index}`}
            aria-labelledby={`settings-tab-${index}`}
            sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                width: "100%",
            }}
            {...other}
        >
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    pt: 3,
                    pb: 0,
                    border: "none",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {children}
            </Box>
        </Box>
    );
}

function a11yProps(index: number) {
    return {
        id: `settings-tab-${index}`,
        "aria-controls": `settings-tabpanel-${index}`,
    };
}

function SettingsContent() {
    const { t, i18n } = useTranslation([
        "settings",
        "common",
        "security_roles",
    ]);
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const theme = useTheme();
    const accountId = session?.user?.account_id || 0;

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            accountId,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];

    const { data: accountProductsSettings } = useQuery<{
        has_credit_insurance?: boolean;
    }>({
        queryKey: ["account-products-settings", accountId],
        queryFn: async () => {
            const response = await api.get(
                `/api/entities/accounts/${accountId}`
            );
            return {
                has_credit_insurance:
                    response.data?.has_credit_insurance === true,
            };
        },
        enabled: !!accountId && !!session?.user,
        staleTime: 60 * 1000,
    });

    const hasCreditInsuranceProduct =
        accountProductsSettings?.has_credit_insurance === true;
    const canViewCreditInsurance =
        hasCreditInsuranceProduct &&
        (userPermissions.includes("view_settings") ||
            userPermissions.includes("update_insurance_policy"));

    // Permission checks for each tab - memoized for performance
    const permissionChecks = useMemo(() => {
        const hasViewSettingsPermission =
            userPermissions.includes("view_settings");
        // If user doesn't have view_settings permission, hide all tabs
        if (!hasViewSettingsPermission) {
            return {
                hasViewUsersPermission: false,
                hasViewBusinessUnitsPermission: false,
                hasManageBusinessUnitsPermission: false,
                hasViewSettingsPermission: false,
                hasViewRolesPermission: false,
                hasViewTemplatesPermission: false,
                hasViewBanksPermission: false,
                canViewBusinessUnits: false,
                canViewSecurityRoles: false,
            };
        }

        const hasViewUsersPermission = userPermissions.includes("view_users");
        const hasViewBusinessUnitsPermission = userPermissions.includes(
            "view_business_units"
        );
        const hasManageBusinessUnitsPermission = userPermissions.includes(
            "manage_business_units"
        );
        const hasViewRolesPermission = userPermissions.includes("view_roles");
        const hasViewTemplatesPermission =
            userPermissions.includes("view_templates");
        const hasViewBanksPermission = userPermissions.includes("view_banks");

        return {
            hasViewUsersPermission,
            hasViewBusinessUnitsPermission,
            hasManageBusinessUnitsPermission,
            hasViewSettingsPermission,
            hasViewRolesPermission,
            hasViewTemplatesPermission,
            hasViewBanksPermission,
            canViewBusinessUnits: hasViewBusinessUnitsPermission, // Only show tab if user has view_business_units permission
            canViewSecurityRoles: hasViewRolesPermission,
        };
    }, [userPermissions]);

    const {
        hasViewUsersPermission,
        canViewBusinessUnits,
        canViewSecurityRoles,
        hasViewSettingsPermission,
        hasViewRolesPermission,
        hasViewTemplatesPermission,
        hasViewBanksPermission,
    } = permissionChecks;

    // Map logical tab indices to actual rendered tab indices
    // Logical indices: users=0, security_roles=1, businessUnits=2, bankAccounts=3, dispute=4, templates=5
    // Actual indices depend on which tabs are visible
    const getTabMapping = useMemo(() => {
        const mapping: { logical: number; actual: number }[] = [];
        let actualIndex = 0;

        // Tab 0: Users (always visible if hasViewUsersPermission)
        if (hasViewUsersPermission) {
            mapping.push({ logical: 0, actual: actualIndex++ });
        }

        // Tab 1: Security Roles (only if canViewSecurityRoles)
        if (canViewSecurityRoles) {
            mapping.push({ logical: 1, actual: actualIndex++ });
        }

        // Tab 2: Business Units (only if canViewBusinessUnits)
        if (canViewBusinessUnits) {
            mapping.push({ logical: 2, actual: actualIndex++ });
        }

        // Tab 3: Bank Accounts (only if hasViewBanksPermission)
        if (hasViewBanksPermission) {
            mapping.push({ logical: 3, actual: actualIndex++ });
        }

        // Tab 4: Dispute (only if hasViewTemplatesPermission)
        if (hasViewTemplatesPermission) {
            mapping.push({ logical: 4, actual: actualIndex++ });
        }

        // Tab 5: Templates (only if hasViewTemplatesPermission)
        if (hasViewTemplatesPermission) {
            mapping.push({ logical: 5, actual: actualIndex++ });
        }

        // Tab 6: Generic Fields (only if hasViewSettingsPermission)
        if (hasViewSettingsPermission) {
            mapping.push({ logical: 6, actual: actualIndex++ });
        }

        if (canViewCreditInsurance) {
            mapping.push({ logical: 7, actual: actualIndex++ });
        }
        if (canViewCreditInsurance) {
            mapping.push({ logical: 8, actual: actualIndex++ });
        }

        return mapping;
    }, [
        hasViewUsersPermission,
        canViewBusinessUnits,
        hasViewSettingsPermission,
        canViewSecurityRoles,
        hasViewRolesPermission,
        hasViewTemplatesPermission,
        hasViewBanksPermission,
        canViewCreditInsurance,
    ]);

    // Convert logical tab index to actual rendered tab index
    const logicalToActual = useCallback(
        (logicalIndex: number): number => {
            const mapping = getTabMapping.find(
                (m) => m.logical === logicalIndex
            );
            return mapping ? mapping.actual : 0; // Default to 0 if not found
        },
        [getTabMapping]
    );

    // Convert actual rendered tab index to logical tab index
    const actualToLogical = useCallback(
        (actualIndex: number): number => {
            const mapping = getTabMapping.find((m) => m.actual === actualIndex);
            return mapping ? mapping.logical : 0; // Default to 0 if not found
        },
        [getTabMapping]
    );

    // Initialize value from URL parameter
    const getInitialTabValue = useCallback(() => {
        // Default to 0 (first visible tab) - will be adjusted when permissions load
        return 0;
    }, []);

    const [value, setValue] = useState(0);

    // Ensure value is always valid when permissions change
    useEffect(() => {
        // Only validate if we have a valid mapping
        if (getTabMapping.length === 0) {
            return;
        }

        const logicalIndex = actualToLogical(value);
        // If the current value maps to an invalid logical index or the tab is not accessible, reset to tab 0
        if (logicalIndex === 0 && !hasViewUsersPermission) {
            // Find first available tab
            const firstTab = getTabMapping[0];
            if (firstTab) {
                setValue(firstTab.actual);
            }
        } else if (logicalIndex === 1 && !canViewSecurityRoles) {
            setValue(logicalToActual(0));
        } else if (logicalIndex === 2 && !canViewBusinessUnits) {
            setValue(logicalToActual(0));
        } else if (!getTabMapping.find((m) => m.actual === value)) {
            // If value doesn't map to any visible tab, reset to first available tab
            const firstTab = getTabMapping[0];
            if (firstTab) {
                setValue(firstTab.actual);
            }
        }
    }, [
        value,
        hasViewUsersPermission,
        canViewBusinessUnits,
        canViewSecurityRoles,
        actualToLogical,
        logicalToActual,
        getTabMapping,
    ]);

    // Handle tab parameter from URL
    useEffect(() => {
        // If user only has view_users permission, restrict to users tab
        if (
            hasViewUsersPermission &&
            !canViewBusinessUnits &&
            !canViewSecurityRoles
        ) {
            setValue(logicalToActual(0));
            return;
        }
        // For users with permissions, allow all accessible tabs
        if (searchParams) {
            const tabParam = searchParams.get("tab");
            if (tabParam) {
                const tabIndexMap: Record<string, number> = {
                    users: 0,
                    security_roles: 1,
                    roles: 1, // Alias for security_roles
                    businessUnits: 2,
                    bankAccounts: 3,
                    "dispute-reason": 4,
                    dispute: 4, // Legacy alias for backward compatibility
                    templates: 5,
                    genericFields: 6,
                    creditInsurance: 7,
                    currencyRate: 8,
                };

                // Handle promiseToPay tab - redirect to templates with promiseToPay sub-tab
                if (tabParam === "promiseToPay") {
                    const currentPath = pathname || "/app/settings";
                    router.replace(
                        `${currentPath}?tab=templates&templateType=promiseToPay`,
                        { scroll: false }
                    );
                    return;
                }

                const logicalIndex = tabIndexMap[tabParam];
                if (logicalIndex !== undefined) {
                    // Validate tab access based on permissions
                    if (logicalIndex === 0 && !hasViewUsersPermission) {
                        // Find first available tab
                        const firstTab = getTabMapping[0];
                        if (firstTab) {
                            setValue(firstTab.actual);
                        }
                        return;
                    }
                    if (logicalIndex === 1 && !canViewSecurityRoles) {
                        setValue(logicalToActual(0));
                        return;
                    }
                    if (logicalIndex === 2 && !canViewBusinessUnits) {
                        setValue(logicalToActual(0));
                        return;
                    }
                    setValue(logicalToActual(logicalIndex));
                }
            }
        }
    }, [
        searchParams,
        pathname,
        router,
        hasViewUsersPermission,
        canViewBusinessUnits,
        canViewSecurityRoles,
        logicalToActual,
        getTabMapping,
    ]);

    const handleChange = useCallback(
        (event: React.SyntheticEvent, newValue: number) => {
            // newValue is the actual rendered tab index, convert to logical index
            const logicalIndex = actualToLogical(newValue);

            // Validate tab access based on permissions
            if (logicalIndex === 0 && !hasViewUsersPermission) {
                return;
            }
            if (logicalIndex === 1 && !canViewSecurityRoles) {
                return;
            }
            if (logicalIndex === 2 && !canViewBusinessUnits) {
                return;
            }
            // If user only has view_users permission, restrict to users tab
            if (
                hasViewUsersPermission &&
                !canViewBusinessUnits &&
                !canViewSecurityRoles &&
                logicalIndex !== 0
            ) {
                return;
            }

            // Allow tab change for users with appropriate permissions
            setValue(newValue);

            // Update URL with the selected tab
            // Logical indices: users=0, security_roles=1, businessUnits=2, bankAccounts=3, dispute=4, templates=5, genericFields=6, creditInsurance=7, currencyRate=8
            const tabNames = [
                "users",
                "security_roles",
                "businessUnits",
                "bankAccounts",
                "dispute-reason",
                "templates",
                "genericFields",
                "creditInsurance",
                "currencyRate",
            ];
            const selectedTab = tabNames[logicalIndex];
            if (selectedTab) {
                const currentPath = pathname || "/app/settings";
                // Use replace instead of push to avoid adding to history and prevent full page refresh
                router.replace(`${currentPath}?tab=${selectedTab}`, {
                    scroll: false,
                });
            }
        },
        [
            router,
            pathname,
            hasViewUsersPermission,
            canViewBusinessUnits,
            canViewSecurityRoles,
            actualToLogical,
        ]
    );

    // accountId is already declared above (line 73) - use it directly

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
            }}
        >
            <Seo title={t("fields.title")} />

            <PageHeader
                title={t("fields.title")}
                description={t("fields.description")}
            />

            {/* Content Container - Exact same structure as AccountList */}
            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    overflow: "hidden",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                {/* Tabs Section */}
                <Tabs
                    value={value}
                    onChange={handleChange}
                    aria-label="settings tabs"
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{
                        px: 2,
                        flexShrink: 0,
                        minHeight: "unset",
                        "& .MuiTabs-indicator": {
                            height: 2,
                            borderRadius: `${theme.shape.borderRadius} ${theme.shape.borderRadius} 0 0`,
                            backgroundColor: theme.palette.primary.main,
                        },
                        "& .MuiTab-root": {
                            textTransform: "none",
                            fontWeight: 500,
                            minWidth: 120,
                            py: 1,
                            px: { xs: 1.5, sm: 2 },
                            minHeight: "unset",
                            height: theme.spacing(5),
                            color: "text.secondary",
                            transition: theme.transitions.create(["all"], {
                                duration: theme.transitions.duration.short,
                                easing: theme.transitions.easing.easeInOut,
                            }),
                            "&:hover": {
                                color: theme.palette.primary.main,
                                backgroundColor: theme.palette.action.hover,
                            },
                            "&.Mui-selected": {
                                color: theme.palette.primary.main,
                                fontWeight: 600,
                            },
                            "& .MuiSvgIcon-root": {
                                fontSize: "1.1rem",
                                mb: 0.25,
                            },
                        },
                    }}
                >
                    {/* Only show Users tab if user has view_users permission */}
                    {hasViewUsersPermission && (
                        <Tab
                            label={t("fields.tab_users").toUpperCase()}
                            {...a11yProps(0)}
                            icon={
                                <PersonIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {/* Security Roles tab - show if user has view_settings permission */}
                    {canViewSecurityRoles && (
                        <Tab
                            label={t("fields.tab_roles", {
                                ns: "security_roles",
                            }).toUpperCase()}
                            {...a11yProps(1)}
                            disabled={false}
                            icon={
                                <SecurityIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {/* Only show Business Unit tab if user has permission */}
                    {canViewBusinessUnits && (
                        <Tab
                            label={t("fields.tab_business_units").toUpperCase()}
                            {...a11yProps(2)}
                            icon={
                                <BusinessIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {/* Bank Accounts tab - show if user has view_banks permission */}
                    {hasViewBanksPermission && (
                        <Tab
                            label={t("fields.tab_bank_accounts").toUpperCase()}
                            {...a11yProps(3)}
                            disabled={false}
                            icon={
                                <AccountBalanceIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {/* Dispute tab - show if user has view_templates permission */}
                    {hasViewTemplatesPermission && (
                        <Tab
                            label={t("fields.tab_dispute_reason").toUpperCase()}
                            {...a11yProps(4)}
                            disabled={false}
                            icon={
                                <GavelIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {/* Templates tab - show if user has view_templates permission */}
                    {hasViewTemplatesPermission && (
                        <Tab
                            label={t(
                                "fields.tab_activity_templates"
                            ).toUpperCase()}
                            {...a11yProps(5)}
                            disabled={false}
                            icon={
                                <DescriptionIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {/* Generic Fields tab - show if user has view_settings permission */}
                    {hasViewSettingsPermission && (
                        <Tab
                            label={t(
                                "fields.tab_generic_fields",
                                "Generic Fields"
                            ).toUpperCase()}
                            {...a11yProps(6)}
                            disabled={false}
                            icon={
                                <TuneIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {canViewCreditInsurance && (
                        <Tab
                            label={t("fields.tab_credit_insurance").toUpperCase()}
                            {...a11yProps(7)}
                            icon={
                                <AttachMoneyIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                    {canViewCreditInsurance && (
                        <Tab
                            label={t("fields.tab_currency_rate").toUpperCase()}
                            {...a11yProps(8)}
                            icon={
                                <CurrencyExchangeIcon
                                    sx={{
                                        mb: 0.5,
                                        mr: i18n.language === "he" ? 0 : 1,
                                        ml: i18n.language === "he" ? 1 : 0,
                                    }}
                                />
                            }
                            iconPosition="start"
                        />
                    )}
                </Tabs>

                {/* Tab Content */}
                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0,
                        position: "relative",
                        border: "none",
                    }}
                >
                    {(() => {
                        const logicalIndex = actualToLogical(value);
                        return (
                            <>
                                {/* Users tab content - show if user has permission */}
                                {hasViewUsersPermission &&
                                    logicalIndex === 0 && (
                                        <TabPanel value={value} index={value}>
                                            <UserList
                                                variant="standalone"
                                                showDescription={false}
                                                height="100%"
                                            />
                                        </TabPanel>
                                    )}
                                {/* Security Roles tab content - show if user has permission */}
                                {canViewSecurityRoles && logicalIndex === 1 && (
                                    <TabPanel value={value} index={value}>
                                        <SecurityRolesList />
                                    </TabPanel>
                                )}
                                {/* Business Unit tab content - show if user has permission */}
                                {canViewBusinessUnits && logicalIndex === 2 && (
                                    <TabPanel value={value} index={value}>
                                        <BusinessUnits accountId={accountId} />
                                    </TabPanel>
                                )}
                                {/* Other tab content - show based on permissions */}
                                {logicalIndex === 3 &&
                                    hasViewBanksPermission && (
                                        <TabPanel value={value} index={value}>
                                            <BankAccountList
                                                accountId={accountId}
                                            />
                                        </TabPanel>
                                    )}
                                {logicalIndex === 4 &&
                                    hasViewTemplatesPermission && (
                                        <TabPanel value={value} index={value}>
                                            <DisputeSettings />
                                        </TabPanel>
                                    )}
                                {logicalIndex === 5 &&
                                    hasViewTemplatesPermission && (
                                        <TabPanel value={value} index={value}>
                                            <TemplateSettings />
                                        </TabPanel>
                                    )}
                                {logicalIndex === 6 &&
                                    hasViewSettingsPermission && (
                                        <TabPanel value={value} index={value}>
                                            <GenericFieldsList
                                                accountId={accountId}
                                            />
                                        </TabPanel>
                                    )}
                                {logicalIndex === 7 && canViewCreditInsurance && (
                                    <TabPanel value={value} index={value}>
                                        <CreditInsuranceSettings
                                            accountId={accountId}
                                            canEdit={userPermissions.includes(
                                                "update_insurance_policy"
                                            )}
                                        />
                                    </TabPanel>
                                )}
                                {logicalIndex === 8 && canViewCreditInsurance && (
                                    <TabPanel value={value} index={value}>
                                        <CurrencyRateSettingsList />
                                    </TabPanel>
                                )}
                            </>
                        );
                    })()}
                </Box>
            </Box>
        </Box>
    );
}

export default function SettingsPage() {
    return (
        <InternalPageWrapper>
            <Fade in timeout={800}>
                <Box
                    sx={{
                        background: "transparent",
                        borderRadius: 3,
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0,
                    }}
                >
                    <Slide direction="up" in timeout={800}>
                        <Box
                            sx={{
                                background: "transparent",
                                borderRadius: 3,
                                position: "relative",
                                display: "flex",
                                flexDirection: "column",
                                minHeight: 0,
                            }}
                        >
                            <SettingsContent />
                        </Box>
                    </Slide>
                </Box>
            </Fade>
        </InternalPageWrapper>
    );
}
