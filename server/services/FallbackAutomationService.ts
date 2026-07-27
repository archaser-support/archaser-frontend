import {
    PrismaClient,
    activity_type,
    delivery_status,
    contact_priority,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { LogLevel, ActivityStatus } from "@/types/enums";

import { EmailService } from "../EmailService";

import { CommunicationIntelligenceService } from "./CommunicationIntelligenceService";
import { LogService } from "./LogService";
import { SMSVendorService } from "./SMSVendorService";

import { type ExtendedPrismaClient } from "@/lib/prisma";


export interface FallbackContact {
    id: number;
    priority_level: contact_priority;
    email?: string | null;
    mobile?: string | null;
    first_name: string;
    escalation_delay_hours?: number | null;
    preferred_channels: string[];
    customer_id: number;
}

export interface FallbackResult {
    success: boolean;
    contactId: number;
    channel: activity_type;
    messageId?: string;
    error?: string;
    isFallback: boolean;
    escalationLevel: number;
    selectionMetadata?: {
        selected_channel: activity_type;
        confidence_score: number;
        selection_reason: string;
        alternative_channels: any[];
    };
}

export class FallbackAutomationService {
    private logService: LogService;
    private emailService: EmailService;
    private smsVendorService: SMSVendorService;
    private intelligenceService: CommunicationIntelligenceService;

    constructor() {
        this.logService = LogService.getInstance();
        this.emailService = new EmailService();
        this.smsVendorService = new SMSVendorService();
        this.intelligenceService = new CommunicationIntelligenceService();
    }

    /**
     * Attempts to send communication through multiple channels and contacts
     */
    public async attemptMultiChannelDelivery(
        activityId: number,
        customerId: number,
        accountId: number,
        content: string,
        title: string,
        smsContent?: string
    ): Promise<FallbackResult[]> {
        try {
            // Check if intelligent selection is enabled
            const isIntelligentEnabled = await this.intelligenceService.isIntelligentSelectionEnabled(accountId);

            if (isIntelligentEnabled) {
                return await this.attemptIntelligentDelivery(
                    activityId,
                    customerId,
                    accountId,
                    content,
                    title,
                    smsContent
                );
            } else {
                return await this.attemptStandardDelivery(
                    activityId,
                    customerId,
                    accountId,
                    content,
                    title,
                    smsContent
                );
            }
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Fallback automation failed: ${error.message}`,
                "FallbackAutomationService",
                { activityId, customerId, accountId }
            );
            throw error;
        }
    }

    /**
     * Intelligent delivery using CommunicationIntelligenceService
     */
    private async attemptIntelligentDelivery(
        activityId: number,
        customerId: number,
        accountId: number,
        content: string,
        title: string,
        smsContent?: string
    ): Promise<FallbackResult[]> {
        try {
            // Get activity details for context building
            const activity = await prisma.activity.findUnique({
                where: { id: activityId },
                include: {
                    CustomerCollectionPeriod: {
                        include: { Customer: true },
                    },
                    ActivityContact: {
                        include: { Contact: true },
                    },
                    Account: true,
                },
            });

            if (!activity) {
                throw new Error(`Activity ${activityId} not found`);
            }

            // Build selection context
            const context = await this.intelligenceService.buildSelectionContext(activity);

            // Get intelligent channel selection
            const selection = await this.intelligenceService.selectOptimalChannel(context);

            // Get contacts ordered by intelligent selection
            const contacts = await this.getContactsByPriority(customerId);
            const intelligentOrder = await this.optimizeContactOrder(contacts, context);

            const results: FallbackResult[] = [];
            let anySuccess = false;

            // Try contacts in intelligent order
            for (const contact of intelligentOrder) {
                const contactResult = await this.attemptIntelligentContactDelivery(
                    activityId,
                    contact,
                    content,
                    title,
                    smsContent,
                    accountId,
                    selection
                );

                results.push(contactResult);

                if (contactResult.success) {
                    anySuccess = true;
                    // Update learning data
                    await this.intelligenceService.updateLearningData(activityId, {
                        activity_id: activityId,
                        channel: contactResult.channel,
                        success: true,
                        delivery_status: "Delivered" as delivery_status,
                        cost: contactResult.channel === "SMS" ? 0.05 : 0, // TODO: Get actual cost
                    });
                    break;
                }
            }

            // Update activity status based on results
            await this.updateActivityStatus(activityId, anySuccess, results);

            return results;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Intelligent delivery failed: ${error.message}`,
                "FallbackAutomationService",
                { activityId, customerId, accountId }
            );
            // Fallback to standard delivery
            return await this.attemptStandardDelivery(activityId, customerId, accountId, content, title, smsContent);
        }
    }

    /**
     * Standard delivery using existing logic
     */
    private async attemptStandardDelivery(
        activityId: number,
        customerId: number,
        accountId: number,
        content: string,
        title: string,
        smsContent?: string
    ): Promise<FallbackResult[]> {
        // Get all contacts for the customer, ordered by priority
        const contacts = await this.getContactsByPriority(customerId);

        if (contacts.length === 0) {
            throw new Error("No contacts found for customer");
        }

        const results: FallbackResult[] = [];
        let anySuccess = false;

        // Try each contact in priority order
        for (const contact of contacts) {
            const contactResult = await this.attemptContactDelivery(
                activityId,
                contact,
                content,
                title,
                smsContent,
                accountId
            );

            results.push(contactResult);

            if (contactResult.success) {
                anySuccess = true;
                // If we got a successful delivery, we can stop trying other contacts
                // unless this was a fallback attempt
                if (!contactResult.isFallback) {
                    break;
                }
            }
        }

        // Update activity status based on results
        await this.updateActivityStatus(activityId, anySuccess, results);

        return results;
    }

    /**
     * Attempts delivery to a single contact through multiple channels
     */
    private async attemptContactDelivery(
        activityId: number,
        contact: FallbackContact,
        content: string,
        title: string,
        smsContent?: string,
        accountId?: number
    ): Promise<FallbackResult> {
        const channels = this.getPreferredChannels(contact);
        let lastError: string | undefined;

        for (const channel of channels) {
            try {
                const result = await this.sendViaChannel(
                    activityId,
                    contact,
                    channel,
                    content,
                    title,
                    smsContent,
                    accountId
                );

                if (result.success) {
                    return result;
                } else {
                    lastError = result.error;
                }
            } catch (error: any) {
                lastError = error.message;
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `Channel ${channel} failed for contact ${contact.id}: ${error.message}`,
                    "FallbackAutomationService",
                    { activityId, contactId: contact.id, channel }
                );
            }
        }

        // If we get here, all channels failed for this contact
        return {
            success: false,
            contactId: contact.id,
            channel: activity_type.Email, // Default channel
            error: lastError,
            isFallback: contact.priority_level !== contact_priority.Primary,
            escalationLevel: this.getEscalationLevel(contact.priority_level),
        };
    }

    /**
     * Sends communication via a specific channel
     */
    private async sendViaChannel(
        activityId: number,
        contact: FallbackContact,
        channel: activity_type,
        content: string,
        title: string,
        smsContent?: string,
        accountId?: number
    ): Promise<FallbackResult> {
        let messageId: string | undefined;

        switch (channel) {
            case activity_type.Email:
                if (!contact.email) {
                    throw new Error("No email address available");
                }

                if (accountId) {
                    await this.emailService.setCustomerSenderNameAndReplyToEmail(
                        accountId
                    );
                }

                const emailResponse = await this.emailService.sendEmail(
                    contact.email,
                    title,
                    await this.replaceContactContent(content, contact)
                );

                messageId = emailResponse?.messageId;
                break;

            case activity_type.SMS:
                if (!contact.mobile) {
                    throw new Error("No mobile number available");
                }

                const customer = await prisma.customer.findUnique({
                    where: { id: activityId },
                    select: { country_id: true },
                });

                if (!customer?.country_id) {
                    throw new Error("Customer country not found");
                }

                // Get customer's SMS from name if accountId is provided
                let senderName = "ARchaser"; // Default fallback
                if (accountId) {
                    const account = await prisma.account.findUnique({
                        where: { id: accountId },
                        select: { sms_from_name: true } as any,
                    });
                    if ((account as any)?.sms_from_name) {
                        senderName = (account as any).sms_from_name;
                    }
                }

                const smsResponse = await this.smsVendorService.sendSMS(
                    contact.mobile,
                    senderName,
                    smsContent ||
                    (await this.replaceContactContent(content, contact)),
                    customer.country_id,
                    activityId,
                    accountId
                );

                if (!smsResponse.success) {
                    throw new Error(smsResponse.error || "SMS sending failed");
                }

                messageId = smsResponse.messageId;
                break;

            default:
                throw new Error(`Unsupported channel: ${channel}`);
        }

        // Create ActivityContact record
        const activityContact = await prisma.activityContact.create({
            data: {
                activity_id: BigInt(activityId),
                contact_id: contact.id,
                message_id: messageId,
                status: delivery_status.Sent,
                sent_at: new Date(),
                communication_channel: channel,
                is_fallback_attempt:
                    contact.priority_level !== contact_priority.Primary,
                escalation_level: this.getEscalationLevel(
                    contact.priority_level
                ),
            },
        });

        await this.logService.logMessage(
            LogLevel.INFO,
            `Successfully sent ${channel} to contact ${contact.id}`,
            "FallbackAutomationService",
            { activityId, contactId: contact.id, channel, messageId }
        );

        return {
            success: true,
            contactId: contact.id,
            channel,
            messageId,
            isFallback: contact.priority_level !== contact_priority.Primary,
            escalationLevel: this.getEscalationLevel(contact.priority_level),
        };
    }

    /**
     * Gets contacts ordered by priority level
     */
    private async getContactsByPriority(
        customerId: number
    ): Promise<FallbackContact[]> {
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                Company: {
                    include: {
                        Contact: {
                            orderBy: [{ priority_level: "asc" }, { id: "asc" }],
                        },
                    },
                },
                Person: true,
            },
        });

        if (!customer) {
            throw new Error("Customer not found");
        }

        const contacts: FallbackContact[] = [];

        // Add company contacts if customer is a company
        if (customer.type === "Company" && customer.Company) {
            contacts.push(
                ...customer.Company.Contact.map((contact) => ({
                    id: contact.id,
                    priority_level:
                        contact.priority_level || contact_priority.Primary,
                    email: contact.email,
                    mobile: contact.mobile,
                    first_name: contact.first_name,
                    escalation_delay_hours: contact.escalation_delay_hours,
                    preferred_channels: contact.preferred_channels,
                    customer_id: customer.id,
                }))
            );
        }

        // Add person contact if customer is a person
        if (customer.type === "Person" && customer.Person) {
            contacts.push({
                id: -1, // Special ID for person customer
                priority_level: contact_priority.Primary,
                email: customer.email,
                mobile: customer.Person.mobile,
                first_name: customer.Person.first_name || "Unknown",
                escalation_delay_hours: 24,
                preferred_channels: ["Email", "SMS"],
                customer_id: customer.id,
            });
        }

        return contacts;
    }

    /**
     * Gets preferred channels for a contact
     */
    private getPreferredChannels(contact: FallbackContact): activity_type[] {
        const channels: activity_type[] = [];

        // Use contact's preferred channels if available
        if (contact.preferred_channels.length > 0) {
            for (const channel of contact.preferred_channels) {
                switch (channel) {
                    case "Email":
                        if (contact.email) channels.push(activity_type.Email);
                        break;
                    case "SMS":
                        if (contact.mobile) channels.push(activity_type.SMS);
                        break;
                    case "WhatsApp":
                        if (contact.mobile)
                            channels.push(activity_type.WhatsApp);
                        break;
                }
            }
        } else {
            // Default channel order
            if (contact.email) channels.push(activity_type.Email);
            if (contact.mobile) channels.push(activity_type.SMS);
        }

        return channels;
    }

    /**
     * Replaces contact-specific content in the message
     */
    private async replaceContactContent(
        content: string,
        contact: FallbackContact
    ): Promise<string> {
        let processedContent = content
            .replace(/\{first_name\}/g, contact.first_name || "")
            .replace(/\{contact_name\}/g, contact.first_name || "")
            .replace(/\{debor_name\}/g, contact.first_name || ""); // Handle typo in template

        // Process dateOnly templates if they exist in the content
        if (processedContent.includes("{{dateOnly:")) {
            try {
                const locale = await this.getCustomerLocale(contact.customer_id);
                if (locale) {
                    // Import ActivityService to use its translateActivityContent method
                    const { ActivityService } = require("./ActivityService");
                    const activityService = new ActivityService();

                    // Process the dateOnly templates
                    processedContent = activityService.translateActivityContent(
                        processedContent,
                        undefined,
                        locale
                    );
                }
            } catch (err: unknown) {
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `Failed to process dateOnly templates: ${err instanceof Error ? err.message : "Unknown error"}`,
                    "FallbackAutomationService",
                    { contactId: contact.id, customerId: contact.customer_id }
                );
            }
        }

        return processedContent;
    }

    /**
     * Gets customer's locale for date formatting
     */
    private async getCustomerLocale(customerId: number): Promise<string | null> {
        try {
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                select: { language: true, Country: { select: { iso2: true } } },
            });

            if (!customer) return null;

            // Convert language to locale
            if (customer.language === "Hebrew") {
                return "he-IL";
            } else if (customer.language === "English") {
                return "en-US";
            }

            // Fallback based on country
            if (customer.Country?.iso2 === "IL") {
                return "he-IL";
            }

            return "en-US"; // Default fallback
        } catch (err: unknown) {
            this.logService.logMessage(
                LogLevel.WARNING,
                `Failed to get customer locale: ${err instanceof Error ? err.message : "Unknown error"}`,
                "FallbackAutomationService",
                { customerId }
            );
            return null;
        }
    }

    /**
     * Gets escalation level from priority
     */
    private getEscalationLevel(priority: contact_priority): number {
        switch (priority) {
            case contact_priority.Primary:
                return 1;
            case contact_priority.Secondary:
                return 2;
            case contact_priority.Emergency:
                return 3;
            default:
                return 1;
        }
    }

    /**
     * Updates activity status based on delivery results
     */
    private async updateActivityStatus(
        activityId: number,
        anySuccess: boolean,
        results: FallbackResult[]
    ): Promise<void> {
        const status = anySuccess ? ActivityStatus.DELIVERED : ActivityStatus.FAILED;
        const deliveryTime = anySuccess ? new Date() : null;

        await prisma.activity.update({
            where: { id: BigInt(activityId) },
            data: {
                status: status,
                actual_delivery_time: deliveryTime,
            },
        });

        // Update response tracking for successful deliveries
        for (const result of results) {
            if (result.success) {
                await this.updateContactResponseHistory(result);
            }
        }
    }

    /**
     * Updates contact response history for optimization
     */
    private async updateContactResponseHistory(
        result: FallbackResult
    ): Promise<void> {
        const contact = await prisma.contact.findUnique({
            where: { id: result.contactId },
            select: { response_history: true },
        });

        if (!contact) return;

        const history = (contact.response_history as any) || {};
        const channel = result.channel.toLowerCase();

        if (!history[channel]) {
            history[channel] = {
                success_count: 0,
                total_attempts: 0,
                last_success: null,
                average_response_time: null,
            };
        }

        history[channel].success_count++;
        history[channel].total_attempts++;
        history[channel].last_success = new Date().toISOString();

        await prisma.contact.update({
            where: { id: result.contactId },
            data: {
                response_history: history,
            },
        });
    }

    /**
     * Handles response from any contact and stops escalation
     */
    public async handleContactResponse(
        activityId: number,
        contactId: number,
        channel: activity_type
    ): Promise<void> {
        try {
            // Mark the activity contact as responded
            await prisma.activityContact.updateMany({
                where: {
                    activity_id: BigInt(activityId),
                    contact_id: contactId,
                    communication_channel: channel,
                },
                data: {
                    response_received_at: new Date(),
                    response_channel: channel,
                },
            });

            // Update activity status to indicate response received
            await prisma.activity.update({
                where: { id: BigInt(activityId) },
                data: {
                    status: ActivityStatus.DELIVERED,
                    actual_delivery_time: new Date(),
                },
            });

            // Cancel any pending fallback attempts for this activity
            await prisma.activityContact.updateMany({
                where: {
                    activity_id: BigInt(activityId),
                    status: delivery_status.Scheduled,
                },
                data: {
                    status: delivery_status.Cancelled,
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Contact ${contactId} responded via ${channel}`,
                "FallbackAutomationService",
                { activityId, contactId, channel }
            );
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to handle contact response: ${error.message}`,
                "FallbackAutomationService",
                { activityId, contactId, channel }
            );
            throw error;
        }
    }

    /**
     * Optimize contact order based on intelligent selection
     */
    private async optimizeContactOrder(
        contacts: FallbackContact[],
        context: any
    ): Promise<FallbackContact[]> {
        // For now, return contacts in original priority order
        // TODO: Implement intelligent contact ordering based on historical success rates
        return contacts;
    }

    /**
     * Attempt intelligent contact delivery using selected channel
     */
    private async attemptIntelligentContactDelivery(
        activityId: number,
        contact: FallbackContact,
        content: string,
        title: string,
        smsContent?: string,
        accountId?: number,
        selection?: any
    ): Promise<FallbackResult> {
        try {
            // Use the selected channel from intelligent selection
            const selectedChannel = selection?.selected_channel || this.getPreferredChannels(contact)[0];

            const result = await this.sendViaChannel(
                activityId,
                contact,
                selectedChannel,
                content,
                title,
                smsContent,
                accountId
            );

            // Add selection metadata to result
            if (selection) {
                result.selectionMetadata = {
                    selected_channel: selection.selected_channel,
                    confidence_score: selection.confidence_score,
                    selection_reason: selection.selection_reason,
                    alternative_channels: selection.alternative_channels,
                };
            }

            return result;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Intelligent contact delivery failed: ${error.message}`,
                "FallbackAutomationService",
                { activityId, contactId: contact.id, error: error.message }
            );

            return {
                success: false,
                contactId: contact.id,
                channel: "Email" as activity_type,
                error: error.message,
                isFallback: false,
                escalationLevel: this.getEscalationLevel(contact.priority_level),
            };
        }
    }
}
