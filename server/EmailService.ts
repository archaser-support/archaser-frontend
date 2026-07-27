import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid"; // Add UUID library for generating unique tracker IDs

import { prisma } from "@/lib/prisma";
import { addEnvironmentPrefixToEmailSubject } from "@/utils/domainUtils";
import { LogLevel } from "@/types/MongoLog";

import {
    getEmailTemplate,
    getEmailSubject,
    EMAIL_TYPES,
} from "../shared/templates/email-templates";
import { mongoLogService } from "./services/MongoLogService";

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST, // e.g., "email-smtp.eu-north-1.amazonaws.com"
    port: parseInt(process.env.EMAIL_SERVER_PORT || "587"), // Use environment variable with fallback
    secure: parseInt(process.env.EMAIL_SERVER_PORT || "587") === 465, // Secure for port 465, not for 587
    auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
    },
});

const senderEmail = process.env.EMAIL_FROM;

function getWelcomeEmailDiagnostics() {
    return {
        smtpHost: process.env.EMAIL_SERVER_HOST || "unset",
        smtpPort: process.env.EMAIL_SERVER_PORT || "587",
        smtpSecure: parseInt(process.env.EMAIL_SERVER_PORT || "587") === 465,
        smtpUserSet: Boolean(process.env.EMAIL_SERVER_USER),
        smtpPasswordSet: Boolean(process.env.EMAIL_SERVER_PASSWORD),
        emailFrom: process.env.EMAIL_FROM || "unset",
        nextAuthUrlSet: Boolean(process.env.NEXTAUTH_URL),
        sesConfigurationSet: process.env.SES_CONFIGURATION_SET || "unset",
        bounceReceiverSet: Boolean(process.env.BOUNCE_RECEIVER_EMAIL),
    };
}

function flattenNodemailerError(
    error: unknown
): Record<string, string | undefined> {
    if (!error || typeof error !== "object") {
        return { errorMessage: String(error) };
    }

    const mailError = error as {
        message?: string;
        code?: unknown;
        command?: unknown;
        response?: unknown;
        responseCode?: unknown;
    };

    return {
        errorMessage:
            typeof mailError.message === "string"
                ? mailError.message
                : String(error),
        errorCode:
            mailError.code !== undefined ? String(mailError.code) : undefined,
        errorCommand:
            mailError.command !== undefined
                ? String(mailError.command)
                : undefined,
        errorResponse:
            mailError.response !== undefined
                ? String(mailError.response)
                : undefined,
        errorResponseCode:
            mailError.responseCode !== undefined
                ? String(mailError.responseCode)
                : undefined,
    };
}

function getResetPasswordUrlDiagnostics(resetLink: string) {
    try {
        const parsed = new URL(resetLink);
        return {
            resetLinkOrigin: parsed.origin,
            resetLinkPath: parsed.pathname,
            resetLinkHasToken: parsed.searchParams.has("token"),
        };
    } catch {
        return {
            resetLinkOrigin: "invalid",
            resetLinkPath: "invalid",
            resetLinkHasToken: false,
        };
    }
}

export { getWelcomeEmailDiagnostics, getResetPasswordUrlDiagnostics };

export type WelcomeEmailLogContext = {
    accountId?: number;
    userId?: string;
};

const WELCOME_EMAIL_LOG_SOURCE = "email.welcome";

export function logWelcomeEmailEvent(
    message: string,
    level: LogLevel,
    details: Record<string, unknown>,
    context?: WelcomeEmailLogContext
): void {
    const step =
        typeof details.step === "string" ? details.step : "unknown";
    const logPayload = {
        ...details,
        accountId: context?.accountId,
        userId: context?.userId,
    };

    if (level === LogLevel.ERROR || level === LogLevel.CRITICAL) {
        console.error(`[WelcomeEmail] ${message}:`, logPayload);
    } else {
        console.warn(`[WelcomeEmail] ${message}:`, logPayload);
    }

    void mongoLogService
        .logMessage({
            timestamp: new Date(),
            level,
            message: `[WelcomeEmail] ${message}`,
            source: WELCOME_EMAIL_LOG_SOURCE,
            sub_source: step,
            account_id: context?.accountId,
            details: logPayload,
        })
        .catch(() => {
            // Logging must not affect email delivery
        });
}

