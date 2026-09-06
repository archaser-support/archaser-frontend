"use client";

import {
    Dashboard as DashboardIcon,
    History as HistoryIcon,
    InfoOutlined as InfoOutlinedIcon,
    Receipt as ReceiptIcon,
    ShieldOutlined as ShieldOutlinedIcon,
    TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import {
    Badge,
    Box,
    Button,
    Tab,
    Tabs,
    Typography,
    useTheme,
} from "@mui/material";
import Slide from "@mui/material/Slide";
import { alpha } from "@mui/material/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
    startTransition,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import AccessDenied from "@/components/AccessDenied";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    fetchCountriesFromApi,
    fetchStatesFromApi,
} from "@/shared/redux/action";
import { useAppDispatch, useAppSelector } from "@/shared/redux/hooks";
import {
    applyEffectivePolicyFieldsToCustomer,
    buildCustomerPutPayload,
    getEffectivePolicyId,
} from "@/shared/customerPolicyAdapter";
import {
    isAllowedPolicyExclusionReason,
    normalizePolicyExclusionReason,
} from "@/shared/creditInsurance/policyExclusion";
import {
    validateMonthEndCutoffFormFields,
    type MonthEndCutoffValidationErrorCode,
} from "@/shared/creditInsurance/monthEndCutoffFields";
import { resolveCustomerDetailDashboardUx } from "@/shared/customerDetailDashboardUx";
import { fetchCustomerById } from "@/shared/services/customerService";
import { Customer } from "@/types/Customer";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import AppUrls from "@/utils/appUrls";
import { getCustomerDisplayName } from "@/utils/customerDisplayName";
import { mergeWithDefaults } from "@/utils/genericFieldUtils";

import CustomerAddressInfo from "./CustomerAddressInfo";
import CustomerBanksList from "./CustomerBanksList";
import CustomerContactList from "./CustomerContactList";
import CustomerCreditInsuranceInfo from "./CustomerCreditInsuranceInfo";
import CustomerDashboardCards from "./CustomerDashboardCards";
import CustomerGeneralInfo from "./CustomerGeneralInfo";
import CustomerHeader from "./CustomerHeader";

interface CustomerIdProps {
    customerId: string;
}

interface CustomerIdPropsLegacy {
    customer_id: string;
}

type CustomerDetailsWrapperProps = CustomerIdProps | CustomerIdPropsLegacy;

const TAB_DASHBOARD = 0;
const TAB_ACTIVITIES = 1;
const TAB_GENERAL = 2;
const TAB_INVOICES = 3;
const TAB_POLICIES = 4;
const TAB_AGGREGATED_DATA = 5;

function activeTabToMuiTabsValue(
    activeTab: number,
    isCreditInsuranceAccount: boolean,
    hasChildren: boolean
): number {
    if (isCreditInsuranceAccount) {
        return hasChildren ? activeTab : Math.min(activeTab, TAB_POLICIES);
    }
    if (!hasChildren) {
        if (activeTab >= TAB_POLICIES) {
            return TAB_DASHBOARD;
        }
        return activeTab;
    }
    if (activeTab === TAB_AGGREGATED_DATA) {
        return TAB_POLICIES;
    }
    if (activeTab === TAB_POLICIES) {
        return TAB_DASHBOARD;
    }
    return activeTab;
}

function muiTabsValueToActiveTab(
    muiValue: number,
    isCreditInsuranceAccount: boolean,
    hasChildren: boolean
): number {
    if (isCreditInsuranceAccount) {
        return muiValue;
    }
    if (!hasChildren) {
        return muiValue;
    }
    if (muiValue === TAB_POLICIES) {
        return TAB_AGGREGATED_DATA;
    }
    return muiValue;
}

// Dynamically import heavy components
const ActivityTimeline = dynamic(() => import("./ActivityTimeline"), {
    ssr: false,
});
const UnpaidInvoiceList = dynamic(() => import("./UnpaidInvoiceList"), {
    ssr: false,
});
const LogActivity = dynamic(() => import("./LogActivity"), {
    ssr: false,
});

const MassSendEmailModal = dynamic(() => import("../components/MassSendEmailModal"), {
    ssr: false,
});
const DisputeContainer = dynamic(() => import("./DisputeContainer"), {
    ssr: false,
});
const CustomerAggregatedDataTab = dynamic(
    () => import("./CustomerAggregatedDataTab"),
    {
        ssr: false,
    }
);

/**
 * ActivitiesTab Component
 *
 * This component serves as a container for the ActivityTimeline component with proper scroll containment.
 *
 * Scroll Implementation:
 * 1. Container Structure:
 *    - Uses flex layout with column direction
 *    - Sets height to 100% to fill parent
 *    - Uses overflow: hidden to prevent scroll propagation
 *
 * 2. Parent Container (in CustomerDetailsCombined):
 *    - Height: calc(100vh - 300px)
 *    - Min-height: 600px
 *    - Uses flex layout
 *    - overflow: hidden to contain scroll
 *
 * 3. Scroll Containment Hierarchy:
 *    CustomerDetailsCombined
 *    └── activities div (fixed height, overflow: hidden)
 *        └── ActivitiesTab (flex container, overflow: hidden)
 *            └── ActivityTimeline (scrollable content)
 *
 * This structure ensures that:
 * - The timeline scroll is contained within its boundaries
 * - Page scroll is prevented when timeline is scrollable
 * - Proper height distribution through the component tree
 *
 * @component
 * @param {Object} props - Component props
 * @param {Customer} props.customer - The customer object
 * @param {string} props.customer_id - The customer ID
 * @param {boolean} props.showLogActivity - Whether to show the log activity
 * @param {function} props.setShowLogActivity - Function to set the showLogActivity state
 * @returns {JSX.Element} Rendered component
 */
