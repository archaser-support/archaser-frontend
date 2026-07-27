import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

/**
 * Account Lookup API
 * GET /api/auth/account-by-subdomain?subdomain=acme
 * 
 * Returns account SSO settings for a given subdomain.
 * Used by login page to determine which SSO buttons to display.
 * 
 * Public endpoint - only exposes minimal account info needed for login UX.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { subdomain } = req.query;

    if (!subdomain || typeof subdomain !== "string") {
        return res.status(400).json({ error: "Subdomain parameter is required" });
    }

    try {
        // Look up account by subdomain (case-insensitive)
        const account = await prisma.account.findFirst({
            where: {
                sub_domain: {
                    equals: subdomain,
                    mode: "insensitive",
                },
                deleted_at: null, // Exclude deleted accounts
            },
            select: {
                id: true,
                name: true,
                sso_enabled: true,
                sso_providers: true,
            },
        });

        if (!account) {
            return res.status(404).json({ error: "Account not found" });
        }

        // Parse sso_providers string into array
        const ssoProviders = account.sso_providers
            ? account.sso_providers.split(",").map((p: string) => p.trim())
            : [];

        return res.status(200).json({
            accountId: account.id,
            name: account.name,
            ssoEnabled: account.sso_enabled ?? false,
            ssoProviders: ssoProviders,
        });
    } catch (error) {
        console.error("[Account Lookup API] Error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