/**
 * Get user's language preference from database
 * @param {string} email - User's email address
 * @returns {Promise<string>} - Language code (en, he)
 */
export const getUserLanguage = async (email: string): Promise<string> => {
    try {
        const user = await prisma.user.findFirst({
            where: { email },
            select: { language: true },
        });

        if (user?.language) {
            // Convert enum to string and map to supported language codes
            const languageMap: { [key: string]: string } = {
                English: "en",
                Hebrew: "he",
            };
            return languageMap[user.language] || "en";
        }

        return "en"; // Default to English
    } catch (error) {
        // Error fetching user language
        return "en"; // Fallback to English
    }
};

type WelcomeProductFlags = {
    hasCollection: boolean;
    hasCreditInsurance: boolean;
};

type WelcomeContentVariables = {
    product_title: string;
    product_subtitle: string;
    welcome_intro: string;
    feature_1: string;
    feature_2: string;
    feature_3: string;
    feature_4: string;
    feature_5: string;
};

const getWelcomeProductFlags = async (
    receiver_email: string,
    hasCollection?: boolean,
    hasCreditInsurance?: boolean
): Promise<WelcomeProductFlags> => {
    if (
        typeof hasCollection === "boolean" &&
        typeof hasCreditInsurance === "boolean"
    ) {
        return { hasCollection, hasCreditInsurance };
    }

    const user = await prisma.user.findFirst({
        where: { email: receiver_email },
        select: {
            account_id: true,
        },
    });

    const account =
        user?.account_id !== null && user?.account_id !== undefined
            ? await prisma.account.findUnique({
                  where: { id: user.account_id },
                  select: {
                      has_collection: true,
                      has_credit_insurance: true,
                  },
              })
            : null;

    return {
        hasCollection:
            typeof hasCollection === "boolean"
                ? hasCollection
                : (account?.has_collection ?? true),
        hasCreditInsurance:
            typeof hasCreditInsurance === "boolean"
                ? hasCreditInsurance
                : (account?.has_credit_insurance ?? false),
    };
};

