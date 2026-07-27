import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

import { authOptions } from "@/server/auth/authOptions";
import { getCookieName } from "./authUtils";

/**
 * Get session from either NextAuth or test auth token
 * This allows stress tests to use test auth tokens while production uses NextAuth
 */
export async function getSessionOrTestAuth(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<{
    user: {
        id: string;
        email: string;
        account_id: number;
        name?: string;
        role?: string;
        language?: string;
        timezone?: string;
        currency?: string;
        locale?: string;
    } | null;
}> {
    // First try NextAuth session
    const session = await getServerSession(req, res, authOptions);
    if (session?.user) {
        return { user: session.user };
    }

    // If NextAuth session not available, try test auth token
    // Only allow in development or when explicitly enabled
    if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_TEST_AUTH !== "true"
    ) {
        return { user: null };
    }

    try {
        const isSecure = process.env.NODE_ENV === "production" && (process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://") ?? false);
        const token = await getToken({
            req,
            secret: process.env.NEXTAUTH_SECRET!,
            cookieName: getCookieName(isSecure),
        });

        if (token && token.id && token.account_id) {
            return {
                user: {
                    id: token.id as string,
                    email: (token.email as string) || "",
                    account_id: token.account_id as number,
                    name: token.name as string | undefined,
                    role: token.role as string | undefined,
                    language: token.language as string | undefined,
                    timezone: token.timezone as string | undefined,
                    currency: token.currency as string | undefined,
                    locale: token.locale as string | undefined,
                },
            };
        }
    } catch (error) {
        // Silently fail - test auth not available
        // Test auth failed, continuing with null user
    }

    return { user: null };
}
