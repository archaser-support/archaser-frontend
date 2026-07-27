// Intentionally no `server-only` import: this module is shared by Pages API routes
// (e.g. pages/api/auth/[...nextauth].ts) and App Router server components.
import { user_role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { jwtVerify } from "jose";
import { type NextAuthOptions, type User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "@/lib/prisma";
import { AccountService } from "@/server/services/AccountService";
import { AdminNotificationService } from "@/server/services/AdminNotificationService";
import { getCookieName as sharedGetCookieName } from "@/utils/authUtils";
import { mongoLogService } from "@/server/services/MongoLogService";
import { LogLevel } from "@/types/MongoLog";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
const useSecureCookies = process.env.NODE_ENV === "production" && (baseUrl?.startsWith("https://") ?? false);

const getRootDomain = (url: string | undefined) => {
    // In locally/development, do not set domain attribute (use host-only cookie)
    if (process.env.NODE_ENV !== "production") return undefined;

    if (!url) return undefined;

    // Isolation fix: If it's a staging environment, return undefined to make it a host-only cookie.
    // Host-only cookies are not shared with other subdomains or the root domain.
    if (url.includes("staging.archaser.com")) {
        return undefined;
    }

    try {
        const hostname = new URL(url).hostname;
        // Detect IP addresses
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return undefined;
        if (hostname.includes("localhost")) return undefined;

        const parts = hostname.split(".");
        // For production, we may want to share cookies across subdomains (e.g. app.archaser.com)
        if (parts.length >= 2) {
            const domain = "." + parts.slice(-2).join(".");
            return domain;
        }
    } catch {
        return undefined;
    }
    return undefined;
};

const rootDomain = getRootDomain(baseUrl);

// Email normalization for consistent user matching across providers
const normalizeEmail = (email: string | null | undefined): string => {
    return email?.toLowerCase().trim() ?? "";
};

const nestJwtSecret = () =>
    process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "";

async function buildSessionUserFromDbUser(user: {
    id: string;
    username: string;
    email: string | null;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    account_id: number | null;
    language: string | null;
    role: user_role | string | null;
    time_zone: string | null;
    locale: string | null;
    session_version?: number | null;
    sidebar_collapsed?: boolean | null;
}): Promise<
    User & {
        session_version: number;
        sidebar_collapsed: boolean;
    }
> {
    const timeZone = user?.time_zone;

    let currency: string | undefined = undefined;
    if (user.account_id) {
        try {
            const account = await prisma.account.findUnique({
                where: { id: user.account_id },
                select: { currency: true },
            });
            currency = account?.currency || undefined;
        } catch {
            // Account table may not exist yet during migration
        }
    }

    const displayName =
        user.name ||
        (user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : user.first_name || user.last_name || user.email || "");

    return {
        id: user.id,
        name: displayName,
        email: user.email || "",
        account_id: user.account_id,
        language: user.language,
        role: user.role as string,
        timezone: timeZone ?? null,
        currency: currency,
        locale: user?.locale,
        session_version: (user as { session_version?: number }).session_version ?? 0,
        sidebar_collapsed:
            (user as { sidebar_collapsed?: boolean }).sidebar_collapsed ?? false,
    } as User & {
        session_version: number;
        sidebar_collapsed: boolean;
    };
}

async function authorizeFromNestAccessToken(
    nestAccessToken: string
): Promise<
    User & {
        session_version: number;
        sidebar_collapsed: boolean;
    }
> {
    const secret = nestJwtSecret();
    if (!secret) {
        throw new Error("Authentication configuration error");
    }

    let sub: string;
    try {
        const { payload } = await jwtVerify(
            nestAccessToken,
            new TextEncoder().encode(secret)
        );
        if (!payload.sub || typeof payload.sub !== "string") {
            throw new Error("Invalid token subject");
        }
        sub = payload.sub;
    } catch {
        throw new Error("Invalid or expired Nest access token");
    }

    const user = await prisma.user.findFirst({
        where: {
            id: sub,
            deactivated_at: null,
        },
        select: {
            id: true,
            username: true,
            email: true,
            name: true,
            first_name: true,
            last_name: true,
            account_id: true,
            status: true,
            language: true,
            role: true,
            time_zone: true,
            locale: true,
            session_version: true,
            freeze: true,
            sidebar_collapsed: true,
        },
    });

    if (!user) {
        throw new Error("No user found for Nest token");
    }

    if ((user as { freeze?: boolean }).freeze === true) {
        throw new Error(
            "Your account has been frozen due to multiple failed login attempts. Please contact an administrator."
        );
    }

    if (user.status === "Inactive") {
        throw new Error(
            "Your account is currently inactive. Please contact support."
        );
    }

    return buildSessionUserFromDbUser(user);
}

export const authOptions: NextAuthOptions = {
    // adapter: PrismaAdapter(prisma),
    // debug: true, // Enable debug logging
    providers: [
        // EmailProvider({
        //   server: {
        //     host: process.env.EMAIL_SERVER_HOST,
        //     port: process.env.EMAIL_SERVER_PORT,
        //     auth: {
        //       user: process.env.EMAIL_SERVER_USER,
        //       pass: process.env.EMAIL_SERVER_PASSWORD,
        //     },
        //   },
        //   from: process.env.EMAIL_FROM,
        // }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: {
                    label: "Username",
                    type: "text",
                    placeholder: "your.username",
                },
                password: { label: "Password", type: "password" },
                nestAccessToken: {
                    label: "Nest Access Token",
                    type: "text",
                },
            },
            async authorize(credentials) {
                if (!credentials) {
                    throw new Error("Credentials is not defined");
                }

                // Nest JWT bridge — Stage 1A when UI authenticates against Nest
                if (
                    credentials.nestAccessToken &&
                    String(credentials.nestAccessToken).trim()
                ) {
                    return authorizeFromNestAccessToken(
                        String(credentials.nestAccessToken)
                    );
                }

                // Look up the user in the database by username (exclude deactivated users)
                const user = await prisma.user.findFirst({
                    where: {
                        username: credentials?.username,
                        deactivated_at: null,
                    },
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        password: true,
                        name: true,
                        first_name: true,
                        last_name: true,
                        account_id: true,
                        status: true,
                        language: true,
                        role: true,
                        time_zone: true,
                        locale: true,
                        session_version: true,
                        freeze: true,
                        sidebar_collapsed: true,
                        failed_login_attempts: true,
                        last_failed_login_at: true,
                    },
                });

                if (!user) {
                    throw new Error("No user found with this username");
                }

                // Check if the user has a password set
                if (!user.password) {
                    throw new Error(
                        "This account is registered for magic link login only"
                    );
                }

                // Check if user is frozen (login-level restriction, separate from Active/Inactive status)
                // Type assertion needed until TypeScript language server refreshes Prisma types
                const userFreeze = (user as any).freeze;
                if (userFreeze === true) {
                    throw new Error(
                        "Your account has been frozen due to multiple failed login attempts. Please contact an administrator."
                    );
                }

                // Verify the password using bcrypt
                const isValidPassword = await bcrypt.compare(
                    credentials?.password,
                    user.password
                );

                if (!isValidPassword) {
                    // Increment failed login attempts
                    const currentAttempts =
                        (user as any).failed_login_attempts || 0;
                    const newAttemptCount = currentAttempts + 1;
                    const shouldFreeze = newAttemptCount >= 5;
                    const wasAlreadyFrozen = (user as any).freeze === true;

                    // Update user with failed attempt and potentially freeze
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            failed_login_attempts: newAttemptCount,
                            last_failed_login_at: new Date(),
                            ...(shouldFreeze ? { freeze: true } : {}),
                        } as any,
                    });

                    // Send admin notification if account was just frozen (not already frozen)
                    if (shouldFreeze && !wasAlreadyFrozen) {
                        const lockTime = new Date();
                        const adminNotificationService =
                            AdminNotificationService.getInstance();
                        // Don't await - let it run in background, don't block login flow
                        adminNotificationService
                            .sendAccountLockNotification(
                                user.id,
                                user.email || "unknown",
                                user.account_id,
                                newAttemptCount,
                                lockTime
                            )
                            .then(() => {
                                // Admin notification sent successfully
                            })
                            .catch((error) => {
                                // Silently handle errors - notification failures shouldn't affect login
                                console.error(
                                    `[NextAuth] Failed to send admin notification for user ${user.email}:`,
                                    error
                                );
                                if (error instanceof Error) {
                                    console.error(
                                        `[NextAuth] Error details: ${error.message}`,
                                        error.stack
                                    );
                                }
                            });
                    }

                    throw new Error("Incorrect password");
                }

                // Password is valid - reset failed login attempts
                const currentAttempts =
                    (user as any).failed_login_attempts || 0;
                if (currentAttempts > 0) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            failed_login_attempts: 0,
                        } as any,
                    });
                }

                if (user.status === "Inactive") {
                    throw new Error(
                        "Your account is currently inactive. Please contact support."
                    );
                }

                return buildSessionUserFromDbUser(user);
            },
        }),
        // Microsoft (Azure AD) OAuth Provider - conditionally registered
        ...((process.env.MICROSOFT_CLIENT_ID || process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID) &&
            (process.env.MICROSOFT_CLIENT_SECRET || process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_SECRET)
            ? [
                AzureADProvider({
                    clientId: (process.env.MICROSOFT_CLIENT_ID ||
                        process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID) as string,
                    clientSecret: (process.env.MICROSOFT_CLIENT_SECRET ||
                        process.env
                            .NEXT_PUBLIC_MICROSOFT_CLIENT_SECRET) as string,
                    tenantId: process.env.MICROSOFT_TENANT_ID,
                    authorization: {
                        params: {
                            scope: "openid profile email User.Read",
                        },
                    },
                    profile(profile) {
                        // Microsoft sometimes returns email in different fields
                        // Priority: email > preferred_username > upn > mail
                        const email = profile.email ||
                            profile.preferred_username ||
                            profile.upn ||
                            profile.mail;

                        return {
                            id: profile.sub || profile.oid,
                            name: profile.name,
                            email: email,
                        } as any; // Cast to any since OAuth providers don't populate account-specific fields yet
                    },
                }),
            ]
            : []),
        // Google OAuth Provider - conditionally registered
        ...((process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) &&
            (process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET)
            ? [
                GoogleProvider({
                    clientId: (process.env.GOOGLE_CLIENT_ID ||
                        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) as string,
                    clientSecret: (process.env.GOOGLE_CLIENT_SECRET ||
                        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET) as string,
                }),
            ]
            : []),
    ],
    pages: {
        signIn: "/login", // Custom sign-in page (optional)
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        updateAge: 24 * 60 * 60, // 24 hours - session will be refreshed if older than this
    },
    cookies: {
        sessionToken: {
            name: sharedGetCookieName(useSecureCookies, "session-token"),
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: useSecureCookies,
                ...(rootDomain ? { domain: rootDomain } : {}),
            },
        },
        csrfToken: {
            name: sharedGetCookieName(useSecureCookies, "csrf-token"),
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: useSecureCookies,
                ...(rootDomain ? { domain: rootDomain } : {}),
            },
        },
        callbackUrl: {
            name: sharedGetCookieName(useSecureCookies, "callback-url"),
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: useSecureCookies,
                ...(rootDomain ? { domain: rootDomain } : {}),
            },
        },
        state: {
            name: sharedGetCookieName(useSecureCookies, "state"),
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: useSecureCookies,
                ...(rootDomain ? { domain: rootDomain } : {}),
            },
        },
        pkceCodeVerifier: {
            name: sharedGetCookieName(useSecureCookies, "pkceCodeVerifier"),
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: useSecureCookies,
                ...(rootDomain ? { domain: rootDomain } : {}),
            },
        },
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            // Allow credentials provider to proceed normally
            if (account?.provider === "credentials") {
                return true;
            }

            // OAuth provider (Microsoft, Google, etc.)
            if (account?.provider && account.provider !== "credentials") {
                try {
                    console.log(`[NextAuth] OAuth sign-in started for provider: ${account.provider}`);

                    // Extract email from profile or user
                    const email = normalizeEmail((profile?.email as string) || user?.email);

                    if (!email) {
                        console.error("[NextAuth] OAuth sign-in failed: No email provided", { profile, user });
                        return false;
                    }

                    console.log(`[NextAuth] Looking up user with email: ${email}`);

                    // Find user by normalized email (must be pre-provisioned)
                    const dbUser = await prisma.user.findFirst({
                        where: {
                            email: email,
                            deactivated_at: null,
                        },
                        include: {
                            Account_User_account_idToAccount: true, // Include full account object
                        }
                    });

                    if (!dbUser) {
                        console.error(`[NextAuth] OAuth sign-in failed: No user found with email ${email}`);
                        // Return false to generic error or generic access denied
                        return "/login?error=AccessDenied";
                    }

                    console.log(`[NextAuth] User found: ${dbUser.id}, checking account SSO settings...`);

                    // Check if user is frozen
                    const userFreeze = (dbUser as any).freeze;
                    if (userFreeze === true) {
                        console.error(`[NextAuth] OAuth sign-in failed: User ${email} is frozen`);
                        return "/login?error=AccountFrozen";
                    }

                    // Check if user is inactive
                    if (dbUser.status === "Inactive") {
                        console.error(`[NextAuth] OAuth sign-in failed: User ${email} is inactive`);
                        return "/login?error=Inactive";
                    }

                    // Validate account SSO settings
                    const userAccount = dbUser.Account_User_account_idToAccount as any; // Cast to any to access potentially missing types

                    if (!userAccount || !userAccount.sso_enabled) {
                        console.error(`[NextAuth] OAuth sign-in failed: SSO not enabled for account`, {
                            accountId: dbUser.account_id,
                            ssoEnabled: userAccount?.sso_enabled
                        });
                        return "/login?error=SSONotEnabled";
                    }

                    // Check if provider is in allowed sso_providers list
                    const allowedProviders = userAccount.sso_providers?.split(',').map((p: string) => p.trim()) || [];
                    const providerName = account.provider === "azure-ad" ? "microsoft" : account.provider;

                    console.log(`[NextAuth] Checking if provider '${providerName}' is in allowed providers:`, allowedProviders);

                    if (!allowedProviders.includes(providerName)) {
                        console.error(`[NextAuth] OAuth sign-in failed: Provider ${providerName} not in account's sso_providers`, {
                            allowedProviders,
                            attemptedProvider: providerName
                        });
                        return "/login?error=AccessDenied";
                    }

                    // All validations passed
                    console.log(`[NextAuth] OAuth sign-in successful for user ${email}`);
                    return true;
                } catch (error) {
                    console.error("[NextAuth] Error in OAuth signIn callback:", error);
                    return "/login?error=Configuration";
                }
            }

            return true;
        },
        async jwt({ token, user, trigger, session, account }) {
            if (user) {
                // For OAuth providers, fetch DB user by email
                if (account?.provider && account.provider !== "credentials") {
                    const email = normalizeEmail(user.email);

                    const dbUser = await prisma.user.findFirst({
                        where: {
                            email: email,
                            deactivated_at: null,
                        },
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            name: true,
                            first_name: true,
                            last_name: true,
                            account_id: true,
                            status: true,
                            language: true,
                            role: true,
                            time_zone: true,
                            locale: true,
                            session_version: true,
                            sidebar_collapsed: true,
                        },
                    });

                    if (!dbUser) {
                        console.error("[NextAuth Check] JWT - User not found for OAuth sign-in");
                        throw new Error("User not found for OAuth sign-in");
                    }

                    // Build same token structure as credentials
                    const displayName =
                        dbUser.name ||
                        (dbUser.first_name && dbUser.last_name
                            ? `${dbUser.first_name} ${dbUser.last_name}`
                            : dbUser.first_name ||
                            dbUser.last_name ||
                            dbUser.email ||
                            "");

                    // Fetch account details: name, currency, and colors
                    let currency: string | undefined = undefined;
                    let accountName = `Account ${dbUser.account_id}`;
                    let primaryColor: string | null = null;
                    let secondaryColor: string | null = null;
                    let chartPaletteColor: string | null = null;
                    // ssoEnabled removed as unused

                    if (dbUser.account_id) {
                        try {
                            const accountData = await prisma.account.findUnique({
                                where: { id: dbUser.account_id },
                                select: {
                                    currency: true,
                                    name: true,
                                    primary_color: true,
                                    secondary_color: true,
                                    chart_palette_color: true,
                                },
                            });
                            currency = accountData?.currency || undefined;
                            accountName = accountData?.name || accountName;
                            primaryColor = accountData?.primary_color ?? null;
                            secondaryColor = accountData?.secondary_color ?? null;
                            chartPaletteColor = accountData?.chart_palette_color ?? null;
                        } catch {
                            // Silently continue
                        }
                    }

                    token.id = dbUser.id;
                    token.name = displayName;
                    token.email = dbUser.email || "";
                    token.account_id = dbUser.account_id;
                    token.language = dbUser.language;
                    token.role = dbUser.role as string;
                    token.timezone = dbUser.time_zone ?? undefined;
                    token.currency = currency ?? "";
                    token.locale = dbUser.locale ?? undefined;
                    token.session_version = (dbUser as any).session_version;
                    token.sidebar_collapsed = (dbUser as any).sidebar_collapsed ?? false;
                    token.account_name = accountName;
                    token.primary_color = primaryColor;
                    token.secondary_color = secondaryColor;
                    token.chart_palette_color = chartPaletteColor;
                } else {
                    // Handle credentials provider
                    token.name = user.name;
                    token.email = user.email;
                    token.id = user.id;
                    token.account_id = user.account_id;
                    token.language = user.language;
                    token.role = user.role;
                    token.timezone = user?.timezone;
                    token.currency = user?.currency;
                    token.locale = user?.locale;
                    token.session_version = (user as any).session_version;
                    token.sidebar_collapsed =
                        (user as any).sidebar_collapsed ?? false;

                    // Fetch account details if account_id exists
                    if (user.account_id) {
                        try {
                            const account = await prisma.account.findUnique({
                                where: { id: user.account_id },
                                select: {
                                    name: true,
                                    primary_color: true,
                                    secondary_color: true,
                                    chart_palette_color: true,
                                },
                            });
                            token.account_name =
                                account?.name || `Account ${user.account_id}`;
                            token.primary_color = account?.primary_color ?? null;
                            token.secondary_color = account?.secondary_color ?? null;
                            token.chart_palette_color = account?.chart_palette_color ?? null;
                        } catch {
                            token.account_name = `Account ${user.account_id}`;
                            token.primary_color = null;
                            token.secondary_color = null;
                            token.chart_palette_color = null;
                        }
                    }
                }
            }

            // Validate session_version and sync user settings on every request
            if (token.id && !user) {
                // Only sync on subsequent requests, not initial login
                try {
                    const dbUser = await prisma.user.findFirst({
                        where: {
                            id: token.id as string,
                            deactivated_at: null, // Exclude deactivated users
                        },
                        select: {
                            session_version: true,
                            language: true,
                            locale: true,
                            time_zone: true,
                            name: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                            sidebar_collapsed: true,
                        },
                    });

                    const sessionVersion = dbUser?.session_version;

                    // If user doesn't exist, invalidate token
                    if (!dbUser) {
                        const errMsg = "Session validation failed: User not found";

                        await mongoLogService.logMessage({
                            level: LogLevel.WARNING,
                            message: `[Auth] ${errMsg}`,
                            source: "NextAuth-JWT",
                            user_id: parseInt(token.id as string),
                            details: { token_email: token.email }
                        });

                        throw new Error("Session invalidated");
                    }

                    // Check session_version match, but be lenient for test auth tokens
                    // Test auth tokens may have session_version 0 when user's session_version is null/undefined
                    const tokenSessionVersion = token.session_version ?? 0;
                    const dbSessionVersion = sessionVersion ?? 0;

                    // Allow if versions match, or if token has 0 and DB has null/undefined (test auth case)
                    const versionsMatch =
                        tokenSessionVersion === dbSessionVersion;
                    const isTestAuthCase =
                        tokenSessionVersion === 0 &&
                        (sessionVersion == null || sessionVersion === 0);

                    if (!versionsMatch && !isTestAuthCase) {
                        // Session version mismatch - invalidate token
                        const errMsg = "Session validation failed: Session version mismatch";

                        await mongoLogService.logMessage({
                            level: LogLevel.WARNING,
                            message: `[Auth] ${errMsg}`,
                            source: "NextAuth-JWT",
                            user_id: parseInt(token.id as string),
                            details: {
                                token_version: tokenSessionVersion,
                                db_version: dbSessionVersion
                            }
                        });

                        throw new Error("Session invalidated");
                    }

                    // Sync language, locale, timezone, name, and sidebar_collapsed from database to keep all sessions in sync
                    // This ensures changes made in one browser are reflected in all other active sessions
                    if (dbUser.language && token.language !== dbUser.language) {
                        token.language = dbUser.language;
                    }
                    if (dbUser.locale && token.locale !== dbUser.locale) {
                        token.locale = dbUser.locale;
                    }
                    if (
                        dbUser.time_zone &&
                        token.timezone !== dbUser.time_zone
                    ) {
                        token.timezone = dbUser.time_zone;
                    }
                    // Sync sidebar_collapsed from database (default to false if null/undefined)
                    const dbSidebarCollapsed =
                        dbUser.sidebar_collapsed ?? false;
                    if (token.sidebar_collapsed !== dbSidebarCollapsed) {
                        token.sidebar_collapsed = dbSidebarCollapsed;
                    }
                    // Sync name - construct from available fields
                    const dbDisplayName =
                        dbUser.name ||
                        (dbUser.first_name && dbUser.last_name
                            ? `${dbUser.first_name} ${dbUser.last_name}`
                            : dbUser.first_name ||
                            dbUser.last_name ||
                            dbUser.email ||
                            "");
                    if (dbDisplayName && token.name !== dbDisplayName) {
                        token.name = dbDisplayName;
                    }
                } catch (error) {
                    console.error(
                        "[NextAuth JWT] Error syncing user settings:",
                        error
                    );

                    // CRITICAL FIX: Do NOT invalidate session on transient database errors
                    // If the database is temporarily unreachable, we should fallback to the
                    // existing token data instead of forcing a logout.
                    // Only throw if we explicitly threw "Session invalidated" above (version mismatch)
                    if (error instanceof Error && error.message === "Session invalidated") {
                        throw error;
                    }

                    // For other errors (like DB connection timeout), silently fail the sync 
                    // and return the existing token. This prevents random logouts.
                }
            }
            // Handle session updates
            if (trigger === "update" && session) {
                // ... existing update logic ...
                // (keeping existing update logic, just omitted for brevity in this prompt block but should be preserved in file)
                // Copying existing logic just to be safe
                if (session.name !== undefined) {
                    token.name = session.name;
                }
                if ("view_as_user_id" in session) {
                    if (session.view_as_user_id === null || session.view_as_user_id === undefined) {
                        token.view_as_user_id = undefined;
                        token.view_as_user_account_id = undefined;
                        token.view_as_user_role = undefined;
                        token.view_as_user_account_name = undefined;
                        token.view_as_user_name = undefined;
                    } else {
                        token.view_as_user_id = session.view_as_user_id;

                        // Fetch impersonated user details
                        const viewAsUser = await prisma.user.findUnique({
                            where: { id: session.view_as_user_id },
                            include: { Account_User_account_idToAccount: true }
                        });

                        if (viewAsUser) {
                            token.view_as_user_account_id = viewAsUser.account_id ?? undefined;
                            token.view_as_user_role = (viewAsUser.role as string) || undefined;
                            token.view_as_user_account_name = viewAsUser.Account_User_account_idToAccount?.name ?? undefined;
                            token.view_as_user_name = viewAsUser.name || `${viewAsUser.first_name || ""} ${viewAsUser.last_name || ""}`.trim() || viewAsUser.email;
                        }
                    }
                }
                if (session.locale !== undefined) token.locale = session.locale;
                if (session.language !== undefined) token.language = session.language;
                if (session.timezone !== undefined) token.timezone = session.timezone;
                if ("sidebar_collapsed" in session && session.sidebar_collapsed !== undefined) {
                    token.sidebar_collapsed = session.sidebar_collapsed;
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
                session.user.name = token.name as string;
                // ... map other fields
                session.user.account_id = token.account_id as number;
                session.user.language = token.language as string;
                session.user.role = (token.role as string) || "Auditor";
                session.user.timezone = token.timezone as string;
                session.user.currency = token.currency as string;
                session.user.locale = token.locale as string;
                session.user.account_name = (token.account_name as string) || "Default Customer";
                session.user.primary_color = (token.primary_color as string | null | undefined);
                session.user.secondary_color = (token.secondary_color as string | null | undefined);
                session.user.chart_palette_color = (token.chart_palette_color as string | null | undefined);
                session.user.view_as_user_id = token.view_as_user_id as string | undefined;
                session.user.view_as_user_account_id = token.view_as_user_account_id as number | undefined;
                session.user.view_as_user_role = token.view_as_user_role as string | undefined;
                session.user.view_as_user_account_name = token.view_as_user_account_name as string | undefined;
                session.user.view_as_user_name = token.view_as_user_name as string | undefined;
                session.user.sidebar_collapsed = (token.sidebar_collapsed ?? false) as boolean;
            }
            return session;
        },
        // async session({ session, user }) {
        //   // Add the user ID and customer ID to the session
        //   session.user.id = user.id;
        //   session.user.account_id = user.account_id;
        //   session.user.language = user.language;

        //   if (user.account_id) {
        //     // Fetch the associated customer
        //     const customer = await prisma.customer.findUnique({
        //       where: { id: user.account_id },
        //     });

        //     session.user.customer = customer;
        //   }

        //   return session;
        // },
        // async redirect(url, baseUrl) {
        //   return '/dashboards/crm/'
        // },
    },
    events: {
        async createUser({ user }) {
            // Create a corresponding Customer when a new User is created
            const customer = await AccountService.createCustomer({
                name: user.name || "New Customer",
                promise_to_pay: 14,
                company_number: `AUTH-${Date.now()}`, // Generate unique company number
                status: "Active",
            });

            // Update the User with the accountId
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    account_id: customer.id,
                    role: user.role as user_role,
                },
            });
        },
        async signIn({ user, account }) {
            await mongoLogService.logMessage({
                level: LogLevel.INFO,
                message: `[Auth] User signed in: ${user.email} (${account?.provider})`,
                source: "NextAuth-Event",
                user_id: parseInt(user.id),
                details: { provider: account?.provider, email: user.email }
            });
        },
        async signOut({ token }) {
            await mongoLogService.logMessage({
                level: LogLevel.INFO,
                message: `[Auth] User signed out: ${token.email}`,
                source: "NextAuth-Event",
                user_id: parseInt(token.id as string),
                details: { email: token.email }
            });
        },
        async session({ session }) {
            // Optional: Log every session creation/refresh
            // This might be noisy, but useful for debugging isolation
            if (session.user) {
                await mongoLogService.logMessage({
                    level: LogLevel.DEBUG,
                    message: `[Auth] Session active: ${session.user.email}`,
                    source: "NextAuth-Event",
                    user_id: parseInt(session.user.id),
                    details: {
                        service: process.env.SERVICE_NAME,
                        baseUrl: process.env.NEXT_PUBLIC_BASE_URL
                    }
                });
            }
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};