export const buildWelcomeContentVars = ({
    hasCollection,
    hasCreditInsurance,
    language,
}: {
    hasCollection: boolean;
    hasCreditInsurance: boolean;
    language: string;
}): WelcomeContentVariables => {
    const isHebrew = language === "he";
    const isDualProduct = hasCollection && hasCreditInsurance;
    const isCreditOnly = !hasCollection && hasCreditInsurance;

    if (isHebrew) {
        if (isDualProduct) {
            return {
                product_title: "ARchaser",
                product_subtitle: "פלטפורמת גבייה וביטוח אשראי שלך",
                welcome_intro:
                    'ברוכים הבאים ל-<span dir="ltr" style="display: inline;">ARchaser</span>! נשמח לעזור לך לנהל תהליכי גבייה לצד חשיפות, מגבלות והתראות כיסוי בביטוח אשראי. כדי להתחיל, יש להגדיר סיסמה באמצעות הכפתור למטה.',
                feature_1: "נהל חייבים ותהליכי גבייה ביעילות",
                feature_2: "נטר חשיפות, מגבלות אשראי ופערי קיבולת",
                feature_3: "עקוב אחר התראות כיסוי והפרות תנאים",
                feature_4: "הפק דוחות תפעוליים ואנליטיים מקיפים",
                feature_5: "שלב בקלות עם המערכות הקיימות שלך",
            };
        }

        if (isCreditOnly) {
            return {
                product_title: "ARchaser",
                product_subtitle: "פלטפורמת ניהול ביטוח האשראי שלך",
                welcome_intro:
                    'ברוכים הבאים ל-<span dir="ltr" style="display: inline;">ARchaser</span>! נשמח לעזור לך לנהל סיכוני אשראי, כיסוי ותובנות תיק במקום אחד. כדי להתחיל, יש להגדיר סיסמה באמצעות הכפתור למטה.',
                feature_1: "נטר חשיפות בסיכון וחשיפות תואמות בפורטפוליו",
                feature_2: "עקוב אחר מגבלות מאושרות, ניצול ופערי קיבולת",
                feature_3: "קבל התראות על מועדי דיווח והפרות תנאים",
                feature_4: "צפה במדדי בריאות תיק ותובנות ביטוח אשראי",
                feature_5: "שלב בקלות עם המערכות הקיימות שלך",
            };
        }

        return {
            product_title: "ARchaser",
            product_subtitle: "פלטפורמת ניהול גביית חובות שלך",
            welcome_intro:
                'ברוכים הבאים ל-<span dir="ltr" style="display: inline;">ARchaser</span>! אנחנו שמחים שתצטרף לקהילה שלנו של אנשי מקצוע בגביית חובות. כדי להתחיל, תצטרך להגדיר את הסיסמה שלך על ידי לחיצה על הכפתור למטה.',
            feature_1: "נהל חייבים ועקוב אחר גבייה ביעילות",
            feature_2: "אוטומט סדרות מעקב ותזכורות",
            feature_3: "צור דוחות מפורטים וניתוחים",
            feature_4: "טפל בערעורים והבטחות תשלום",
            feature_5: "שלב עם המערכות הקיימות שלך",
        };
    }

    if (isDualProduct) {
        return {
            product_title: "ARchaser",
            product_subtitle: "Your collections and credit insurance platform",
            welcome_intro:
                "Welcome to ARchaser! We are excited to help you manage debt collection workflows alongside credit insurance exposure, limits, and coverage alerts. To get started, set your password using the button below.",
            feature_1: "Manage customers and collection workflows efficiently",
            feature_2: "Monitor portfolio exposure, approved limits, and capacity gaps",
            feature_3: "Stay ahead of reporting deadlines and policy breaches",
            feature_4: "Generate operational and risk analytics in one place",
            feature_5: "Integrate with your existing systems",
        };
    }

    if (isCreditOnly) {
        return {
            product_title: "ARchaser",
            product_subtitle: "Your credit insurance management platform",
            welcome_intro:
                "Welcome to ARchaser! We are excited to help you monitor risk, coverage, and portfolio health in one place. To get started, set your password using the button below.",
            feature_1: "Monitor compliant and at-risk exposure across your portfolio",
            feature_2: "Track approved limits, utilization, and capacity gaps",
            feature_3: "Stay ahead of reporting deadlines and terms breaches",
            feature_4: "View credit dashboard insights and coverage alerts",
            feature_5: "Integrate with your existing systems",
        };
    }

    return {
        product_title: "ARchaser",
        product_subtitle: "Your debt collection management platform",
        welcome_intro:
            "Welcome to ARchaser! We're excited to have you join our community of debt collection professionals. To get started, you'll need to set your password by clicking the button below.",
        feature_1: "Manage customers and track collections efficiently",
        feature_2: "Automate follow-up sequences and reminders",
        feature_3: "Generate detailed reports and analytics",
        feature_4: "Handle disputes and payment promises",
        feature_5: "Integrate with your existing systems",
    };
};

