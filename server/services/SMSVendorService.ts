import messagebird from "messagebird";
import twilio from "twilio";


import { activity_type } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";

import { CommunicationLearningService } from "./CommunicationLearningService";
import { LogService } from "./LogService";


export interface SMSVendorConfig {
    id: number;
    name: string;
    provider: string;
    api_key?: string;
    api_secret?: string;
    account_sid?: string;
    auth_token?: string;
    webhook_url?: string;
    phone_number?: string; // Country-mapped sender (e.g., Twilio number)
    cost_per_sms?: number;
    currency: string;
    is_country_specific?: boolean;
    use_account_sender_name?: boolean;
}

export interface SMSSendResult {
    success: boolean;
    messageId?: string;
    vendorMessageId?: string; // Vendor's actual internal message ID
    cost?: number;
    segments?: number;
    error?: string;
    vendorId: number;
}

/**
 * Twilio client factory type
 * Used for dependency injection in tests
 */
export type TwilioClientFactory = (
    accountSid: string,
    authToken: string
) => {
    messages: {
        create: (params: any) => Promise<{ sid: string }>;
    };
};

export interface SMSVendorServiceOptions {
    dryRunSms?: boolean;
}

export class SMSVendorService {
    private logService = LogService.getInstance();
    private clientCache = new Map<string, any>(); // Cache for vendor clients
    private connectionPool = new Map<string, any>(); // Connection pool for vendors;
    private learningService = new CommunicationLearningService();
    private twilioClientFactory: TwilioClientFactory;
    private dryRunSms: boolean;

    /**
     * Constructor with optional Twilio client factory and options (e.g. dry run for testing)
     * @param twilioClientFactory Optional factory function to create Twilio clients (for testing)
     * @param options Optional options; dryRunSms=true skips actual send and returns fake success
     */
    constructor(
        twilioClientFactory?: TwilioClientFactory,
        options?: SMSVendorServiceOptions
    ) {
        // Use provided factory or default to normal import
        this.twilioClientFactory =
            twilioClientFactory ||
            ((accountSid: string, authToken: string) => {
                return twilio(accountSid, authToken);
            });
        this.dryRunSms = options?.dryRunSms ?? false;
    }

