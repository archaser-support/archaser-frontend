"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import CustomerFormField from "@/app/[locale]/app/customers/[customerId]/CustomerFormField";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

interface CountryType {
    id: number;
    name: string;
    emoji: string | null;
    iso2: string | null;
    iso3: string | null;
    numeric_code: string | null;
    phonecode: string | null;
    capital: string | null;
    currency: string | null;
    currency_name: string | null;
    currency_symbol: string | null;
    tld: string | null;
    native: string | null;
    region: string | null;
    subregion: string | null;
    timezones: string | null;
    translations: string | null;
    latitude: string | null;
    longitude: string | null;
    emojiU: string | null;
    wikiDataId: string | null;
}

interface StateType {
    id: number;
    name: string;
    country_id: number;
}

interface CustomerFormData {
    country: CountryType | null;
    company_id: number | null;
    state: StateType | null;
    customer_number: string | null;
    collection_status: "Inactive" | "Active";
    type?: "Company" | "Person";
    account_id?: number;
    owner_id?: string | null;
    address_line1: string | null;
    address_line2: string | null;
    postal_code: string | null;
    city: string | null;
    first_activity_delay_days: number | null;
    phone: string | null;
    language: string | null;
    category_for_new_collection: string | null;
    // Additional fields for CustomerFormField compatibility
    country_id: number | null;
    state_id: number | null;
    business_unit_id: number | null;
    parent_customer_id: number | null;
}

interface Errors {
    [key: string]: string;
}

interface User {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
}

import { useQuery } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";

import {
    fetchCountriesFromApi,
    fetchStatesFromApi,
} from "@/shared/redux/action";
import { useAppDispatch, useAppSelector } from "@/shared/redux/hooks";