const ActivitiesTab = React.memo(
    ({
        customer,
        showLogActivity,
        setShowLogActivity,
        showSendEmail,
        setShowSendEmail,
        refreshTrigger,
        refreshTimeline,
        hasCreateLogActivityPermission,
        hasSendEmailPermission,
    }: {
        customer: Customer;
        showLogActivity: boolean;
        setShowLogActivity: React.Dispatch<React.SetStateAction<boolean>>;
        showSendEmail: boolean;
        setShowSendEmail: React.Dispatch<React.SetStateAction<boolean>>;
        refreshTrigger: number;
        refreshTimeline: () => void;
        hasCreateLogActivityPermission: boolean;
        hasSendEmailPermission: boolean;
    }) => {
        const theme = useTheme();
        const { i18n } = useTranslation([
            "customers",
            "common",
            "bank_accounts",
            "contacts",
            "invoices",
        ]);

        const toggleOpen = useCallback(() => {
            setShowLogActivity(false);
        }, [setShowLogActivity]);

        // Ref to track LogActivity container height
        const logActivityContainerRef = useRef<HTMLDivElement | null>(null);
        const timelineContainerRef = useRef<HTMLDivElement | null>(null);
        const [logActivityHeight, setLogActivityHeight] = useState<number | null>(null);

        // Measure LogActivity height and update timeline minHeight
        useEffect(() => {
            if (!showLogActivity || !logActivityContainerRef.current) {
                setLogActivityHeight(null);
                return;
            }

            const measureHeight = () => {
                const container = logActivityContainerRef.current;
                if (container) {
                    const rect = container.getBoundingClientRect();
                    const height = rect.height;
                    setLogActivityHeight(height);
                }
            };

            // Measure immediately with a small delay to ensure DOM is ready
            const timeoutId = setTimeout(measureHeight, 100);

            // Use ResizeObserver to track height changes
            const resizeObserver = new ResizeObserver(() => {
                measureHeight();
            });

            if (logActivityContainerRef.current) {
                resizeObserver.observe(logActivityContainerRef.current);
            }

            // Also measure on window resize
            window.addEventListener('resize', measureHeight);

            return () => {
                clearTimeout(timeoutId);
                resizeObserver.disconnect();
                window.removeEventListener('resize', measureHeight);
                setLogActivityHeight(null);
            };
        }, [showLogActivity]);

        return (
            <div
                className="col-span-12"
                style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "row",
                    gap: "1rem",
                    overflow: "visible", // Changed to "visible" to allow absolutely positioned LogActivity to be fully visible
                    width: "100%",
                    minHeight: "calc(100vh - 340px)", // Ensure parent has enough height for dispute panel
                    boxSizing: "border-box",
                    alignItems: "flex-start",
                    padding: 0, // Remove padding - ActivityTimeline handles its own padding to match tabs
                    zIndex: 27, // Higher than tabs (zIndex: 25) to ensure children can appear above tabs
                }}
            >
                <div
                    ref={timelineContainerRef}
                    style={{
                        flex: "1 1 auto",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "visible",
                        position: "relative",
                        boxSizing: "border-box",
                        minWidth: 0,
                        // Remove height constraints - let ActivityTimeline handle viewport calculation
                        // Height will be set by ActivityTimeline's viewport calculation
                        width: "calc(100% - 390px)",
                        maxWidth: "calc(100% - 390px)",
                        transition: "width 0.3s ease, max-width 0.3s ease",
                    }}
                >
                    <ActivityTimeline
                        key={`timeline-${refreshTrigger}`}
                        customer={customer}
                        refreshTrigger={refreshTrigger}
                        onSendEmailClick={() => setShowSendEmail(true)}
                        hasSendEmailPermission={hasSendEmailPermission}
                        onLogActivityClick={() => setShowLogActivity((prev: boolean) => !prev)}
                        hasCreateLogActivityPermission={hasCreateLogActivityPermission}
                        showLogActivity={showLogActivity}
                    />
                </div>

                {/* Dispute Container - Always visible, stays in same position */}
                <Box
                    sx={{
                        position: "absolute",
                        top: "24px", // Align with ActivityTimeline header (12px marginTop + 12px paddingTop = 24px)
                        right: i18n.language === "he" ? "auto" : theme.spacing(1.5),
                        left: i18n.language === "he" ? theme.spacing(1.5) : "auto",
                        width: "350px",
                        maxWidth: "350px",
                        minHeight: "500px", // Ensure dispute panel is always visible
                        height: "calc(100vh - 340px - 12px)", // Adjust height to account for the 12px offset
                        maxHeight: "calc(100vh - 340px - 12px)",
                        overflow: "auto",
                        zIndex: 26, // Below LogActivity
                    }}
                >
                    <DisputeContainer
                        customer={customer}
                        refreshTimeline={refreshTimeline}
                        isActive={true}
                        refreshTrigger={refreshTrigger}
                    />
                </Box>

                {/* LogActivity Container - Overlays above DisputeContainer when visible */}
                {hasCreateLogActivityPermission && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: "24px", // Align with ActivityTimeline header (12px marginTop + 12px paddingTop = 24px)
                            right: i18n.language === "he" ? "auto" : theme.spacing(1.5),
                            left: i18n.language === "he" ? theme.spacing(1.5) : "auto",
                            width: "350px",
                            maxWidth: "350px",
                            height: showLogActivity ? (logActivityHeight ? `${logActivityHeight}px` : "435px") : 0, // Use measured height or fallback
                            maxHeight: showLogActivity ? (logActivityHeight ? `${logActivityHeight}px` : "435px") : 0,
                            overflow: "hidden", // Critical for Slide animation clipping
                            zIndex: 28, // Above DisputeContainer
                            pointerEvents: showLogActivity ? "auto" : "none", // Allow interaction only when visible
                            transition: "height 0.3s ease, max-height 0.3s ease", // Smooth height transition
                        }}
                    >
                        <Slide
                            direction={i18n.language === "he" ? "right" : "left"}
                            in={showLogActivity}
                            timeout={{ enter: 300, exit: 200 }}
                            mountOnEnter
                            unmountOnExit={false}
                        >
                            <Box
                                data-testid="log-activity-container"
                                ref={logActivityContainerRef}
                                sx={{
                                    height: "100%",
                                    overflow: "auto",
                                    width: "100%",
                                    // No background - let LogActivity component handle its own background
                                    // This allows DisputeContainer to be visible behind it
                                }}
                            >
                                <LogActivity
                                    customer={customer}
                                    isActive={showLogActivity}
                                    toggleOpen={toggleOpen}
                                    refreshTimeline={refreshTimeline}
                                />
                            </Box>
                        </Slide>
                    </Box>
                )}
            </div>
        );
    }
);
ActivitiesTab.displayName = "ActivitiesTab";

