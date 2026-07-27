"use client";

import {
    Receipt as ReceiptIcon,
    Payment as PaymentIcon,
    People as PeopleIcon,
    Contacts as ContactsIcon,
    Shield as ShieldIcon,
} from "@mui/icons-material";
import {
    Box,
    Container,
    Tabs,
    Tab,
    Paper,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";

import PageHeader from "@/components/PageHeader";
import InvoiceProcessor from "./invoice/InvoiceProcessor";
import PaymentProcessor from "./payment/PaymentProcessor";
import CustomerProcessor from "./customer/CustomerProcessor";
import ContactProcessor from "./contact/ContactProcessor";
import PolicyProcessor from "./policy/PolicyProcessor";

type ImportType =
    | "invoice"
    | "payment"
    | "customer"
    | "contact"
    | "policy";

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`import-tabpanel-${index}`}
            aria-labelledby={`import-tab-${index}`}
            {...other}
        >
            {value === index && <Box>{children}</Box>}
        </div>
    );
}

export default function ImportPage() {
    const { t, i18n } = useTranslation(["import", "common"]);
    const theme = useTheme();
    const searchParams = useSearchParams();
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const { data: session, status } = useSession();
    const headerRef = useRef<HTMLDivElement>(null);
    const accountId = session?.user?.account_id as number | undefined;

    const { data: accountData } = useQuery({
        queryKey: ["account", accountId, "import-policy-tab"],
        queryFn: async () => {
            const response = await api.get(`/api/entities/accounts/${accountId}`);
            return response.data;
        },
        enabled: !!accountId && status === "authenticated",
    });

    const hasCreditInsurance = accountData?.has_credit_insurance === true;

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
        enabled: !!session?.user && status === "authenticated",
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });

    const userPermissions = userPermissionsData?.permissions;

    // Permission checks
    const hasImportInvoicePermission = userPermissions
        ? userPermissions.includes("import_invoice")
        : false;
    const hasImportPaymentPermission = userPermissions
        ? userPermissions.includes("import_payment")
        : false;
    const hasImportCustomerPermission = userPermissions
        ? userPermissions.includes("import_customer")
        : false;
    const hasImportContactPermission = userPermissions
        ? userPermissions.includes("import_contact")
        : false;
    const hasImportPolicyPermission = userPermissions
        ? userPermissions.includes("import_policy")
        : false;

    // Define all import types
    const allImportTypes: Array<{
        id: ImportType;
        label: string;
        icon: React.ReactNode;
        component: React.ReactNode;
        permission: boolean;
    }> = [
        {
            id: "invoice",
            label: t("actions.navigation_import_invoice", { ns: "common" }),
            icon: <ReceiptIcon />,
            component: <InvoiceProcessor />,
            permission: hasImportInvoicePermission,
        },
        {
            id: "payment",
            label: t("actions.navigation_import_payment", { ns: "common" }),
            icon: <PaymentIcon />,
            component: <PaymentProcessor />,
            permission: hasImportPaymentPermission,
        },
        {
            id: "customer",
            label: t("actions.navigation_import_customer", { ns: "common" }),
            icon: <PeopleIcon />,
            component: <CustomerProcessor />,
            permission: hasImportCustomerPermission,
        },
        {
            id: "contact",
            label: t("actions.navigation_import_contact", { ns: "common" }),
            icon: <ContactsIcon />,
            component: <ContactProcessor />,
            permission: hasImportContactPermission,
        },
        {
            id: "policy",
            label: t("actions.navigation_import_policy", { ns: "common" }),
            icon: <ShieldIcon />,
            component: <PolicyProcessor />,
            permission: hasImportPolicyPermission && hasCreditInsurance,
        },
    ];

    // Filter to only show types user has permission for
    const importTypes = allImportTypes.filter((type) => type.permission);

    // Get initial tab from URL or default to first available
    const getInitialTab = (): number => {
        const tabParam = searchParams?.get("tab");
        if (tabParam && importTypes.length > 0) {
            const tabIndex = importTypes.findIndex((t) => t.id === tabParam);
            if (tabIndex !== -1) return tabIndex;
        }
        return 0;
    };

    const [activeTab, setActiveTab] = useState<number>(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
        const tabId = importTypes[newValue]?.id;
        if (tabId) {
            router.push(`/${locale}/app/import?tab=${tabId}`, { scroll: false });
        }
    };

    // Update tab when URL changes or when importTypes are loaded
    useEffect(() => {
        if (importTypes.length > 0) {
            const newTab = getInitialTab();
            setActiveTab(newTab);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams?.get("tab"), importTypes.length]);

    useEffect(() => {
        if (
            i18n.language !== "he" &&
            window.location.pathname.includes("/he/")
        ) {
            i18n.changeLanguage("he");
        }
    }, [i18n]);

    // Show message if no permissions
    if (importTypes.length === 0) {
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
                    maxWidth: {
                        xs: "calc(100% + 16px)",
                        sm: "calc(100% + 24px)",
                    },
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <Container
                    maxWidth="xl"
                    sx={{
                        py: { xs: 2, sm: 3 },
                        px: { xs: 2, sm: 3, md: 4 },
                    }}
                >
                    <Paper sx={{ p: 4, textAlign: "center" }}>
                        <Typography variant="h6" color="text.secondary">
                            {t("actions.no_import_permissions", {
                                ns: "common",
                                defaultValue: "You do not have permission to access import features.",
                            })}
                        </Typography>
                    </Paper>
                </Container>
            </Box>
        );
    }

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
                direction: i18n.language === "he" ? "rtl" : "ltr",
                ...(i18n.language === "he" && {
                    "& *": {
                        boxSizing: "border-box",
                    },
                    "& .MuiTableContainer-root": {
                        overflowX: "auto",
                        maxWidth: "100%",
                    },
                    "& .MuiTable-root": {
                        tableLayout: "fixed",
                        width: "100%",
                    },
                    "& .MuiTableCell-root": {
                        wordBreak: "break-word",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    },
                    "& > *": {
                        maxWidth: "100%",
                        overflow: "hidden",
                    },
                }),
            }}
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
                    <Box sx={{ "& .MuiPaper-root": { mb: 0 } }}>
                        <PageHeader
                            title={t("actions.navigation_import", {
                                ns: "common",
                            })}
                            description={t(
                                "actions.import_description",
                                {
                                    ns: "import",
                                    defaultValue:
                                        "Import invoices, payments, customers, contacts, and policies from CSV or Excel files. Select a tab to get started.",
                                }
                            )}
                            sticky={false}
                        />
                    </Box>
                </Box>
            </Box>

            {/* Content Area */}
            <Container
                maxWidth="xl"
                sx={{
                    py: { xs: 2, sm: 3 },
                    px: { xs: 2, sm: 3, md: 4 },
                }}
            >
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        borderBottom: 1,
                        borderColor: "divider",
                        mb: 3,
                        "& .MuiTab-root": {
                            "& .MuiSvgIcon-root": {
                                mb: 0.5,
                                mr: i18n.language === "he" ? 0 : 1,
                                ml: i18n.language === "he" ? 1 : 0,
                            },
                        },
                    }}
                >
                    {importTypes.map((type, index) => (
                        <Tab
                            key={type.id}
                            icon={type.icon as React.ReactElement}
                            iconPosition="start"
                            label={type.label}
                            id={`import-tab-${index}`}
                            aria-controls={`import-tabpanel-${index}`}
                        />
                    ))}
                </Tabs>

                {importTypes.map((type, index) => (
                    <TabPanel key={type.id} value={activeTab} index={index}>
                        {type.component}
                    </TabPanel>
                ))}
            </Container>
        </Box>
    );
}