export const sendEmailWithSenderName = (
    fromName: string,
    toEmail: string,
    subject: string,
    body: string,
    replyToEmail = "",
    messageId?: string,
    logContext?: WelcomeEmailLogContext
): Promise<{ messageId: string }> => {
    const emailTrackerId = uuidv4(); // Generate a new unique email tracker ID

    // Add environment prefix to subject
    const prefixedSubject = addEnvironmentPrefixToEmailSubject(subject);

    logWelcomeEmailEvent(
        "sendMail starting",
        LogLevel.INFO,
        {
            step: "sendMail_start",
            toEmail,
            subject: prefixedSubject,
            fromName,
            senderEmail: senderEmail || "unset",
            replyToSet: replyToEmail !== "",
            htmlBodyLength: body?.length ?? 0,
            trackerId: emailTrackerId,
            messageIdProvided: Boolean(messageId),
            ...getWelcomeEmailDiagnostics(),
        },
        logContext
    );

    const mailOptions: any = {
        from: `"${fromName}" <${senderEmail}>`,
        to: toEmail,
        subject: prefixedSubject,
        html: body,
    };

    // Initialize headers object
    mailOptions.headers = {};

    // Only add Return-Path header if BOUNCE_RECEIVER_EMAIL is set
    if (process.env.BOUNCE_RECEIVER_EMAIL) {
        mailOptions.headers["Return-Path"] = process.env.BOUNCE_RECEIVER_EMAIL;
    }

    // Add SES configuration set for tracking if available
    if (process.env.SES_CONFIGURATION_SET) {
        mailOptions.headers["X-SES-CONFIGURATION-SET"] =
            process.env.SES_CONFIGURATION_SET;
    }

    // Add message ID for tracking if provided
    if (messageId) {
        mailOptions.headers["X-Message-ID"] = messageId;
    }

    if (replyToEmail !== "") {
        mailOptions.replyTo = replyToEmail;
    }

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error: any, info: any) => {
            if (error) {
                logWelcomeEmailEvent(
                    "sendMail failed",
                    LogLevel.ERROR,
                    {
                        step: "sendMail_failed",
                        toEmail,
                        subject: prefixedSubject,
                        fromName,
                        senderEmail: senderEmail || "unset",
                        ...flattenNodemailerError(error),
                        ...getWelcomeEmailDiagnostics(),
                    },
                    logContext
                );
                reject(error);
            } else {
                const response = info.response;
                let resolvedMessageId = "";
                if (response.includes("Ok")) {
                    resolvedMessageId = response.split(" ")[2].trim(); // Extract messageId from the response
                }

                logWelcomeEmailEvent(
                    "sendMail succeeded",
                    LogLevel.INFO,
                    {
                        step: "sendMail_success",
                        toEmail,
                        subject: prefixedSubject,
                        messageId: resolvedMessageId || "unknown",
                        smtpResponse: response,
                        acceptedCount: Array.isArray(info?.accepted)
                            ? info.accepted.length
                            : undefined,
                        rejectedCount: Array.isArray(info?.rejected)
                            ? info.rejected.length
                            : undefined,
                        rejectedRecipients: Array.isArray(info?.rejected)
                            ? info.rejected.join(",")
                            : undefined,
                    },
                    logContext
                );

                resolve({
                    messageId: resolvedMessageId, // Extract messageId from the response
                }); // Return messageId + trackerId
            }
        });
    });
};

/**
 * Send reset password email with automatic language detection
 * @param {string} reset_link - Reset password link
 * @param {string} receiver_email - Recipient email
 * @param {string} language - Optional language code (en, he), if not provided will auto-detect from user table
 * @returns {Promise<{messageId: string}>} - Email message ID
 */
export const sentResetPasswordEmail = async (
    reset_link: string,
    receiver_email: string,
    language?: string
): Promise<{ messageId: string }> => {
    const user = await prisma.user.findFirst({
        where: { email: receiver_email },
        select: { language: true, username: true, first_name: true },
    });
    const languageMap: { [key: string]: string } = {
        English: "en",
        Hebrew: "he",
    };
    const userLanguage =
        language || (user?.language ? languageMap[user.language] || "en" : "en");
    const first_name =
        user?.first_name?.trim() ||
        (userLanguage === "he" ? "" : "there");
    const username =
        user?.username ||
        (userLanguage === "he" ? "" : "there");

    const subject = getEmailSubject(EMAIL_TYPES.FORGOT_PASSWORD, userLanguage);
    const template = getEmailTemplate(
        EMAIL_TYPES.FORGOT_PASSWORD,
        userLanguage,
        { reset_link, username, first_name }
    );

    return await sendEmailWithSenderName(
        "ARchaser",
        receiver_email,
        subject,
        template
    );
};