const InvoicesTab = React.memo(
    ({
        customer,
        isCreditInsuranceAccount = false,
        isCollectionAccount = false,
    }: {
        customer: Customer;
        isCreditInsuranceAccount?: boolean;
        isCollectionAccount?: boolean;
    }) => {
        return (
            <Box
                sx={{
                    width: "100%",
                    height: "100%",
                    minHeight: "500px",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <UnpaidInvoiceList
                    customer={customer}
                    isCreditInsuranceAccount={isCreditInsuranceAccount}
                    isCollectionAccount={isCollectionAccount}
                />
            </Box>
        );
    }
);
InvoicesTab.displayName = "InvoicesTab";

// Tab Content Component
const TabContent = React.memo(
    ({
        activeTab,
        customer,
        showLogActivity,
        setShowLogActivity,
        showSendEmail,
        setShowSendEmail,
        loadedTabs,
        refreshTrigger,
        refreshTimeline,
        t,
        i18n,
        countries,
        states,
        activeUsers,
        isEditing,
        editedCustomer,
        onFieldChange,
        onEditClick,
        onCancelEdit,
        onSave,
        isSaving,
        validationErrors,
        sequenceContainers,
        businessUnits,
        hasChildren,
        customerIdNumber,
        hasCreateLogActivityPermission,
        hasEditCustomerPermission,
        hasSendEmailPermission,
        genericFieldsConfig = {},
        isCreditOnlyAccount = false,
        isCreditInsuranceAccount = false,
        isCollectionAccount = false,
        activePolicies = [],
        hasCreditProduct = false,
    }: {
        activeTab: number;
        customer: Customer;
        showLogActivity: boolean;
        setShowLogActivity: React.Dispatch<React.SetStateAction<boolean>>;
        showSendEmail: boolean;
        setShowSendEmail: React.Dispatch<React.SetStateAction<boolean>>;
        loadedTabs: Set<number>;
        refreshTrigger: number;
        refreshTimeline: () => void;
        t: any;
        i18n: any;
        countries: any[];
        states: any[];
        activeUsers: any[];
        isEditing: boolean;
        editedCustomer: any;
        onFieldChange: (field: string, value: any) => void;
        onEditClick: () => void;
        onCancelEdit: () => void;
        onSave: () => void;
        isSaving: boolean;
        validationErrors: { [key: string]: string };
        sequenceContainers: any[];
        businessUnits: any[];
        hasChildren: boolean;
        customerIdNumber: number;
        hasCreateLogActivityPermission: boolean;
        hasEditCustomerPermission: boolean;
        hasSendEmailPermission: boolean;
        genericFieldsConfig?: { [key: string]: { enabled: boolean; label: string; read_only: boolean } };
        isCreditOnlyAccount?: boolean;
        isCreditInsuranceAccount?: boolean;
        isCollectionAccount?: boolean;
        activePolicies?: Array<{
            id: number;
            policy_number: string;
            start_date?: string | Date | null;
            end_date?: string | Date | null;
        }>;
        hasCreditProduct?: boolean;
    }) => {
        return (
            <Box
                sx={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    zIndex: 27, // Higher than tabs (25) to ensure children can appear above tabs
                }}
            >
                {/* Dashboard Tab */}
                <Box
                    sx={{
                        display: activeTab === TAB_DASHBOARD ? "block" : "none",
                        width: "100%",
                        height: "100%",
                        overflow: "auto",
                        p: { xs: 1, sm: 1.5 },
                    }}
                >
                    {loadedTabs.has(TAB_DASHBOARD) && (
                        <CustomerDashboardCards
                            customerId={String(customer.id)}
                            customer={customer}
                            hasCreditProduct={hasCreditProduct}
                            onTimelineRefresh={refreshTimeline}
                        />
                    )}
                </Box>

                {/* Activities Tab */}
                <Box
                    sx={{
                        display: activeTab === TAB_ACTIVITIES ? "block" : "none",
                        width: "100%",
                        height: "100%",
                        overflow: "hidden", // Changed from "auto" to "hidden" to prevent page overflow
                        position: "relative",
                        zIndex: 27, // Higher than tabs (zIndex: 25) to ensure children can appear above tabs
                    }}
                >
                    {loadedTabs.has(TAB_ACTIVITIES) && (
                        <ActivitiesTab
                            customer={customer}
                            showLogActivity={showLogActivity}
                            setShowLogActivity={setShowLogActivity}
                            showSendEmail={showSendEmail}
                            setShowSendEmail={setShowSendEmail}
                            refreshTrigger={refreshTrigger}
                            refreshTimeline={refreshTimeline}
                            hasCreateLogActivityPermission={
                                hasCreateLogActivityPermission
                            }
                            hasSendEmailPermission={hasSendEmailPermission}
                        />
                    )}
                </Box>

                {/* General Tab */}
                <Box
                    sx={{
                        display: activeTab === TAB_GENERAL ? "block" : "none",
                        width: "100%",
                        height: "100%",
                        overflow: "auto",
                        p: { xs: 1, sm: 1.5 },
                    }}
                >
                    {loadedTabs.has(TAB_GENERAL) && (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: { xs: 1, sm: 1 },
                            }}
                        >
                            {/* General Information Section */}
                            <CustomerGeneralInfo
                                customer={editedCustomer}
                                isEditing={isEditing}
                                errors={validationErrors}
                                onChange={onFieldChange}
                                countries={countries}
                                states={states}
                                activeUsers={activeUsers}
                                sequenceContainers={sequenceContainers}
                                businessUnits={businessUnits}
                                t={t}
                                i18n={i18n}
                                onEditClick={
                                    hasEditCustomerPermission
                                        ? onEditClick
                                        : undefined
                                }
                                onCancelEdit={
                                    hasEditCustomerPermission
                                        ? onCancelEdit
                                        : undefined
                                }
                                onSave={
                                    hasEditCustomerPermission
                                        ? onSave
                                        : undefined
                                }
                                isSaving={isSaving}
                                genericFieldsConfig={genericFieldsConfig}
                                isCreditOnlyAccount={isCreditOnlyAccount}
                                isCreditInsuranceAccount={isCreditInsuranceAccount}
                                activePolicies={activePolicies}
                                showCreditInsuranceSection={false}
                            />

                            {/* Address Information Section */}
                            <CustomerAddressInfo
                                customer={editedCustomer}
                                isEditing={isEditing}
                                errors={validationErrors}
                                onChange={onFieldChange}
                                countries={countries}
                                states={states}
                                activeUsers={[]}
                                t={t}
                                i18n={i18n}
                            />

                            {/* Contact Information Section */}
                            <CustomerContactList customer={customer} />

                            {/* Bank Information Section */}
                            {!isCreditOnlyAccount && (
                                <CustomerBanksList customer={customer} />
                            )}
                        </Box>
                    )}
                </Box>

                {/* Invoices Tab */}
                <Box
                    sx={{
                        display: activeTab === TAB_INVOICES ? "flex" : "none",
                        width: "100%",
                        height: "100%",
                        flexDirection: "column",
                        p: { xs: 1, sm: 1.5 },
                    }}
                >
                    {loadedTabs.has(TAB_INVOICES) && (
                        <InvoicesTab
                            customer={customer}
                            isCreditInsuranceAccount={isCreditInsuranceAccount}
                            isCollectionAccount={isCollectionAccount}
                        />
                    )}
                </Box>

                {/* Settings (credit insurance) tab */}
                <Box
                    sx={{
                        display: activeTab === TAB_POLICIES ? "block" : "none",
                        width: "100%",
                        height: "100%",
                        overflow: "auto",
                        p: { xs: 1, sm: 1.5 },
                    }}
                >
                    {loadedTabs.has(TAB_POLICIES) && isCreditInsuranceAccount && (
                        <CustomerCreditInsuranceInfo
                            customer={
                                isEditing && editedCustomer
                                    ? editedCustomer
                                    : customer
                            }
                            isEditing={isEditing}
                            errors={validationErrors}
                            onChange={onFieldChange}
                            countries={countries}
                            states={states}
                            activeUsers={activeUsers}
                            activePolicies={activePolicies}
                            onEditClick={
                                hasEditCustomerPermission
                                    ? onEditClick
                                    : undefined
                            }
                            onCancelEdit={
                                hasEditCustomerPermission
                                    ? onCancelEdit
                                    : undefined
                            }
                            onSave={
                                hasEditCustomerPermission
                                    ? onSave
                                    : undefined
                            }
                            isSaving={isSaving}
                            customerId={customerIdNumber}
                        />
                    )}
                </Box>

                {/* Aggregated Data Tab */}
                {hasChildren && (
                    <Box
                        sx={{
                            display: activeTab === TAB_AGGREGATED_DATA ? "block" : "none",
                            width: "100%",
                            height: "100%",
                            overflow: "auto",
                            p: { xs: 1, sm: 1.5 },
                        }}
                    >
                        {loadedTabs.has(TAB_AGGREGATED_DATA) && (
                            <CustomerAggregatedDataTab
                                customerId={customerIdNumber}
                            />
                        )}
                    </Box>
                )}
            </Box>
        );
    }
);
TabContent.displayName = "TabContent";

