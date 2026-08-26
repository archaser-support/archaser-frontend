"use client";

import {
    Add as AddIcon,
    Business as BusinessIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Email as EmailIcon,
    Info as InfoIcon,
    LocationOn as LocationIcon,
    People as PeopleIcon,
    Public as PortalIcon,
    Shield as CreditInsuranceIcon,
    Psychology as PsychologyIcon,
    Security as SecurityIcon,
    Settings as SettingsIcon,
    Key as KeyIcon,
    CloudSync as BillingIcon,
} from "@mui/icons-material";
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Fade,
    FormControlLabel,
    IconButton,
    Switch,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import api, { apiFetch } from "@/app/api";
import { resolveAccountColorFields } from "@/app/theme";
import { CountrySelect } from "@/components/LocationSelects";
import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { getEndlessScrollToolbarTooltipProps } from "@/shared/layout-components/grid/endlessScrollToolbarTooltip";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { fetchAccountById } from "@/shared/services/accountService";
import { createLogRecord } from "@/shared/utility/LogCreator";
import { Account } from "@/types/Account";
import AppUrls from "@/utils/appUrls";
import { decodeLogo } from "@/utils/logoUtils";

import {
    accountCardContentSx,
    accountCardHeaderSx,
    accountCardSx,
} from "./accountCardStyles";
import AccountHeader from "./components/AccountHeader";
import AccountRoles from "./components/AccountRoles";
import AccountUsers from "./components/AccountUsers";
import AddressInformation from "./components/AddressInformation";
import AutomationSettings from "./components/AutomationSettings";
import BillingIntegrationSettings, {
    type BillingIntegrationSettingsHandle,
} from "./components/BillingIntegrationSettings";
import { BusinessUnits } from "./components/BusinessUnits";
import CommunicationSettings from "./components/CommunicationSettings";
import GeneralInformation from "./components/GeneralInformation";
import IntelligentChannelSelection from "./components/IntelligentChannelSelection";
import PortalSettings from "./components/PortalSettings";
import SSOSettings from "./components/SSOSettings";
import {
    AccountDisplayData,
    AccountFormData,
    CountryType,
    StateType,
} from "./types";

interface AccountDetailsProps {
    accountId: number | string;
}

const REQUIRED_FIELDS = [
    "name",
    "company_number",
    "promise_to_pay",
    "currency",
    "locale",
    "country_id",
    "sub_domain",
    "email_from",
    "email_from_name",
    "default_language",
];

/** Match CustomerDetailsCombined / CustomerGeneralInfo card padding — see accountCardStyles.ts */
async function uploadLogoToS3(
    file: File,
    accountId: number | string,
    activityId = "logo"
) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountId", accountId.toString());
    formData.append("activityId", activityId);

    const response = await apiFetch("/api/upload/s3", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload logo");
    }

    return response.json(); // { filePath, url }
}

// 1. Add ProviderPreferenceFormData type
interface ProviderPreferenceFormData {
    id?: number;
    country_id?: number;
    vendor_id?: number;
    is_enabled?: boolean;
    priority?: number;
}

// 2. Add ProviderRow type for DataGrid
interface ProviderRow {
    id: number;
    country_id: number;
    vendor_id: number;
    is_enabled: boolean;
    priority: number;
    provider?: string;
    Country?: { emoji?: string; name?: string };
    SMSVendor?: {
        provider?: string;
        name?: string;
        phone_number?: string;
        id?: number;
    };
}