import {
    GroupAdd as GroupAddIcon,
    LocationOn as LocationIcon,
} from "@mui/icons-material";
import BusinessIcon from "@mui/icons-material/Business";
import InfoIcon from "@mui/icons-material/Info";
import LanguageIcon from "@mui/icons-material/Language";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import {
    Backdrop,
    Box,
    Breadcrumbs,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Container,
    Fade,
    Link,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

export default function CreateCustomerPage() {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const theme = useTheme();
    const { data: session } = useSession();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const countries = useAppSelector((state) => state.countries) || [];
    const states = useAppSelector((state) => state.states) || [];
    const { showToast } = useToast();

    const [customer, setCustomer] = useState<CustomerFormData>({
        country: null,
        company_id: null,
        state: null,
        customer_number: null,
        collection_status: "Inactive",
        address_line1: null,
        address_line2: null,
        postal_code: null,
        city: null,
        first_activity_delay_days: null,
        phone: null,
        language: null,
        category_for_new_collection: "Automated",
        country_id: null,
        state_id: null,
        business_unit_id: null,
        parent_customer_id: null,
    });

    const [companyName, setCompanyName] = useState("");
    const [errors, setErrors] = useState<Errors>({});
    const [isLoading, setIsLoading] = useState(false);

    // Helper function to get language from country
    const getLanguageFromCountry = useCallback(
        (countryId: number | null): string | null => {
            if (!countryId) return null;

            const country = countries.find((c) => c.id === countryId);
            if (!country) return null;

            const countryName = country.name || "";
            // Access iso2 from the country object - check if it exists in the Country type
            const countryIso2 = (country as any).iso2 || "";

            // Israel
            if (countryIso2 === "IL" || countryName === "Israel") {
                return "Hebrew";
            }

            // United States, Canada, United Kingdom -> English
            if (
                countryIso2 === "US" ||
                countryName === "United States" ||
                countryIso2 === "CA" ||
                countryName === "Canada" ||
                countryIso2 === "GB" ||
                countryName === "United Kingdom"
            ) {
                return "English";
            }

            // France -> French
            if (countryIso2 === "FR" || countryName === "France") {
                return "French";
            }

            // Default to English
            return "English";
        },
        [countries]
    );

    // Fetch account data to get default_first_activity_delay_days and use_customer_language setting
    const { data: accountData } = useQuery({
        queryKey: ["account", session?.user?.account_id],
        queryFn: async () => {
            const response = await apiFetch(`/api/entities/accounts/${session?.user?.account_id}`
            );
            if (!response.ok) throw new Error("Failed to fetch account data");
            const data = await response.json();
            return data;
        },
        enabled: !!session?.user?.account_id,
    });

    const isCreditOnlyAccount =
        accountData?.has_collection === false &&
        accountData?.has_credit_insurance === true;

    const { data: activeUsers = [] } = useQuery<User[]>({
        queryKey: ["activeUsers", session?.user?.account_id],
        queryFn: async () => {
            const response = await apiFetch(`/api/entities/users?account_id=${session?.user?.account_id}&active_only=true`
            );
            if (!response.ok) throw new Error("Failed to fetch active users");
            const data = await response.json();
            // Ensure we return an array even if the API structure changes
            return Array.isArray(data.users)
                ? data.users
                : Array.isArray(data)
                    ? data
                    : [];
        },
        enabled: !!session?.user?.account_id,
    });

    // Fetch business units for dropdown
    const { data: businessUnits = [] } = useQuery({
        queryKey: ["business-units", session?.user?.account_id],
        queryFn: async () => {
            if (!session?.user?.account_id) return [];
            const response = await apiFetch(`/api/entities/accounts/${session?.user?.account_id}/business-units`
            );
            if (!response.ok) throw new Error("Failed to fetch business units");
            return response.json();
        },
        enabled: !!session?.user?.account_id,
    });

    // Fetch current user's data to get business_unit_id
    const { data: currentUserData } = useQuery({
        queryKey: ["current-user", session?.user?.id],
        queryFn: async () => {
            if (!session?.user?.id) return null;
            try {
                const response = await apiFetch(`/api/entities/users/${session.user.id}`
                );
                if (!response.ok) return null;
                const userData = await response.json();
                return userData;
            } catch (error) {
                return null;
            }
        },
        enabled: !!session?.user?.id && !session?.user?.view_as_user_id,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Set default business_unit_id when user data is loaded
    useEffect(() => {
        if (currentUserData?.BusinessUnit?.id && !customer.business_unit_id) {
            setCustomer((prev) => ({
                ...prev,
                business_unit_id: currentUserData.BusinessUnit.id,
            }));
        }
    }, [currentUserData, customer.business_unit_id]);

    // Fetch countries and states
    useEffect(() => {
        if (!countries.length) {
            dispatch(fetchCountriesFromApi());
        }
    }, [countries, dispatch]);

    useEffect(() => {
        if (customer.country_id) {
            dispatch(fetchStatesFromApi(customer.country_id));
        }
    }, [customer.country_id, dispatch]);

    // Handle field changes for CustomerFormField
    const handleFieldChange = useCallback(
        (key: string, value: any) => {
            if (key === "customer_name") {
                setCompanyName(value);
            } else if (key === "customer_number") {
                setCustomer((prev) => ({ ...prev, customer_number: value }));
            } else if (key === "phone") {
                setCustomer((prev) => ({ ...prev, phone: value }));
            } else if (key === "owner_id") {
                setCustomer((prev) => ({ ...prev, owner_id: value }));
            } else if (key === "language") {
                setCustomer((prev) => ({ ...prev, language: value }));
            } else if (key === "category_for_new_collection") {
                setCustomer((prev) => ({
                    ...prev,
                    category_for_new_collection: value,
                }));
            } else if (key === "business_unit_id") {
                setCustomer((prev) => ({ ...prev, business_unit_id: value }));
            } else if (key === "parent_customer_id") {
                setCustomer((prev) => ({ ...prev, parent_customer_id: value }));
            } else if (key === "country_id") {
                // For country_id, we need to find the country object by ID
                const countryId =
                    value !== null && value !== undefined
                        ? typeof value === "number"
                            ? value
                            : parseInt(String(value))
                        : null;
                const countryObject =
                    countryId && countries.length > 0
                        ? (countries.find((c) => c.id === countryId) as
                            | CountryType
                            | undefined)
                        : null;

                // If account uses country-based language, automatically set language based on country
                if (
                    accountData?.use_customer_language &&
                    countryId &&
                    countries.length > 0
                ) {
                    const countryLanguage = getLanguageFromCountry(countryId);
                    setCustomer((prev) => ({
                        ...prev,
                        country_id: countryId,
                        country: countryObject || null,
                        ...(countryLanguage
                            ? { language: countryLanguage }
                            : {}),
                    }));
                } else {
                    setCustomer((prev) => ({
                        ...prev,
                        country_id: countryId,
                        country: countryObject || null,
                    }));
                }
            } else if (key === "state_id") {
                // For state_id, we need to find the state object by ID
                setCustomer((prev) => ({
                    ...prev,
                    state_id: value ? parseInt(value) : null,
                }));
            } else if (key === "city") {
                setCustomer((prev) => ({ ...prev, city: value }));
            } else if (key === "postal_code") {
                setCustomer((prev) => ({ ...prev, postal_code: value }));
            } else if (key === "address_line1") {
                setCustomer((prev) => ({ ...prev, address_line1: value }));
            } else if (key === "address_line2") {
                setCustomer((prev) => ({ ...prev, address_line2: value }));
            } else if (key === "first_activity_delay_days") {
                setCustomer((prev) => ({
                    ...prev,
                    first_activity_delay_days: value ? parseInt(value) : null,
                }));
            }
        },
        [accountData, countries, getLanguageFromCountry]
    );

    // Initialize first_activity_delay_days and language with account's default values
    useEffect(() => {
        if (accountData) {
            setCustomer((prev) => {
                let language = prev.language;

                // If use_customer_language is enabled and country is selected, use country language
                if (accountData?.use_customer_language && prev.country_id) {
                    const countryLanguage = getLanguageFromCountry(
                        prev.country_id
                    );
                    if (countryLanguage) {
                        language = countryLanguage;
                    }
                } else if (accountData?.default_language && !prev.language) {
                    // Use account default language if customer language is not enabled
                    language = accountData.default_language;
                }

                return {
                    ...prev,
                    // Only set default if not already manually set (null means not set yet)
                    first_activity_delay_days:
                        isCreditOnlyAccount
                            ? null
                            : prev.first_activity_delay_days === null
                                ? (accountData?.default_first_activity_delay_days ??
                                    null)
                                : prev.first_activity_delay_days,
                    category_for_new_collection: isCreditOnlyAccount
                        ? null
                        : prev.category_for_new_collection || "Automated",
                    ...(language ? { language } : {}),
                };
            });
        }
    }, [accountData, countries, getLanguageFromCountry, isCreditOnlyAccount]);

    // Watch for country changes and update language if use_customer_language is enabled
    useEffect(() => {
        if (
            accountData?.use_customer_language &&
            customer.country_id &&
            countries.length > 0
        ) {
            const countryLanguage = getLanguageFromCountry(customer.country_id);
            if (countryLanguage && customer.language !== countryLanguage) {
                setCustomer((prev) => ({
                    ...prev,
                    language: countryLanguage,
                }));
            }
        }
    }, [
        customer.country_id,
        customer.language,
        accountData?.use_customer_language,
        countries,
        getLanguageFromCountry,
    ]);

    const resetFields = () => {
        setCustomer({
            country: null,
            company_id: null,
            state: null,
            customer_number: null,
            collection_status: "Inactive",
            address_line1: null,
            address_line2: null,
            postal_code: null,
            city: null,
            first_activity_delay_days:
                isCreditOnlyAccount
                    ? null
                    : accountData?.default_first_activity_delay_days ?? null,
            phone: null,
            language: accountData?.default_language || null,
            category_for_new_collection: isCreditOnlyAccount
                ? null
                : "Automated",
            country_id: null,
            state_id: null,
            business_unit_id: currentUserData?.BusinessUnit?.id || null,
            parent_customer_id: null,
        });
        setCompanyName("");
        setErrors({});
    };

    const validateFields = (): boolean => {
        const newErrors: Errors = {};

        if (!companyName.trim()) {
            newErrors.companyName = "required";
        }

        if (!customer.customer_number?.trim()) {
            newErrors.customer_number = "required";
        }

        if (!customer.country_id) {
            newErrors.country = "required";
        }

        // State is required if country is United States or Canada
        if (customer.country_id) {
            const selectedCountry = countries.find(
                (c) => c.id === customer.country_id
            );
            const isUSOrCanada =
                selectedCountry?.name === "United States" ||
                selectedCountry?.name === "Canada";
            if (isUSOrCanada && !customer.state_id) {
                newErrors.state = "required";
            }
        }

        if (!isCreditOnlyAccount) {
            if (
                customer.first_activity_delay_days === null ||
                customer.first_activity_delay_days === undefined ||
                customer.first_activity_delay_days < 0
            ) {
                newErrors.first_activity_delay_days = "required";
            }

            if (!customer.category_for_new_collection) {
                newErrors.category_for_new_collection = "required";
            }
        }

        if (!customer.business_unit_id) {
            newErrors.business_unit_id = "required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleBlur = (field: string) => {
        if (errors[field as keyof Errors]) {
            setErrors({ ...errors, [field]: "" });
        }
    };

    const submitHandler = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateFields()) {
            return;
        }

        if (!session?.user?.account_id) {
            showToast(t("messages.error_message"));
            return;
        }

        setIsLoading(true);
        try {
            // First create the company
            const newCompany = {
                name: companyName.trim(),
                company_number: Math.floor(
                    100000 + Math.random() * 900000
                ).toString(),
            };

            const createdCompany = await api
                .post("/api/system/company", newCompany)
                .then((res) => res.data);

            if (!createdCompany?.id) {
                throw new Error(t("messages.error_message"));
            }

            // Then create the customer
            const customerData = {
                customer_number: customer.customer_number,
                collection_status: customer.collection_status,
                address_line1: customer.address_line1,
                address_line2: customer.address_line2,
                postal_code: customer.postal_code,
                city: customer.city,
                first_activity_delay_days: customer.first_activity_delay_days,
                country_id: customer.country?.id || null,
                state_id: customer.state?.id || null,
                company_id: createdCompany.id,
                type: "Company" as const,
                account_id: session.user.account_id,
                phone: customer.phone,
                language: customer.language,
                business_unit_id: customer.business_unit_id || null,
                parent_customer_id: customer.parent_customer_id || null,
            };

            const response = await api.post(
                "/api/import/customers",
                customerData,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    withCredentials: true,
                }
            );

            showToast(t("messages.customer_saved_success"));

            // Redirect to the newly created customer's detail page with general tab focused
            const createdCustomerId =
                response.data?.id || response.data?.customer?.id;
            if (createdCustomerId) {
                router.push(`/app/customers/${createdCustomerId}?tab=general`);
            } else {
                // Fallback to customers list if ID is not available
                router.push("/app/customers");
            }
        } catch (error: any) {
            const errorMessage =
                error.response?.data?.error ||
                error.message ||
                t("messages.error_message");
            showToast(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        router.push("/app/customers");
    };

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                minHeight: "100vh",
                m: 0,
                p: 0,
                mt: { xs: -1, sm: -1.5 },
                mx: { xs: -1, sm: -1.5 },
                width: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                maxWidth: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
            }}
        >
            {/* Sticky Header */}
            <Box
                sx={{
                    position: "sticky",
                    top: { xs: "-8px", sm: "-12px" },
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    bgcolor: "background.paper",
                    flexShrink: 0,
                    m: 0,
                    mt: 0,
                    backgroundColor: "background.paper",
                    width: "100%",
                    maxWidth: "100%",
                    px: { xs: 2, sm: 3, md: 4 },
                    pt: { xs: 2, sm: 3 },
                    pb: 0,
                }}
            >
                <Box
                    sx={{
                        maxWidth: "xl",
                        mx: "auto",
                    }}
                >
                    {/* Breadcrumbs */}
                    <Breadcrumbs
                        sx={{
                            mb: 1,
                            width: "100%",
                            direction:
                                i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiBreadcrumbs-ol": {
                                flexWrap: "nowrap",
                                overflow: "hidden",
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                flexDirection:
                                    i18n.language === "he"
                                        ? "row-reverse"
                                        : "row",
                                justifyContent:
                                    i18n.language === "he"
                                        ? "flex-end"
                                        : "flex-start",
                            },
                            "& .MuiBreadcrumbs-li": {
                                minWidth: 0,
                                flexShrink: 1,
                                maxWidth: "none",
                                padding: 0,
                                margin: 0,
                            },
                            "& .MuiBreadcrumbs-separator": {
                                marginLeft:
                                    i18n.language === "he"
                                        ? 0
                                        : theme.spacing(0.5),
                                marginRight:
                                    i18n.language === "he"
                                        ? theme.spacing(0.5)
                                        : theme.spacing(0.5),
                            },
                        }}
                    >
                        {(() => {
                            const breadcrumbItems = [
                                <Link
                                    key="customers"
                                    component="button"
                                    variant="body1"
                                    onClick={() => router.push("/app/customers")}
                                    sx={{
                                        textDecoration: "none",
                                        color: "primary.main",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        minWidth: 0,
                                        flexShrink: 1,
                                        display: "block",
                                        maxWidth: "none",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                    }}
                                >
                                    {t("sections.title")}
                                </Link>,
                                <Typography
                                    key="current"
                                    color="text.primary"
                                    sx={{
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        minWidth: 0,
                                        flexShrink: 1,
                                        display: "block",
                                        maxWidth: "none",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                    }}
                                >
                                    {t("actions.add_customer")}
                                </Typography>,
                            ];
                            return i18n.language === "he"
                                ? breadcrumbItems.slice().reverse()
                                : breadcrumbItems;
                        })()}
                    </Breadcrumbs>

                    <Box sx={{ "& .MuiPaper-root": { mb: 0 } }}>
                        <PageHeader
                            title={t("actions.add_customer")}
                            description={t("sections.description")}
                            sticky={false}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    ml: {
                                        xs: 0,
                                        sm: i18n.language === "he" ? 0 : "auto",
                                    },
                                    mr: {
                                        xs: 0,
                                        sm: i18n.language === "he" ? "auto" : 0,
                                    },
                                    mt: { xs: 2, sm: 0 },
                                }}
                            >
                                <Box
                                    className="edit-action-button-group"
                                    sx={{ direction: "ltr" }}
                                >
                                    <Button
                                        variant="contained"
                                        size="small"
                                        className="save-button"
                                        onClick={
                                            isLoading
                                                ? undefined
                                                : submitHandler
                                        }
                                        disabled={isLoading}
                                    >
                                        {t("actions.save", {
                                            ns: "common",
                                        })}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        className="cancel-button"
                                        onClick={handleCancel}
                                        disabled={isLoading}
                                    >
                                        {t("actions.cancel", {
                                            ns: "common",
                                        })}
                                    </Button>
                                </Box>
                            </Box>
                        </PageHeader>
                    </Box>
                </Box>
            </Box>

            <Container
                maxWidth="xl"
                sx={{
                    py: { xs: 2, sm: 3 },
                    px: { xs: 2, sm: 3, md: 4 },
                }}
            >
                <Fade in timeout={400}>
                    <Box>
                        {/* Form Sections */}
                        <form onSubmit={submitHandler}>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: { xs: 2, sm: 3 },
                                }}
                            >
                                {/* General Information Section */}
                                <Card
                                    elevation={0}
                                    sx={{
                                        border: "1px solid",
                                        borderColor: "divider",
                                        borderRadius: { xs: 1, sm: 2 },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            p: { xs: 1.5, sm: 2 },
                                            borderBottom: "1px solid",
                                            borderColor: "divider",
                                            bgcolor: "background.paper",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <InfoIcon
                                            sx={{
                                                color: "primary.main",
                                                fontSize: { xs: 18, sm: 20 },
                                            }}
                                        />
                                        <Typography
                                            variant="h6"
                                            sx={{
                                                fontWeight: 500,
                                                fontSize: {
                                                    xs: "1rem",
                                                    sm: "1.25rem",
                                                },
                                            }}
                                        >
                                            {t("sections.general_information")}
                                        </Typography>
                                    </Box>
                                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    sm: "repeat(2, 1fr)",
                                                    md: "repeat(3, 1fr)",
                                                },
                                                gap: 3,
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        >
                                            {/* Company */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="customer_name"
                                                    value={companyName}
                                                    isEditing={true}
                                                    error={errors.companyName}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t("fields.name")}
                                                    icon={<BusinessIcon />}
                                                />
                                            </Box>

                                            {/* Customer Code */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="customer_number"
                                                    value={
                                                        customer.customer_number ||
                                                        ""
                                                    }
                                                    isEditing={true}
                                                    error={
                                                        errors.customer_number
                                                    }
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t(
                                                        "fields.customer_code"
                                                    )}
                                                    icon={<BusinessIcon />}
                                                />
                                            </Box>

                                            {/* Phone */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="phone"
                                                    value={customer.phone || ""}
                                                    isEditing={true}
                                                    error={errors.phone}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t("fields.phone")}
                                                    icon={<PhoneIcon />}
                                                />
                                            </Box>

                                            {/* Owner */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="owner_id"
                                                    value={
                                                        customer.owner_id || ""
                                                    }
                                                    isEditing={true}
                                                    error={errors.owner_id}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t("fields.owner")}
                                                    icon={<PersonIcon />}
                                                />
                                            </Box>

                                            {/* Language */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="language"
                                                    value={
                                                        customer.language || ""
                                                    }
                                                    isEditing={true}
                                                    error={errors.language}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t("fields.language")}
                                                    icon={<LanguageIcon />}
                                                />
                                            </Box>

                                            {!isCreditOnlyAccount && (
                                                <Box
                                                    sx={{
                                                        position: "relative",
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
                                                    }}
                                                >
                                                    <CustomerFormField
                                                        field="first_activity_delay_days"
                                                        value={
                                                            customer.first_activity_delay_days?.toString() ||
                                                            ""
                                                        }
                                                        isEditing={true}
                                                        error={
                                                            errors.first_activity_delay_days
                                                        }
                                                        onChange={handleFieldChange}
                                                        countries={countries}
                                                        states={states}
                                                        activeUsers={activeUsers}
                                                        businessUnits={
                                                            businessUnits
                                                        }
                                                        t={t}
                                                        editedCustomer={customer}
                                                        label={t(
                                                            "fields.first_activity_delay_days"
                                                        )}
                                                        icon={<BusinessIcon />}
                                                    />
                                                </Box>
                                            )}

                                            {!isCreditOnlyAccount && (
                                                <Box
                                                    sx={{
                                                        position: "relative",
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
                                                    }}
                                                >
                                                    <CustomerFormField
                                                        field="category_for_new_collection"
                                                        value={
                                                            customer.category_for_new_collection ||
                                                            ""
                                                        }
                                                        isEditing={true}
                                                        error={
                                                            errors.category_for_new_collection
                                                        }
                                                        onChange={handleFieldChange}
                                                        countries={countries}
                                                        states={states}
                                                        activeUsers={activeUsers}
                                                        businessUnits={
                                                            businessUnits
                                                        }
                                                        t={t}
                                                        editedCustomer={customer}
                                                        label={t(
                                                            "fields.category_for_new_collection"
                                                        )}
                                                        icon={<InfoIcon />}
                                                    />
                                                </Box>
                                            )}

                                            {/* Business Unit Field */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="business_unit_id"
                                                    value={
                                                        customer.business_unit_id?.toString() ||
                                                        ""
                                                    }
                                                    isEditing={true}
                                                    error={
                                                        errors.business_unit_id
                                                    }
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t(
                                                        "fields.business_unit"
                                                    )}
                                                    icon={<BusinessIcon />}
                                                />
                                            </Box>

                                            {/* Parent Customer Field */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="parent_customer_id"
                                                    value={
                                                        customer.parent_customer_id?.toString() ||
                                                        ""
                                                    }
                                                    isEditing={true}
                                                    error={
                                                        errors.parent_customer_id
                                                    }
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t(
                                                        "fields.parent_customer"
                                                    )}
                                                    icon={<BusinessIcon />}
                                                />
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>

                                {/* Communication Section */}
                                <Card
                                    elevation={0}
                                    sx={{
                                        border: "1px solid",
                                        borderColor: "divider",
                                        borderRadius: { xs: 1, sm: 2 },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            p: { xs: 1.5, sm: 2 },
                                            borderBottom: "1px solid",
                                            borderColor: "divider",
                                            bgcolor: "background.paper",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <LocationIcon
                                            sx={{
                                                color: "primary.main",
                                                fontSize: { xs: 18, sm: 20 },
                                            }}
                                        />
                                        <Typography
                                            variant="h6"
                                            sx={{
                                                fontWeight: 500,
                                                fontSize: {
                                                    xs: "1rem",
                                                    sm: "1.25rem",
                                                },
                                            }}
                                        >
                                            {t("sections.address_information")}
                                        </Typography>
                                    </Box>
                                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    sm: "repeat(2, 1fr)",
                                                    md: "repeat(3, 1fr)",
                                                },
                                                gap: 3,
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                            }}
                                        >
                                            {/* Country */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="country_id"
                                                    value={
                                                        customer.country?.id?.toString() ||
                                                        ""
                                                    }
                                                    isEditing={true}
                                                    error={errors.country}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t("fields.country", {
                                                        ns: "common",
                                                    })}
                                                    icon={<LocationOnIcon />}
                                                />
                                            </Box>

                                            {/* State */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="state_id"
                                                    value={
                                                        customer.state?.id?.toString() ||
                                                        ""
                                                    }
                                                    isEditing={true}
                                                    error={errors.state}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t("fields.state")}
                                                    icon={<LocationOnIcon />}
                                                />
                                            </Box>

                                            {/* Address Line 1 */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="address_line1"
                                                    value={
                                                        customer.address_line1 ||
                                                        ""
                                                    }
                                                    isEditing={true}
                                                    error={errors.address_line1}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t(
                                                        "fields.address_1"
                                                    )}
                                                    icon={<LocationOnIcon />}
                                                />
                                            </Box>

                                            {/* Address Line 2 */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="address_line2"
                                                    value={
                                                        customer.address_line2 ||
                                                        ""
                                                    }
                                                    isEditing={true}
                                                    error={errors.address_line2}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t(
                                                        "fields.address_2"
                                                    )}
                                                    icon={<LocationOnIcon />}
                                                />
                                            </Box>

                                            {/* City */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="city"
                                                    value={customer.city || ""}
                                                    isEditing={true}
                                                    error={errors.city}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t("fields.city")}
                                                    icon={<LocationOnIcon />}
                                                />
                                            </Box>

                                            {/* Postal Code */}
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                <CustomerFormField
                                                    field="postal_code"
                                                    value={
                                                        customer.postal_code ||
                                                        ""
                                                    }
                                                    isEditing={true}
                                                    error={errors.postal_code}
                                                    onChange={handleFieldChange}
                                                    countries={countries}
                                                    states={states}
                                                    activeUsers={activeUsers}
                                                    businessUnits={
                                                        businessUnits
                                                    }
                                                    t={t}
                                                    editedCustomer={customer}
                                                    label={t(
                                                        "fields.postal_code"
                                                    )}
                                                    icon={<LocationOnIcon />}
                                                />
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Box>
                        </form>

                        {/* Saving Backdrop */}
                        <Backdrop
                            sx={{
                                color: "#fff",
                                zIndex: (theme) => theme.zIndex.drawer + 1,
                                bgcolor: "rgba(0,0,0,0.5)",
                            }}
                            open={isLoading}
                        >
                            <CircularProgress color="inherit" size={40} />
                        </Backdrop>
                    </Box>
                </Fade>
            </Container>
        </Box>
    );
}