    /**
     * Get the appropriate SMS vendor for a country with country-specific costs
     */
    async getVendorForCountry(
        countryId: number
    ): Promise<SMSVendorConfig | null> {
        try {
            const countryVendor = await prisma.countrySMSVendor.findFirst({
                where: {
                    country_id: countryId,
                    is_active: true,
                    SMSVendor: {
                        is_active: true,
                    },
                },
                include: {
                    SMSVendor: true,
                },
                orderBy: [
                    { is_default: "desc" },
                    { SMSVendor: { priority: "asc" } },
                ],
            });

            if (countryVendor) {
                return this.mapVendorToConfigWithCountryCosts(countryVendor);
            }

            // Fallback to default vendor
            const defaultVendor = await prisma.sMSVendor.findFirst({
                where: {
                    is_active: true,
                    priority: 1,
                },
                orderBy: { priority: "asc" },
            });

            return defaultVendor ? this.mapVendorToConfig(defaultVendor) : null;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to get SMS vendor for country ${countryId}: ${error?.message || error}`,
                "SMSVendorService"
            );
            return null;
        }
    }

    /**
     * Check if SMS is blocked for a country (no active vendor mapping)
     * SMS is blocked if there's no country-specific mapping, regardless of default vendor
     */
    async isSMSBlockedForCountry(countryId: number): Promise<boolean> {
        try {
            const countryVendor = await prisma.countrySMSVendor.findFirst({
                where: {
                    country_id: countryId,
                    is_active: true,
                    SMSVendor: {
                        is_active: true,
                    },
                },
                include: {
                    SMSVendor: true,
                },
            });

            // SMS is blocked if there's no country-specific vendor mapping
            return !countryVendor;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to check SMS blocking for country ${countryId}: ${error?.message || error}`,
                "SMSVendorService"
            );
            return true; // Assume blocked on error
        }
    }

    /**
     * Check if SMS is blocked for a specific customer in a specific country
     * Business rule: Mapping is per Account (Customer). If there is NO mapping
     * in CustomerSMSProviderPreferences for (accountId, countryId) with an
     * active provider, SMS is BLOCKED.
     */
    async isSMSBlockedForCustomerCountry(
        accountId: number,
        countryId: number
    ): Promise<boolean> {
        try {
            const customerCountryMapping =
                await prisma.accountSMSProviderPreferences.findFirst({
                    where: {
                        account_id: accountId,
                        country_id: countryId,
                        is_enabled: true,
                        SMSVendor: {
                            is_active: true,
                        },
                    },
                    include: {
                        SMSVendor: true,
                        Country: true,
                    },
                });

            // SMS is blocked if no account-specific country mapping exists
            return !customerCountryMapping;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to check customer-country SMS blocking for customer ${accountId}, country ${countryId}: ${error?.message || error}`,
                "SMSVendorService"
            );
            return true; // Fail-safe: block on error
        }
    }

    /**
     * Get all vendors for a country with costs
     */
    async getVendorsForCountry(countryId: number): Promise<SMSVendorConfig[]> {
        try {
            const countryVendors = await prisma.countrySMSVendor.findMany({
                where: {
                    country_id: countryId,
                    is_active: true,
                    SMSVendor: {
                        is_active: true,
                    },
                },
                include: {
                    SMSVendor: true,
                },
                orderBy: [
                    { is_default: "desc" },
                    { SMSVendor: { priority: "asc" } },
                ],
            });

            return countryVendors.map((cv) =>
                this.mapVendorToConfigWithCountryCosts(cv)
            );
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to get SMS vendors for country ${countryId}: ${error?.message || error}`,
                "SMSVendorService"
            );
            return [];
        }
    }

    /**
     * Update country-specific cost for a vendor
     */
    async updateCountryCost(
        countryId: number,
        vendorId: number,
        costPerSms: number,
        currency: string = "USD"
    ): Promise<boolean> {
        try {
            const result = await prisma.countrySMSVendor.updateMany({
                where: {
                    country_id: countryId,
                    vendor_id: vendorId,
                },
                data: {
                    cost_per_sms: costPerSms,
                    currency: currency,
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Updated SMS cost for country ${countryId}, vendor ${vendorId}: ${costPerSms} ${currency}`,
                "SMSVendorService"
            );

            return result.count > 0;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to update SMS cost for country ${countryId}, vendor ${vendorId}: ${error?.message || error}`,
                "SMSVendorService"
            );
            return false;
        }
    }

    /**
     * Reset country cost to vendor default
     */
    async resetCountryCost(
        countryId: number,
        vendorId: number
    ): Promise<boolean> {
        try {
            const result = await prisma.countrySMSVendor.updateMany({
                where: {
                    country_id: countryId,
                    vendor_id: vendorId,
                },
                data: {
                    cost_per_sms: null,
                    currency: null,
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Reset SMS cost to default for country ${countryId}, vendor ${vendorId}`,
                "SMSVendorService"
            );

            return result.count > 0;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to reset SMS cost for country ${countryId}, vendor ${vendorId}: ${error?.message || error}`,
                "SMSVendorService"
            );
            return false;
        }
    }

    /**
     * Detect country ID from mobile number
     */
    async detectCountryFromMobileNumber(
        mobileNumber: string
    ): Promise<number | null> {
        try {
            // Remove any non-digit characters except +
            const cleanNumber = mobileNumber.replace(/[^\d+]/g, "");

            // Check for US/Canada numbers (+1)
            if (cleanNumber.startsWith("+1") || cleanNumber.startsWith("1")) {
                const usCountry = await prisma.country.findFirst({
                    where: { iso2: "US" },
                    select: { id: true },
                });
                return usCountry?.id || null;
            }

            // Check for Israel numbers (+972)
            if (
                cleanNumber.startsWith("+972") ||
                cleanNumber.startsWith("972")
            ) {
                const israelCountry = await prisma.country.findFirst({
                    where: { iso2: "IL" },
                    select: { id: true },
                });
                return israelCountry?.id || null;
            }

            // Add more country codes as needed
            // UK (+44), Germany (+49), France (+33), etc.

            // If no specific country detected, return null
            return null;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to detect country from mobile number ${mobileNumber}: ${error?.message || error}`,
                "SMSVendorService"
            );
            return null;
        }
    }

    /**
     * Send SMS using the appropriate vendor
     * Now uses mobile number country instead of customer country
     */
    async sendSMS(
        to: string,
        from: string,
        body: string,
        countryId: number, // Keep for backward compatibility, but will be overridden by mobile number detection
        activityId: number,
        accountId?: number
    ): Promise<SMSSendResult> {
        try {
            // Detect country from mobile number instead of using customer country
            const mobileCountryId =
                await this.detectCountryFromMobileNumber(to);
            const effectiveCountryId = mobileCountryId || countryId; // Fallback to customer country if mobile detection fails

            // Log the country detection
            await this.logService.logMessage(
                LogLevel.INFO,
                `SMS country detection: Mobile=${mobileCountryId}, Customer=${countryId}, Using=${effectiveCountryId}`,
                "SMSVendorService",
                {
                    activityId,
                    mobileNumber: to,
                    mobileCountryId,
                    customerCountryId: countryId,
                    effectiveCountryId,
                }
            );

            // Check account-specific country mapping before attempting to send
            if (accountId) {
                const isBlocked = await this.isSMSBlockedForCustomerCountry(
                    accountId,
                    effectiveCountryId
                );
                if (isBlocked) {
                    const errorMsg = `SMS blocked: No country mapping configured for this account (Customer ID: ${accountId}, Country ID: ${effectiveCountryId})`;
                    await this.logService.logMessage(
                        LogLevel.WARNING,
                        errorMsg,
                        "SMSVendorService",
                        {
                            activityId,
                            accountId,
                            countryId: effectiveCountryId,
                            to,
                        }
                    );

                    // Record failed SMS outcome due to missing mapping
                    await this.recordSMSOutcome(activityId, {
                        success: false,
                        error: errorMsg,
                        vendorId: 0,
                    });

                    return {
                        success: false,
                        error: errorMsg,
                        vendorId: 0,
                    };
                }
            }

            const vendor = await this.getVendorForCountry(effectiveCountryId);

            if (!vendor) {
                throw new Error(
                    `No SMS vendor available for country ${effectiveCountryId} (detected from mobile: ${mobileCountryId || "none"}, customer: ${countryId})`
                );
            }

            // Determine sender name based on vendor settings
            let senderName = "archaser"; // Default sender name
            if (
                vendor.provider?.toLowerCase() === "twilio" &&
                vendor.phone_number
            ) {
                // For Twilio, prefer a valid phone number from mapping
                senderName = vendor.phone_number;
            } else if (vendor.use_account_sender_name && from) {
                // For other providers, optionally use account sender name
                senderName = from;
            }

            if (this.dryRunSms) {
                const dryRunResult: SMSSendResult = {
                    success: true,
                    messageId: `dryrun_${uuidv4()}`,
                    vendorId: vendor.id,
                    cost: vendor.cost_per_sms || 0,
                    segments: Math.ceil(body.length / 160),
                };
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `SMS dry run (no actual send) - would have sent via ${vendor.name} (${vendor.provider})`,
                    "SMSVendorService",
                    {
                        activityId,
                        vendorId: vendor.id,
                        to,
                        from,
                        effectiveCountryId,
                    }
                );
                await this.recordSMSOutcome(activityId, dryRunResult);
                return dryRunResult;
            }

            const result = await this.sendViaVendor(
                vendor,
                to,
                senderName,
                body
            );

            // Log the SMS attempt
            await this.logService.logMessage(
                LogLevel.INFO,
                `SMS sent via ${vendor.name} (${vendor.provider}) for country ${effectiveCountryId}`,
                "SMSVendorService",
                {
                    activityId,
                    vendorId: vendor.id,
                    to,
                    from,
                    success: result.success,
                    messageId: result.messageId,
                    cost: result.cost,
                    mobileCountryId,
                    customerCountryId: countryId,
                    effectiveCountryId,
                }
            );

            // Record learning data for SMS outcome
            await this.recordSMSOutcome(activityId, result);

            return result;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to send SMS: ${error?.message || error}`,
                "SMSVendorService",
                { activityId, to, from }
            );

            // Record failed SMS outcome
            await this.recordSMSOutcome(activityId, {
                success: false,
                error: error?.message || String(error),
                vendorId: 0,
            });

            return {
                success: false,
                error: error?.message || String(error),
                vendorId: 0,
            };
        }
    }

    /**
     * Send multiple SMS messages in batch using a single connection
     * This is much more efficient than sending individual SMS messages
     * Validates account-specific country mappings before sending
     */
    async sendBatchSMS(
        messages: Array<{
            to: string;
            from: string;
            body: string;
            countryId: number;
            activityId: number;
            accountId?: number;
        }>
    ): Promise<SMSSendResult[]> {
        const results: SMSSendResult[] = [];

        if (messages.length === 0) {
            return results;
        }

        if (this.dryRunSms) {
            return this.sendBatchSMSDryRun(messages);
        }

        // Group messages by vendor/country for efficient batch processing
        const messagesByVendor = new Map<
            string,
            Array<{
                to: string;
                from: string;
                body: string;
                countryId: number;
                activityId: number;
                accountId?: number;
                vendor: SMSVendorConfig;
            }>
        >();

        for (const message of messages) {
            try {
                // Check if SMS is blocked for this account-country combination
                if (message.accountId) {
                    const isBlocked = await this.isSMSBlockedForCustomerCountry(
                        message.accountId,
                        message.countryId
                    );

                    if (isBlocked) {
                        // Add blocked result
                        const errorMsg = `SMS blocked: No country mapping for account (Customer: ${message.accountId}, Country: ${message.countryId})`;
                        results.push({
                            success: false,
                            error: errorMsg,
                            vendorId: 0,
                        });

                        await this.logService.logMessage(
                            LogLevel.WARNING,
                            errorMsg,
                            "SMSVendorService",
                            {
                                activityId: message.activityId,
                                accountId: message.accountId,
                                countryId: message.countryId,
                            }
                        );
                        continue; // Skip this message
                    }
                }

                const vendor = await this.getVendorForCountry(
                    message.countryId
                );
                if (!vendor) {
                    results.push({
                        success: false,
                        error: "No SMS vendor available for this country",
                        vendorId: 0,
                    });
                    continue;
                }

                const vendorKey = `${vendor.provider}_${vendor.id}`;
                if (!messagesByVendor.has(vendorKey)) {
                    messagesByVendor.set(vendorKey, []);
                }
                messagesByVendor
                    .get(vendorKey)!
                    .push({ ...message, vendor: vendor });
            } catch (error: any) {
                results.push({
                    success: false,
                    error: error?.message || String(error),
                    vendorId: 0,
                });
            }
        }

        // Process each vendor batch
        for (const [vendorKey, vendorMessages] of Array.from(
            messagesByVendor.entries()
        )) {
            const vendor = vendorMessages[0].vendor;
            const vendorResults = await this.sendBatchViaVendor(
                vendor,
                vendorMessages
            );
            results.push(...vendorResults);
        }

        return results;
    }

    /**
     * Dry-run batch: same validations as sendBatchSMS, no actual send; returns one result per message in order.
     */
    private async sendBatchSMSDryRun(
        messages: Array<{
            to: string;
            from: string;
            body: string;
            countryId: number;
            activityId: number;
            accountId?: number;
        }>
    ): Promise<SMSSendResult[]> {
        const results: SMSSendResult[] = [];
        for (const message of messages) {
            try {
                if (message.accountId) {
                    const isBlocked = await this.isSMSBlockedForCustomerCountry(
                        message.accountId,
                        message.countryId
                    );
                    if (isBlocked) {
                        const errorMsg = `SMS blocked: No country mapping for account (Customer: ${message.accountId}, Country: ${message.countryId})`;
                        results.push({
                            success: false,
                            error: errorMsg,
                            vendorId: 0,
                        });
                        continue;
                    }
                }
                const vendor = await this.getVendorForCountry(
                    message.countryId
                );
                if (!vendor) {
                    results.push({
                        success: false,
                        error: "No SMS vendor available for this country",
                        vendorId: 0,
                    });
                    continue;
                }
                results.push({
                    success: true,
                    messageId: `dryrun_${uuidv4()}`,
                    vendorId: vendor.id,
                    cost: vendor.cost_per_sms || 0,
                    segments: Math.ceil(message.body.length / 160),
                });
            } catch (error: any) {
                results.push({
                    success: false,
                    error: error?.message || String(error),
                    vendorId: 0,
                });
            }
        }
        await this.logService.logMessage(
            LogLevel.INFO,
            `SMS batch dry run (no actual send) - ${results.filter((r) => r.success).length}/${messages.length} would have been sent`,
            "SMSVendorService",
            {
                totalMessages: messages.length,
                successCount: results.filter((r) => r.success).length,
            }
        );
        return results;
    }

    /**
     * Send batch of SMS messages via specific vendor using optimized connection
     */
    private async sendBatchViaVendor(
        vendor: SMSVendorConfig,
        messages: Array<{
            to: string;
            from: string;
            body: string;
            activityId: number;
            vendor: SMSVendorConfig;
        }>
    ): Promise<SMSSendResult[]> {
        const results: SMSSendResult[] = [];

        try {
            switch (vendor.provider.toLowerCase()) {
                case "twilio":
                    results.push(
                        ...(await this.sendBatchViaTwilio(vendor, messages))
                    );
                    break;
                case "messagebird":
                    results.push(
                        ...(await this.sendBatchViaMessageBird(
                            vendor,
                            messages
                        ))
                    );
                    break;
                case "inforu":
                    results.push(
                        ...(await this.sendBatchViaInforu(vendor, messages))
                    );
                    break;
                default:
                    // Fallback to individual sends
                    for (const message of messages) {
                        const result = await this.sendViaVendor(
                            vendor,
                            message.to,
                            message.from,
                            message.body
                        );
                        results.push(result);
                    }
            }
        } catch (error: any) {
            // If batch fails, fallback to individual sends
            await this.logService.logMessage(
                LogLevel.WARNING,
                `Batch SMS failed, falling back to individual sends: ${error?.message}`,
                "SMSVendorService",
                { vendorId: vendor.id, messageCount: messages.length }
            );

            for (const message of messages) {
                try {
                    const result = await this.sendViaVendor(
                        vendor,
                        message.to,
                        message.from,
                        message.body
                    );
                    results.push(result);
                } catch (individualError: any) {
                    results.push({
                        success: false,
                        error:
                            individualError?.message || String(individualError),
                        vendorId: vendor.id,
                    });
                }
            }
        }

        return results;
    }

    /**
     * Send SMS via specific vendor
     */
    public async sendViaVendor(
        vendor: SMSVendorConfig,
        to: string,
        from: string,
        body: string
    ): Promise<SMSSendResult> {
        switch (vendor.provider.toLowerCase()) {
            case "twilio":
                // Ensure Twilio uses a valid phone number if provided via mapping
                return this.sendViaTwilio(
                    vendor,
                    to,
                    vendor.phone_number || from,
                    body
                );
            case "messagebird":
                return this.sendViaMessageBird(vendor, to, from, body);
            case "inforu":
                return this.sendViaInforu(vendor, to, from, body);
            default:
                throw new Error(`Unsupported SMS provider: ${vendor.provider}`);
        }
    }

    private async sendViaTwilio(
        vendor: SMSVendorConfig,
        to: string,
        from: string,
        body: string
    ): Promise<SMSSendResult> {
        if (!vendor.account_sid || !vendor.auth_token) {
            throw new Error(
                `Twilio vendor ${vendor.id} is missing account_sid or auth_token`
            );
        }
        const client = this.twilioClientFactory(
            vendor.account_sid,
            vendor.auth_token
        );

        try {
            const messageParams: any = {
                body,
                from,
                to,
            };

            // Add status callback if webhook_url is configured
            if (vendor.webhook_url) {
                messageParams.statusCallback = vendor.webhook_url;
            }

            const message = await client.messages.create(messageParams);

            return {
                success: true,
                messageId: message.sid,
                cost: vendor.cost_per_sms || 0,
                segments: Math.ceil(body.length / 160), // Approximate segments
                vendorId: vendor.id,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error?.message || String(error),
                vendorId: vendor.id,
            };
        }
    }

    /**
     * Send batch SMS via Twilio using optimized connection
     */
    private async sendBatchViaTwilio(
        vendor: SMSVendorConfig,
        messages: Array<{
            to: string;
            from: string;
            body: string;
            activityId: number;
            vendor: SMSVendorConfig;
        }>
    ): Promise<SMSSendResult[]> {
        const results: SMSSendResult[] = [];

        // Reuse client connection using injected factory
        if (!vendor.account_sid || !vendor.auth_token) {
            throw new Error(
                `Twilio vendor ${vendor.id} is missing account_sid or auth_token`
            );
        }
        const client = this.twilioClientFactory(
            vendor.account_sid,
            vendor.auth_token
        );

        // Process messages in parallel using the same client
        const promises = messages.map(async (message) => {
            try {
                const twilioMessage = await client.messages.create({
                    body: message.body,
                    from: vendor.phone_number || message.from,
                    to: message.to,
                });

                return {
                    success: true,
                    messageId: twilioMessage.sid,
                    cost: vendor.cost_per_sms || 0,
                    segments: Math.ceil(message.body.length / 160),
                    vendorId: vendor.id,
                };
            } catch (error: any) {
                return {
                    success: false,
                    error: error?.message || String(error),
                    vendorId: vendor.id,
                };
            }
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);

        await this.logService.logMessage(
            LogLevel.INFO,
            `Twilio batch SMS completed - Messages: ${messages.length}, Successful: ${batchResults.filter((r) => r.success).length}`,
            "SMSVendorService",
            {
                vendorId: vendor.id,
                messageCount: messages.length,
                successfulCount: batchResults.filter((r) => r.success).length,
            }
        );

        return results;
    }

    private async sendViaMessageBird(
        vendor: SMSVendorConfig,
        to: string,
        from: string,
        body: string
    ): Promise<SMSSendResult> {
        const client = (messagebird as any)(vendor.api_key);

        try {
            const message = await client.messages.create({
                originator: from,
                recipients: [to],
                body,
            });

            return {
                success: true,
                messageId: message.id,
                cost: vendor.cost_per_sms || 0,
                segments: message.mtCount || 1,
                vendorId: vendor.id,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error?.message || String(error),
                vendorId: vendor.id,
            };
        }
    }

    private async sendViaInforu(
        vendor: SMSVendorConfig,
        to: string,
        from: string,
        body: string
    ): Promise<SMSSendResult> {
        try {
            const customerMessageID = uuidv4();

            // Inforu API v2 uses JSON format
            const jsonData = {
                Data: {
                    Message: body,
                    Recipients: [
                        {
                            Phone: to,
                        },
                    ],
                    Settings: {
                        Sender: from, // Use the provided sender name (customer's sms_from_name if available)
                        DeliveryNotificationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/sms/webhook/inforu`,
                        CustomerMessageID: customerMessageID,
                    },
                },
            };

            // Use the correct credentials for Inforu
            const correctApiSecret = "588934a4-10af-4e95-ae40-9a900c07d64f";
            const credentials = `${vendor.api_key}:${correctApiSecret}`;
            const encoded = Buffer.from(credentials, "utf8").toString("base64");

            const response = await fetch(
                "https://capi.inforu.co.il/api/v2/SMS/SendSms",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Basic ${encoded}`,
                    },
                    body: JSON.stringify(jsonData),
                }
            );

            const responseData = await response.json();

            // Check if the response is successful
            if (responseData.StatusId === 1) {
                // Extract vendor's actual message ID from response
                // Inforu returns MessageID or MessageId in their response
                const vendorMessageId =
                    responseData.MessageID ||
                    responseData.MessageId ||
                    responseData.Id;

                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Inforu SMS sent successfully - Customer ID: ${customerMessageID}, Vendor ID: ${vendorMessageId}`,
                    "SMSVendorService",
                    {
                        vendorId: vendor.id,
                        customerMessageId: customerMessageID,
                        vendorMessageId: vendorMessageId,
                        cost: vendor.cost_per_sms || 0,
                    }
                );

                return {
                    success: true,
                    messageId: customerMessageID,
                    vendorMessageId: vendorMessageId,
                    cost: vendor.cost_per_sms || 0,
                    segments: Math.ceil(body.length / 160),
                    vendorId: vendor.id,
                };
            } else {
                const errorMessage =
                    responseData.StatusDescription ||
                    responseData.DetailedDescription ||
                    "Unknown error from Inforu";

                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Inforu SMS failed - ${errorMessage}`,
                    "SMSVendorService",
                    {
                        vendorId: vendor.id,
                        statusId: responseData.StatusId,
                        statusDescription: responseData.StatusDescription,
                        detailedDescription: responseData.DetailedDescription,
                        fullResponse: responseData,
                    }
                );

                throw new Error(errorMessage);
            }
        } catch (error: any) {
            return {
                success: false,
                error: error?.message || String(error),
                vendorId: vendor.id,
            };
        }
    }

    /**
     * Send batch SMS via Inforu using optimized single connection
     * Note: Inforu batch API can only send one message body to all recipients
     * If messages have different content, we need to send them individually or group by content
     */
    private async sendBatchViaInforu(
        vendor: SMSVendorConfig,
        messages: Array<{
            to: string;
            from: string;
            body: string;
            activityId: number;
            vendor: SMSVendorConfig;
        }>
    ): Promise<SMSSendResult[]> {
        const results: SMSSendResult[] = [];

        try {
            // Group messages by content - Inforu can only send one message body per batch
            const messagesByContent = new Map<string, typeof messages>();
            for (const message of messages) {
                const key = `${message.body}|${message.from}`;
                if (!messagesByContent.has(key)) {
                    messagesByContent.set(key, []);
                }
                messagesByContent.get(key)!.push(message);
            }

            // Send each content group as a separate batch
            for (const [contentKey, contentMessages] of Array.from(
                messagesByContent.entries()
            )) {
                try {
                    // Prepare batch data for Inforu API
                    const recipients = contentMessages.map((msg) => ({
                        Phone: msg.to,
                    }));
                    const batchMessageID = uuidv4();

                    // Use the message body (all messages in this group have the same content)
                    const body = contentMessages[0].body;

                    // Use the sender name (all messages in this group have the same sender)
                    const senderName = contentMessages[0].from || "ARchaser";

                    const jsonData = {
                        Data: {
                            Message: body,
                            Recipients: recipients,
                            Settings: {
                                Sender: senderName,
                                DeliveryNotificationUrl: `https://portal.archaser.com/api/sms/webhook?provider=${vendor.provider}`,
                                CustomerMessageID: batchMessageID,
                            },
                        },
                    };

                    // Use cached credentials
                    const correctApiSecret =
                        "588934a4-10af-4e95-ae40-9a900c07d64f";
                    const credentials = `${vendor.api_key}:${correctApiSecret}`;
                    const encoded = Buffer.from(credentials, "utf8").toString(
                        "base64"
                    );

                    // Single API call for all messages with same content
                    const response = await fetch(
                        "https://capi.inforu.co.il/api/v2/SMS/SendSms",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Basic ${encoded}`,
                            },
                            body: JSON.stringify(jsonData),
                        }
                    );

                    const responseData = await response.json();

                    if (responseData.StatusId === 1) {
                        // Extract vendor's actual message ID from batch response
                        const vendorMessageId =
                            responseData.MessageID ||
                            responseData.MessageId ||
                            responseData.Id;

                        // All messages in this group sent successfully
                        for (const message of contentMessages) {
                            const messageId = `${batchMessageID}_${message.activityId}`;
                            results.push({
                                success: true,
                                messageId: messageId,
                                vendorMessageId: vendorMessageId, // Same vendor ID for all messages in batch
                                cost: vendor.cost_per_sms || 0,
                                segments: Math.ceil(message.body.length / 160),
                                vendorId: vendor.id,
                            });
                        }

                        await this.logService.logMessage(
                            LogLevel.INFO,
                            `Inforu batch SMS sent successfully - Batch ID: ${batchMessageID}, Vendor ID: ${vendorMessageId}, Messages: ${contentMessages.length}`,
                            "SMSVendorService",
                            {
                                vendorId: vendor.id,
                                batchId: batchMessageID,
                                vendorMessageId: vendorMessageId,
                                messageCount: contentMessages.length,
                                cost:
                                    (vendor.cost_per_sms || 0) *
                                    contentMessages.length,
                            }
                        );
                    } else {
                        // Batch failed, create individual error results
                        const errorMessage =
                            responseData.StatusDescription ||
                            responseData.DetailedDescription ||
                            "Unknown error from Inforu";

                        for (const message of contentMessages) {
                            results.push({
                                success: false,
                                error: errorMessage,
                                vendorId: vendor.id,
                            });
                        }

                        await this.logService.logMessage(
                            LogLevel.ERROR,
                            `Inforu batch SMS failed - ${errorMessage}`,
                            "SMSVendorService",
                            {
                                vendorId: vendor.id,
                                batchId: batchMessageID,
                                messageCount: contentMessages.length,
                                statusId: responseData.StatusId,
                                statusDescription:
                                    responseData.StatusDescription,
                            }
                        );
                    }
                } catch (groupError: any) {
                    // If this group fails, create error results for all messages in the group
                    await this.logService.logMessage(
                        LogLevel.ERROR,
                        `Inforu batch group failed - ${groupError?.message}`,
                        "SMSVendorService",
                        {
                            vendorId: vendor.id,
                            messageCount: contentMessages.length,
                            error: groupError?.message,
                        }
                    );

                    for (const message of contentMessages) {
                        results.push({
                            success: false,
                            error: groupError?.message || String(groupError),
                            vendorId: vendor.id,
                        });
                    }
                }
            }

            // Log summary of content-grouped batches
            if (messagesByContent.size > 1) {
                await this.logService.logMessage(
                    LogLevel.INFO,
                    `Inforu batch SMS grouped by content - ${messagesByContent.size} different messages sent to ${messages.length} recipients`,
                    "SMSVendorService",
                    {
                        vendorId: vendor.id,
                        totalRecipients: messages.length,
                        uniqueMessages: messagesByContent.size,
                    }
                );
            }
        } catch (error: any) {
            // If the entire batch process fails, create individual error results
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Inforu batch SMS process failed - ${error?.message}`,
                "SMSVendorService",
                {
                    vendorId: vendor.id,
                    messageCount: messages.length,
                    error: error?.message,
                }
            );

            for (const message of messages) {
                results.push({
                    success: false,
                    error: error?.message || String(error),
                    vendorId: vendor.id,
                });
            }
        }

        return results;
    }

    /**
     * Send batch SMS via MessageBird using optimized connection
     */
    private async sendBatchViaMessageBird(
        vendor: SMSVendorConfig,
        messages: Array<{
            to: string;
            from: string;
            body: string;
            activityId: number;
            vendor: SMSVendorConfig;
        }>
    ): Promise<SMSSendResult[]> {
        const results: SMSSendResult[] = [];
        const client = (messagebird as any)(vendor.api_key);

        // Process messages in parallel using the same client
        const promises = messages.map(async (message) => {
            try {
                const birdMessage = await client.messages.create({
                    originator: message.from,
                    recipients: [message.to],
                    body: message.body,
                });

                return {
                    success: true,
                    messageId: birdMessage.id,
                    cost: vendor.cost_per_sms || 0,
                    segments: birdMessage.mtCount || 1,
                    vendorId: vendor.id,
                };
            } catch (error: any) {
                return {
                    success: false,
                    error: error?.message || String(error),
                    vendorId: vendor.id,
                };
            }
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);

        await this.logService.logMessage(
            LogLevel.INFO,
            `MessageBird batch SMS completed - Messages: ${messages.length}, Successful: ${batchResults.filter((r) => r.success).length}`,
            "SMSVendorService",
            {
                vendorId: vendor.id,
                messageCount: messages.length,
                successfulCount: batchResults.filter((r) => r.success).length,
            }
        );

        return results;
    }

    private mapVendorToConfig(vendor: any): SMSVendorConfig {
        return {
            id: vendor.id,
            name: vendor.name,
            provider: vendor.provider,
            api_key: vendor.api_key,
            api_secret: vendor.api_secret,
            account_sid: vendor.account_sid,
            auth_token: vendor.auth_token,
            webhook_url: vendor.webhook_url,
            cost_per_sms: vendor.cost_per_sms,
            currency: vendor.currency,
            is_country_specific: false,
            use_account_sender_name: vendor.use_account_sender_name || false,
        };
    }

    /**
     * Map vendor with country-specific costs
     */
    private mapVendorToConfigWithCountryCosts(
        countryVendor: any
    ): SMSVendorConfig {
        const vendor = countryVendor.SMSVendor;
        const isCountrySpecific = countryVendor.cost_per_sms !== null;

        return {
            id: vendor.id,
            name: vendor.name,
            provider: vendor.provider,
            api_key: vendor.api_key,
            api_secret: vendor.api_secret,
            account_sid: vendor.account_sid,
            auth_token: vendor.auth_token,
            webhook_url: vendor.webhook_url,
            phone_number: countryVendor.phone_number || undefined,
            // Use country-specific cost if available, otherwise fall back to vendor default
            cost_per_sms: isCountrySpecific
                ? countryVendor.cost_per_sms
                : vendor.cost_per_sms,
            currency: isCountrySpecific
                ? countryVendor.currency
                : vendor.currency,
            is_country_specific: isCountrySpecific,
            use_account_sender_name: vendor.use_account_sender_name || false,
        };
    }

    /**
     * Record SMS outcome for learning data
     */
    private async recordSMSOutcome(
        activityId: number,
        result: SMSSendResult
    ): Promise<void> {
        try {
            // Get activity details for learning data
            const activity = await prisma.activity.findUnique({
                where: { id: BigInt(activityId) },
                select: {
                    id: true,
                    customer_id: true,
                    schedule_time: true,
                    type: true,
                },
            });

            if (!activity) {
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `Activity ${activityId} not found for SMS learning data`,
                    "SMSVendorService"
                );
                return;
            }

            // Record the communication outcome
            await this.learningService.recordCommunicationOutcome({
                customerId: activity.customer_id,
                channel: activity.type as activity_type,
                activityId: activity.id,
                sentAt: activity.schedule_time,
                success: result.success,
                contextData: {
                    smsResult: result,
                    vendorId: result.vendorId,
                    messageId: result.messageId,
                    cost: result.cost,
                    segments: result.segments,
                    error: result.error,
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Recorded SMS outcome for activity ${activityId}, success: ${result.success}`,
                "SMSVendorService"
            );
        } catch (error: any) {
            // Log learning error but don't fail the main process
            await this.logService.logMessage(
                LogLevel.WARNING,
                `Failed to record SMS learning data: ${error.message}`,
                "SMSVendorService"
            );
        }
    }
}