const CustomerDetailsCombined: React.FC<CustomerDetailsWrapperProps> = (
    props
) => {
    const customer_id =
        "customerId" in props ? props.customerId : props.customer_id;
    const { t, i18n } = useTranslation([
        "customers",
        "common",
        "bank_accounts",
        "contacts",
        "invoices",
        "auth",
        "settings",
    ]);
    const theme = useTheme();
    const queryClient = useQueryClient();
    const params = useSearchParams();
    const router = useRouter();
    const { showToast } = useToast();
    const dispatch = useAppDispatch();
    const { data: session } = useSession();
    const countriesRaw = useAppSelector((state) => state.countries);
    const countries = useMemo(() => countriesRaw || [], [countriesRaw]);
    const states = useAppSelector((state) => state.states) || [];

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasCreateLogActivityPermission = userPermissions.includes(
        "create_log_activity"
    );
    const hasEditCustomerPermission = userPermissions.includes("edit_customer");
    const hasSendEmailPermission = userPermissions.includes("send_email");

    // Convert customer_id to number for consistency with query functions
    const customerIdNumber = parseInt(customer_id, 10);

    // Get the tab from URL query parameter
    const tabParam = params?.get("tab");
    const getInitialTab = () => {
        if (!tabParam) return TAB_DASHBOARD;
        if (tabParam === "dashboard") return TAB_DASHBOARD;
        if (tabParam === "activities") return TAB_ACTIVITIES;
        if (tabParam === "general") return TAB_GENERAL;
        if (tabParam === "invoices") return TAB_INVOICES;
        if (tabParam === "policies" || tabParam === "credit_insurance") {
            return TAB_POLICIES;
        }
        if (tabParam === "aggregated_data") return TAB_AGGREGATED_DATA;
        return TAB_DASHBOARD;
    };

    const [activeTab, setActiveTab] = useState(getInitialTab());
    const [showLogActivity, setShowLogActivity] = useState(false);
    const [showSendEmail, setShowSendEmail] = useState(false);
    const [loadedTabs, setLoadedTabs] = useState<Set<number>>(
        new Set([getInitialTab()])
    );
    const hasAppliedDefaultTabRouting = useRef(false);
    const headerRef = useRef<HTMLDivElement>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [editedCustomer, setEditedCustomer] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState<{
        [key: string]: string;
    }>({});
    const [policySwitchConfirmOpen, setPolicySwitchConfirmOpen] =
        useState(false);
    const policyIdAtEditStartRef = useRef<number | null>(null);

    // Force cache invalidation on mount to ensure fresh data
    useEffect(() => {
        queryClient.invalidateQueries({
            queryKey: ["customer", customerIdNumber],
        });
    }, [queryClient, customerIdNumber]);

    // Fetch countries and states
    useEffect(() => {
        if (!countries.length) {
            dispatch(fetchCountriesFromApi());
        }
    }, [countries, dispatch]);

    // Pre-load tabs when switching
    useEffect(() => {
        setLoadedTabs((prev) => {
            if (prev.has(activeTab)) {
                return prev;
            }
            const newSet = new Set(prev);
            newSet.add(activeTab);
            return newSet;
        });
    }, [activeTab]);

    // Fetch customer data
    const {
        data: customer,
        refetch,
        isFetching,
        error,
    } = useQuery<Customer>({
        queryKey: ["customer", customerIdNumber],
        queryFn: fetchCustomerById,
        enabled: !!customer_id,
        retry: 1,
        staleTime: 0,
        gcTime: 60000,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
    });

    useEffect(() => {
        const displayName = getCustomerDisplayName(customer);
        const fallbackTitle = t("fields.unknown");
        const titleBase = displayName || fallbackTitle;
        document.title = `${titleBase} | ARchaser`;
    }, [customer, t]);

    // Check if customer has children from the customer data
    const hasChildren = Boolean(
        customer &&
        "ChildCustomers" in customer &&
        Array.isArray((customer as any).ChildCustomers) &&
        (customer as any).ChildCustomers.length > 0
    );

    // Fetch active users for owner field
    const { data: activeUsersData } = useQuery({
        queryKey: ["users", customer?.account_id, "Active", 1, 50],
        queryFn: async () => {
            const response = await apiFetch(`/api/entities/users?account_id=${customer?.account_id
                }&status=Active&page=1&limit=50`
            );
            if (!response.ok) throw new Error("Failed to fetch active users");
            return response.json();
        },
        enabled: !!customer?.account_id,
    });

    const activeUsers = activeUsersData?.users || [];

    // Fetch sequence containers for dropdown
    const { data: sequenceContainersData } = useQuery({
        queryKey: ["sequenceContainers", customer?.account_id],
        queryFn: async () => {
            const response = await apiFetch(`/api/sequenceContainers?account_id=${customer?.account_id}&category=Automated&includeInactive=false`
            );
            if (!response.ok)
                throw new Error("Failed to fetch sequence containers");
            const data = await response.json();
            return data.data || [];
        },
        enabled: !!customer?.account_id,
    });

    const sequenceContainers = sequenceContainersData || [];

    // Fetch business units for dropdown
    const { data: businessUnitsData } = useQuery({
        queryKey: ["business-units", customer?.account_id],
        queryFn: async () => {
            const response = await apiFetch(`/api/entities/accounts/${customer?.account_id}/business-units`
            );
            if (!response.ok) throw new Error("Failed to fetch business units");
            const data = await response.json();
            // Handle both array response and { data: [...] } response format
            return Array.isArray(data) ? data : data.data || [];
        },
        enabled: !!customer?.account_id,
    });

    const businessUnits = businessUnitsData || [];

    const { data: accountData } = useQuery({
        queryKey: ["account", customer?.account_id],
        queryFn: async () => {
            const response = await apiFetch(`/api/entities/accounts/${customer?.account_id}`
            );
            if (!response.ok) throw new Error("Failed to fetch account");
            return response.json();
        },
        enabled: !!customer?.account_id,
        refetchOnMount: "always",
        staleTime: 0,
    });

    const isCreditOnlyAccount =
        accountData?.has_collection === false &&
        accountData?.has_credit_insurance === true;

    const isCreditInsuranceAccount: boolean =
        accountData?.has_credit_insurance === true;

    const isCollectionAccount: boolean =
        accountData?.has_collection !== false;

    // MUI Tabs value = index among rendered <Tab /> children (differs when Settings tab is omitted)
    const muiTabsValue = useMemo(
        () =>
            activeTabToMuiTabsValue(
                activeTab,
                isCreditInsuranceAccount,
                hasChildren
            ),
        [activeTab, isCreditInsuranceAccount, hasChildren]
    );

    const { data: activePoliciesData } = useQuery({
        queryKey: ["insurance-policies", customer?.account_id],
        queryFn: async () => {
            const r = await apiFetch(`/api/entities/insurance-policies?account_id=${customer?.account_id}&assignable_only=1`
            );
            if (!r.ok) {
                throw new Error("Failed to fetch insurance policies");
            }
            const d = await r.json();
            return d.policies || [];
        },
        enabled: !!customer?.account_id && isCreditInsuranceAccount,
    });

    useEffect(() => {
        hasAppliedDefaultTabRouting.current = false;
    }, [customerIdNumber]);

    const activePolicies = activePoliciesData || [];

    // Handle tab switching for parent accounts, credit-insurance visibility, and default tab routing
    useEffect(() => {
        if (!customer) return;

        if (!isCreditInsuranceAccount && activeTab === TAB_POLICIES) {
            setActiveTab(TAB_DASHBOARD);
            setLoadedTabs((prev) => {
                const newSet = new Set(prev);
                newSet.add(TAB_DASHBOARD);
                return newSet;
            });
        } else if (!hasChildren && activeTab === TAB_AGGREGATED_DATA) {
            setActiveTab(TAB_DASHBOARD);
            setLoadedTabs((prev) => {
                const newSet = new Set(prev);
                newSet.add(TAB_DASHBOARD);
                return newSet;
            });
        } else if (!tabParam && !hasAppliedDefaultTabRouting.current) {
            const { defaultTabWithoutUrlParam } = resolveCustomerDetailDashboardUx({
                customer,
                hasCreditInsurance: isCreditInsuranceAccount,
                hasCollection: isCollectionAccount,
                hasChildren,
                explicitTab: tabParam,
            });

            const targetTab =
                defaultTabWithoutUrlParam === "aggregated_data"
                    ? TAB_AGGREGATED_DATA
                    : defaultTabWithoutUrlParam === "activities"
                      ? TAB_ACTIVITIES
                      : TAB_DASHBOARD;

            if (activeTab !== targetTab) {
                setActiveTab(targetTab);
                setLoadedTabs((prev) => {
                    const newSet = new Set(prev);
                    newSet.add(targetTab);
                    return newSet;
                });
            }
            hasAppliedDefaultTabRouting.current = true;
        }
    }, [
        customer,
        hasChildren,
        tabParam,
        activeTab,
        isCreditInsuranceAccount,
        isCollectionAccount,
    ]);

    // Fetch states when customer country changes
    useEffect(() => {
        if (customer?.country_id) {
            dispatch(fetchStatesFromApi(customer.country_id));
        }
    }, [customer?.country_id, dispatch]);

    // Initialize edited customer when customer data loads
    useEffect(() => {
        if (customer && !editedCustomer) {
            const constructedCustomer = applyEffectivePolicyFieldsToCustomer({
                ...customer,
                customer_name: customer?.Person
                    ? `${customer.Person.first_name || ""} ${customer.Person.last_name || ""}`.trim()
                    : customer?.Company?.name || "",
                category_for_new_collection:
                    customer?.category_for_new_collection || "Automated",
            });
            setEditedCustomer(constructedCustomer);
        }
    }, [customer, editedCustomer]);

    // Timeline refresh function
    const refreshTimeline = useCallback(async () => {
        setRefreshTrigger((prev) => prev + 1);

        try {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["customerTimeLineData"],
                }),
                queryClient.invalidateQueries({
                    queryKey: [
                        "activityTimeline",
                        { customer_id: customer?.id },
                    ],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["customerActivities", customer?.id],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["customerDisputes", customer?.id],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["open_dispute", customer?.id],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["customer", customerIdNumber],
                }),
            ]);

            await Promise.all([
                queryClient.refetchQueries({
                    queryKey: ["customerTimeLineData"],
                }),
                queryClient.refetchQueries({
                    queryKey: [
                        "activityTimeline",
                        { customer_id: customer?.id },
                    ],
                }),
                queryClient.refetchQueries({
                    queryKey: ["customerActivities", customer?.id],
                }),
            ]);
        } catch {
            // Error handling for timeline refresh
        }
    }, [queryClient, customer?.id, customerIdNumber]);

    const handleTabChange = useCallback(
        (event: React.SyntheticEvent, newValue: number) => {
            const semanticTab = muiTabsValueToActiveTab(
                newValue,
                isCreditInsuranceAccount,
                hasChildren
            );

            startTransition(() => {
                setLoadedTabs((prev) => {
                    if (prev.has(semanticTab)) {
                        return prev;
                    }
                    const newSet = new Set(prev);
                    newSet.add(semanticTab);
                    return newSet;
                });
            });

            setActiveTab(semanticTab);

            const newParams = new URLSearchParams(params?.toString() || "");
            const tabNames = [
                "dashboard",
                "activities",
                "general",
                "invoices",
                "policies",
                "aggregated_data",
            ];
            const tabName = tabNames[semanticTab];

            if (tabName) {
                newParams.set("tab", tabName);
                const currentPathParts = window.location.pathname.split("?")[0];
                setTimeout(() => {
                    router.replace(`${currentPathParts}?${newParams.toString()}`, { scroll: false });
                }, 0);
            }
        },
        [params, router, isCreditInsuranceAccount, hasChildren]
    );

    const handleEditClick = useCallback(() => {
        const base = editedCustomer ?? customer;
        if (base) {
            policyIdAtEditStartRef.current = getEffectivePolicyId(base);
        }
        setIsEditing(true);
        setValidationErrors({});
    }, [customer, editedCustomer]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
        const resetCustomer = applyEffectivePolicyFieldsToCustomer({
            ...customer,
            customer_name: customer?.Person
                ? `${customer.Person.first_name || ""} ${customer.Person.last_name || ""}`.trim()
                : customer?.Company?.name || "",
            category_for_new_collection:
                customer?.category_for_new_collection || "Automated",
        });
        setEditedCustomer(resetCustomer);
        setValidationErrors({});
    }, [customer]);

    const policyPrefillSeqRef = useRef(0);
    const policyPrefillAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            policyPrefillAbortRef.current?.abort();
        };
    }, []);

    const applyCreditInsurancePolicyPrefill = useCallback(
        async (
            policyId: number,
            snapshot: {
                account_id: number;
                country_id: number | null;
                customer_number?: string | null;
                customer_number_policy?: string | null;
            },
            options?: {
                namedMatchByPolicyCustomerNumberOnly?: boolean;
                dclOnly?: boolean;
            }
        ) => {
            policyPrefillAbortRef.current?.abort();
            const ac = new AbortController();
            policyPrefillAbortRef.current = ac;
            const seq = ++policyPrefillSeqRef.current;

            const params = new URLSearchParams({
                account_id: String(snapshot.account_id),
            });
            if (snapshot.country_id) {
                params.set("country_id", String(snapshot.country_id));
            }
            if (options?.dclOnly) {
                params.set("limit_type", "DCL");
            } else {
                if (snapshot.customer_number) {
                    params.set(
                        "customer_number",
                        String(snapshot.customer_number)
                    );
                }
                if (snapshot.customer_number_policy) {
                    params.set(
                        "customer_number_policy",
                        String(snapshot.customer_number_policy)
                    );
                }
                if (options?.namedMatchByPolicyCustomerNumberOnly) {
                    params.set("named_match", "policy_customer_number");
                }
            }

            try {
                const r = await apiFetch(`/api/entities/insurance-policies/${policyId}/customer-prefill?${params.toString()}`,
                    { signal: ac.signal }
                );
                if (!r.ok) return;
                const data = (await r.json()) as {
                    source?: string;
                    limit_type?: string;
                    max_payment_term?: number | null;
                    max_allowed_mep?: number | null;
                    reporting_days?: number | null;
                    mep_cutoff_day_of_month?: number | null;
                    mep_substitute_day_of_month?: number | null;
                    reporting_cutoff_day_of_month?: number | null;
                    reporting_substitute_day_of_month?: number | null;
                    payment_term_cutoff_day_of_month?: number | null;
                    payment_term_substitute_day_of_month?: number | null;
                    approved_limit?: unknown;
                    approved_limit_expiration_date?: string | null;
                    credit_score?: unknown;
                    customer_number_policy?: string | null;
                };

                if (seq !== policyPrefillSeqRef.current) return;

                if (data.source === "no_named_match") {
                    return;
                }

                setEditedCustomer((prev: any) => {
                    if (prev.policy_id !== policyId) return prev;

                    const next: Record<string, unknown> = {
                        ...prev,
                        limit_type:
                            data.limit_type === "Named" ? "Named" : "DCL",
                    };

                    if (data.max_payment_term != null) {
                        next.max_payment_term = data.max_payment_term;
                    }
                    if (data.max_allowed_mep != null) {
                        next.max_allowed_mep = data.max_allowed_mep;
                    }
                    if (data.reporting_days != null) {
                        next.reporting_days = data.reporting_days;
                    }
                    next.mep_cutoff_day_of_month =
                        data.mep_cutoff_day_of_month ?? null;
                    next.mep_substitute_day_of_month =
                        data.mep_substitute_day_of_month ?? null;
                    next.reporting_cutoff_day_of_month =
                        data.reporting_cutoff_day_of_month ?? null;
                    next.reporting_substitute_day_of_month =
                        data.reporting_substitute_day_of_month ?? null;
                    next.payment_term_cutoff_day_of_month =
                        data.payment_term_cutoff_day_of_month ?? null;
                    next.payment_term_substitute_day_of_month =
                        data.payment_term_substitute_day_of_month ?? null;
                    const isNamedLimit = data.limit_type === "Named";
                    if (isNamedLimit) {
                        if (
                            data.approved_limit != null &&
                            data.approved_limit !== ""
                        ) {
                            next.approved_limit = String(data.approved_limit);
                        }
                        if (data.approved_limit_expiration_date !== undefined) {
                            next.approved_limit_expiration_date =
                                data.approved_limit_expiration_date ?? null;
                        }
                    } else {
                        next.approved_limit =
                            data.approved_limit != null &&
                            data.approved_limit !== ""
                                ? String(data.approved_limit)
                                : null;
                        next.approved_limit_expiration_date = null;
                    }
                    if (data.credit_score != null && data.credit_score !== "") {
                        next.credit_score = String(data.credit_score);
                    }
                    if (data.customer_number_policy != null) {
                        next.customer_number_policy = data.customer_number_policy;
                    }

                    return next as typeof prev;
                });
            } catch (e: unknown) {
                const err = e as { name?: string };
                if (err?.name === "AbortError") return;
            }
        },
        []
    );

    const handleFieldChange = useCallback(
        (field: string, value: any) => {
            if (field === "policy_id" && isCreditInsuranceAccount && isEditing) {
                if (value == null || value === "") {
                    policyPrefillAbortRef.current?.abort();
                } else {
                    const policyId = Number(value);
                    policyPrefillAbortRef.current?.abort();
                    setEditedCustomer((prev: any) => {
                        const next = {
                            ...prev,
                            policy_id: value,
                            limit_type: "DCL",
                        };
                        void applyCreditInsurancePolicyPrefill(
                            policyId,
                            {
                                account_id: prev.account_id,
                                country_id: prev.country_id ?? null,
                                customer_number: prev.customer_number,
                                customer_number_policy:
                                    prev.customer_number_policy,
                            },
                            { dclOnly: true }
                        );
                        return next;
                    });
                    return;
                }
            }

            if (
                field === "limit_type" &&
                (value === "Named" || value === "DCL") &&
                isCreditInsuranceAccount &&
                isEditing
            ) {
                setEditedCustomer((prev: any) => {
                    const next = {
                        ...prev,
                        limit_type: value,
                        ...(value === "Named"
                            ? {
                                  excluded_from_policy: false,
                                  policy_exclusion_reason: null,
                              }
                            : {}),
                    };
                    const rawPid = prev.policy_id;
                    const policyId =
                        rawPid != null && rawPid !== ""
                            ? Number(rawPid)
                            : Number.NaN;
                    if (Number.isFinite(policyId)) {
                        policyPrefillAbortRef.current?.abort();
                        void applyCreditInsurancePolicyPrefill(
                            policyId,
                            {
                                account_id: prev.account_id,
                                country_id: prev.country_id ?? null,
                                customer_number: prev.customer_number,
                                customer_number_policy:
                                    prev.customer_number_policy,
                            },
                            value === "Named"
                                ? { namedMatchByPolicyCustomerNumberOnly: true }
                                : { dclOnly: true }
                        );
                    }
                    return next;
                });
                return;
            }

            if (
                field === "customer_number_policy" &&
                isCreditInsuranceAccount &&
                isEditing
            ) {
                setEditedCustomer((prev: any) => {
                    const next = {
                        ...prev,
                        [field]: value,
                    };
                    if (
                        prev.limit_type === "Named" &&
                        prev.policy_id != null &&
                        prev.policy_id !== ""
                    ) {
                        const policyId = Number(prev.policy_id);
                        if (Number.isFinite(policyId)) {
                            policyPrefillAbortRef.current?.abort();
                            void applyCreditInsurancePolicyPrefill(
                                policyId,
                                {
                                    account_id: prev.account_id,
                                    country_id: prev.country_id ?? null,
                                    customer_number: prev.customer_number,
                                    customer_number_policy: value,
                                },
                                { namedMatchByPolicyCustomerNumberOnly: true }
                            );
                        }
                    }
                    return next;
                });
                return;
            }

            setEditedCustomer((prev: any) => {
                const next = {
                    ...prev,
                    [field]: value,
                };

                // Keep month-end pairs consistent in customer policy edit:
                // clearing cutoff should also clear substitute.
                if (field === "payment_term_cutoff_day_of_month" && (value == null || value === "")) {
                    next.payment_term_substitute_day_of_month = null;
                }
                if (field === "mep_cutoff_day_of_month" && (value == null || value === "")) {
                    next.mep_substitute_day_of_month = null;
                }
                if (field === "reporting_cutoff_day_of_month" && (value == null || value === "")) {
                    next.reporting_substitute_day_of_month = null;
                }

                // Exclusion reason is the single source of truth sent to the
                // server (it derives excluded_from_policy).
                if (field === "policy_exclusion_reason") {
                    const normalizedReason =
                        normalizePolicyExclusionReason(value);
                    next.policy_exclusion_reason = normalizedReason;
                    next.excluded_from_policy = normalizedReason != null;
                }

                return next;
            });
        },
        [
            applyCreditInsurancePolicyPrefill,
            isCreditInsuranceAccount,
            isEditing,
        ]
    );

    const validateFields = useCallback((): boolean => {
        if (!editedCustomer) return false;

        const newErrors: { [key: string]: string } = {};

        if (
            !editedCustomer.customer_name ||
            editedCustomer.customer_name.trim() === ""
        ) {
            newErrors.customer_name = t("validation.required", {
                ns: "common",
            });
        }

        if (
            !editedCustomer.customer_number ||
            editedCustomer.customer_number.trim() === ""
        ) {
            newErrors.customer_number = t("validation.required", {
                ns: "common",
            });
        }

        if (!editedCustomer.country_id) {
            newErrors.country_id = t("validation.required", { ns: "common" });
        }

        if (!editedCustomer.language) {
            newErrors.language = t("validation.required", { ns: "common" });
        }

        if (!isCreditOnlyAccount) {
            const categoryValue =
                editedCustomer.category_for_new_collection || "Automated";
            if (!categoryValue || categoryValue.trim() === "") {
                newErrors.category_for_new_collection = t(
                    "validation.required",
                    {
                        ns: "common",
                    }
                );
            }

            if (!editedCustomer.sequence_container_id) {
                newErrors.sequence_container_id = t("validation.required", {
                    ns: "common",
                });
            }
        }

        if (editedCustomer.country_id) {
            const selectedCountry = countries.find(
                (c) => c.id === editedCustomer.country_id
            );
            const isUSOrCanada =
                selectedCountry?.name === "United States" ||
                selectedCountry?.name === "Canada";

            if (isUSOrCanada && !editedCustomer.state_id) {
                newErrors.state_id = t("validation.required", { ns: "common" });
            }
        }

        const req = t("validation.required", { ns: "common" });
        if (
            isCreditInsuranceAccount &&
            editedCustomer.policy_id != null &&
            editedCustomer.policy_id !== ""
        ) {
            const al = (editedCustomer as { approved_limit?: unknown }).approved_limit;
            if (
                al === null ||
                al === undefined ||
                (typeof al === "string" && al.trim() === "")
            ) {
                newErrors.approved_limit = req;
            } else if (Number(String(al).trim()) === 0) {
                const zld = (editedCustomer as { zero_limit_date?: unknown })
                    .zero_limit_date;
                if (
                    zld === null ||
                    zld === undefined ||
                    (typeof zld === "string" && zld.trim() === "")
                ) {
                    newErrors.zero_limit_date = req;
                }
            }
            const lt = (editedCustomer as { limit_type?: unknown }).limit_type;
            if (
                lt === null ||
                lt === undefined ||
                (typeof lt === "string" && lt.trim() === "")
            ) {
                newErrors.limit_type = req;
            }
            const mpt = (editedCustomer as { max_payment_term?: unknown })
                .max_payment_term;
            if (mpt === null || mpt === undefined) {
                newErrors.max_payment_term = req;
            }
            const mam = (editedCustomer as { max_allowed_mep?: unknown })
                .max_allowed_mep;
            if (mam === null || mam === undefined) {
                newErrors.max_allowed_mep = req;
            }
            const rd = (editedCustomer as { reporting_days?: unknown })
                .reporting_days;
            if (rd === null || rd === undefined) {
                newErrors.reporting_days = req;
            }
        }

        if (isCreditInsuranceAccount) {
            const ec = editedCustomer as Record<string, unknown>;
            const monthEndResult = validateMonthEndCutoffFormFields({
                mepCutoffRaw:
                    ec.mep_cutoff_day_of_month != null
                        ? String(ec.mep_cutoff_day_of_month)
                        : "",
                mepSubstituteRaw:
                    ec.mep_substitute_day_of_month != null
                        ? String(ec.mep_substitute_day_of_month)
                        : "",
                reportingCutoffRaw:
                    ec.reporting_cutoff_day_of_month != null
                        ? String(ec.reporting_cutoff_day_of_month)
                        : "",
                reportingSubstituteRaw:
                    ec.reporting_substitute_day_of_month != null
                        ? String(ec.reporting_substitute_day_of_month)
                        : "",
                paymentTermCutoffRaw:
                    ec.payment_term_cutoff_day_of_month != null
                        ? String(ec.payment_term_cutoff_day_of_month)
                        : "",
                paymentTermSubstituteRaw:
                    ec.payment_term_substitute_day_of_month != null
                        ? String(ec.payment_term_substitute_day_of_month)
                        : "",
            });
            const monthEndErrorMessage = (
                code: MonthEndCutoffValidationErrorCode
            ): string => {
                switch (code) {
                    case "invalid_integer":
                        return t("credit_insurance.validation.invalid_integer", {
                            ns: "settings",
                        });
                    case "out_of_range":
                        return t(
                            "credit_insurance.validation.day_of_month_out_of_range",
                            { ns: "settings" }
                        );
                    case "cutoff_requires_substitute":
                        return t(
                            "credit_insurance.validation.cutoff_requires_substitute",
                            { ns: "settings" }
                        );
                    case "substitute_requires_cutoff":
                        return t(
                            "credit_insurance.validation.substitute_requires_cutoff",
                            { ns: "settings" }
                        );
                    default:
                        return t("credit_insurance.validation.invalid_integer", {
                            ns: "settings",
                        });
                }
            };
            for (const [field, code] of Object.entries(monthEndResult.errors)) {
                if (code) {
                    newErrors[field] = monthEndErrorMessage(
                        code as MonthEndCutoffValidationErrorCode
                    );
                }
            }
        }

        if (isCreditInsuranceAccount) {
            const per = normalizePolicyExclusionReason(
                (editedCustomer as { policy_exclusion_reason?: unknown })
                    .policy_exclusion_reason
            );
            if (per !== null && !isAllowedPolicyExclusionReason(per)) {
                newErrors.policy_exclusion_reason = t(
                    "validation.invalidPolicyExclusionReason",
                    {
                        ns: "import",
                        defaultValue: "Invalid policy exclusion reason",
                    }
                );
            }
        }

        setValidationErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [editedCustomer, countries, t, isCreditOnlyAccount, isCreditInsuranceAccount]);

    const performSave = useCallback(
        async (confirmPolicySwitch: boolean) => {
            if (!editedCustomer) return;

            setIsSaving(true);
            try {
                const response = await apiFetch(`/api/entities/customers/${customerIdNumber}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(
                            buildCustomerPutPayload(editedCustomer, {
                                confirmPolicySwitch,
                            })
                        ),
                    }
                );

                if (response.ok) {
                    await queryClient.invalidateQueries({
                        queryKey: ["customer", customerIdNumber],
                    });
                    const { data: freshCustomer } = await refetch();
                    if (freshCustomer) {
                        setEditedCustomer(
                            applyEffectivePolicyFieldsToCustomer({
                                ...freshCustomer,
                                customer_name: freshCustomer?.Person
                                    ? `${freshCustomer.Person.first_name || ""} ${freshCustomer.Person.last_name || ""}`.trim()
                                    : freshCustomer?.Company?.name || "",
                                category_for_new_collection:
                                    freshCustomer?.category_for_new_collection ||
                                    "Automated",
                            })
                        );
                    }
                    setIsEditing(false);
                    setPolicySwitchConfirmOpen(false);
                    setRefreshTrigger((prev) => prev + 1);
                } else {
                    const errBody = await response.json().catch(() => ({}));
                    if (errBody?.code === "CONFIRM_POLICY_SWITCH_REQUIRED") {
                        setPolicySwitchConfirmOpen(true);
                    } else {
                        const apiError =
                            typeof errBody?.error === "string"
                                ? errBody.error
                                : null;
                        showToast(
                            apiError ?? t("messages.save_error"),
                            "error"
                        );
                    }
                }
            } catch {
                showToast(t("messages.save_error"), "error");
            } finally {
                setIsSaving(false);
            }
        },
        [
            editedCustomer,
            customerIdNumber,
            refetch,
            showToast,
            t,
            queryClient,
        ]
    );

    const handleSave = useCallback(async () => {
        if (!editedCustomer) return;

        const isValid = validateFields();
        if (!isValid) {
            return;
        }

        const nextPolicyId =
            editedCustomer.policy_id == null || editedCustomer.policy_id === ""
                ? null
                : Number(editedCustomer.policy_id);
        const policyChanged =
            isCreditInsuranceAccount &&
            (Number.isNaN(nextPolicyId as number)
                ? null
                : nextPolicyId) !== policyIdAtEditStartRef.current;

        if (policyChanged) {
            setPolicySwitchConfirmOpen(true);
            return;
        }

        await performSave(false);
    }, [
        editedCustomer,
        validateFields,
        isCreditInsuranceAccount,
        performSave,
    ]);

    // Show loading state
    if (isFetching && !customer) {
        return null;
    }

    // Show error state
    if (error) {
        const errorResponse = (error as any)?.response;
        const errorCode = errorResponse?.data?.code;
        const statusCode = errorResponse?.status;

        // Determine error type
        const is403 = statusCode === 403;
        const is404 = statusCode === 404;

        let errorTitle = t("messages.customer_not_found");
        let errorDescription = t("messages.customer_not_found_description");

        if (is403) {
            errorTitle = t("messages.access_denied", { ns: "auth" });

            // Provide specific message based on error code
            if (errorCode === "ACCESS_DENIED_OWNER") {
                errorDescription = t("messages.access_denied_owner", {
                    ns: "auth",
                });
            } else if (errorCode === "ACCESS_DENIED_BUSINESS_UNIT") {
                errorDescription = t("messages.access_denied_business_unit", {
                    ns: "auth",
                });
            } else if (errorCode === "ACCESS_DENIED_ACCOUNT") {
                errorDescription = t("messages.access_denied_account", {
                    ns: "auth",
                });
            } else {
                errorDescription = t("messages.access_denied_description", {
                    ns: "auth",
                });
            }
        }

        // Use the modern AccessDenied component for both 403 and 404 errors
        return (
            <AccessDenied
                title={errorTitle}
                description={errorDescription}
                errorCode={errorCode}
                backUrl={AppUrls.CUSTOMERS}
                backLabel={t("actions.back", { ns: "common" })}
            />
        );
    }

    // Show no data state
    if (!customer) {
        return (
            <Box sx={{ p: 4, color: "text.secondary" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    No customer data available
                </Typography>
            </Box>
        );
    }
    const tabIconPosition: "start" | "end" =
        i18n.language === "he" ? "end" : "start";

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                m: 0,
                p: 0,
                mt: { xs: -1, sm: -1.5 },
                mx: { xs: -1, sm: -1.5 },
                width: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                maxWidth: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
            }}
            data-testid="customer-details-container"
        >
            {/* Sticky Header */}
            <Box
                ref={headerRef}
                sx={{
                    position: "sticky",
                    top: { xs: "-8px", sm: "-12px" },
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    bgcolor: "background.paper",
                    flexShrink: 0,
                    px: { xs: 1, sm: 1.5 },
                    m: 0,
                    mt: 0,
                    backgroundColor: "background.paper",
                    width: "100%",
                    maxWidth: "100%",
                }}
            >
                <CustomerHeader
                    customer_id={customer_id}
                    onTimelineRefresh={refreshTimeline}
                    hideOpenPortal={isCreditOnlyAccount}
                    isCollectionAccount={isCollectionAccount}
                    isCreditInsuranceAccount={isCreditInsuranceAccount}
                    isCreditOnlyAccount={isCreditOnlyAccount}
                    renderMode="full"
                />
            </Box>

            {/* Non-sticky Tabs */}
            <Box
                sx={{
                    px: { xs: 1, sm: 1.5 },
                }}
            >
                <Tabs
                    value={muiTabsValue}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        bgcolor: "background.paper",
                        minHeight: "unset",
                        width: "100%",
                        // Match layout when all tabs are real nodes: hide disabled scroll slots so
                        // the first tab lines up when the strip does not overflow.
                        "& .MuiTabScrollButton-root.Mui-disabled": {
                            width: 0,
                            minWidth: 0,
                            maxWidth: 0,
                            overflow: "hidden",
                            opacity: 0,
                            pointerEvents: "none",
                        },
                        "& .MuiTabs-indicator": {
                            height: 2,
                            borderRadius: `${theme.shape.borderRadius} ${theme.shape.borderRadius} 0 0`,
                            backgroundColor: theme.palette.primary.main,
                        },
                        "& .MuiTab-root": {
                            textTransform: "none",
                            fontWeight: 500,
                            minWidth: { xs: "auto", sm: "120px" },
                            px: { xs: 1.5, sm: 2 },
                            py: 1,
                            minHeight: "unset",
                            height: "40px",
                            color: "text.secondary",
                            transition: theme.transitions.create(["all"], {
                                duration: theme.transitions.duration.short,
                                easing: theme.transitions.easing.easeInOut,
                            }),
                            // Hebrew font sizing - larger for better readability
                            fontSize:
                                i18n.language === "he" ? "1rem" : "0.875rem",
                            "&:hover": {
                                color: "secondary.main",
                                backgroundColor: alpha(
                                    theme.palette.secondary.main,
                                    0.08
                                ),
                            },
                            "&.Mui-selected": {
                                color: "primary.main",
                                fontWeight: 600,
                            },
                            "& .MuiSvgIcon-root": {
                                fontSize: "1.1rem",
                                mb: 0.25,
                            },
                            // Force icon to the right for Hebrew using proven RTL pattern
                            ...(i18n.language === "he" && {
                                display: "flex !important",
                                flexDirection: "row-reverse !important",
                                alignItems: "center !important",
                                "& .MuiTab-iconWrapper": {
                                    marginLeft: "8px !important",
                                    marginRight: "0px !important",
                                    order: "2 !important",
                                },
                                "& .MuiTab-label": {
                                    order: "1 !important",
                                },
                            }),
                        },
                    }}
                >
                    <Tab
                        label={t("sections.dashboard").toUpperCase()}
                        icon={<DashboardIcon sx={{ mb: 0.5 }} />}
                        iconPosition={tabIconPosition}
                    />
                    <Tab
                        label={t("sections.activities").toUpperCase()}
                        icon={<HistoryIcon sx={{ mb: 0.5 }} />}
                        iconPosition={tabIconPosition}
                    />
                    <Tab
                        label={t("sections.general").toUpperCase()}
                        icon={<InfoOutlinedIcon sx={{ mb: 0.5 }} />}
                        iconPosition={tabIconPosition}
                    />
                    <Tab
                        label={t("sections.invoices").toUpperCase()}
                        icon={<ReceiptIcon sx={{ mb: 0.5 }} />}
                        iconPosition={tabIconPosition}
                    />
                    {isCreditInsuranceAccount && (
                        <Tab
                            label={t("sections.policies").toUpperCase()}
                            icon={
                                <Badge
                                    color="primary"
                                    variant="dot"
                                    invisible={
                                        !(
                                            (customer as {
                                                active_top_up_count?: number;
                                            })?.active_top_up_count ?? 0
                                        )
                                    }
                                >
                                    <ShieldOutlinedIcon sx={{ mb: 0.5 }} />
                                </Badge>
                            }
                            iconPosition={tabIconPosition}
                        />
                    )}
                    {hasChildren && (
                        <Tab
                            label={t("sections.aggregated_data", {
                                ns: "customers",
                            }).toUpperCase()}
                            icon={<TrendingUpIcon sx={{ mb: 0.5 }} />}
                            iconPosition={tabIconPosition}
                        />
                    )}
                </Tabs>
            </Box>

            {/* Content Area */}
            <Box
                sx={{
                    flex: 1,
                    width: "100%",
                    position: "relative",
                    px: { xs: 1, sm: 1.5 },
                }}
            >
                {customer && (
                    <TabContent
                        activeTab={activeTab}
                        customer={customer}
                        genericFieldsConfig={
                            accountData?.generic_field_config
                                ? (mergeWithDefaults(
                                    accountData.generic_field_config
                                ).customer as unknown as {
                                    [key: string]: {
                                        enabled: boolean;
                                        label: string;
                                        read_only: boolean;
                                    };
                                })
                                : undefined
                        }
                        showLogActivity={showLogActivity}
                        setShowLogActivity={setShowLogActivity}
                        showSendEmail={showSendEmail}
                        setShowSendEmail={setShowSendEmail}
                        loadedTabs={loadedTabs}
                        refreshTrigger={refreshTrigger}
                        refreshTimeline={refreshTimeline}
                        t={t}
                        i18n={i18n}
                        countries={countries}
                        states={states}
                        activeUsers={activeUsers}
                        isEditing={isEditing}
                        editedCustomer={editedCustomer}
                        onFieldChange={handleFieldChange}
                        onEditClick={handleEditClick}
                        onCancelEdit={handleCancelEdit}
                        onSave={handleSave}
                        isSaving={isSaving}
                        validationErrors={validationErrors}
                        sequenceContainers={sequenceContainers}
                        businessUnits={businessUnits}
                        hasChildren={hasChildren || false}
                        customerIdNumber={customerIdNumber}
                        hasCreateLogActivityPermission={
                            hasCreateLogActivityPermission
                        }
                        hasEditCustomerPermission={hasEditCustomerPermission}
                        hasSendEmailPermission={hasSendEmailPermission}
                        isCreditOnlyAccount={isCreditOnlyAccount}
                        isCreditInsuranceAccount={isCreditInsuranceAccount}
                        isCollectionAccount={isCollectionAccount}
                        activePolicies={activePolicies}
                        hasCreditProduct={isCreditInsuranceAccount}
                    />
                )}
            </Box>

            <AppDialog
                open={policySwitchConfirmOpen}
                onClose={() => setPolicySwitchConfirmOpen(false)}
                title={t("fields.confirm_policy_switch_title", {
                    ns: "customers",
                    defaultValue: "Change active policy?",
                })}
                isRTL={i18n.language === "he"}
                paperWidth="360px"
                actions={
                    <>
                        <Button
                            onClick={() => setPolicySwitchConfirmOpen(false)}
                            disabled={isSaving}
                        >
                            {t("actions.cancel", { ns: "common" })}
                        </Button>
                        <Button
                            variant="contained"
                            disabled={isSaving}
                            onClick={() => void performSave(true)}
                        >
                            {t("actions.ok", { ns: "common" })}
                        </Button>
                    </>
                }
            >
                <Typography variant="body2">
                    {t("fields.confirm_policy_switch_message", {
                        ns: "customers",
                        defaultValue:
                            "Changing the active policy creates a new policy record. Previous policy settings remain in history.",
                    })}
                </Typography>
            </AppDialog>

            {/* SendEmail Modal */}
            <MassSendEmailModal
                customer={customer}
                isOpen={showSendEmail}
                closeModal={() => setShowSendEmail(false)}
                refreshTimeline={refreshTimeline}
            />
        </Box>
    );
};

export default React.memo(CustomerDetailsCombined);
