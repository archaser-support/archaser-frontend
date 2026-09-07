import { NextApiRequest } from "next";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { parse } from "tldts";

import { getCustomerPortalUrl } from "@/utils/appUrls";
import { getEnvironmentLabel } from "@/utils/domainUtils";
import { serializeBigInt } from "@/utils/serializeBigInt";

/** Checked against SERVICE_NAME, which is set per deployment (e.g. archaser-staging). */
const ENVIRONMENT_LABELS = ["staging", "dev", "preprod", "production"] as const;

function hostnameOf(url: string | null | undefined): string {
    if (!url) return "";
    try {
        const fullUrl = url.includes("://") ? url : `https://${url}`;
        return new URL(fullUrl).hostname;
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

/**
 * Secret the session cookie is signed with. Mirrors `authOptions.secret`: a
 * reader that falls back differently cannot decrypt the cookie it is handed.
 */
export const sessionSecret = (): string | undefined =>
    process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;

/**
 * Whether auth cookies carry the `__Secure-` prefix and the `secure` attribute.
 * `authOptions` and every reader must agree on this, so it is derived here once.
 */
type RequestContext = NextRequest | NextApiRequest | Request | string | null | undefined;

export const authCookiesAreSecure = (
    reqOrHost?: RequestContext
): boolean => {
    if (process.env.NODE_ENV !== "production") {
        return false;
    }
    if (reqOrHost) {
        if (typeof reqOrHost === "string") {
            if (reqOrHost.startsWith("https://")) return true;
            if (reqOrHost.startsWith("http://")) return false;
        } else if ("headers" in reqOrHost && reqOrHost.headers) {
            const headers = reqOrHost.headers;
            const proto = typeof headers.get === "function"
                ? headers.get("x-forwarded-proto")
                : (headers as Record<string, string | string[] | undefined>)["x-forwarded-proto"];
            const protoStr = Array.isArray(proto) ? proto[0] : proto;
            const nextUrlProto = (reqOrHost as NextRequest).nextUrl?.protocol;
            if (protoStr || nextUrlProto) {
                return (protoStr || nextUrlProto || "").includes("https");
            }
        }
    }
    const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "";
    if (baseUrl.startsWith("http://")) {
        return false;
    }
    return true;
};

/**
 * Name of a NextAuth cookie for this deployment. `authOptions` configures the
 * session cookie with this name, and middleware, `getServerSession` and the
 * helpers below read it back. A writer/reader disagreement makes login appear
 * to succeed and then bounce straight back to /login, so this is the single
 * source of truth for the name.
 */
export const getCookieName = (
    isSecure: boolean,
    name: string = "session-token",
    reqOrHost?: RequestContext
) => {
    const cookieMap: Record<string, string> = {
        "session-token": "session-token",
        "csrf-token": "csrf-token",
        "callback-url": "callback-url",
        "state": "state",
        "pkce.code_verifier": "pkce.code_verifier",
        "pkceCodeVerifier": "pkce.code_verifier",
        "nonce": "nonce",
    };

    const targetName = cookieMap[name] || name;
    const baseName = `next-auth.${targetName}`;
    const prefix = isSecure ? "__Secure-" : "";
    const serviceName = process.env.SERVICE_NAME || "";
    const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "";

    let requestHost = "";
    if (reqOrHost) {
        if (typeof reqOrHost === "string") {
            requestHost = hostnameOf(reqOrHost);
        } else if ("headers" in reqOrHost && reqOrHost.headers) {
            const headers = reqOrHost.headers;
            const hostHeader = typeof headers.get === "function"
                ? headers.get("host")
                : (headers as Record<string, string | string[] | undefined>)["host"];
            const hostStr = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
            requestHost =
                hostStr ||
                (reqOrHost as NextRequest).nextUrl?.hostname ||
                "";
        }
    }

    const envLabel =
        ENVIRONMENT_LABELS.find((label) => serviceName.includes(label)) ??
        getEnvironmentLabel(requestHost) ??
        getEnvironmentLabel(hostnameOf(baseUrl));
    const suffix = envLabel ? `.${envLabel}` : "";
    return `${prefix}${baseName}${suffix}`;
};

/**
 * Returns candidate cookie names to handle potential writer/reader deployment mismatches.
 */
export const getCookieNameCandidates = (
    isSecure: boolean,
    name: string = "session-token",
    reqOrHost?: RequestContext
): string[] => {
    const primary = getCookieName(isSecure, name, reqOrHost);
    const candidates: string[] = [primary];

    const baseTarget = name === "session-token" ? "session-token" : name;
    let hostLabel: string | null = null;
    if (reqOrHost) {
        let hostStr = "";
        if (typeof reqOrHost === "string") {
            hostStr = reqOrHost;
        } else if ("headers" in reqOrHost && reqOrHost.headers) {
            const headers = reqOrHost.headers;
            const hostHeader = typeof headers.get === "function"
                ? headers.get("host")
                : (headers as Record<string, string | string[] | undefined>)["host"];
            hostStr = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader) || (reqOrHost as NextRequest).nextUrl?.hostname || "";
        }
        if (hostStr) {
            hostLabel = getEnvironmentLabel(hostnameOf(hostStr));
        }
    }

    const prefixes = isSecure ? ["__Secure-", ""] : ["", "__Secure-"];
    const suffixes = new Set<string>();

    const serviceName = process.env.SERVICE_NAME || "";
    const envLabel = ENVIRONMENT_LABELS.find((label) =>
        serviceName.includes(label)
    );
    if (envLabel) suffixes.add(`.${envLabel}`);
    if (hostLabel) suffixes.add(`.${hostLabel}`);

    const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "";
    const urlLabel = getEnvironmentLabel(hostnameOf(baseUrl));
    if (urlLabel) suffixes.add(`.${urlLabel}`);

    suffixes.add(""); // Standard fallback with no suffix

    for (const p of prefixes) {
        for (const s of suffixes) {
            const cand = `${p}next-auth.${baseTarget}${s}`;
            if (!candidates.includes(cand)) {
                candidates.push(cand);
            }
        }
    }

    return candidates;
};

const extractToken = async (request: NextApiRequest | NextRequest) => {
    const isSecure = authCookiesAreSecure(request);
    let token = await getToken({
        req: request,
        secret: sessionSecret(),
        cookieName: getCookieName(isSecure, "session-token", request),
    });
    if (!token) {
        const candidates = getCookieNameCandidates(
            isSecure,
            "session-token",
            request
        );
        for (const candidate of candidates) {
            token = await getToken({
                req: request,
                secret: sessionSecret(),
                cookieName: candidate,
            });
            if (token) break;
        }
    }
    return token;
};

// Helper: Get user from token (legacy function - use getAccountId/getUserId instead)
export async function getUser(request: Request): Promise<Token> {
    const isSecure = authCookiesAreSecure(request);
    let token = (await getToken({
        req: request as any,
        secret: sessionSecret(),
        cookieName: getCookieName(isSecure, "session-token", request),
    })) as Token | null;

    if (!token) {
        const candidates = getCookieNameCandidates(
            isSecure,
            "session-token",
            request
        );
        for (const candidate of candidates) {
            token = (await getToken({
                req: request as any,
                secret: sessionSecret(),
                cookieName: candidate,
            })) as Token | null;
            if (token) break;
        }
    }

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