/**
 * Send welcome user email with automatic language detection
 * @param {string} receiver_email - Recipient email
 * @param {string} user_name - User's name
 * @param {string} reset_link - Password setup link
 * @param {string} language - Optional language code (en, he), if not provided will auto-detect from user table
 * @returns {Promise<{messageId: string}>} - Email message ID
 */
export const sentWelcomeUserEmail = async (
    receiver_email: string,
    user_name: string,
    reset_link: string,
    language?: string,
    hasCollection?: boolean,
    hasCreditInsurance?: boolean,
    logContext?: WelcomeEmailLogContext
): Promise<{ messageId: string }> => {
    logWelcomeEmailEvent(
        "sentWelcomeUserEmail starting",
        LogLevel.INFO,
        {
            step: "compose_start",
            receiver_email,
            user_namePresent: Boolean(user_name?.trim()),
            languageProvided: Boolean(language),
            hasCollectionArg: hasCollection,
            hasCreditInsuranceArg: hasCreditInsurance,
            ...getResetPasswordUrlDiagnostics(reset_link),
            ...getWelcomeEmailDiagnostics(),
        },
        logContext
    );

    // Auto-detect language if not provided
    const userLanguage = language || (await getUserLanguage(receiver_email));
    const productFlags = await getWelcomeProductFlags(
        receiver_email,
        hasCollection,
        hasCreditInsurance
    );
    const welcomeContentVariables = buildWelcomeContentVars({
        hasCollection: productFlags.hasCollection,
        hasCreditInsurance: productFlags.hasCreditInsurance,
        language: userLanguage,
    });

    const subject = getEmailSubject(EMAIL_TYPES.WELCOME_USER, userLanguage);
    const template = getEmailTemplate(EMAIL_TYPES.WELCOME_USER, userLanguage, {
        user_name,
        reset_link,
        ...welcomeContentVariables,
    });

    logWelcomeEmailEvent(
        "sentWelcomeUserEmail composed",
        LogLevel.INFO,
        {
            step: "compose_complete",
            receiver_email,
            userLanguage,
            hasCollection: productFlags.hasCollection,
            hasCreditInsurance: productFlags.hasCreditInsurance,
            subject,
            templateLength: template?.length ?? 0,
            welcomeIntroLength: welcomeContentVariables.welcome_intro?.length ?? 0,
        },
        logContext
    );

    return await sendEmailWithSenderName(
        "ARchaser",
        receiver_email,
        subject,
        template,
        "",
        undefined,
        logContext
    );
};

export class EmailService {
    fromName: string;
    fromEmail: string = process.env.EMAIL_FROM || "";
    replyToEmail: string;

    constructor() {
        this.fromName = "ARchaser";
        this.replyToEmail = "";
    }

    setSenderName(fromName: string) {
        this.fromName = fromName;
    }

    setReplyToEmail(replyToEmail: string) {
        this.replyToEmail = replyToEmail;
    }

    async setCustomerSenderNameAndReplyToEmail(account_id: number) {
        const account = await prisma.account.findUnique({
            where: {
                id: account_id,
            },
            select: {
                email_from_name: true,
                email_from: true,
            },
        });

        if (account) {
            this.fromName = account.email_from_name || "";
            // Use account email as reply-to, but keep system email as sender
            this.replyToEmail = account.email_from || "";
            // Don't change this.fromEmail - keep it as the verified AWS SES address
        } else {
            throw new Error("Account not found");
        }

        if (this.fromName === "") {
            throw new Error("Account sender name not found");
        }

        // Remove this check since we're not using customer email as sender anymore
        // if (this.replyToEmail === "") {
        //     throw new Error("Customer reply to email not found");
        // }
    }

