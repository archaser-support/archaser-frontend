/**
 * Portal URL Utilities
 * 
 * Utilities for generating subdomain-aware portal URLs
 */

import { getCustomerPortalUrl } from './appUrls';
import { getTenantSubdomain, isEnvironmentHost } from './domainUtils';

/**
 * Get the current customer subdomain from the hostname
 */
export function getCurrentSubdomain(): string | null {
    if (typeof window === 'undefined') return null;

    return getTenantSubdomain(window.location.hostname);
}

/**
 * Generate a portal URL that maintains the current subdomain context
 */
export function getPortalUrl(customerUUID: string, path: string = '', customerLanguage?: string | null): string {
    const subdomain = getCurrentSubdomain();
    return getCustomerPortalUrl(customerUUID, subdomain, customerLanguage, undefined, path); // Pass path as 5th argument
}

/**
 * Generate a portal URL with a specific customer subdomain
 */
export function getPortalUrlWithSubdomain(
    customerUUID: string,
    customerSubdomain: string | null,
    path: string = '',
    customerLanguage?: string | null
): string {
    return getCustomerPortalUrl(customerUUID, customerSubdomain, customerLanguage, undefined, path); // Pass path as 5th argument
}

/**
 * Generate a relative portal URL for client-side navigation
 * This ensures Next.js router.push() works correctly without full page refreshes
 */
function getRelativePortalUrl(customerUUID: string, path: string = '', customerLanguage?: string | null): string {
    // Determine locale based on customer's language
    let effectiveLocale: string;

    if (customerLanguage === "Hebrew") {
        effectiveLocale = "he";
    } else if (customerLanguage === "English") {
        effectiveLocale = "en";
    } else if (customerLanguage === "he" || customerLanguage === "en") {
        // Already a locale code
        effectiveLocale = customerLanguage;
    } else if (typeof window !== 'undefined') {
        // Fallback: detect from current URL
        const currentLocale = window.location.pathname.match(/^\/([a-z]{2})\//)?.[1];
        effectiveLocale = currentLocale || 'en';
    } else {
        // Server-side fallback
        effectiveLocale = 'en';
    }

    // Build relative path - Next.js router.push() works best with relative paths
    return `/${effectiveLocale}/portal/${customerUUID}${path}`;
}

/**
 * Generate portal navigation URLs that maintain subdomain context
 * Use these for client-side navigation (router.push) - returns relative paths
 */
export const PortalUrls = {
    home: (customerUUID: string, customerLanguage?: string | null) => getRelativePortalUrl(customerUUID, '', customerLanguage),
    invoices: (customerUUID: string, customerLanguage?: string | null) => getRelativePortalUrl(customerUUID, '/view-invoices', customerLanguage),
    disputes: (customerUUID: string, customerLanguage?: string | null) => getRelativePortalUrl(customerUUID, '/view-disputes', customerLanguage),
    createDispute: (customerUUID: string, customerLanguage?: string | null) => getRelativePortalUrl(customerUUID, '/create-dispute', customerLanguage),
    makePayment: (customerUUID: string, customerLanguage?: string | null) => getRelativePortalUrl(customerUUID, '/make-payment', customerLanguage),
    promiseToPay: (customerUUID: string, customerLanguage?: string | null) => getRelativePortalUrl(customerUUID, '/promise-to-pay', customerLanguage),
    reportWrongContact: (customerUUID: string, customerLanguage?: string | null) => getRelativePortalUrl(customerUUID, '/report-wrong-contact', customerLanguage),
    agentPortal: (customerUUID: string, customerLanguage?: string | null) => getRelativePortalUrl(customerUUID, '/agent-portal', customerLanguage),
};

/**
 * Check if the current page is accessed via the correct subdomain
 */
export function isCorrectSubdomain(expectedSubdomain: string | null): boolean {
    const currentSubdomain = getCurrentSubdomain();

    // If no subdomain expected, any subdomain (or none) is fine
    if (!expectedSubdomain) return true;

    // Check if current subdomain matches expected
    return currentSubdomain === expectedSubdomain;
}

/**
 * Get the redirect URL to the correct subdomain
 */
export function getSubdomainRedirectUrl(
    customerUUID: string,
    customerSubdomain: string | null,
    currentPath: string = ''
): string | null {
    if (!customerSubdomain) return null;

    const currentSubdomain = getCurrentSubdomain();

    // If already on correct subdomain, no redirect needed
    if (currentSubdomain === customerSubdomain) return null;

    // Deployment hosts do not have per-tenant subdomains configured.
    if (isEnvironmentHost(window.location.hostname)) return null;

    // Generate URL with correct subdomain
    const protocol = window.location.protocol;
    const baseDomain = window.location.hostname.includes('localhost')
        ? `localhost:${window.location.port || 3000}`
        : 'archaser.com';

    const cleanPath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`;
    return `${protocol}//${customerSubdomain}.${baseDomain}/portal/${customerUUID}${cleanPath}`;
}
