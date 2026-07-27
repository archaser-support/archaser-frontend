import { activity_type, delivery_status } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";

import { LogService } from "./LogService";

// Core interfaces for intelligent channel selection
export interface ChannelSelectionContext {
    customer_id: number;
    contact_id: number | null;
    activity_type: activity_type;
    available_channels: activity_type[];
    account_settings: {
        sms_fallback_enabled: boolean;
        unlisted_country_sms_policy: string;
        intelligent_channel_selection_enabled: boolean;
    };
    contact_validation: {
        email_valid: boolean;
        mobile_valid: boolean;
        email_bounce_count: number;
        sms_failure_count: number;
        communication_score: number;
    };
    sms_vendor_availability: {
        country_supported: boolean;
        vendor_configured: boolean;
        vendor_cost: number;
    };
    historical_data: CommunicationChannelPreference[];
    time_context: {
        current_hour: number;
        business_hours: boolean;
        timezone: string;
        day_of_week: number;
    };
    urgency_level: "low" | "medium" | "high";
    previous_attempts: number;
}

export interface ChannelSelectionResult {
    selected_channel: activity_type;
    confidence_score: number;
    selection_reason: string;
    alternative_channels: {
        channel: activity_type;
        score: number;
        reason: string;
    }[];
    learning_data: {
        used_historical_data: boolean;
        data_quality: "excellent" | "good" | "limited" | "insufficient";
        recommendations_count: number;
    };
}

export interface CommunicationOutcome {
    activity_id: number;
    channel: activity_type;
    success: boolean;
    response_time_hours?: number;
    engagement_level?: "none" | "low" | "medium" | "high";
    cost?: number;
    delivery_status: delivery_status;
    notes?: string;
}

export interface ChannelScore {
    channel: activity_type;
    score: number;
    breakdown: {
        historical: number;
        availability: number;
        cost: number;
        time: number;
        urgency: number;
    };
}

export interface SelectionWeights {
    historical: number;
    availability: number;
    cost: number;
    time: number;
    urgency: number;
}

export interface CommunicationChannelPreference {
    id: number;
    customer_id: number;
    channel: activity_type;
    success_rate: number;
    average_response_time_hours: number;
    total_attempts: number;
    last_used: Date;
    modified_at: Date;
}

export class CommunicationIntelligenceService {
    private logService: LogService;
    private defaultWeights: SelectionWeights = {
        historical: 0.4,
        availability: 0.25,
        cost: 0.15,
        time: 0.1,
        urgency: 0.1,
    };

    constructor() {
        this.logService = LogService.getInstance();
    }

