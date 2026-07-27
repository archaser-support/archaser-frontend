import crypto from "crypto";

import { User } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import {
    sentWelcomeUserEmail,
    getWelcomeEmailDiagnostics,
    getResetPasswordUrlDiagnostics,
    logWelcomeEmailEvent,
} from "@/server/EmailService";
import { LogLevel } from "@/types/MongoLog";
import AppUrls from "@/utils/appUrls";
import { isValidIANATimezone } from "@/utils/timezoneValidation";

/** Find a user by email (excludes deleted users) */
export async function findUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findFirst({
        where: {
            email,
        },
    });
}

/** Find a user by username */
export async function findUserByUsername(username: string): Promise<User | null> {
    return await prisma.user.findFirst({
        where: {
            username,
        },
    });
}

/**
 * Check if a username is available
 * @param username The username to check
 * @param excludeUserId Optional user ID to exclude from the check (for updates)
 * @returns true if username is available, false otherwise
 */
export async function checkUsernameAvailability(
    username: string,
    excludeUserId?: string
): Promise<boolean> {
    const existingUser = await prisma.user.findFirst({
        where: {
            username,
            ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        },
    });
    return !existingUser;
}



/**
 * Special user ID for portal actions
 * This identifier always resolves to "Portal User" in the UI (translated)
 * @deprecated Use getPortalUserId(accountId) instead for account-specific portal users
 */
export const PORTAL_USER_ID = "portal_user";

/**
 * Get the system user ID for a specific account
 * Pattern: 11111111-1111-1111-1111-{accountId padded to 12 digits}
 * @param accountId The account ID
 * @returns The system user ID for the account
 */
export function getSystemUserId(accountId: number): string {
    const paddedAccountId = accountId.toString().padStart(12, "0");
    return `11111111-1111-1111-1111-${paddedAccountId}`;
}

/**
 * Get the portal user ID for a specific account
 * Pattern: 00000000-0000-0000-0000-{accountId padded to 12 digits}
 * @param accountId The account ID
 * @returns The portal user ID for the account
 */
export function getPortalUserId(accountId: number): string {
    const paddedAccountId = accountId.toString().padStart(12, "0");
    return `00000000-0000-0000-0000-${paddedAccountId}`;
}

/** Find a user by ID (excludes deleted users) */
export async function findUserById(
    id: string,
    accountId?: number
): Promise<User | null> {
    // Backward compatibility: Handle old "portal_user" string identifier
    if (id === PORTAL_USER_ID) {
        // If accountId is provided, try to find the actual portal user for that account
        if (accountId) {
            const portalUserId = getPortalUserId(accountId);
            const portalUser = await prisma.user.findFirst({
                where: {
                    id: portalUserId,
                    account_id: accountId,
                },
            });
            if (portalUser) {
                return portalUser;
            }
        }
        // Fallback: Return a virtual user object for Portal User (backward compatibility)
        // Store translation key in name field - will be translated at display time
        // Use type assertion with 'unknown' first to avoid type errors
        return {
            id: PORTAL_USER_ID,
            name: "{{users.values.portal_user}}",
            first_name: null, // Portal user doesn't have separate first/last name
            last_name: null,
            email: "portal@system.local",
            emailVerified: null,
            image: null,
            account_id: null,
            role: null,
            status: "Active",
            language: "English" as any,
            locale: null,
            timezone: null,
            currency: null,
            business_unit_id: null,
            mobile: null,
            deactivated_at: null,
            created_at: new Date(),
            modified_at: new Date(),
            resetToken: null,
            resetTokenExpiry: null,
            session_version: 0,
            is_audit_user: false,
        } as unknown as User;
    }

    // Check if this is a portal user ID pattern (00000000-0000-0000-0000-...)
    if (id.startsWith("00000000-0000-0000-0000-")) {
        return await prisma.user.findFirst({
            where: {
                id,
            },
        });
    }

    // Check if this is a system user ID pattern (11111111-1111-1111-1111-...)
    if (id.startsWith("11111111-1111-1111-1111-")) {
        return await prisma.user.findFirst({
            where: {
                id,
            },
        });
    }

    return await prisma.user.findFirst({
        where: {
            id,
        },
    });
}

/** Generate a password reset token and expiry */
export async function generateResetToken(email: string): Promise<string> {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour expiry

    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) throw new Error("User not found");

    await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
    });

    return resetToken;
}

/** Find a user by reset token (excludes deleted users) */
export async function findUserByResetToken(
    resetToken: string
): Promise<User | null> {
    return await prisma.user.findFirst({
        where: {
            resetToken,
            resetTokenExpiry: {
                gt: new Date(),
            },
        },
    });
}

/** Reset user's password and clear reset token fields */
export async function resetUserPassword(
    userId: string,
    newPassword: string
): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: userId },
        data: {
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiry: null,
            session_version: { increment: 1 },
        },
    });
}

/** Get all users for a customer */
export async function getUsersByAccountId(accountId: number): Promise<User[]> {
    return await prisma.user.findMany({
        where: {
            account_id: accountId,
        },
        orderBy: { created_at: "desc" },
    });
}

/** Update user with customer ID */
export async function linkUserToCustomer(
    userId: string,
    accountId: number
): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: { account_id: accountId },
    });
}

/**
 * Create a new user with an automatically generated password and welcome email.
 * Used by admins, account managers, and users creating other users in their customer account.
 * @returns The created user
 */