    async sendEmail(
        toEmail: string,
        subject: string,
        body: string,
        messageId?: string
    ): Promise<{ messageId: string }> {
        // Add environment prefix to subject
        const prefixedSubject = addEnvironmentPrefixToEmailSubject(subject);

        const mailOptions: any = {
            from: `"${this.fromName}" <${this.fromEmail}>`, // Use system email (verified AWS SES)
            to: toEmail,
            subject: prefixedSubject,
            html: body,
            replyTo: this.replyToEmail, // Keep customer email as reply-to
        };

        // Add SES configuration set for tracking if available
        if (process.env.SES_CONFIGURATION_SET) {
            mailOptions.headers = {
                ...mailOptions.headers,
                "X-SES-CONFIGURATION-SET": process.env.SES_CONFIGURATION_SET,
            };
        }

        // Add message ID for tracking if provided
        if (messageId) {
            mailOptions.headers = {
                ...mailOptions.headers,
                "X-Message-ID": messageId,
            };
        }

        return new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (error: any, info: any) => {
                if (error) {
                    reject(error);
                } else {
                    const response = info.response;
                    let messageId = "";
                    if (response.includes("Ok")) {
                        messageId = response.split(" ")[2].trim(); // Extract messageId from the response
                    }

                    resolve({
                        messageId: messageId, // Extract messageId from the response
                    }); // Return messageId + trackerId
                }
            });
        });
    }

    /**
     * Send reset password email with automatic language detection
     * @param {string} reset_link - Reset password link
     * @param {string} receiver_email - Recipient email
     * @param {string} language - Optional language code (en, he), if not provided will auto-detect from user table
     * @returns {Promise<{messageId: string}>} - Email message ID
     */
    async sendResetPasswordEmail(
        reset_link: string,
        receiver_email: string,
        language?: string
    ) {
        const user = await prisma.user.findFirst({
            where: { email: receiver_email },
            select: { language: true, username: true, first_name: true },
        });
        const languageMap: { [key: string]: string } = {
            English: "en",
            Hebrew: "he",
        };
        const userLanguage =
            language ||
            (user?.language ? languageMap[user.language] || "en" : "en");
        const first_name =
            user?.first_name?.trim() ||
            (userLanguage === "he" ? "" : "there");
        const username =
            user?.username ||
            (userLanguage === "he" ? "" : "there");

        const subject = getEmailSubject(
            EMAIL_TYPES.FORGOT_PASSWORD,
            userLanguage
        );
        const template = getEmailTemplate(
            EMAIL_TYPES.FORGOT_PASSWORD,
            userLanguage,
            { reset_link, username, first_name }
        );
        return await this.sendEmail(receiver_email, subject, template);
    }

    /**
     * Send welcome user email with automatic language detection
     * @param {string} receiver_email - Recipient email
     * @param {string} user_name - User's name
     * @param {string} reset_link - Password setup link
     * @param {string} language - Optional language code (en, he), if not provided will auto-detect from user table
     * @returns {Promise<{messageId: string}>} - Email message ID
     */
    async sendWelcomeUserEmail(
        receiver_email: string,
        user_name: string,
        reset_link: string,
        language?: string,
        hasCollection?: boolean,
        hasCreditInsurance?: boolean
    ) {
        // Auto-detect language if not provided
        const userLanguage =
            language || (await getUserLanguage(receiver_email));
        const productFlags = await getWelcomeProductFlags(
            receiver_email,
            hasCollection,
            hasCreditInsurance
        );
        const welcomeContentVariables = buildWelcomeContentVars({
            hasCollection: productFlags.hasCollection,
            hasCreditInsurance: productFlags.hasCreditInsurance,
            language: userLanguage,
        });

        const subject = getEmailSubject(EMAIL_TYPES.WELCOME_USER, userLanguage);
        const template = getEmailTemplate(
            EMAIL_TYPES.WELCOME_USER,
            userLanguage,
            {
                user_name,
                reset_link,
                ...welcomeContentVariables,
            }
        );
        return await this.sendEmail(receiver_email, subject, template);
    }
}