const AccountDetails: React.FC<AccountDetailsProps> = ({ accountId }) => {
    const { t } = useTranslation([
        "accounts",
        "sms",
        "common",
        "security_roles",
    ]);
    const { i18n } = useTranslation();
    const theme = useTheme();
    const queryClient = useQueryClient();
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const locale = (params?.locale as string) || "en";
    const searchParams = useSearchParams();
    const { success, error: showError } = useToast();
    const { data: session } = useSession();

    // Fetch user permissions to check view_business_units permission
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
        staleTime: 0, // Don't cache - always fetch fresh permissions
        gcTime: 0,
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasViewBusinessUnitsPermission = userPermissions.includes(
        "view_business_units"
    );
    const hasViewBillingConnectorPermission = userPermissions.includes(
        "view_billing_connector"
    );
    const hasManageBillingConnectorPermission = userPermissions.includes(
        "manage_billing_connector"
    );
    const isArchaserAdmin = session?.user?.account_id === 10013;

    const [isSaving, setIsSaving] = useState(false);
    const [editedAccount, setEditedAccount] = useState<AccountFormData>({
        status: "Active", // Set default status to Active for new records
        // Set default values for new accounts - check accountId directly since editedAccount isn't initialized yet
        ...(accountId === "new" && {
            has_collection: true,
            has_credit_insurance: false,
            has_file_import: true,
            promise_to_pay: 1,
            default_first_activity_delay_days: 3,
            category_after_automated: "Agent",
            default_language: "English",
            wait_days_after_automated: 0,
            ...resolveAccountColorFields({}),
        }),
    });

    // Keep create/edit mode tied to the route only.
    // This prevents accidental GET /entities/accounts/new requests between save and redirect.
    const isNewAccount = useMemo(() => {
        return accountId === "new";
    }, [accountId]);

    const showBillingIntegrationTab =
        hasViewBillingConnectorPermission && !isNewAccount;
    const ssoTabIndex = hasViewBusinessUnitsPermission ? 5 : 4;
    const billingTabIndex = showBillingIntegrationTab ? ssoTabIndex + 1 : -1;
    const securityRolesTabIndex = hasViewBusinessUnitsPermission ? 4 : 3;
    const tabIndexByName = useMemo((): Record<string, number> => {
        return {
            general: 0,
            communication: 1,
            users: 2,
            business_units: hasViewBusinessUnitsPermission ? 3 : -1,
            security_roles: securityRolesTabIndex,
            roles: securityRolesTabIndex,
            sso: ssoTabIndex,
            billing_integration: billingTabIndex,
        };
    }, [
        hasViewBusinessUnitsPermission,
        securityRolesTabIndex,
        ssoTabIndex,
        billingTabIndex,
    ]);
    const tabNameByIndex = useMemo((): Record<number, string> => {
        return {
            0: "general",
            1: "communication",
            2: "users",
            ...(hasViewBusinessUnitsPermission ? { 3: "business_units" } : {}),
            [securityRolesTabIndex]: "security_roles",
            [ssoTabIndex]: "sso",
            ...(billingTabIndex >= 0
                ? { [billingTabIndex]: "billing_integration" }
                : {}),
        };
    }, [
        hasViewBusinessUnitsPermission,
        securityRolesTabIndex,
        ssoTabIndex,
        billingTabIndex,
    ]);
    const [validationErrors, setValidationErrors] = useState<
        Record<string, string>
    >({});
    const [activeTab, setActiveTab] = useState(0);
    const billingSettingsRef = useRef<BillingIntegrationSettingsHandle>(null);
    const [billingTabVisited, setBillingTabVisited] = useState(false);

    useEffect(() => {
        if (billingTabIndex >= 0 && activeTab === billingTabIndex) {
            setBillingTabVisited(true);
        }
    }, [activeTab, billingTabIndex]);

    // Restore the selected tab from ?tab= so a refresh stays on the same tab
    useEffect(() => {
        const tabParam = searchParams?.get("tab");
        if (!tabParam) return;
        const tabIndex = tabIndexByName[tabParam];
        if (tabIndex !== undefined && tabIndex >= 0) {
            setActiveTab(tabIndex);
        }
    }, [searchParams, accountId, tabIndexByName]);

    // SMS Provider Configuration state
    const [selectedCountryForSMS, setSelectedCountryForSMS] =
        useState<CountryType | null>(null);
    interface ExtendedProviderPreferenceFormData
        extends ProviderPreferenceFormData {
        isNewPreference?: boolean;
        enabled?: boolean;
        comment?: string;
        SMSVendor?: {
            provider?: string;
            name?: string;
            phone_number?: string;
            id?: number;
        };
    }
    const [smsProviderConfigs, setSmsProviderConfigs] = useState<
        ExtendedProviderPreferenceFormData[]
    >([]);
    const [loadingProviders, setLoadingProviders] = useState(false);
    const [openSMSConfigModal, setOpenSMSConfigModal] = useState(false);
    const [savingConfigurations, setSavingConfigurations] = useState(false);
    const [userProviders, setUserProviders] = useState<ProviderRow[]>([]);
    const [loadingUserProviders, setLoadingUserProviders] = useState(false);

    // Search state for SMS providers table (shared across tabs)
    const [providerSearch, setProviderSearch] = useState("");
    const [debouncedProviderSearch] = useDebounce(providerSearch, 500);
    const filteredProviders = useMemo(() => {
        if (!debouncedProviderSearch) return userProviders;
        const term = debouncedProviderSearch.toLowerCase();
        return userProviders.filter((row: ProviderRow) => {
            const values = [
                row?.Country?.name,
                row?.Country?.emoji,
                row?.SMSVendor?.provider,
                row?.SMSVendor?.phone_number,
                row?.priority != null ? String(row.priority) : "",
            ];
            return values.some((v) =>
                (v || "").toString().toLowerCase().includes(term)
            );
        });
    }, [userProviders, debouncedProviderSearch]);

    // 3. Replace all provider CRUD state/handlers to use ProviderPreferenceFormData
    const [providerForm, setProviderForm] =
        useState<ProviderPreferenceFormData>({});
    const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);

    // Add state for mapped providers
    const [mappedProviders, setMappedProviders] = useState<ProviderRow[]>([]);
    const [loadingMappedProviders, setLoadingMappedProviders] = useState(false);

    // Add state for countries with SMS vendors
    const [countriesWithSMSVendors, setCountriesWithSMSVendors] = useState<
        CountryType[]
    >([]);
    const [loadingCountriesWithSMS, setLoadingCountriesWithSMS] =
        useState(false);

    // Add state for delete confirmation dialog
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [providerToDelete, setProviderToDelete] =
        useState<ProviderRow | null>(null);

    const [isDeletingProvider, setIsDeletingProvider] = useState(false);

    // Add state to track SMS provider updates for IntelligentChannelSelection
    const [smsProvidersUpdated, setSmsProvidersUpdated] = useState(0);

    const handleTabChange = useCallback(
        (_event: React.SyntheticEvent, newValue: number) => {
            setActiveTab(newValue);

            const tabName = tabNameByIndex[newValue];
            if (!tabName) return;

            const newParams = new URLSearchParams(searchParams?.toString() || "");
            if (newParams.get("tab") === tabName) return;
            newParams.set("tab", tabName);

            const currentPath =
                pathname || window.location.pathname.split("?")[0];
            router.replace(`${currentPath}?${newParams.toString()}`, {
                scroll: false,
            });
        },
        [pathname, router, searchParams, tabNameByIndex]
    );

    // Map field names to their respective tab indices
    const getFieldTabIndex = (fieldName: string): number => {
        // Tab 0: General tab fields
        const generalTabFields = [
            "name",
            "company_number",
            "promise_to_pay",
            "currency",
            "locale",
            "country_id",
            "sub_domain",
            "default_first_activity_delay_days",
            "category_after_automated",
            "default_language",
        ];

        // Tab 1: Communication tab fields
        const communicationTabFields = [
            "email_from",
            "email_from_name",
            "sms_from_name",
        ];

        // Tab 2: Users tab (no validation fields)

        if (generalTabFields.includes(fieldName)) {
            return 0;
        } else if (communicationTabFields.includes(fieldName)) {
            return 1;
        }

        // Default to General tab if field not found
        return 0;
    };

    const {
        data: account,
        isLoading,
        error,
    } = useQuery<Account, Error>({
        queryKey: ["account", accountId],
        queryFn: fetchAccountById,
        enabled: !!accountId && !isNewAccount,
        retry: 3,
    });

    const { data: countries } = useQuery<CountryType[]>({
        queryKey: ["countries"],
        queryFn: async () => {
            const response = await apiFetch("/api/country");
            if (!response.ok) {
                throw new Error("Failed to fetch countries");
            }
            return response.json();
        },
    });

    // Use the current account's country_id for states query
    // Always use editedAccount as it's kept in sync with account data
    const currentAccount: AccountDisplayData = editedAccount;

    // Check if account is deleted or anonymized
    const isAccountDeleted = !!(currentAccount as any)?.deleted_at;
    const calculateGracePeriodDaysForAccount = (
        deletedAt: string | Date
    ): number => {
        const deleted = new Date(deletedAt);
        const gracePeriodEnds = new Date(deleted);
        gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 30);
        const diffTime = gracePeriodEnds.getTime() - new Date().getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };
    const gracePeriodDaysRemaining = isAccountDeleted
        ? calculateGracePeriodDaysForAccount((currentAccount as any).deleted_at)
        : 0;
    const isAccountViewOnly = isAccountDeleted;

    const countryIdForStates = currentAccount?.country_id;

    const { data: states } = useQuery<StateType[]>({
        queryKey: ["states", countryIdForStates],
        queryFn: async () => {
            if (!countryIdForStates) return [];
            const response = await apiFetch(`/api/state?country_id=${countryIdForStates}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch states");
            }
            return response.json();
        },
        enabled: !!countryIdForStates,
    });

    // Convert Account to AccountFormData
    const convertAccountToFormData = (account: Account): AccountFormData => {
        const accountAny = account as any;

        const formData: AccountFormData = {
            id: account.id,
            name: account.name,
            company_number: account.company_number,
            currency: account.currency,
            locale: account.locale,
            balance_evaluation_method: account.balance_evaluation_method,
            promise_to_pay: account.promise_to_pay,
            status: account.status,
            max_promise_to_pay_allowed_per_cycle:
                account.max_promise_to_pay_allowed_per_cycle,
            address_line1: account.address_line1,
            address_line2: account.address_line2,
            city: account.city,
            postal_code: account.postal_code,
            country_id: account.country_id,
            state_id: account.state_id,
            category_after_automated: account.category_after_automated,
            category_for_new_collection: account.category_for_new_collection,
            default_language: account.default_language,
            wait_days_after_automated: account.wait_days_after_automated,
            email_from_name: account.email_from_name,
            email_from: account.email_from,
            sms_from_name: account.sms_from_name,
            beneficiary_name: account.beneficiary_name,
            bank_name: account.bank_name,
            branch_name: account.branch_name,
            branch_number: account.branch_number,
            account_number: account.account_number,
            swift: account.swift,
            iban: account.iban,
            bank_comments: account.bank_comments,
            sub_domain: account.sub_domain,
            allow_partial_payment: account.allow_partial_payment,
            default_first_activity_delay_days:
                account.default_first_activity_delay_days,
            logo: account.logo,
            ...resolveAccountColorFields({
                primary_color: account.primary_color,
                secondary_color: account.secondary_color,
                chart_palette_color: account.chart_palette_color,
            }),
            intelligent_channel_selection_enabled:
                account.intelligent_channel_selection_enabled,
            sms_fallback_enabled: account.sms_fallback_enabled,
            unlisted_country_sms_policy: account.unlisted_country_sms_policy,
            portal_verification_enabled: account.portal_verification_enabled,
            sso_enabled: (account as any).sso_enabled,
            sso_providers: (account as any).sso_providers,
            has_collection:
                (account as any).has_collection === undefined
                    ? true
                    : (account as any).has_collection,
            has_credit_insurance:
                (account as any).has_credit_insurance === undefined
                    ? false
                    : (account as any).has_credit_insurance,
            has_file_import:
                (account as any).has_file_import === undefined
                    ? true
                    : (account as any).has_file_import,
            enable_customer_checkpoints:
                (account as any).enable_customer_checkpoints === true,
            credit_limit_warning_threshold_pct:
                accountAny.credit_limit_warning_threshold_pct != null
                    ? Number(accountAny.credit_limit_warning_threshold_pct)
                    : null,
            credit_score_validity_warning_days:
                accountAny.credit_score_validity_warning_days != null
                    ? Number(accountAny.credit_score_validity_warning_days)
                    : null,
            reporting_date_warning_days:
                accountAny.reporting_date_warning_days != null
                    ? Number(accountAny.reporting_date_warning_days)
                    : null,
            customer_limit_expiration_warning_days:
                accountAny.customer_limit_expiration_warning_days != null
                    ? Number(accountAny.customer_limit_expiration_warning_days)
                    : null,
            deleted_at: accountAny?.deleted_at || null,
            deleted_by: accountAny?.deleted_by || null,
        };

        return formData;
    };

    useEffect(() => {
        if (account) {
            const formData = convertAccountToFormData(account);
            setEditedAccount(formData);
        }
    }, [account, isNewAccount]);

    // Set default country to Israel for new accounts
    useEffect(() => {
        if (isNewAccount && countries && !editedAccount.country_id) {
            const israelCountry = countries.find(
                (c) => c.iso2 === "IL" || c.name === "Israel"
            );
            if (israelCountry) {
                setEditedAccount((prev) => ({
                    ...prev,
                    country_id: israelCountry.id,
                }));
            }
        }
    }, [isNewAccount, countries, editedAccount.country_id]);

    useEffect(() => {
        const uploadLogoIfNeeded = async () => {
            if (
                editedAccount.logoFile &&
                session?.user?.id &&
                accountId !== "new"
            ) {
                try {
                    setIsSaving(true); // Optional: show loading state
                    const { filePath } = await uploadLogoToS3(
                        editedAccount.logoFile as File,
                        accountId
                    );
                    setEditedAccount((prev) => {
                        const updated = {
                            ...prev,
                            logo: filePath,
                            logoFile: null,
                        };
                        return updated;
                    });

                    // Invalidate React Query cache to ensure fresh data
                    await queryClient.invalidateQueries({
                        queryKey: ["account", accountId],
                        refetchType: "active",
                    });
                } catch (err: unknown) {
                    console.error("Logo upload failed:", err);
                    const errorMessage =
                        err instanceof Error ? err.message : undefined;
                    showError(
                        errorMessage ||
                        t("messages.logo_upload_failed", { ns: "accounts" })
                    );
                    setEditedAccount((prev) => ({
                        ...prev,
                        logoFile: null,
                    }));
                } finally {
                    setIsSaving(false);
                }
            }
        };
        uploadLogoIfNeeded();
        // Only run when logoFile changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editedAccount.logoFile]);

    // Load user providers when component mounts (defined later in the component)
    const loadUserProviders = async () => {
        try {
            setLoadingUserProviders(true);
            // Only fetch customer-specific preferences
            const response = await apiFetch(`/api/accounts/${accountId}/sms-preferences`
            );
            if (response.ok) {
                const data = await response.json();
                setUserProviders(data); // No filtering, show all customer-specific preferences
            }
        } catch (error) {
            console.error("Error loading user providers:", error);
        } finally {
            setLoadingUserProviders(false);
        }
    };

    // Load countries that have SMS vendors available
    const loadCountriesWithSMSVendors = async () => {
        try {
            setLoadingCountriesWithSMS(true);
            const response = await apiFetch("/api/sms/country-vendors");
            if (response.ok) {
                const data = await response.json();
                // Extract unique countries from the SMS vendor mappings
                interface SMSVendorMapping {
                    Country?: CountryType;
                }
                const uniqueCountries = (
                    data.mappings as SMSVendorMapping[]
                ).reduce((acc: CountryType[], mapping) => {
                    if (
                        mapping.Country &&
                        !acc.find((c) => c.id === mapping.Country?.id)
                    ) {
                        acc.push(mapping.Country);
                    }
                    return acc;
                }, []);
                setCountriesWithSMSVendors(uniqueCountries);
            }
        } catch (error) {
            console.error("Error loading countries with SMS vendors:", error);
        } finally {
            setLoadingCountriesWithSMS(false);
        }
    };

    useEffect(() => {
        // Only fetch SMS preferences when we have a valid account ID (skip for "new" account)
        if (accountId !== "new" && !isNaN(Number(accountId))) {
            loadUserProviders();
        }
        loadCountriesWithSMSVendors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCancel = () => {
        // Always navigate back to the accounts list
        router.push(`/${locale}${AppUrls.ACCOUNTS}`);
    };

    const validateFields = (): {
        isValid: boolean;
        errors: Record<string, string>;
    } => {
        const errors: Record<string, string> = {};

        // Email validation regex
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // Basic required fields
        if (!editedAccount.name)
            errors.name = t("validation.required", { ns: "common" });
        if (!editedAccount.company_number)
            errors.company_number = t("validation.required", { ns: "common" });
        if (!editedAccount.promise_to_pay && editedAccount.promise_to_pay !== 0)
            errors.promise_to_pay = t("validation.required", { ns: "common" });

        // Currency and locale
        if (!editedAccount.currency)
            errors.currency = t("validation.required", { ns: "common" });
        if (!editedAccount.locale)
            errors.locale = t("validation.required", { ns: "common" });

        // Location (country)
        if (!editedAccount.country_id)
            errors.country_id = t("validation.required", { ns: "common" });

        // Sub domain
        if (!editedAccount.sub_domain)
            errors.sub_domain = t("validation.required", { ns: "common" });

        // Default first activity delay days
        if (
            !editedAccount.default_first_activity_delay_days &&
            editedAccount.default_first_activity_delay_days !== 0
        )
            errors.default_first_activity_delay_days = t(
                "validation.required",
                { ns: "common" }
            );

        // Email fields with validation
        if (!editedAccount.email_from) {
            errors.email_from = t("validation.required", { ns: "common" });
        } else if (!EMAIL_REGEX.test(editedAccount.email_from)) {
            errors.email_from = t("validation.invalid_email_format", {
                ns: "accounts",
            });
        }
        if (!editedAccount.email_from_name)
            errors.email_from_name = t("validation.required", { ns: "common" });

        // Default language
        if (!editedAccount.default_language)
            errors.default_language = t("validation.required", {
                ns: "common",
            });

        // SMS From Name validation - no spaces allowed
        if (
            editedAccount.sms_from_name &&
            editedAccount.sms_from_name.includes(" ")
        ) {
            errors.sms_from_name = t("validation.no_spaces_allowed", {
                ns: "accounts",
            });
        }

        // Category after automated
        if (
            !editedAccount.category_after_automated ||
            (typeof editedAccount.category_after_automated === "string" &&
                editedAccount.category_after_automated.trim() === "")
        )
            errors.category_after_automated = t("validation.required", {
                ns: "common",
            });

        // Wait days after automated
        if (
            editedAccount.wait_days_after_automated === undefined ||
            editedAccount.wait_days_after_automated === null ||
            editedAccount.wait_days_after_automated < 0
        ) {
            errors.wait_days_after_automated = t("validation.required", {
                ns: "common",
            });
        }

        if (
            !editedAccount.has_collection &&
            !editedAccount.has_credit_insurance
        ) {
            errors.products = "Select at least one product.";
        }

        setValidationErrors(errors);
        return { isValid: Object.keys(errors).length === 0, errors };
    };

    const handleSave = async () => {
        // Validate fields before saving
        const { isValid, errors } = validateFields();
        if (!isValid) {
            if (errors.products) {
                showError(errors.products);
            } else {
                showError(t("validation.please_fix_errors", { ns: "accounts" }));
            }

            // Switch to the tab containing the first validation error
            const errorFields = Object.keys(errors);
            if (errorFields.length > 0) {
                const firstErrorField = errorFields[0];
                const tabIndex = getFieldTabIndex(firstErrorField);
                if (tabIndex !== activeTab) {
                    setActiveTab(tabIndex);
                }
            }

            return;
        }

        setIsSaving(true);
        try {
            const url = isNewAccount
                ? "/api/entities/accounts"
                : `/api/entities/accounts/${accountId}`;

            // Only send the S3 path in the logo field
            const payload: Partial<AccountFormData> & {
                logoFile?: unknown;
                logoPreview?: unknown;
                deleteLogo?: boolean;
            } = {
                ...editedAccount,
                ...resolveAccountColorFields(editedAccount),
            };
            delete payload.logoFile;
            delete payload.logoPreview;

            // Handle logo deletion - if deleteLogo flag is set, set logo to null
            if (payload.deleteLogo) {
                payload.logo = null;
                delete payload.deleteLogo;
            }

            if (!isNewAccount) {
                payload.id = accountId as number;
            }

            const response = await apiFetch(url, {
                method: isNewAccount ? "POST" : "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.text();
                try {
                    const errorJson = JSON.parse(errorData);
                    throw new Error(
                        errorJson.error ||
                        errorJson.message ||
                        (isNewAccount
                            ? "Failed to create customer"
                            : "Failed to update customer")
                    );
                } catch (_parseError) {
                    throw new Error(
                        isNewAccount
                            ? "Failed to create customer"
                            : "Failed to update customer"
                    );
                }
            }

            const result = await response.json();

            if (billingSettingsRef.current) {
                await billingSettingsRef.current.save();
            }

            if (isNewAccount) {
                // Set the account data in editedAccount so currentAccount.id exists after redirect
                const formData = convertAccountToFormData(result as Account);
                setEditedAccount(formData);

                // Invalidate users-related queries to ensure fresh data after account creation
                await queryClient.invalidateQueries({ queryKey: ["users"] });
                await queryClient.invalidateQueries({
                    queryKey: ["users-virtual"],
                });
                await queryClient.invalidateQueries({
                    queryKey: ["activeUsers"],
                });
                await queryClient.invalidateQueries({
                    queryKey: ["business-unit-active-users"],
                });

                // Invalidate account query so it refetches when navigating to the new account page
                await queryClient.invalidateQueries({
                    queryKey: ["account", result.id],
                });

                // Use replace instead of push to avoid back button issues
                router.replace(
                    `/${locale}${AppUrls.ACCOUNT_DETAILS(result.id)}`
                );

                success(
                    t("messages.account_created_successfully", {
                        ns: "accounts",
                    })
                );
            } else {
                const updatedAccount: Partial<AccountFormData> & {
                    logoFile?: unknown;
                    logoPreview?: unknown;
                } = { ...editedAccount, ...result };
                delete updatedAccount.logoFile;
                delete updatedAccount.logoPreview;
                setEditedAccount(updatedAccount as AccountFormData);
                await queryClient.invalidateQueries({
                    queryKey: ["account", account?.id],
                    refetchType: "active",
                });
                success(
                    t("messages.account_updated_successfully", {
                        ns: "accounts",
                    })
                );
            }
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : undefined;
            showError(
                errorMessage ||
                (isNewAccount
                    ? t("messages.error_creating_account", {
                        ns: "accounts",
                    })
                    : t("messages.error_updating_account", {
                        ns: "accounts",
                    }))
            );
            await createLogRecord(
                "ERROR",
                errorMessage || "Unknown error",
                isNewAccount
                    ? "Account Details Page - Create"
                    : "Account Details Page - Inline Edit",
                error
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleFieldChange = useCallback((key: string, value: unknown) => {
        // Ensure country_id and state_id are stored as numbers
        let processedValue = value;
        if (key === "country_id" || key === "state_id") {
            processedValue = value ? Number(value) : null;
        } else if (
            key === "primary_color" ||
            key === "secondary_color" ||
            key === "chart_palette_color"
        ) {
            const colorKey = key as keyof ReturnType<
                typeof resolveAccountColorFields
            >;
            if (value === null || (typeof value === "string" && !value.trim())) {
                processedValue = resolveAccountColorFields({})[colorKey];
            } else if (typeof value === "string") {
                processedValue = value.trim();
            }
        }

        setEditedAccount((prev) => ({
            ...prev,
            [key]: processedValue,
        }));

        // Clear validation error for this field when user starts typing (functional update to avoid dependency)
        setValidationErrors((prev) => {
            if (!prev[key]) return prev;
            const newErrors = { ...prev };
            delete newErrors[key];
            return newErrors;
        });
    }, []);

    // Calculate selected values after currentAccount is determined
    const selectedCountry =
        countries?.find((c) => {
            // Only compare if both values are valid numbers
            const customerCountryId = currentAccount.country_id;
            if (customerCountryId == null || customerCountryId === undefined) {
                return false;
            }
            return c.id === Number(customerCountryId);
        }) || null;

    const selectedState =
        states?.find((s) => {
            // Only compare if both values are valid numbers
            const customerStateId = currentAccount.state_id;
            if (customerStateId == null || customerStateId === undefined) {
                return false;
            }
            return s.id === Number(customerStateId);
        }) || null;

    // SMS Provider Configuration functions
    const loadProviderConfigurationsForCountry = useCallback(
        async (countryId: number) => {
            setLoadingProviders(true);
            try {
                // First, get customer-specific preferences
                const customerPrefsResponse = await apiFetch(`/api/accounts/${accountId}/sms-preferences?country_id=${countryId}`
                );
                if (customerPrefsResponse.ok) {
                    const customerPrefs = await customerPrefsResponse.json();
                    if (customerPrefs.length > 0) {
                        setSmsProviderConfigs(customerPrefs);
                        return;
                    }
                }
                // If no customer-specific preferences exist, load global providers for this country
                const globalResponse = await apiFetch(`/api/sms/country-vendors?country_id=${countryId}`
                );
                if (globalResponse.ok) {
                    const globalProviders = await globalResponse.json();
                    // Transform global providers to customer-specific format
                    interface GlobalProvider {
                        vendor_id?: number;
                        country_id?: number;
                        [key: string]: unknown;
                    }
                    const customerProviders = (
                        globalProviders as GlobalProvider[]
                    ).map((provider) => ({
                        ...provider,
                        account_id: accountId,
                        is_enabled: true, // Default to enabled
                        priority: 1, // Default priority
                        isNewPreference: true, // Flag to indicate this needs to be created
                    }));
                    setSmsProviderConfigs(customerProviders);
                }
            } catch (error) {
                console.error("Error loading provider configurations:", error);
            } finally {
                setLoadingProviders(false);
            }
        },
        [accountId]
    );

    // Load providers when country changes
    useEffect(() => {
        if (selectedCountryForSMS) {
            loadProviderConfigurationsForCountry(selectedCountryForSMS.id);
        }
    }, [selectedCountryForSMS, loadProviderConfigurationsForCountry]);

    const toggleProvider = (providerId: number, enabled: boolean) => {
        setSmsProviderConfigs((prev) =>
            prev.map((config) =>
                config.id === providerId || config.vendor_id === providerId
                    ? { ...config, is_enabled: enabled, enabled }
                    : config
            )
        );
    };

    const updateProviderPriority = (providerId: number, priority: string) => {
        setSmsProviderConfigs((prev) =>
            prev.map((config) =>
                config.id === providerId || config.vendor_id === providerId
                    ? { ...config, priority: parseInt(priority) || 1 }
                    : config
            )
        );
    };

    const saveConfigurations = async () => {
        if (!selectedCountryForSMS || smsProviderConfigs.length === 0) {
            showError("No configurations to save");
            return;
        }
        try {
            setSavingConfigurations(true);
            // Save customer-specific preferences
            const savePromises = smsProviderConfigs.map(async (provider) => {
                const preferenceData = {
                    account_id: accountId,
                    country_id: provider.country_id,
                    vendor_id: provider.vendor_id,
                    is_enabled:
                        provider.is_enabled !== undefined
                            ? provider.is_enabled
                            : (provider.enabled ?? true),
                    priority: provider.priority || 1,
                };
                if (provider.isNewPreference || !provider.id) {
                    // Create new customer preference
                    const response = await apiFetch(`/api/accounts/${accountId}/sms-preferences`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify(preferenceData),
                        }
                    );
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(
                            errorData.error ||
                            "Failed to create provider preference"
                        );
                    }
                    return response.json();
                } else {
                    // Update existing customer preference
                    const response = await apiFetch(`/api/accounts/${accountId}/sms-preferences/${provider.id}`,
                        {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify(preferenceData),
                        }
                    );
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(
                            errorData.error ||
                            "Failed to update provider preference"
                        );
                    }
                    return response.json();
                }
            });
            await Promise.all(savePromises);
            success("SMS provider configurations saved successfully!");
            // Reload the configurations to reflect the saved changes
            await loadProviderConfigurationsForCountry(
                selectedCountryForSMS.id
            );
            // Also reload the user providers table
            await loadUserProviders();
        } catch (error: unknown) {
            console.error("Error saving configurations:", error);
            const errorMessage =
                error instanceof Error ? error.message : undefined;
            showError(errorMessage || "Failed to save configurations");
        } finally {
            setSavingConfigurations(false);
        }
    };

    const handleCloseSMSConfigModal = () => {
        setOpenSMSConfigModal(false);
        setSelectedCountryForSMS(null);
        setSmsProviderConfigs([]);
    };

    // Remove all provider CRUD logic using editedAccount
    // Use only providerForm and isProviderDialogOpen for provider CRUD
    // Update all handlers: handleEditProvider, handleSaveProvider, handleDeleteProvider, handleOpenProviderDialog, handleCloseProviderDialog
    // Remove all modal/batch save logic and toggles for provider CRUD
    // Ensure DataGrid and all handlers are type-safe and linter-clean
    // Example for handleEditProvider:
    const handleEditProvider = (provider: ProviderRow) => {
        setProviderForm({
            id: provider.id,
            country_id: provider.country_id,
            vendor_id: provider.vendor_id,
            is_enabled: provider.is_enabled,
            priority: provider.priority,
        });
        setIsProviderDialogOpen(true);
    };
    // Example for handleOpenProviderDialog (for add):
    const handleOpenProviderDialog = () => {
        setProviderForm({
            is_enabled: true,
            priority: 1,
        });
        setIsProviderDialogOpen(true);
    };
    // Example for handleCloseProviderDialog:
    const handleCloseProviderDialog = () => {
        setProviderForm({});
        setIsProviderDialogOpen(false);
    };
    // Example for handleSaveProvider:
    const handleSaveProvider = async () => {
        const errors: Record<string, string> = {};
        if (!providerForm.country_id)
            errors.country_id = t("validation.required", { ns: "common" });
        if (!providerForm.vendor_id)
            errors.vendor_id = t("validation.required", { ns: "common" });
        if (!providerForm.priority)
            errors.priority = t("validation.required", { ns: "common" });
        if (Object.keys(errors).length > 0) {
            showError(t("validation.please_fix_errors", { ns: "accounts" }));
            setValidationErrors(errors);
            return;
        }
        try {
            const url = providerForm.id
                ? `/api/accounts/${accountId}/sms-preferences/${providerForm.id}`
                : `/api/accounts/${accountId}/sms-preferences`;
            const method = providerForm.id ? "PUT" : "POST";
            const payload = {
                country_id: providerForm.country_id,
                vendor_id: providerForm.vendor_id,
                is_enabled: providerForm.is_enabled ?? true,
                priority: providerForm.priority ?? 1,
            };

            const response = await apiFetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error ||
                    (providerForm.id
                        ? "Failed to update provider preference"
                        : "Failed to create provider preference")
                );
            }
            success(
                providerForm.id
                    ? t("messages.provider_updated", { ns: "sms" })
                    : t("messages.provider_added", { ns: "sms" })
            );
            setProviderForm({});
            setIsProviderDialogOpen(false);
            await loadUserProviders();
            const newCount = smsProvidersUpdated + 1;
            setSmsProvidersUpdated(newCount); // Trigger re-check in IntelligentChannelSelection
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : undefined;
            showError(
                errorMessage ||
                (providerForm.id
                    ? t("messages.error_updating_provider", { ns: "sms" })
                    : t("messages.error_adding_provider", { ns: "sms" }))
            );
            console.error("Error saving provider:", error);
        }
    };
    // Example for handleDeleteProvider:
    const handleDeleteProvider = (provider: ProviderRow) => {
        setProviderToDelete(provider);
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteProvider = async () => {
        if (!providerToDelete) return;

        setIsDeletingProvider(true);
        try {
            const response = await apiFetch(`/api/accounts/${accountId}/sms-preferences/${providerToDelete.id}`,
                {
                    method: "DELETE",
                }
            );
            if (response.ok) {
                success(t("messages.provider_deleted", { ns: "sms" }));
                await loadUserProviders();
                const newCount = smsProvidersUpdated + 1;
                setSmsProvidersUpdated(newCount); // Trigger re-check in IntelligentChannelSelection
            } else {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to delete provider preference"
                );
            }
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : undefined;
            showError(errorMessage || "Failed to delete provider preference");
            console.error("Error deleting provider:", error);
        } finally {
            setIsDeletingProvider(false);
            setDeleteConfirmOpen(false);
            setProviderToDelete(null);
        }
    };

    const handleCloseDeleteConfirm = () => {
        setDeleteConfirmOpen(false);
        setProviderToDelete(null);
    };

    // Fetch mapped providers when country changes in the modal
    useEffect(() => {
        if (isProviderDialogOpen && providerForm.country_id) {
            setLoadingMappedProviders(true);

            // First try to get customer-specific preferences for this country
            apiFetch(`/api/accounts/${accountId}/sms-preferences?country_id=${providerForm.country_id}`
            )
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    return res.json();
                })
                .then((data) => {
                    // If we have customer preferences, use those
                    if (data.length > 0) {
                        setMappedProviders(data);
                    } else {
                        // If no customer preferences, try to get global country-vendor mappings
                        return apiFetch(`/api/sms/country-vendors?country_id=${providerForm.country_id}`
                        ).then((res) => {
                            if (!res.ok) {
                                throw new Error(
                                    `HTTP error! status: ${res.status}`
                                );
                            }
                            return res.json();
                        });
                    }
                })
                .then((globalData) => {
                    if (globalData && globalData.mappings) {
                        setMappedProviders(globalData.mappings);
                    } else if (globalData) {
                        setMappedProviders(globalData);
                    }
                })
                .catch((error) => {
                    console.error("Error loading providers:", error);
                    // If both customer preferences and global vendors fail, show empty list
                    setMappedProviders([]);
                })
                .finally(() => setLoadingMappedProviders(false));
        } else {
            setMappedProviders([]);
        }
    }, [isProviderDialogOpen, providerForm.country_id, accountId]);

    // Render all sections without tabs
    const renderGeneralTab = () => {
        // (search state and filteredProviders come from component scope)
        const sectionProps = {
            customer: currentAccount,
            onFieldChange: handleFieldChange,
            validationErrors,
            REQUIRED_FIELDS,
            selectedCountry,
            selectedState,
            decodeLogo,
            isArchaserAdmin,
        };

        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: { xs: 2, sm: 3 },
                }}
            >
                {/* General Information Section */}
                <Card elevation={0} sx={accountCardSx}>
                    <Box sx={accountCardHeaderSx}>
                        <InfoIcon
                            sx={{
                                color: "primary.main",
                                fontSize: { xs: 18, sm: 20 },
                            }}
                        />
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 500,
                                fontSize: { xs: "0.875rem", sm: "1rem" },
                            }}
                        >
                            {t("sections.general", { ns: "accounts" })}
                        </Typography>
                    </Box>
                    <CardContent sx={accountCardContentSx}>
                        <GeneralInformation {...sectionProps} />
                    </CardContent>
                </Card>

                {/* Address Information Section */}
                <Card elevation={0} sx={accountCardSx}>
                    <Box sx={accountCardHeaderSx}>
                        <LocationIcon
                            sx={{
                                color: "primary.main",
                                fontSize: { xs: 18, sm: 20 },
                            }}
                        />
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 500,
                                fontSize: { xs: "0.875rem", sm: "1rem" },
                            }}
                        >
                            {t("sections.address", { ns: "accounts" })}
                        </Typography>
                    </Box>
                    <CardContent sx={accountCardContentSx}>
                        <AddressInformation {...sectionProps} />
                    </CardContent>
                </Card>

                {/* Automation Settings Section */}
                <Card elevation={0} sx={accountCardSx}>
                    <Box sx={accountCardHeaderSx}>
                        <SettingsIcon
                            sx={{
                                color: "primary.main",
                                fontSize: { xs: 18, sm: 20 },
                            }}
                        />
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 500,
                                fontSize: { xs: "0.875rem", sm: "1rem" },
                            }}
                        >
                            {t("sections.automation", { ns: "accounts" })}
                        </Typography>
                    </Box>
                    <CardContent sx={accountCardContentSx}>
                        <AutomationSettings {...sectionProps} />
                    </CardContent>
                </Card>

                {/* Portal Settings Section */}
                <Card elevation={0} sx={accountCardSx}>
                    <Box sx={accountCardHeaderSx}>
                        <PortalIcon
                            sx={{
                                color: "primary.main",
                                fontSize: { xs: 18, sm: 20 },
                            }}
                        />
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 500,
                                fontSize: { xs: "0.875rem", sm: "1rem" },
                            }}
                        >
                            {t("sections.portal", { ns: "accounts" })}
                        </Typography>
                    </Box>
                    <CardContent sx={accountCardContentSx}>
                        <PortalSettings
                            {...sectionProps}
                            decodeLogo={
                                decodeLogo as (
                                    logoData?: string | null | undefined
                                ) => string
                            }
                        />
                    </CardContent>
                </Card>

                {/* Credit Insurance (limit warnings window) */}
                <Card elevation={0} sx={accountCardSx}>
                    <Box sx={accountCardHeaderSx}>
                        <CreditInsuranceIcon
                            sx={{
                                color: "primary.main",
                                fontSize: { xs: 18, sm: 20 },
                            }}
                        />
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 500,
                                fontSize: { xs: "0.875rem", sm: "1rem" },
                            }}
                        >
                            {t("sections.credit_insurance", {
                                ns: "accounts",
                                defaultValue: "Credit Insurance",
                            })}
                        </Typography>
                    </Box>
                    <CardContent sx={accountCardContentSx}>
                        {editedAccount.has_credit_insurance ? (
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: {
                                        xs: "1fr",
                                        md: "repeat(4, minmax(0, 1fr))",
                                    },
                                    gap: 2,
                                    width: "100%",
                                }}
                            >
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={t(
                                        "fields.limit_warning_threshold_pct",
                                        {
                                            ns: "accounts",
                                            defaultValue:
                                                "Approved limit warning threshold (%)",
                                        }
                                    )}
                                    value={
                                        editedAccount.credit_limit_warning_threshold_pct !=
                                        null
                                            ? String(
                                                  editedAccount.credit_limit_warning_threshold_pct
                                              )
                                            : ""
                                    }
                                    onChange={(e) =>
                                        handleFieldChange(
                                            "credit_limit_warning_threshold_pct",
                                            e.target.value === ""
                                                ? null
                                                : parseInt(e.target.value, 10)
                                        )
                                    }
                                    inputProps={{ min: 1, max: 100, step: 1 }}
                                />
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={t(
                                        "fields.credit_score_validity_warning_days",
                                        {
                                            ns: "accounts",
                                            defaultValue:
                                                "Credit score validity warning days",
                                        }
                                    )}
                                    value={
                                        editedAccount.credit_score_validity_warning_days !=
                                        null
                                            ? String(
                                                  editedAccount.credit_score_validity_warning_days
                                              )
                                            : ""
                                    }
                                    onChange={(e) =>
                                        handleFieldChange(
                                            "credit_score_validity_warning_days",
                                            e.target.value === ""
                                                ? null
                                                : parseInt(e.target.value, 10)
                                        )
                                    }
                                    inputProps={{ min: 0, step: 1 }}
                                />
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={t(
                                        "fields.reporting_date_warning_days",
                                        {
                                            ns: "accounts",
                                            defaultValue:
                                                "Reporting date warning days",
                                        }
                                    )}
                                    value={
                                        editedAccount.reporting_date_warning_days !=
                                        null
                                            ? String(
                                                  editedAccount.reporting_date_warning_days
                                              )
                                            : ""
                                    }
                                    onChange={(e) =>
                                        handleFieldChange(
                                            "reporting_date_warning_days",
                                            e.target.value === ""
                                                ? null
                                                : parseInt(e.target.value, 10)
                                        )
                                    }
                                    inputProps={{ min: 0, step: 1 }}
                                />
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    label={t(
                                        "fields.limit_expiration_warning_days",
                                        {
                                            ns: "accounts",
                                            defaultValue:
                                                "Limit expiration warning days",
                                        }
                                    )}
                                    value={
                                        editedAccount.customer_limit_expiration_warning_days !=
                                        null
                                            ? String(
                                                  editedAccount.customer_limit_expiration_warning_days
                                              )
                                            : ""
                                    }
                                    onChange={(e) =>
                                        handleFieldChange(
                                            "customer_limit_expiration_warning_days",
                                            e.target.value === ""
                                                ? null
                                                : parseInt(e.target.value, 10)
                                        )
                                    }
                                    inputProps={{ min: 0, step: 1 }}
                                />
                            </Box>
                        ) : (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ maxWidth: 560 }}
                            >
                                {t(
                                    "hints.credit_insurance_section_disabled",
                                    {
                                        ns: "accounts",
                                        defaultValue:
                                            "Turn on Credit Insurance under General Information → Products to configure how many days before limit expiration customers appear in Limit Warnings.",
                                    }
                                )}
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            </Box>
        );
    };

    const renderCommunicationTab = () => {
        const sectionProps = {
            customer: currentAccount,
            onFieldChange: handleFieldChange,
            validationErrors,
            REQUIRED_FIELDS,
            selectedCountry,
            selectedState,
            decodeLogo,
            isNewAccount,
        };

        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: { xs: 2, sm: 3 },
                }}
            >
                {/* Communication Settings Section */}
                <Card elevation={0} sx={accountCardSx}>
                    <Box sx={accountCardHeaderSx}>
                        <EmailIcon
                            sx={{
                                color: "primary.main",
                                fontSize: { xs: 18, sm: 20 },
                            }}
                        />
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 500,
                                fontSize: { xs: "0.875rem", sm: "1rem" },
                            }}
                        >
                            {t("sections.communication", { ns: "accounts" })}
                        </Typography>
                    </Box>
                    <CardContent sx={accountCardContentSx}>
                        <CommunicationSettings {...sectionProps} />
                    </CardContent>
                </Card>

                {/* Intelligent Channel Selection Section */}
                <Card elevation={0} sx={accountCardSx}>
                    <Box sx={accountCardHeaderSx}>
                        <PsychologyIcon
                            sx={{
                                color: "primary.main",
                                fontSize: { xs: 18, sm: 20 },
                            }}
                        />
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 500,
                                fontSize: { xs: "0.875rem", sm: "1rem" },
                            }}
                        >
                            {t("sections.intelligent_channel_selection", {
                                ns: "accounts",
                            })}
                        </Typography>
                    </Box>
                    <CardContent sx={accountCardContentSx}>
                        <IntelligentChannelSelection
                            {...sectionProps}
                            smsProvidersUpdated={smsProvidersUpdated}
                        />
                    </CardContent>
                </Card>

                {/* SMS Provider Configuration Section */}
                <Card elevation={0} sx={accountCardSx}>
                    <Box
                        sx={{
                            ...accountCardHeaderSx,
                            justifyContent: "space-between",
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <SettingsIcon
                                sx={{
                                    color: "primary.main",
                                    fontSize: { xs: 18, sm: 20 },
                                }}
                            />
                            <Typography
                                variant="subtitle1"
                                sx={{
                                    fontWeight: 500,
                                    fontSize: { xs: "0.875rem", sm: "1rem" },
                                }}
                            >
                                {t("sections.sms_provider_configuration", {
                                    ns: "sms",
                                })}
                            </Typography>
                        </Box>
                    </Box>
                    <CardContent sx={accountCardContentSx}>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            {t(
                                "messages.sms_provider_configuration_description",
                                { ns: "sms" }
                            )}
                        </Typography>
                        <EndlessScrollDataGrid
                            rows={filteredProviders as ProviderRow[]}
                            columns={providerColumns}
                            isLoading={loadingUserProviders}
                            totalRecords={filteredProviders.length}
                            hasMore={false}
                            onLoadMore={() => { }}
                            searchValue={providerSearch}
                            onSearchChange={(value) => setProviderSearch(value)}
                            searchPlaceholder={t("fields.search_placeholder", {
                                ns: "common",
                            })}
                            searchDebounceMs={500}
                            searchDisabled={false}
                            searchDirection={
                                i18n.language === "he" ? "rtl" : "ltr"
                            }
                            language={i18n.language}
                            resizableColumns={true}
                            customButtons={
                                !isNewAccount && (
                                    <Tooltip
                                        title={t("actions.add_provider", {
                                            ns: "sms",
                                        })}
                                        {...getEndlessScrollToolbarTooltipProps(
                                            i18n.language === "he"
                                        )}
                                    >
                                        <IconButton
                                            color="primary"
                                            size="small"
                                            type="button"
                                            className="toolbar-button"
                                            onClick={handleOpenProviderDialog}
                                        >
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    display: "inline-flex",
                                                }}
                                            >
                                                <PortalIcon />
                                                <AddIcon
                                                    sx={(theme) => ({
                                                        position: "absolute",
                                                        right: theme.spacing(
                                                            -0.5
                                                        ),
                                                        bottom: theme.spacing(
                                                            -0.5
                                                        ),
                                                        fontSize:
                                                            theme.typography.pxToRem(
                                                                13
                                                            ),
                                                        backgroundColor:
                                                            theme.palette
                                                                .primary.main,
                                                        color: theme.palette
                                                            .primary
                                                            .contrastText,
                                                        borderRadius: "50%",
                                                        width: theme.spacing(2),
                                                        height: theme.spacing(
                                                            2
                                                        ),
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                    })}
                                                />
                                            </Box>
                                        </IconButton>
                                    </Tooltip>
                                )
                            }
                        />
                    </CardContent>
                </Card>
            </Box>
        );
    };

    const renderUsersTab = () => {
        const sectionProps = {
            customer: currentAccount,
            onFieldChange: handleFieldChange,
            validationErrors,
            REQUIRED_FIELDS,
            selectedCountry,
            selectedState,
            decodeLogo,
        };

        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: { xs: 2, sm: 3 },
                }}
            >
                {!isNewAccount && currentAccount?.id && (
                    <AccountUsers {...sectionProps} />
                )}
            </Box>
        );
    };

    const renderBusinessUnitsTab = () => {
        // Only render if account has an ID (not a new account)
        if (!currentAccount?.id || isNewAccount) {
            return null;
        }

        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: { xs: 2, sm: 3 },
                }}
            >
                <BusinessUnits accountId={currentAccount.id} />
            </Box>
        );
    };

    // DataGrid columns typing
    const providerColumns: GridColDef<ProviderRow>[] = [
        {
            field: "country",
            headerName: t("fields.country", { ns: "common" }),
            flex: 1,
            renderCell: (params: GridRenderCellParams<ProviderRow>) => {
                const row = params.row;
                if (!row || !row.Country) return "-";
                return `${row.Country.emoji || ""} ${row.Country.name || "-"}`;
            },
        },
        {
            field: "provider",
            headerName: t("fields.provider", { ns: "accounts" }),
            flex: 1,
            renderCell: (params: GridRenderCellParams<ProviderRow>) => {
                const row = params.row;
                if (!row || !row.SMSVendor) return "-";
                return row.SMSVendor.provider || "-";
            },
        },
        {
            field: "priority",
            headerName: t("fields.priority", { ns: "accounts" }),
            flex: 0.5,
            renderCell: (params: GridRenderCellParams<ProviderRow>) => {
                const row = params.row;
                if (!row) return "1";
                return row.priority || 1;
            },
        },
        {
            field: "status",
            headerName: t("fields.status", { ns: "common" }),
            flex: 1,
            minWidth: 100,
            renderCell: (params: GridRenderCellParams<ProviderRow>) => {
                const isActive = params.row.is_enabled === true;
                return (
                    <Chip
                        label={
                            isActive
                                ? t("values.status_active", { ns: "common" })
                                : t("values.status_inactive", { ns: "common" })
                        }
                        size="small"
                        data-status={isActive ? "active" : "inactive"}
                    />
                );
            },
        },
        {
            field: "actions",
            headerName: t("actions.actions", { ns: "common" }),
            flex: 0.7,
            sortable: false,
            renderCell: (params: GridRenderCellParams<ProviderRow>) =>
                params && params.row ? (
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditProvider(params.row)}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleDeleteProvider(params.row)}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Box>
                ) : null,
        },
    ];

    // Minimalistic Loading State
    if (isLoading && !isNewAccount) {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.default",
                    px: { xs: 2, sm: 3 },
                }}
            >
                <Box textAlign="center">
                    <CircularProgress
                        color="primary"
                        size={40}
                        sx={{
                            mb: { xs: 1, sm: 2 },
                            width: { xs: 32, sm: 40 },
                            height: { xs: 32, sm: 40 },
                        }}
                    />
                </Box>
            </Box>
        );
    }

    // Minimalistic Error State - Show spinner instead of error
    if (error && !isNewAccount) {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.default",
                    px: { xs: 2, sm: 3 },
                }}
            >
                <Box textAlign="center">
                    <CircularProgress
                        color="primary"
                        size={40}
                        sx={{
                            width: { xs: 32, sm: 40 },
                            height: { xs: 32, sm: 40 },
                        }}
                    />
                </Box>
            </Box>
        );
    }

    // Minimalistic Not Found State - Show spinner instead of warning
    if (!account && !isNewAccount) {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.default",
                    px: { xs: 2, sm: 3 },
                }}
            >
                <Box textAlign="center">
                    <CircularProgress
                        color="primary"
                        size={40}
                        sx={{
                            width: { xs: 32, sm: 40 },
                            height: { xs: 32, sm: 40 },
                        }}
                    />
                </Box>
            </Box>
        );
    }

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
            data-testid="account-details-container"
        >
            <Fade in timeout={400}>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                    }}
                >
                    {/* Deletion Status Banner */}
                    {(currentAccount as any)?.deleted_at && (
                        <Alert
                            severity={(() => {
                                const deleted = new Date(
                                    (currentAccount as any).deleted_at
                                );
                                const gracePeriodEnds = new Date(deleted);
                                gracePeriodEnds.setDate(
                                    gracePeriodEnds.getDate() + 30
                                );
                                const canRestore = new Date() < gracePeriodEnds;
                                return canRestore ? "warning" : "error";
                            })()}
                            sx={{
                                mb: 3,
                                mx: { xs: 1, sm: 1.5 },
                                borderRadius: theme.shape.borderRadius,
                                "& .MuiAlert-message": {
                                    width: "100%",
                                },
                            }}
                        >
                            <Box>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 600, mb: 1 }}
                                >
                                    {(() => {
                                        const canRestore =
                                            gracePeriodDaysRemaining > 0;

                                        return canRestore
                                            ? `${t("messages.deleted_with_grace_period", { ns: "accounts" })} (${gracePeriodDaysRemaining} ${t("fields.days", { ns: "common" })} ${t("messages.remaining_for_restoration", { ns: "accounts" })})`
                                            : t("messages.anonymized", {
                                                ns: "accounts",
                                            });
                                    })()}
                                </Typography>
                                <Typography variant="body2">
                                    {(() => {
                                        const deleted = new Date(
                                            (currentAccount as any).deleted_at
                                        );
                                        const gracePeriodEnds = new Date(
                                            deleted
                                        );
                                        gracePeriodEnds.setDate(
                                            gracePeriodEnds.getDate() + 30
                                        );
                                        const canRestore =
                                            gracePeriodDaysRemaining > 0;

                                        // Format dates using user's locale
                                        const deletedDate =
                                            deleted.toLocaleDateString(
                                                i18n.language,
                                                {
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                }
                                            );
                                        const gracePeriodEndDate =
                                            gracePeriodEnds.toLocaleDateString(
                                                i18n.language,
                                                {
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric",
                                                }
                                            );

                                        return canRestore
                                            ? t("messages.deleted_message", {
                                                ns: "accounts",
                                                deletedDate,
                                                gracePeriodEndDate,
                                            })
                                            : t("messages.anonymized_message", {
                                                ns: "accounts",
                                            });
                                    })()}
                                </Typography>
                            </Box>
                        </Alert>
                    )}

                    {/* Sticky Account Header — match CustomerDetailsCombined */}
                    <Box
                        sx={{
                            position: "sticky",
                            top: { xs: "-8px", sm: "-12px" },
                            left: 0,
                            right: 0,
                            zIndex: 30,
                            bgcolor: "background.paper",
                            backgroundColor: "background.paper",
                            flexShrink: 0,
                            m: 0,
                            mt: 0,
                            px: { xs: 1, sm: 1.5 },
                            width: "100%",
                            maxWidth: "100%",
                        }}
                    >
                        <AccountHeader
                            key={`account-header-${currentAccount.logo || "no-logo"}`}
                            customer={currentAccount}
                            isEditing={!isAccountViewOnly}
                            isSaving={isSaving}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            onFieldChange={handleFieldChange}
                            decodeLogo={
                                decodeLogo as (
                                    logoData?: string | null | undefined
                                ) => string
                            }
                            isNewAccount={isNewAccount}
                        />
                    </Box>

                    {/* Tabs — non-sticky, match CustomerDetailsCombined */}
                    <Box
                        sx={{
                            px: { xs: 1, sm: 1.5 },
                            mt: { xs: 2, sm: 3 },
                        }}
                    >
                        <Tabs
                            value={activeTab}
                            onChange={handleTabChange}
                            aria-label="account tabs"
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{
                                bgcolor: "background.paper",
                                minHeight: "unset",
                                width: "100%",
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
                                        backgroundColor:
                                            theme.palette.primary.main,
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
                                        transition: theme.transitions.create(
                                            ["all"],
                                            {
                                                duration:
                                                    theme.transitions.duration
                                                        .short,
                                                easing: theme.transitions.easing
                                                    .easeInOut,
                                            }
                                        ),
                                        "&:hover": {
                                            color: theme.palette.primary.main,
                                            backgroundColor:
                                                theme.palette.action.hover,
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
                                <Tab
                                    label={t("sections.tab_general", {
                                        ns: "accounts",
                                    }).toUpperCase()}
                                    icon={
                                        <InfoIcon
                                            sx={{
                                                mb: 0.5,
                                                mr:
                                                    i18n.language === "he"
                                                        ? 0
                                                        : 1,
                                                ml:
                                                    i18n.language === "he"
                                                        ? 1
                                                        : 0,
                                            }}
                                        />
                                    }
                                    iconPosition="start"
                                />
                                <Tab
                                    label={t("sections.tab_communication", {
                                        ns: "accounts",
                                    }).toUpperCase()}
                                    icon={
                                        <EmailIcon
                                            sx={{
                                                mb: 0.5,
                                                mr:
                                                    i18n.language === "he"
                                                        ? 0
                                                        : 1,
                                                ml:
                                                    i18n.language === "he"
                                                        ? 1
                                                        : 0,
                                            }}
                                        />
                                    }
                                    iconPosition="start"
                                />
                                <Tab
                                    label={t("sections.tab_users", {
                                        ns: "accounts",
                                    }).toUpperCase()}
                                    icon={
                                        <PeopleIcon
                                            sx={{
                                                mb: 0.5,
                                                mr:
                                                    i18n.language === "he"
                                                        ? 0
                                                        : 1,
                                                ml:
                                                    i18n.language === "he"
                                                        ? 1
                                                        : 0,
                                            }}
                                        />
                                    }
                                    iconPosition="start"
                                    disabled={
                                        isNewAccount || !currentAccount?.id
                                    }
                                />
                                {hasViewBusinessUnitsPermission && (
                                    <Tab
                                        label={t(
                                            "sections.tab_business_units",
                                            { ns: "accounts" }
                                        ).toUpperCase()}
                                        icon={
                                            <BusinessIcon
                                                sx={{
                                                    mb: 0.5,
                                                    mr:
                                                        i18n.language === "he"
                                                            ? 0
                                                            : 1,
                                                    ml:
                                                        i18n.language === "he"
                                                            ? 1
                                                            : 0,
                                                }}
                                            />
                                        }
                                        iconPosition="start"
                                        disabled={isNewAccount}
                                    />
                                )}
                                <Tab
                                    label={t("sections.tab_security_roles", {
                                        ns: "accounts",
                                    }).toUpperCase()}
                                    icon={
                                        <SecurityIcon
                                            sx={{
                                                mb: 0.5,
                                                mr:
                                                    i18n.language === "he"
                                                        ? 0
                                                        : 1,
                                                ml:
                                                    i18n.language === "he"
                                                        ? 1
                                                        : 0,
                                            }}
                                        />
                                    }
                                    iconPosition="start"
                                    disabled={isNewAccount}
                                />
                                <Tab
                                    label={t("sections.tab_sso", {
                                        ns: "accounts",
                                    }).toUpperCase()}
                                    icon={
                                        <KeyIcon
                                            sx={{
                                                mb: 0.5,
                                                mr:
                                                    i18n.language === "he"
                                                        ? 0
                                                        : 1,
                                                ml:
                                                    i18n.language === "he"
                                                        ? 1
                                                        : 0,
                                            }}
                                        />
                                    }
                                    iconPosition="start"
                                    disabled={isNewAccount}
                                />
                                {showBillingIntegrationTab && (
                                    <Tab
                                        label={t(
                                            "sections.tab_billing_integration",
                                            {
                                                ns: "accounts",
                                                defaultValue: "Billing integration",
                                            }
                                        ).toUpperCase()}
                                        icon={
                                            <BillingIcon
                                                sx={{
                                                    mb: 0.5,
                                                    mr:
                                                        i18n.language === "he"
                                                            ? 0
                                                            : 1,
                                                    ml:
                                                        i18n.language === "he"
                                                            ? 1
                                                            : 0,
                                                }}
                                            />
                                        }
                                        iconPosition="start"
                                        disabled={isNewAccount}
                                    />
                                )}
                            </Tabs>
                    </Box>

                    {/* Content area — match CustomerDetailsCombined */}
                    <Box
                        sx={{
                            flex: 1,
                            width: "100%",
                            position: "relative",
                            px: { xs: 1, sm: 1.5 },
                            ...(isAccountViewOnly && {
                                pointerEvents: "none",
                                opacity: 0.7,
                                userSelect: "none",
                            }),
                        }}
                    >
                                    {activeTab === 0 && renderGeneralTab()}
                                    {activeTab === 1 &&
                                        renderCommunicationTab()}
                                    {activeTab === 2 && renderUsersTab()}
                                    {activeTab === 3 &&
                                        hasViewBusinessUnitsPermission &&
                                        renderBusinessUnitsTab()}
                                    {activeTab === securityRolesTabIndex && (
                                        <AccountRoles accountId={accountId} />
                                    )}
                                    {activeTab === ssoTabIndex && (
                                        <SSOSettings
                                            accountId={Number(accountId)}
                                            ssoEnabled={editedAccount.sso_enabled ?? false}
                                            ssoProviders={(editedAccount.sso_providers || "").split(",").map((p: string) => p.trim()).filter(Boolean)}
                                            onSave={async (ssoEnabled: boolean, ssoProviders: string[]) => {
                                                // Update local state
                                                const updatedAccount = {
                                                    ...editedAccount,
                                                    sso_enabled: ssoEnabled,
                                                    sso_providers: ssoProviders.join(","),
                                                };
                                                setEditedAccount(updatedAccount);

                                                // Make direct API call with the updated values
                                                setIsSaving(true);
                                                try {
                                                    const url = `/api/entities/accounts/${accountId}`;
                                                    const payload: any = { ...updatedAccount };
                                                    delete payload.logoFile;
                                                    delete payload.logoPreview;
                                                    payload.id = Number(accountId);

                                                    const response = await apiFetch(url, {
                                                        method: "PUT",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify(payload),
                                                    });

                                                    if (!response.ok) {
                                                        throw new Error("Failed to update SSO settings");
                                                    }

                                                    const result = await response.json();
                                                    const finalAccount: any = { ...updatedAccount, ...result };
                                                    delete finalAccount.logoFile;
                                                    delete finalAccount.logoPreview;
                                                    setEditedAccount(finalAccount as AccountFormData);

                                                    await queryClient.invalidateQueries({
                                                        queryKey: ["account", account?.id],
                                                        refetchType: "active",
                                                    });

                                                    success(t("messages.account_updated_successfully", { ns: "accounts" }));
                                                } catch (error: unknown) {
                                                    const errorMessage = error instanceof Error ? error.message : undefined;
                                                    showError(errorMessage || t("messages.error_updating_account", { ns: "accounts" }));
                                                } finally {
                                                    setIsSaving(false);
                                                }
                                            }}
                                        />
                                    )}
                                    {billingTabIndex >= 0 && billingTabVisited && (
                                        <Box
                                            sx={{
                                                display:
                                                    activeTab === billingTabIndex
                                                        ? "block"
                                                        : "none",
                                            }}
                                        >
                                            <BillingIntegrationSettings
                                                ref={billingSettingsRef}
                                                accountId={Number(accountId)}
                                                canManage={
                                                    hasManageBillingConnectorPermission &&
                                                    !isAccountViewOnly
                                                }
                                            />
                                        </Box>
                                    )}
                    </Box>

                    {/* SMS Provider Configuration Modal */}
                    <AppDialog
                        open={openSMSConfigModal}
                        onClose={handleCloseSMSConfigModal}
                        drag={false}
                        align={false}
                        slide={false}
                        isRTL={i18n.language === "he"}
                        title={
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <SettingsIcon />
                                {t(
                                    "sections.sms_provider_configuration_modal_title",
                                    { ns: "sms" }
                                )}
                            </Box>
                        }
                        titleIcon={null}
                        ariaLabelledBy="sms-config-modal-title"
                        ariaDescribedBy="sms-config-modal-description"
                        maxWidth="lg"
                        fullWidth
                        actions={
                            <>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    className="cancel-button"
                                    onClick={handleCloseSMSConfigModal}
                                    disabled={savingConfigurations}
                                    sx={{
                                        mr:
                                            i18n.language === "he"
                                                ? 0
                                                : theme.spacing(1),
                                        ml:
                                            i18n.language === "he"
                                                ? theme.spacing(1)
                                                : 0,
                                    }}
                                >
                                    {t("actions.cancel", { ns: "common" })}
                                </Button>
                                {selectedCountryForSMS &&
                                    smsProviderConfigs.length > 0 && (
                                        <Button
                                            variant="contained"
                                            size="small"
                                            className="save-button"
                                            onClick={saveConfigurations}
                                            disabled={savingConfigurations}
                                            endIcon={
                                                savingConfigurations ? (
                                                    <CircularProgress
                                                        size={16}
                                                        sx={{ color: "inherit" }}
                                                    />
                                                ) : undefined
                                            }
                                            sx={{
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                "& .MuiButton-endIcon": {
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
                                        >
                                            {t("actions.save_configurations", {
                                                ns: "sms",
                                            })}
                                        </Button>
                                    )}
                            </>
                        }
                    >
                        <Box
                            id="sms-config-modal-description"
                            component="div"
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: { xs: 2, sm: 3 },
                                maxWidth: "900px",
                                mx: "auto",
                                py: 2,
                            }}
                        >
                                <CountrySelect
                                    value={selectedCountryForSMS}
                                    onChange={setSelectedCountryForSMS}
                                    label={t("fields.select_country", {
                                        ns: "accounts",
                                    })}
                                />

                                {selectedCountryForSMS && (
                                    <Box>
                                        <Typography variant="h6" sx={{ mb: 2 }}>
                                            {t(
                                                "sections.configure_providers_for",
                                                {
                                                    ns: "sms",
                                                    country:
                                                        selectedCountryForSMS.name,
                                                }
                                            )}
                                        </Typography>

                                        {loadingProviders ? (
                                            <Box
                                                display="flex"
                                                justifyContent="center"
                                                py={4}
                                            >
                                                <CircularProgress
                                                    color="primary"
                                                    size={40}
                                                />
                                            </Box>
                                        ) : smsProviderConfigs.length > 0 ? (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 1,
                                                }}
                                            >
                                                {smsProviderConfigs.map(
                                                    (provider) => (
                                                        <Box
                                                            key={provider.id}
                                                            sx={{
                                                                display: "flex",
                                                                justifyContent:
                                                                    "space-between",
                                                                alignItems:
                                                                    "center",
                                                                p: 2,
                                                                border: "1px solid",
                                                                borderColor:
                                                                    "divider",
                                                                borderRadius: 1,
                                                                bgcolor:
                                                                    "background.default",
                                                            }}
                                                        >
                                                            <Box>
                                                                <Typography
                                                                    variant="body1"
                                                                    fontWeight="medium"
                                                                >
                                                                    {
                                                                        provider
                                                                            .SMSVendor
                                                                            ?.provider
                                                                    }{" "}
                                                                    -{" "}
                                                                    {provider.comment ||
                                                                        "Unnamed Provider"}
                                                                </Typography>
                                                                <Typography
                                                                    variant="body2"
                                                                    color="text.secondary"
                                                                >
                                                                    {provider
                                                                        .SMSVendor
                                                                        ?.phone_number ||
                                                                        "No phone number configured"}
                                                                </Typography>
                                                            </Box>
                                                            <Box
                                                                sx={{
                                                                    display:
                                                                        "flex",
                                                                    alignItems:
                                                                        "center",
                                                                    gap: 2,
                                                                }}
                                                            >
                                                                <FormControlLabel
                                                                    control={
                                                                        <Switch
                                                                            checked={
                                                                                provider.is_enabled ||
                                                                                false
                                                                            }
                                                                            onChange={(
                                                                                e
                                                                            ) =>
                                                                                provider.id !==
                                                                                undefined &&
                                                                                toggleProvider(
                                                                                    provider.id,
                                                                                    e
                                                                                        .target
                                                                                        .checked
                                                                                )
                                                                            }
                                                                            color="primary"
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
                                                                            {provider.is_enabled
                                                                                ? t(
                                                                                    "fields.enabled",
                                                                                    {
                                                                                        ns: "common",
                                                                                    }
                                                                                )
                                                                                : t(
                                                                                    "fields.disabled",
                                                                                    {
                                                                                        ns: "common",
                                                                                    }
                                                                                )}
                                                                        </Typography>
                                                                    }
                                                                />
                                                                <TextField
                                                                    label={t(
                                                                        "fields.priority",
                                                                        {
                                                                            ns: "accounts",
                                                                        }
                                                                    )}
                                                                    type="number"
                                                                    value={
                                                                        provider.priority ||
                                                                        1
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        provider.id !==
                                                                        undefined &&
                                                                        updateProviderPriority(
                                                                            provider.id,
                                                                            e
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                    size="small"
                                                                    sx={{
                                                                        width: 100,
                                                                    }}
                                                                    inputProps={{
                                                                        min: 1,
                                                                        max: 10,
                                                                    }}
                                                                />
                                                            </Box>
                                                        </Box>
                                                    )
                                                )}
                                            </Box>
                                        ) : (
                                            <Alert severity="info">
                                                {t(
                                                    "messages.sms_provider_configuration_no_providers_available",
                                                    { ns: "sms" }
                                                )}
                                            </Alert>
                                        )}
                                    </Box>
                                )}
                        </Box>
                    </AppDialog>

                    {/* SMS Provider Preference Dialog */}
                    <AppDialog
                        open={isProviderDialogOpen}
                        onClose={handleCloseProviderDialog}
                        drag
                        align
                        slide
                        isRTL={i18n.language === "he"}
                        paperWidth="380px"
                        paperMaxHeight="90vh"
                        title={
                            providerForm.id
                                ? t("actions.edit_provider", { ns: "sms" })
                                : t("actions.add_provider", { ns: "sms" })
                        }
                        titleIcon={<EditIcon aria-hidden="true" />}
                        ariaLabelledBy="add-provider-dialog-title"
                        ariaDescribedBy="add-provider-dialog-description"
                        actions={
                            <>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    className="cancel-button"
                                    onClick={handleCloseProviderDialog}
                                    fullWidth={false}
                                    disabled={savingConfigurations}
                                    sx={{
                                        mr:
                                            i18n.language === "he"
                                                ? 0
                                                : theme.spacing(1),
                                        ml:
                                            i18n.language === "he"
                                                ? theme.spacing(1)
                                                : 0,
                                    }}
                                >
                                    {t("actions.cancel", { ns: "common" })}
                                </Button>
                                <Button
                                    variant="contained"
                                    size="small"
                                    className="save-button"
                                    onClick={handleSaveProvider}
                                    disabled={savingConfigurations}
                                    fullWidth={false}
                                    endIcon={
                                        savingConfigurations ? (
                                            <CircularProgress
                                                size={16}
                                                sx={{ color: "inherit" }}
                                            />
                                        ) : undefined
                                    }
                                    sx={{
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        "& .MuiButton-endIcon": {
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
                                >
                                    {providerForm.id
                                        ? t("actions.save", { ns: "common" })
                                        : t("actions.add", { ns: "common" })}
                                </Button>
                            </>
                        }
                    >
                        <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2.5,
                                    p: { xs: 2, sm: 3 },
                                    "& .MuiFormControl-root": {
                                        mb: 0, // Remove default margins since we use gap
                                    },
                                    "& .MuiTextField-root": {
                                        mb: 0, // Remove default margins since we use gap
                                    },
                                    // Only apply fixed height to regular TextFields, not Autocomplete components
                                    "& .MuiTextField-root:not(.MuiAutocomplete-inputRoot)":
                                    {
                                        height: "40px", // Fixed height for regular text fields
                                        "& .MuiInputBase-root": {
                                            height: "40px",
                                        },
                                        "& .MuiInputLabel-root": {
                                            transform:
                                                "translate(14px, 9px) scale(1)",
                                            "&.Mui-focused, &.MuiFormLabel-filled":
                                            {
                                                transform:
                                                    "translate(14px, -9px) scale(0.75)",
                                            },
                                        },
                                    },
                                }}
                            >
                                {/* Country Selection - Filtered to only show countries with SMS vendors */}
                                <Box>
                                    <Autocomplete
                                        options={countriesWithSMSVendors}
                                        loading={loadingCountriesWithSMS}
                                        getOptionLabel={(option) =>
                                            `${option.emoji || "🏳️"} ${option.name}`
                                        }
                                        isOptionEqualToValue={(option, value) =>
                                            option.id === value.id
                                        }
                                        value={
                                            (providerForm.country_id
                                                ? countriesWithSMSVendors.find(
                                                    (c) =>
                                                        c.id ===
                                                        providerForm.country_id
                                                )
                                                : null) || null
                                        }
                                        onChange={(_, newValue) => {
                                            setProviderForm({
                                                ...providerForm,
                                                country_id: newValue
                                                    ? Number(newValue.id)
                                                    : undefined,
                                                vendor_id: undefined,
                                            });
                                            // Clear validation error when user selects a value
                                            if (validationErrors.country_id) {
                                                setValidationErrors((prev) => {
                                                    const updated = { ...prev };
                                                    delete updated.country_id;
                                                    return updated;
                                                });
                                            }
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label={t(
                                                    "fields.select_country",
                                                    { ns: "accounts" }
                                                )}
                                                size="small"
                                                variant="outlined"
                                                error={
                                                    !!validationErrors.country_id
                                                }
                                                helperText={
                                                    validationErrors.country_id
                                                }
                                                sx={{
                                                    padding: 0,
                                                    margin: 0,
                                                    "& .MuiFormControl-root": {
                                                        padding: 0,
                                                        margin: 0,
                                                    },
                                                    "& .MuiInputLabel-root": {
                                                        whiteSpace: "nowrap",
                                                        overflow: "visible",
                                                        textOverflow: "clip",
                                                    },
                                                    "& .MuiOutlinedInput-root": {
                                                        display: "flex !important",
                                                        alignItems: "center !important",
                                                    },
                                                    "& .MuiOutlinedInput-input": {
                                                        paddingTop: "6px !important",
                                                        paddingBottom: "6px !important",
                                                    },
                                                }}
                                            />
                                        )}
                                    />
                                </Box>

                                {/* Provider Selection */}
                                <Box sx={{ minHeight: "56px" }}>
                                    <Autocomplete
                                        options={mappedProviders}
                                        loading={loadingMappedProviders}
                                        disabled={!providerForm.country_id}
                                        getOptionLabel={(option: ProviderRow) =>
                                            option?.SMSVendor?.provider ||
                                            option?.provider ||
                                            ""
                                        }
                                        isOptionEqualToValue={(
                                            option: ProviderRow,
                                            value: ProviderRow
                                        ) =>
                                            (option?.SMSVendor?.id ||
                                                option?.vendor_id) ===
                                            (value?.SMSVendor?.id ||
                                                value?.vendor_id)
                                        }
                                        value={
                                            providerForm.vendor_id
                                                ? mappedProviders.find(
                                                    (p: ProviderRow) =>
                                                        (p?.SMSVendor?.id ||
                                                            p?.vendor_id) ===
                                                        providerForm.vendor_id
                                                ) || null
                                                : null
                                        }
                                        onChange={(
                                            _,
                                            newValue: ProviderRow | null
                                        ) => {
                                            setProviderForm({
                                                ...providerForm,
                                                vendor_id: newValue
                                                    ? Number(
                                                        newValue?.SMSVendor
                                                            ?.id ||
                                                        newValue?.vendor_id
                                                    )
                                                    : undefined,
                                            });
                                            // Clear validation error when user selects a value
                                            if (validationErrors.vendor_id) {
                                                setValidationErrors((prev) => {
                                                    const updated = { ...prev };
                                                    delete updated.vendor_id;
                                                    return updated;
                                                });
                                            }
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label={t(
                                                    "fields.select_provider",
                                                    { ns: "accounts" }
                                                )}
                                                size="small"
                                                variant="outlined"
                                                placeholder={
                                                    loadingMappedProviders
                                                        ? t(
                                                            "messages.loading",
                                                            { ns: "common" }
                                                        )
                                                        : undefined
                                                }
                                                error={
                                                    !!validationErrors.vendor_id
                                                }
                                                helperText={
                                                    validationErrors.vendor_id
                                                }
                                                sx={{
                                                    padding: 0,
                                                    margin: 0,
                                                    "& .MuiFormControl-root": {
                                                        padding: 0,
                                                        margin: 0,
                                                    },
                                                    "& .MuiInputLabel-root": {
                                                        whiteSpace: "nowrap",
                                                        overflow: "visible",
                                                        textOverflow: "clip",
                                                    },
                                                    "& .MuiOutlinedInput-root": {
                                                        display: "flex !important",
                                                        alignItems: "center !important",
                                                    },
                                                    "& .MuiOutlinedInput-input": {
                                                        paddingTop: "6px !important",
                                                        paddingBottom: "6px !important",
                                                    },
                                                }}
                                            />
                                        )}
                                    />
                                </Box>

                                {/* Priority Input */}
                                <Box sx={{ minHeight: "56px" }}>
                                    <TextField
                                        label={t("fields.priority", {
                                            ns: "accounts",
                                        })}
                                        type="number"
                                        value={providerForm.priority || 1}
                                        onChange={(e) => {
                                            setProviderForm({
                                                ...providerForm,
                                                priority:
                                                    parseInt(e.target.value) ||
                                                    1,
                                            });
                                            // Clear validation error when user changes the value
                                            if (validationErrors.priority) {
                                                setValidationErrors((prev) => {
                                                    const updated = { ...prev };
                                                    delete updated.priority;
                                                    return updated;
                                                });
                                            }
                                        }}
                                        fullWidth
                                        size="small"
                                        variant="outlined"
                                        inputProps={{ min: 1, max: 10 }}
                                        error={!!validationErrors.priority}
                                        helperText={
                                            validationErrors.priority ||
                                            t(
                                                "messages.sms_provider_configuration_priority_help",
                                                { ns: "sms" }
                                            )
                                        }
                                        sx={{
                                            padding: 0,
                                            margin: 0,
                                            "& .MuiFormControl-root": {
                                                padding: 0,
                                                margin: 0,
                                            },
                                            "& .MuiInputLabel-root": {
                                                whiteSpace: "nowrap",
                                                overflow: "visible",
                                                textOverflow: "clip",
                                            },
                                            "& .MuiOutlinedInput-root": {
                                                display: "flex !important",
                                                alignItems: "center !important",
                                            },
                                            "& .MuiOutlinedInput-input": {
                                                paddingTop: "6px !important",
                                                paddingBottom: "6px !important",
                                            },
                                        }}
                                    />
                                </Box>

                                {/* Enabled Toggle */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        minHeight: "56px",
                                        pl: 0.5, // Small padding to align with other fields
                                    }}
                                >
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={
                                                    providerForm.is_enabled ||
                                                    false
                                                }
                                                onChange={(e) =>
                                                    setProviderForm({
                                                        ...providerForm,
                                                        is_enabled:
                                                            e.target.checked,
                                                    })
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
                                                {providerForm.is_enabled
                                                    ? t("fields.enabled", {
                                                        ns: "common",
                                                    })
                                                    : t("fields.disabled", {
                                                        ns: "common",
                                                    })}
                                            </Typography>
                                        }
                                        sx={{
                                            m: 0, // Remove default margin
                                            "& .MuiFormControlLabel-label": {
                                                fontSize: "0.875rem",
                                                fontWeight: 500,
                                            },
                                        }}
                                    />
                                </Box>
                            </Box>
                    </AppDialog>

                    {/* Delete Confirmation Dialog */}
                    <DeleteDialog
                        isOpen={deleteConfirmOpen}
                        onClose={handleCloseDeleteConfirm}
                        onConfirm={confirmDeleteProvider}
                        title={t(
                            "sections.sms_provider_configuration_delete_provider_title",
                            { ns: "sms" }
                        )}
                        description={
                            <Box>
                                <Typography
                                    variant="body1"
                                    color="text.secondary"
                                    sx={{ mb: 2 }}
                                >
                                    {t(
                                        "messages.sms_provider_configuration_confirm_delete",
                                        { ns: "sms" }
                                    )}
                                </Typography>
                                {providerToDelete && (
                                    <Box
                                        sx={{
                                            mt: 2,
                                            p: 2,
                                            bgcolor: "background.default",
                                            borderRadius: 1,
                                            border: "1px solid",
                                            borderColor: "divider",
                                        }}
                                    >
                                        <Typography
                                            variant="subtitle2"
                                            fontWeight="medium"
                                            sx={{ mb: 0.5 }}
                                        >
                                            {providerToDelete.Country?.emoji}{" "}
                                            {providerToDelete.Country?.name} -{" "}
                                            {providerToDelete.SMSVendor
                                                ?.provider}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {providerToDelete.SMSVendor
                                                ?.phone_number ||
                                                "No phone number configured"}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        }
                        confirmLabel={t("actions.delete", { ns: "common" })}
                        cancelLabel={t("actions.cancel", { ns: "common" })}
                        isLoading={isDeletingProvider}
                        type="delete"
                        locale={i18n.language}
                    />
                </Box>
            </Fade>
        </Box>
    );
};

export default AccountDetails;