export async function createUser({
    email,
    username,
    mobile,
    first_name,
    last_name,
    role,
    language,
    status,
    account_id,
    time_zone,
    locale,
    created_by,
    modified_by,
    business_unit_id,
}: Partial<User> & {
    username?: string;
    created_by?: string;
    modified_by?: string;
}): Promise<User> {
    try {
        if (!email) {
            throw new Error("User email is required.");
        }

        // Note: Email uniqueness is NOT enforced - emails can be reused across users
        // Only username must be unique across the system

        // Determine the username - use provided username or default to email
        const effectiveUsername = username || email;

        // Check if username is available
        const isUsernameAvailable = await checkUsernameAvailability(effectiveUsername);
        if (!isUsernameAvailable) {
            throw new Error("A user with this username already exists.");
        }

        if (!account_id) {
            throw new Error("Customer id required.");
        }

        const existingAccount = await prisma.account.findUnique({
            where: { id: account_id },
        });

        if (!existingAccount) {
            throw new Error("Account does not exist.");
        }

        // Validate timezone is IANA format if provided (database now stores IANA directly)
        if (time_zone && !isValidIANATimezone(time_zone)) {
            throw new Error(
                `Invalid timezone: "${time_zone}" is not a valid IANA timezone identifier`
            );
        }

        // Generate a random 12-character alphanumeric password
        const generatedPassword = crypto.randomBytes(6).toString("base64url");

        // Hash the generated password
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        // Generate reset token and expiry
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 3600000 * 24); // 24-hour expiry

        // Create the new user in the database
        const effectiveUserId = created_by || modified_by;
        const user = await prisma.user.create({
            data: {
                id: crypto.randomUUID(),
                account_id: account_id,
                email,
                username: effectiveUsername,
                mobile,
                first_name,
                last_name,
                name: `${first_name} ${last_name}`,
                role,
                language,
                status,
                password: hashedPassword,
                resetToken,
                resetTokenExpiry,
                time_zone,
                locale,
                modified_at: new Date(), // Required field
                created_by: effectiveUserId || null,
                modified_by: effectiveUserId || null,
                business_unit_id: business_unit_id || null,
                sidebar_collapsed: false,
            } as any,
        });

        // User created

        // Generate the reset password URL
        const resetPasswordUrl = `${process.env.NEXTAUTH_URL}${AppUrls.RESET_PASSWORD(resetToken)}`;

        // Send a welcome email with the reset password link
        const welcomeEmailLogContext = {
            accountId: account_id,
            userId: user.id,
        };

        try {
            logWelcomeEmailEvent(
                "Welcome email attempt starting",
                LogLevel.INFO,
                {
                    step: "welcome_email_attempt_start",
                    recipientEmail: email,
                    userName: user.name || "",
                    hasCollection: existingAccount.has_collection === true,
                    hasCreditInsurance:
                        existingAccount.has_credit_insurance === true,
                    resetTokenSet: Boolean(resetToken),
                    resetTokenExpiry: resetTokenExpiry.toISOString(),
                    ...getResetPasswordUrlDiagnostics(resetPasswordUrl),
                    ...getWelcomeEmailDiagnostics(),
                },
                welcomeEmailLogContext
            );

            const welcomeEmailResult = await sentWelcomeUserEmail(
                email,
                user.name || "",
                resetPasswordUrl,
                undefined,
                existingAccount.has_collection === true,
                existingAccount.has_credit_insurance === true,
                welcomeEmailLogContext
            );
            logWelcomeEmailEvent(
                "Welcome email sent",
                LogLevel.INFO,
                {
                    step: "welcome_email_attempt_success",
                    recipientEmail: email,
                    messageId: welcomeEmailResult.messageId || "unknown",
                    ...getWelcomeEmailDiagnostics(),
                },
                welcomeEmailLogContext
            );
        } catch (emailError) {
            const mailErrorDetails =
                emailError &&
                typeof emailError === "object" &&
                "message" in emailError
                    ? {
                          errorMessage: String(
                              (emailError as { message: unknown }).message
                          ),
                          errorCode:
                              "code" in emailError
                                  ? String(
                                        (emailError as { code: unknown }).code
                                    )
                                  : undefined,
                          errorCommand:
                              "command" in emailError
                                  ? String(
                                        (emailError as { command: unknown })
                                            .command
                                    )
                                  : undefined,
                          errorResponse:
                              "response" in emailError
                                  ? String(
                                        (emailError as { response: unknown })
                                            .response
                                    )
                                  : undefined,
                          errorResponseCode:
                              "responseCode" in emailError
                                  ? String(
                                        (
                                            emailError as {
                                                responseCode: unknown;
                                            }
                                        ).responseCode
                                    )
                                  : undefined,
                      }
                    : {
                          errorMessage: String(emailError),
                      };

            logWelcomeEmailEvent(
                "Welcome email failed",
                LogLevel.ERROR,
                {
                    step: "welcome_email_attempt_failed",
                    recipientEmail: email,
                    ...mailErrorDetails,
                    ...getResetPasswordUrlDiagnostics(resetPasswordUrl),
                    ...getWelcomeEmailDiagnostics(),
                },
                welcomeEmailLogContext
            );
            // Don't throw error here, as the user was created successfully
        }

        return user;
    } catch (error: any) {
        const message = error?.message || "";

        if (error?.code === "P2002") {
            const target = error.meta?.target as string[] | undefined;
            if (target?.includes("username")) {
                throw new Error("A user with this username already exists.");
            }
        }

        if (
            message.includes("already exists") ||
            message.includes("required") ||
            message.includes("Invalid timezone") ||
            message.includes("does not exist")
        ) {
            throw error;
        }
        throw new Error("Failed to create user.");
    }
}
