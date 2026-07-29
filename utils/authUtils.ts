import { NextApiRequest } from "next";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { parse } from "tldts";

import { getCustomerPortalUrl } from "@/utils/appUrls";
import { getEnvironmentLabel } from "@/utils/domainUtils";
import { serializeBigInt } from "@/utils/serializeBigInt";

/** Checked against SERVICE_NAME, which is set per deployment (e.g. archaser-staging). */
const ENVIRONMENT_LABELS = ["staging", "dev", "preprod"] as const;

function hostnameOf(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return "";
    }
}

interface Token {
    account_id: number;
    name: string;
    locale: string;
    id?: string;
    language?: string;
}

interface CustomerReplaceContent {
    customer_uuid: string;
    type: string;
    language?: string;
    Person?: {
        first_name?: string;
    };
    Company?: {
        name?: string;
        Contact?: Array<{
            first_name?: string;
            company_wide_address?: boolean;
        }>;
    };
    Account: {
        id: number;
        name: string;
        logo?: string;
        sub_domain: string;
    };
}

export const prettyJSON = (json: any) => {
    return JSON.stringify(serializeBigInt(json), null, 2);
};

export const replaceContent = (
    content: string,
    customer: CustomerReplaceContent
) => {
    const host_url =
        process.env.NODE_ENV === "production" && process?.env?.NEXTAUTH_URL
            ? parse(process?.env?.NEXTAUTH_URL).hostname
            : `localhost:${process.env.PORT || 3000}`;

    const greetingName =
        customer.type === "Company"
            ? customer.Company?.Contact?.length &&
                !customer.Company.Contact[0].company_wide_address
                ? customer.Company.Contact[0].first_name || ""
                : ""
            : customer.Person?.first_name || "";

    // Account name (the company/account that owns the portal)
    const accountName = customer.Account.name || "";

    // Customer name (the customer's name - Company name or Person first_name)
    const customerName =
        (customer.type === "Company"
            ? customer.Company?.name
            : customer.Person?.first_name) || "";

    // Create logo URL if logo exists
    let logoHtml = "";
    if (customer.Account.logo) {
        const logoUrl = `${process?.env?.NEXTAUTH_URL || `http://${host_url}`}/api/accounts/${customer.Account.id}/logo?v=${Date.now()}`;
        logoHtml = `<img src="${logoUrl}" alt="${accountName} Logo" style="max-width: 200px; height: auto;" />`;
    }

    // Generate language-aware portal URL
    const portal_url = getCustomerPortalUrl(
        customer?.customer_uuid,
        customer?.Account?.sub_domain,
        customer?.language
    );

    return content
        ?.replace(/\{first_name\}/g, greetingName)
        ?.replace(/\{account_name\}/g, accountName)
        ?.replace(/\{customer_name\}/g, customerName)
        ?.replace(/\{customer_logo\}/g, logoHtml)
        ?.replace(/\{link\}/g, portal_url);
};

export const combineFirstLastNames = (
    firstName?: string | null,
    lastName?: string | null
) => {
    return [firstName, lastName].filter(Boolean).join(" ");
};

// ===== AUTHENTICATION HELPERS =====

export const getCookieName = (isSecure: boolean, name: string = "session-token", isLegacy: boolean = false) => {
    // Standard NextAuth cookie names: session-token, csrf-token, callback-url, state, pkce.code_verifier, nonce
    // Maps internal NextAuth cookie keys to their base names
    const cookieMap: Record<string, string> = {
        "session-token": "session-token",
        "csrf-token": "csrf-token",
        "callback-url": "callback-url",
        "state": "state",
        "pkce.code_verifier": "pkce.code_verifier",
        "pkceCodeVerifier": "pkce.code_verifier", // JS property name in NextAuth config
        "nonce": "nonce"
    };

    const targetName = cookieMap[name] || name;

    const baseName = isLegacy && targetName === "session-token"
        ? "next-auth.session-token"
        : `next-auth.${targetName}${targetName === "session-token" && !isLegacy ? ".v1" : ""}`;
    const prefix = isSecure ? "__Secure-" : "";
    const serviceName = process.env.SERVICE_NAME || "";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "";

    // Non-production deployments get their own cookie name so a cookie issued
    // by another environment cannot reach them and fail decryption.
    const envLabel =
        ENVIRONMENT_LABELS.find((label) => serviceName.includes(label)) ??
        getEnvironmentLabel(hostnameOf(baseUrl));
    const suffix = envLabel ? `.${envLabel}` : "";
    const result = `${prefix}${baseName}${suffix}`;

    return result;
};

const extractToken = async (request: NextApiRequest | NextRequest) => {
    const isSecure =
        process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://");

    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: getCookieName(!!isSecure),
    });
    return token;
};

// Helper: Get user from token (legacy function - use getAccountId/getUserId instead)
export async function getUser(request: Request): Promise<Token> {
    const isSecure =
        process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://");

    const token = (await getToken({
        req: request as any,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: getCookieName(!!isSecure),
    })) as Token | null;

    if (!token?.account_id) {
        throw new Error("Account ID not found in token");
    }

    return token;
}

// Get customer ID from request token
export async function getAccountId(
    request: NextApiRequest | NextRequest
): Promise<number> {
    const token: any = await extractToken(request);
    return token?.account_id as number;
}

// Get user ID from request token
export async function getUserId(
    request: NextApiRequest | NextRequest
): Promise<string> {
    const token: any = await extractToken(request);
    return token?.id as string;
}

// Get customer currency from database
// Note: This function has been moved to server-side utilities
// Use API endpoint instead for client-side operations
export async function getCustomerCurrency(
    accountId: number
): Promise<string | null | undefined> {
    // This function should not be used on the client side
    // Use API endpoint /api/accounts/{accountId}/currency instead
    throw new Error(
        "getCustomerCurrency should not be called on the client side. Use API endpoint instead."
    );
}

// Get user language from request token
export async function getUserLanguage(
    request: NextApiRequest | NextRequest
): Promise<string> {
    const token: any = await extractToken(request);
    const language = (token?.language as string) || "English";
    let language_code = "en";

    switch (language) {
        case "English":
            language_code = "en";
            break;
        case "Hebrew":
            language_code = "he";
            break;
        default:
            language_code = "en";
            break;
    }

    return language_code;
}