    /**
     * Primary method for intelligent channel selection
     */
    public async selectOptimalChannel(
        context: ChannelSelectionContext
    ): Promise<ChannelSelectionResult> {
        try {
            await this.logService.logMessage(
                LogLevel.INFO,
                "Starting intelligent channel selection",
                "CommunicationIntelligenceService.selectOptimalChannel",
                { customer_id: context.customer_id, activity_type: context.activity_type }
            );

            // Step 1: Validate context and available channels
            const validatedChannels = await this.validateAvailableChannels(context);
            if (validatedChannels.length === 0) {
                throw new Error("No valid channels available for communication");
            }

            // Step 2: Calculate scores for each channel
            const channelScores = await Promise.all(
                validatedChannels.map((channel) =>
                    this.calculateChannelScore(channel, context)
                )
            );

            // Step 3: Apply business rules and constraints
            const filteredScores = this.applyBusinessRules(channelScores, context);

            // Step 4: Select optimal channel
            const selectedChannel = this.selectBestChannel(filteredScores);

            // Step 5: Generate selection reasoning
            const reasoning = this.generateSelectionReasoning(selectedChannel, context);

            const result: ChannelSelectionResult = {
                selected_channel: selectedChannel.channel,
                confidence_score: selectedChannel.score,
                selection_reason: reasoning.primary,
                alternative_channels: reasoning.alternatives,
                learning_data: {
                    used_historical_data: context.historical_data.length > 0,
                    data_quality: this.assessDataQuality(context),
                    recommendations_count: context.historical_data.length,
                },
            };

            await this.logService.logMessage(
                LogLevel.INFO,
                `Channel selected: ${result.selected_channel} (confidence: ${result.confidence_score})`,
                "CommunicationIntelligenceService.selectOptimalChannel",
                { result }
            );

            return result;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Intelligent channel selection failed: ${error.message}`,
                "CommunicationIntelligenceService.selectOptimalChannel",
                { context, error: error.message }
            );
            throw error;
        }
    }

    /**
     * Update learning data based on communication outcomes
     */
    public async updateLearningData(
        activityId: number,
        outcome: CommunicationOutcome
    ): Promise<void> {
        try {
            // Get activity details
            const activity = await prisma.activity.findUnique({
                where: { id: activityId },
                include: {
                    CustomerCollectionPeriod: {
                        include: { Customer: true },
                    },
                    ActivityContact: {
                        include: { Contact: true },
                    },
                },
            });

            if (!activity) {
                throw new Error(`Activity ${activityId} not found`);
            }

            const customerId = activity.CustomerCollectionPeriod?.Customer?.id;
            if (!customerId) {
                throw new Error(`Customer not found for activity ${activityId}`);
            }

            // Update or create channel preference
            await this.updateChannelPreference(customerId, outcome);

            // Add to learning data
            await this.addLearningDataPoint(customerId, outcome, activity);

            // Update contact communication score
            if (activity.ActivityContact?.[0]?.contact_id) {
                await this.updateContactCommunicationScore(
                    activity.ActivityContact[0].contact_id,
                    outcome
                );
            }

            // Trigger real-time analytics update
            await this.triggerAnalyticsUpdate(customerId);

            await this.logService.logMessage(
                LogLevel.INFO,
                `Learning data updated for activity ${activityId}`,
                "CommunicationIntelligenceService.updateLearningData",
                { activityId, outcome }
            );
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to update learning data for activity ${activityId}: ${error.message}`,
                "CommunicationIntelligenceService.updateLearningData",
                { activityId, outcome, error: error.message }
            );
            throw error;
        }
    }

    /**
     * Check if intelligent selection is enabled for a customer
     */
    public async isIntelligentSelectionEnabled(
        accountId: number
    ): Promise<boolean> {
        try {
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: { intelligent_channel_selection_enabled: true } as any,
            });

            return (account as any)?.intelligent_channel_selection_enabled ?? false;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to check intelligent selection status: ${error.message}`,
                "CommunicationIntelligenceService.isIntelligentSelectionEnabled",
                { accountId, error: error.message }
            );
            return false;
        }
    }

    /**
     * Build selection context from activity data
     */
    public async buildSelectionContext(activity: any): Promise<ChannelSelectionContext> {
        try {
            const customerId = activity.CustomerCollectionPeriod?.Customer?.id;
            const accountId = activity.CustomerCollectionPeriod?.Customer?.account_id;

            if (!customerId || !accountId) {
                throw new Error("Missing customer or customer information");
            }

            // Get account settings
            const account = await prisma.account.findUnique({
                where: { id: accountId },
                select: {
                    sms_fallback_enabled: true,
                    unlisted_country_sms_policy: true,
                    intelligent_channel_selection_enabled: true,
                } as any,
            });

            // Get contact validation data
            const contact = activity.ActivityContact?.[0]?.Contact;
            const contactValidation = {
                email_valid: contact?.email_status === "Valid",
                mobile_valid: contact?.mobile_status === "Valid",
                email_bounce_count: contact?.email_bounce_count || 0,
                sms_failure_count: contact?.sms_delivery_failure_count || 0,
                communication_score: Number(contact?.communication_score) || 1.0,
            };

            // Get SMS vendor availability
            const smsVendorAvailability = await this.checkSMSVendorAvailability(
                customerId,
                accountId
            );

            // Get historical data
            const historicalData = await this.getCustomerChannelPreferences(customerId);

            // Get time context
            const now = new Date();
            const timeContext = {
                current_hour: now.getHours(),
                business_hours: this.isBusinessHours(now),
                timezone: "UTC", // TODO: Get from customer/customer settings
                day_of_week: now.getDay(),
            };

            return {
                customer_id: customerId,
                contact_id: contact?.id || null,
                activity_type: activity.type,
                available_channels: this.getAvailableChannels(contactValidation),
                account_settings: {
                    sms_fallback_enabled: (account as any)?.sms_fallback_enabled ?? true,
                    unlisted_country_sms_policy: (account as any)?.unlisted_country_sms_policy ?? "block",
                    intelligent_channel_selection_enabled: (account as any)?.intelligent_channel_selection_enabled ?? false,
                },
                contact_validation: contactValidation,
                sms_vendor_availability: smsVendorAvailability,
                historical_data: historicalData,
                time_context: timeContext,
                urgency_level: this.determineUrgencyLevel(activity),
                previous_attempts: 0, // TODO: Calculate from activity history
            };
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to build selection context: ${error.message}`,
                "CommunicationIntelligenceService.buildSelectionContext",
                { activity, error: error.message }
            );
            throw error;
        }
    }

    // Private helper methods

    private async validateAvailableChannels(
        context: ChannelSelectionContext
    ): Promise<activity_type[]> {
        const availableChannels: activity_type[] = [];

        // Check email availability
        if (context.contact_validation.email_valid) {
            availableChannels.push("Email");
        }

        // Check SMS availability
        if (
            context.contact_validation.mobile_valid &&
            context.sms_vendor_availability.country_supported &&
            context.sms_vendor_availability.vendor_configured
        ) {
            availableChannels.push("SMS");
        }

        // Check call availability (always available if contact has phone)
        if (context.contact_validation.mobile_valid) {
            availableChannels.push("Call");
        }

        return availableChannels;
    }

    private async calculateChannelScore(
        channel: activity_type,
        context: ChannelSelectionContext
    ): Promise<ChannelScore> {
        const weights = await this.getSelectionWeights(context.customer_id);

        // Historical success rate (40% weight)
        const historicalScore = this.calculateHistoricalScore(channel, context);

        // Contact availability and validation (25% weight)
        const availabilityScore = this.calculateAvailabilityScore(channel, context);

        // Cost effectiveness (15% weight)
        const costScore = this.calculateCostScore(channel, context);

        // Time-based factors (10% weight)
        const timeScore = this.calculateTimeScore(channel, context);

        // Urgency considerations (10% weight)
        const urgencyScore = this.calculateUrgencyScore(channel, context);

        // Calculate weighted total
        const totalScore =
            historicalScore * weights.historical +
            availabilityScore * weights.availability +
            costScore * weights.cost +
            timeScore * weights.time +
            urgencyScore * weights.urgency;

        return {
            channel,
            score: Math.min(1.0, Math.max(0.0, totalScore)),
            breakdown: {
                historical: historicalScore,
                availability: availabilityScore,
                cost: costScore,
                time: timeScore,
                urgency: urgencyScore,
            },
        };
    }

    private calculateHistoricalScore(
        channel: activity_type,
        context: ChannelSelectionContext
    ): number {
        // Get historical data for this customer and channel
        const historicalData = context.historical_data.filter(
            (data) => data.channel === channel
        );

        if (historicalData.length === 0) {
            // No historical data - use global averages
            return this.getGlobalChannelAverage(channel);
        }

        // Calculate weighted success rate
        const recentData = historicalData.filter((data) =>
            this.isRecentData(data.modified_at, 90) // Last 90 days
        );

        const successRate =
            recentData.length > 0
                ? recentData.reduce((sum, data) => sum + data.success_rate, 0) /
                recentData.length
                : historicalData.reduce((sum, data) => sum + data.success_rate, 0) /
                historicalData.length;

        // Apply recency weighting
        const recencyWeight = this.calculateRecencyWeight(
            recentData.length,
            historicalData.length
        );

        return successRate * recencyWeight;
    }

    private calculateAvailabilityScore(
        channel: activity_type,
        context: ChannelSelectionContext
    ): number {
        let score = 0;

        switch (channel) {
            case "Email":
                score = context.contact_validation.email_valid ? 1.0 : 0.0;
                // Reduce score based on bounce count
                if (context.contact_validation.email_bounce_count > 0) {
                    score *= Math.max(0.1, 1.0 - context.contact_validation.email_bounce_count * 0.1);
                }
                break;

            case "SMS":
                score = context.contact_validation.mobile_valid ? 1.0 : 0.0;
                // Reduce score based on SMS failure count
                if (context.contact_validation.sms_failure_count > 0) {
                    score *= Math.max(0.1, 1.0 - context.contact_validation.sms_failure_count * 0.1);
                }
                // Check SMS vendor availability
                if (!context.sms_vendor_availability.vendor_configured) {
                    score *= 0.5;
                }
                break;

            case "Call":
                score = context.contact_validation.mobile_valid ? 1.0 : 0.0;
                break;

            default:
                score = 0.5; // Default score for unknown channels
        }

        return score;
    }

    private calculateCostScore(
        channel: activity_type,
        context: ChannelSelectionContext
    ): number {
        switch (channel) {
            case "Email":
                return 1.0; // Email is typically free
            case "SMS":
                // Lower score for higher cost SMS
                const smsCost = context.sms_vendor_availability.vendor_cost;
                return smsCost > 0 ? Math.max(0.1, 1.0 - smsCost / 0.1) : 0.5;
            case "Call":
                return 0.7; // Calls have moderate cost
            default:
                return 0.5;
        }
    }

    private calculateTimeScore(
        channel: activity_type,
        context: ChannelSelectionContext
    ): number {
        const { current_hour, business_hours, day_of_week } = context.time_context;

        // Base score
        let score = 0.5;

        // Business hours boost
        if (business_hours) {
            score += 0.3;
        }

        // Channel-specific time preferences
        switch (channel) {
            case "Email":
                // Email works well at any time
                score += 0.2;
                break;
            case "SMS":
                // SMS works well during business hours and early evening
                if (current_hour >= 9 && current_hour <= 20) {
                    score += 0.3;
                }
                break;
            case "Call":
                // Calls work best during business hours
                if (current_hour >= 9 && current_hour <= 17) {
                    score += 0.4;
                }
                break;
        }

        return Math.min(1.0, score);
    }

    private calculateUrgencyScore(
        channel: activity_type,
        context: ChannelSelectionContext
    ): number {
        const { urgency_level } = context;

        switch (urgency_level) {
            case "high":
                // For high urgency, prefer faster channels
                switch (channel) {
                    case "SMS":
                        return 1.0;
                    case "Call":
                        return 0.9;
                    case "Email":
                        return 0.6;
                    default:
                        return 0.5;
                }
            case "medium":
                // Balanced approach
                switch (channel) {
                    case "Email":
                        return 0.8;
                    case "SMS":
                        return 0.7;
                    case "Call":
                        return 0.6;
                    default:
                        return 0.5;
                }
            case "low":
                // For low urgency, prefer cost-effective channels
                switch (channel) {
                    case "Email":
                        return 1.0;
                    case "SMS":
                        return 0.6;
                    case "Call":
                        return 0.4;
                    default:
                        return 0.5;
                }
            default:
                return 0.5;
        }
    }

    private applyBusinessRules(
        scores: ChannelScore[],
        context: ChannelSelectionContext
    ): ChannelScore[] {
        return scores.filter((score) => {
            // Apply minimum score threshold
            if (score.score < 0.1) {
                return false;
            }

            // Apply channel-specific business rules
            switch (score.channel) {
                case "SMS":
                    // SMS requires valid mobile and vendor configuration
                    return (
                        context.contact_validation.mobile_valid &&
                        context.sms_vendor_availability.vendor_configured
                    );
                case "Email":
                    // Email requires valid email address
                    return context.contact_validation.email_valid;
                case "Call":
                    // Call requires valid mobile number
                    return context.contact_validation.mobile_valid;
                default:
                    return true;
            }
        });
    }

    private selectBestChannel(scores: ChannelScore[]): ChannelScore {
        if (scores.length === 0) {
            throw new Error("No valid channels available after applying business rules");
        }

        // Sort by score (highest first)
        scores.sort((a, b) => b.score - a.score);

        return scores[0];
    }

    private generateSelectionReasoning(
        selectedChannel: ChannelScore,
        context: ChannelSelectionContext
    ): {
        primary: string;
        alternatives: { channel: activity_type; score: number; reason: string }[];
    } {
        const { breakdown } = selectedChannel;
        const reasons: string[] = [];

        // Generate primary reason
        if (breakdown.historical > 0.7) {
            reasons.push("strong historical success rate");
        }
        if (breakdown.availability > 0.8) {
            reasons.push("excellent contact availability");
        }
        if (breakdown.cost > 0.8) {
            reasons.push("cost-effective option");
        }
        if (breakdown.time > 0.7) {
            reasons.push("optimal timing");
        }
        if (breakdown.urgency > 0.7) {
            reasons.push("matches urgency level");
        }

        const primaryReason = reasons.length > 0
            ? `Selected ${selectedChannel.channel} based on ${reasons.join(", ")}`
            : `Selected ${selectedChannel.channel} as best available option`;

        // Generate alternative reasons
        const alternatives = context.available_channels
            .filter((channel) => channel !== selectedChannel.channel)
            .map((channel) => ({
                channel,
                score: 0.5, // TODO: Calculate actual alternative scores
                reason: `Alternative ${channel} option`,
            }));

        return {
            primary: primaryReason,
            alternatives,
        };
    }

    private assessDataQuality(context: ChannelSelectionContext): "excellent" | "good" | "limited" | "insufficient" {
        const dataCount = context.historical_data.length;

        if (dataCount >= 20) return "excellent";
        if (dataCount >= 10) return "good";
        if (dataCount >= 5) return "limited";
        return "insufficient";
    }

    // Additional helper methods (simplified implementations for now)

    private async getSelectionWeights(customerId: number): Promise<SelectionWeights> {
        // TODO: Implement customer-specific weight configuration
        return this.defaultWeights;
    }

    private getGlobalChannelAverage(channel: activity_type): number {
        // TODO: Implement global channel averages from database
        const defaults = {
            Email: 0.6,
            SMS: 0.7,
            Call: 0.8,
            WhatsApp: 0.75,
            Internal: 0.9,
            Resolved: 1.0,
            Dispute: 0.3,
            Promise_to_pay: 0.8,
            Agent: 0.85,
        };
        return defaults[channel] || 0.5;
    }

    private isRecentData(date: Date, days: number): boolean {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= days;
    }

    private calculateRecencyWeight(recentCount: number, totalCount: number): number {
        if (totalCount === 0) return 0.5;
        return 0.5 + (recentCount / totalCount) * 0.5;
    }

    private async checkSMSVendorAvailability(
        customerId: number,
        accountId: number
    ): Promise<{ country_supported: boolean; vendor_configured: boolean; vendor_cost: number }> {
        // TODO: Implement SMS vendor availability check
        return {
            country_supported: true,
            vendor_configured: true,
            vendor_cost: 0.05,
        };
    }

    private async getCustomerChannelPreferences(customerId: number): Promise<CommunicationChannelPreference[]> {
        // TODO: Implement database query for channel preferences
        return [];
    }

    private getAvailableChannels(contactValidation: any): activity_type[] {
        const channels: activity_type[] = [];
        if (contactValidation.email_valid) channels.push("Email");
        if (contactValidation.mobile_valid) {
            channels.push("SMS");
            channels.push("Call");
        }
        return channels;
    }

    private isBusinessHours(date: Date): boolean {
        const hour = date.getHours();
        const day = date.getDay();
        return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
    }

    private determineUrgencyLevel(activity: any): "low" | "medium" | "high" {
        // TODO: Implement urgency level determination based on activity data
        return "medium";
    }

    private async updateChannelPreference(customerId: number, outcome: CommunicationOutcome): Promise<void> {
        // TODO: Implement channel preference updates
    }

    private async addLearningDataPoint(customerId: number, outcome: CommunicationOutcome, activity: any): Promise<void> {
        // TODO: Implement learning data point addition
    }

    private async updateContactCommunicationScore(contactId: number, outcome: CommunicationOutcome): Promise<void> {
        // TODO: Implement contact communication score updates
    }

    private async triggerAnalyticsUpdate(customerId: number): Promise<void> {
        // TODO: Implement analytics update triggering
    }
}
