import { isEnvironmentHost } from "./domainUtils";

function hostnameOf(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return "";
    }
}

export const getCustomerPortalUrl = (
    customerUUID: string,
    sub_domain?: string | null,
    customerLanguage?: string | null,
    contactId?: number,
    path?: string
): string => {
    if (!customerUUID) return "";

    // Check if we're in a non-localhost environment
    const isLocalhost =
        typeof window !== "undefined"
            ? window.location.hostname.includes("localhost") ||
            window.location.hostname.includes("127.0.0.1")
            : process.env.NODE_ENV === "development";

    let baseUrl: string;
    const publicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    const isDeploymentHost = isEnvironmentHost(hostnameOf(publicBaseUrl));

    if (isLocalhost) {
        // Development environment - use localhost
        baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    } else if (isDeploymentHost) {
        // staging / dev — per-tenant subdomains are not configured there.
        baseUrl = publicBaseUrl.endsWith("/") ? publicBaseUrl.slice(0, -1) : publicBaseUrl;
    } else {
        // Production environment - prioritize customer subdomain
        if (sub_domain) {
            // Always use customer subdomain when available
            baseUrl = `https://${sub_domain}.archaser.com`;
        } else if (typeof window !== "undefined") {
            // Use current hostname if we're in the browser and no subdomain provided
            baseUrl = `https://${window.location.hostname}`;
        } else {
            // Server-side fallback
            baseUrl = "https://archaser.com";
        }
    }

    // Determine locale based on customer's language
    // Handle both enum values ("English", "Hebrew") and locale codes ("en", "he")
    let locale: string;
    if (customerLanguage === "Hebrew") {
        locale = "he";
    } else if (customerLanguage === "English") {
        locale = "en";
    } else if (customerLanguage === "he" || customerLanguage === "en") {
        // Already a locale code
        locale = customerLanguage;
    } else {
        // Default to English for any other language or null
        locale = "en";
    }

    // Remove trailing slash to avoid middleware redirect
    let url = `${baseUrl}/${locale}/portal/${customerUUID}`;

    // Append path if provided
    if (path) {
        // Ensure path starts with / but not duplicated
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        url += cleanPath;
    }

    // Append query params
    const queryParams: string[] = [];
    if (contactId) {
        queryParams.push(`cid=${contactId}`);
    }

    if (queryParams.length > 0) {
        // Check if path already contains query params
        const separator = url.includes("?") ? "&" : "?";
        url += `${separator}${queryParams.join("&")}`;
    }

    return url;
};

const AppUrls = {
    LOGIN: "/login",
    CUSTOMERS: "/app/customers",
    DISPUTES: "/app/disputes",
    AGENTS: "/app/agents",
    IMPORT: "/app/import",
    PROMISE_TO_PAY_INTERNAL: "/app/promise-to-pay",
    DASHBOARD: "/app/dashboard",
    CREDIT_DASHBOARD: "/app/credit-dashboard",
    CREDIT_PORTFOLIO_HEALTH: "/app/credit-portfolio-health",
    DASHBOARD_CHART_DETAILS: "/app/dashboard/chart-details",
    ADMIN_DASHBOARD: "/app/admin/dashboard",
    OPERATION_DASHBOARD: "/app/operation-dashboard",
    OPERATION_DASHBOARD_DETAILS: "/app/operation-dashboard/details",
    CONTROL_CENTER: "/app/control-center",
    REPORTS: "/app/reports",
    REPORT_BUILDER: "/app/reports/builder",
    REPORT_DETAILS: (id: string | number) => `/app/reports/${id}`,
    ACCOUNTS: "/app/admin/accounts",
    ACTIVITY_SEQUENCE: "/app/activitySequences",
    SYSTEM_LOGS: "/app/admin/logs",
    SMS_MANAGEMENT: "/app/admin/sms",
    CRON_JOBS: "/app/admin/cron-jobs",

    EMAIL_CAMPAIGN_REPORT: "/app/admin/email-campaign-report",
    Customer_DETAILS: (id: string | number) => `/app/customers/${id}`,
    Customer_ACTIVITY: (id: string | number) =>
        `/app/customers/${id}?activeTab=outstanding-activities-tab`,
    Customer_DISPUTES: (id: string | number, disputeId: string | number) =>
        `/app/customers/${id}?activeTab=outstanding-activities-tab&openDispute=${disputeId}`,
    ACCOUNT_DETAILS: (id: string | number) =>
        `/app/admin/accounts/${id}/details`,

    RESET_PASSWORD: (resetToken: string) => `/reset-password/${resetToken}`,
    Customer_PORTAL: (
        customerUUID: string,
        sub_domain?: string | null,
        customerLanguage?: string | null,
        contactId?: number
    ) => getCustomerPortalUrl(customerUUID, sub_domain, customerLanguage, contactId),
    Customer_PORTAL_HOME: (customerUUID: string) => `/portal/${customerUUID}`,
};

export default AppUrls;
