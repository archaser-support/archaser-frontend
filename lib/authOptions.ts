/**
 * NextAuth options for the UI-only frontend: the browser authenticates against
 * Nest and exchanges the resulting access token for a NextAuth cookie session.
 * Amplify verifies that token with JWT_SECRET when it matches Nest, otherwise
 * it asks Nest GET /auth/me so a mismatched Amplify secret does not 401 login.
 */
import { jwtVerify } from "jose";
import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { authCookiesAreSecure, getCookieName } from "@/utils/authUtils";
import { nestFetch } from "@/utils/nestAuth";

const nestJwtSecret = () => process.env.JWT_SECRET || "";

type NestBridgeUser = User & {
    username: string;
    timezone?: string | null;
    locale?: string | null;
    account_name?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    chart_palette_color?: string | null;
    currency?: string | null;
    sidebar_collapsed?: boolean | null;
};

function claimString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function claimBool(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
}

/** Login posts `nestAccessToken`. */
export function nestAccessTokenFromCredentials(
    credentials: Record<string, unknown> | undefined
): string | null {
    const raw = credentials?.nestAccessToken;
    if (typeof raw !== "string") {
        return null;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function nestBridgeUserFromClaims(
    claims: Record<string, unknown>
): NestBridgeUser | null {
    const sub = claimString(claims.sub);
    if (!sub) {
        return null;
    }
    const username = claimString(claims.username) || sub;
    const name = claimString(claims.name) || username;
    const email = claimString(claims.email) || "";
    const role = claimString(claims.role) || "Collection_Agent";
    const account_id =
        typeof claims.account_id === "number" ? claims.account_id : null;

    return {
        id: sub,
        name,
        email,
        account_id,
        role,
        language: claimString(claims.language) || "English",
        locale: claimString(claims.locale),
        timezone: claimString(claims.timezone),
        username,
        account_name: claimString(claims.account_name) || "",
        primary_color: claimString(claims.primary_color) ?? null,
        secondary_color: claimString(claims.secondary_color) ?? null,
        chart_palette_color: claimString(claims.chart_palette_color) ?? null,
        currency: claimString(claims.currency),
        sidebar_collapsed: claimBool(claims.sidebar_collapsed),
    };
}

async function profileFromNestMe(
    nestAccessToken: string
): Promise<NestBridgeUser | null> {
    try {
        const response = await nestFetch("/auth/me", {
            headers: { Authorization: `Bearer ${nestAccessToken}` },
            cache: "no-store",
        });
        if (!response.ok) {
            return null;
        }
        const body = (await response.json()) as Record<string, unknown>;
        return nestBridgeUserFromClaims(body);
    } catch {
        return null;
    }
}

async function authorizeFromNestAccessToken(
    nestAccessToken: string
): Promise<NestBridgeUser | null> {
    const secret = nestJwtSecret();
    if (secret) {
        try {
            const { payload } = await jwtVerify(
                nestAccessToken,
                new TextEncoder().encode(secret)
            );
            const fromJwt = nestBridgeUserFromClaims(
                payload as Record<string, unknown>
            );
            if (fromJwt) {
                return fromJwt;
            }
        } catch {
            // Amplify JWT_SECRET often differs from Nest; ask Nest instead.
        }
    }
    return profileFromNestMe(nestAccessToken);
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            id: "credentials",
            name: "Credentials",
            credentials: {
                nestAccessToken: { label: "Nest token", type: "text" },
            },
            async authorize(credentials) {
                const nestAccessToken = nestAccessTokenFromCredentials(
                    credentials as Record<string, unknown> | undefined
                );
                if (!nestAccessToken) {
                    return null;
                }
                return authorizeFromNestAccessToken(nestAccessToken);
            },
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
    session: { strategy: "jwt" },
    pages: {
        signIn: "/login",
    },
    // Middleware and server components look the session cookie up by the
    // deployment-specific name from `getCookieName`, which NextAuth would not
    // produce on its own. Naming it here is what keeps the writer and those
    // readers in agreement; without it a deployment whose name carries an
    // environment suffix authenticates and then redirects back to /login.
    useSecureCookies: authCookiesAreSecure(),
    cookies: {
        sessionToken: {
            name: getCookieName(authCookiesAreSecure()),
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: authCookiesAreSecure(),
            },
        },
    },
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                const u = user as NestBridgeUser;
                token.id = u.id;
                token.username = u.username;
                token.account_id = u.account_id;
                token.role = u.role;
                token.language = u.language;
                token.email = u.email;
                token.name = u.name;
                token.locale = u.locale;
                token.timezone = u.timezone;
                token.account_name = u.account_name;
                token.primary_color = u.primary_color;
                token.secondary_color = u.secondary_color;
                token.chart_palette_color = u.chart_palette_color;
                token.currency = u.currency ?? undefined;
                token.sidebar_collapsed = u.sidebar_collapsed ?? undefined;
            }
            if (trigger === "update" && session) {
                const source =
                    typeof session === "object" &&
                    session &&
                    "user" in session &&
                    session.user &&
                    typeof session.user === "object"
                        ? (session.user as Record<string, unknown>)
                        : (session as Record<string, unknown>);
                if ("primary_color" in source) {
                    token.primary_color = claimString(source.primary_color) ?? null;
                }
                if ("secondary_color" in source) {
                    token.secondary_color =
                        claimString(source.secondary_color) ?? null;
                }
                if ("chart_palette_color" in source) {
                    token.chart_palette_color =
                        claimString(source.chart_palette_color) ?? null;
                }
                if ("language" in source) {
                    const language = claimString(source.language);
                    if (language) {
                        token.language = language;
                    }
                }
                if ("locale" in source) {
                    token.locale = claimString(source.locale) ?? null;
                }
                if ("name" in source) {
                    const name = claimString(source.name);
                    if (name) {
                        token.name = name;
                    }
                }
                if ("timezone" in source) {
                    token.timezone = claimString(source.timezone) ?? null;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.email = (token.email as string) || "";
                session.user.name = (token.name as string) || "";
                (
                    session.user as { username?: string }
                ).username = token.username as string;
                session.user.account_id =
                    typeof token.account_id === "number" ? token.account_id : 0;
                session.user.role = (token.role as string) || "";
                session.user.language =
                    (token.language as string) || "English";
                session.user.account_name =
                    (token.account_name as string) || "";
                (
                    session.user as { sidebar_collapsed?: boolean | null }
                ).sidebar_collapsed =
                    typeof token.sidebar_collapsed === "boolean"
                        ? token.sidebar_collapsed
                        : null;
                (
                    session.user as { locale?: string | null }
                ).locale = (token.locale as string) || null;
                (
                    session.user as { timezone?: string | null }
                ).timezone = (token.timezone as string) || null;
                (
                    session.user as { primary_color?: string | null }
                ).primary_color = (token.primary_color as string) || null;
                (
                    session.user as { secondary_color?: string | null }
                ).secondary_color =
                    (token.secondary_color as string) || null;
                session.user.chart_palette_color =
                    (token.chart_palette_color as string) || null;
                session.user.currency =
                    (token.currency as string) || undefined;
            }
            return session;
        },
    },
};
