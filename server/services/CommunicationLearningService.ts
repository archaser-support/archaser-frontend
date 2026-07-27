import { activity_type, Prisma } from "@prisma/client";
import { DateTime } from "luxon";

import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";

import { LogService } from "./LogService";

export interface CommunicationOutcome {
    customerId: number;
    contactId?: number;
    channel: activity_type;
    activityId?: bigint;
    sentAt: Date;
    responseReceivedAt?: Date;
    responseChannel?: activity_type;
    success: boolean;
    responseTimeHours?: number;
    contextData?: any;
}

export interface ChannelPerformanceMetrics {
    channel: activity_type;
    successRate: number;
    averageResponseTimeHours: number;
    totalAttempts: number;
    totalSuccesses: number;
    lastSuccessfulContact?: Date | null;
    preferredTimeOfDay?: string | null;
}

export class CommunicationLearningService {
    private logService = LogService.getInstance();

    /**
     * Record a communication outcome for learning
     */
    async recordCommunicationOutcome(outcome: CommunicationOutcome): Promise<void> {
        try {
            // Calculate response time if response was received
            let responseTimeHours: number | undefined;
            if (outcome.responseReceivedAt) {
                const sentTime = DateTime.fromJSDate(outcome.sentAt);
                const responseTime = DateTime.fromJSDate(outcome.responseReceivedAt);
                responseTimeHours = parseFloat(responseTime.diff(sentTime, 'hours').toObject().hours?.toFixed(2) || '0');
            }

            // Store the learning data
            await prisma.communicationLearningData.create({
                data: {
                    customer_id: outcome.customerId,
                    contact_id: outcome.contactId,
                    channel: outcome.channel,
                    activity_id: outcome.activityId,
                    sent_at: outcome.sentAt,
                    response_received_at: outcome.responseReceivedAt,
                    response_channel: outcome.responseChannel,
                    success: outcome.success,
                    response_time_hours: responseTimeHours,
                    context_data: outcome.contextData,
                },
            });

            // Update channel preferences
            await this.updateChannelPreferences(outcome.customerId, outcome.channel, outcome.success, responseTimeHours);

            await this.logService.logMessage(
                LogLevel.INFO,
                `Recorded communication outcome for customer ${outcome.customerId}, channel ${outcome.channel}, success: ${outcome.success}`,
                "CommunicationLearningService"
            );
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to record communication outcome: ${error.message}`,
                "CommunicationLearningService"
            );
            throw error;
        }
    }

    /**
     * Update channel preferences based on outcome
     */
    private async updateChannelPreferences(
        customerId: number,
        channel: activity_type,
        success: boolean,
        responseTimeHours?: number
    ): Promise<void> {
        try {
            // Get or create channel preference
            const existingPreference = await prisma.communicationChannelPreference.findUnique({
                where: {
                    customer_id_channel: {
                        customer_id: customerId,
                        channel: channel,
                    },
                },
            });

            if (existingPreference) {
                // Update existing preference
                const newTotalAttempts = (existingPreference.total_attempts || 0) + 1;
                const newTotalSuccesses = (existingPreference.total_successes || 0) + (success ? 1 : 0);
                const newSuccessRate = newTotalSuccesses / newTotalAttempts;

                // Calculate new average response time
                let newAverageResponseTime = existingPreference.response_time_hours;
                if (success && responseTimeHours !== undefined) {
                    if (existingPreference.response_time_hours) {
                        // Weighted average based on number of successes
                        const currentHours = parseFloat(existingPreference.response_time_hours.toString());
                        const calculatedHours = (currentHours * (newTotalSuccesses - 1) + responseTimeHours) / newTotalSuccesses;
                        newAverageResponseTime = new Prisma.Decimal(calculatedHours);
                    } else {
                        newAverageResponseTime = new Prisma.Decimal(responseTimeHours);
                    }
                }

                await prisma.communicationChannelPreference.update({
                    where: {
                        customer_id_channel: {
                            customer_id: customerId,
                            channel: channel,
                        },
                    },
                    data: {
                        success_rate: newSuccessRate,
                        response_time_hours: newAverageResponseTime,
                        last_successful_contact: success ? new Date() : existingPreference.last_successful_contact,
                        total_attempts: newTotalAttempts,
                        total_successes: newTotalSuccesses,
                    },
                });
            } else {
                // Create new preference
                await prisma.communicationChannelPreference.create({
                    data: {
                        customer_id: customerId,
                        channel: channel,
                        success_rate: success ? 1.0 : 0.0,
                        response_time_hours: responseTimeHours ? new Prisma.Decimal(responseTimeHours) : null,
                        last_successful_contact: success ? new Date() : null,
                        total_attempts: 1,
                        total_successes: success ? 1 : 0,
                    },
                });
            }
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to update channel preferences: ${error.message}`,
                "CommunicationLearningService"
            );
            throw error;
        }
    }

    /**
     * Get channel performance metrics for a customer
     */
    async getChannelPerformanceMetrics(customerId: number): Promise<ChannelPerformanceMetrics[]> {
        try {
            const preferences = await prisma.communicationChannelPreference.findMany({
                where: { customer_id: customerId },
                orderBy: { success_rate: 'desc' },
            });

            return preferences.map(pref => ({
                channel: pref.channel,
                successRate: pref.success_rate?.toNumber() || 0,
                averageResponseTimeHours: pref.response_time_hours?.toNumber() || 0,
                totalAttempts: pref.total_attempts || 0,
                totalSuccesses: pref.total_successes || 0,
                lastSuccessfulContact: pref.last_successful_contact,
                preferredTimeOfDay: pref.preferred_time_of_day,
            }));
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to get channel performance metrics: ${error.message}`,
                "CommunicationLearningService"
            );
            throw error;
        }
    }

    /**
     * Get aggregated learning data for analytics
     */
    async getAggregatedLearningData(filters: {
        customerId?: number;
        channel?: activity_type;
        startDate?: Date;
        endDate?: Date;
        query?: string;
    } = {}): Promise<any> {
        try {
            const whereClause: any = {};

            if (filters.customerId) {
                whereClause.customer_id = filters.customerId;
            }

            if (filters.channel) {
                whereClause.channel = filters.channel;
            }

            if (filters.startDate || filters.endDate) {
                whereClause.sent_at = {};
                if (filters.startDate) {
                    whereClause.sent_at.gte = filters.startDate;
                }
                if (filters.endDate) {
                    whereClause.sent_at.lte = filters.endDate;
                }
            }

            // Add search functionality
            if (filters.query && filters.query.trim()) {
                const searchTerm = filters.query.trim();
                const searchConditions: any[] = [
                    // Search in customer information
                    {
                        Customer: {
                            Person: {
                                first_name: { contains: searchTerm, mode: "insensitive" }
                            }
                        }
                    },
                    {
                        Customer: {
                            Person: {
                                last_name: { contains: searchTerm, mode: "insensitive" }
                            }
                        }
                    },
                    {
                        Customer: {
                            Company: {
                                name: { contains: searchTerm, mode: "insensitive" }
                            }
                        }
                    },
                    // Search in contact information
                    {
                        Contact: {
                            first_name: { contains: searchTerm, mode: "insensitive" }
                        }
                    },
                    {
                        Contact: {
                            last_name: { contains: searchTerm, mode: "insensitive" }
                        }
                    }
                ];

                // Add channel search (exact match for enum values)
                const channelValues: activity_type[] = ['SMS', 'Email', 'Call', 'WhatsApp', 'Internal', 'Resolved', 'Dispute', 'Promise_to_pay', 'Agent'];
                const matchingChannels = channelValues.filter(channel =>
                    channel.toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (matchingChannels.length > 0) {
                    searchConditions.push({
                        channel: { in: matchingChannels }
                    });
                }

                whereClause.OR = searchConditions;
            }

            const learningData = await prisma.communicationLearningData.findMany({
                where: whereClause,
                include: {
                    Customer: {
                        select: {
                            id: true,
                            account_id: true,
                            Person: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                },
                            },
                        },
                    },
                    Contact: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                },
                orderBy: { sent_at: 'desc' },
            });

            // Calculate aggregated metrics
            const channelStats = new Map<activity_type, {
                totalAttempts: number;
                totalSuccesses: number;
                successRate: number;
                averageResponseTime: number;
                totalResponseTime: number;
                responseCount: number;
            }>();

            learningData.forEach(data => {
                if (!channelStats.has(data.channel)) {
                    channelStats.set(data.channel, {
                        totalAttempts: 0,
                        totalSuccesses: 0,
                        successRate: 0,
                        averageResponseTime: 0,
                        totalResponseTime: 0,
                        responseCount: 0,
                    });
                }

                const stats = channelStats.get(data.channel)!;
                stats.totalAttempts++;
                if (data.success) {
                    stats.totalSuccesses++;
                }
                if (data.response_time_hours) {
                    stats.totalResponseTime += parseFloat(data.response_time_hours.toString());
                    stats.responseCount++;
                }
            });

            // Calculate final metrics
            const channelMetrics = Array.from(channelStats.entries()).map(([channel, stats]) => ({
                channel,
                totalAttempts: stats.totalAttempts,
                totalSuccesses: stats.totalSuccesses,
                successRate: stats.totalAttempts > 0 ? stats.totalSuccesses / stats.totalAttempts : 0,
                averageResponseTime: stats.responseCount > 0 ? stats.totalResponseTime / stats.responseCount : 0,
            }));

            return {
                learningData,
                channelMetrics,
                totalRecords: learningData.length,
            };
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to get aggregated learning data: ${error.message}`,
                "CommunicationLearningService"
            );
            throw error;
        }
    }

    /**
     * Get the best performing channel for a customer
     */
    async getBestChannelForCustomer(customerId: number): Promise<activity_type | null> {
        try {
            const preferences = await prisma.communicationChannelPreference.findMany({
                where: {
                    customer_id: customerId,
                    total_attempts: { gte: 3 }, // Require minimum attempts for reliability
                },
                orderBy: { success_rate: 'desc' },
                take: 1,
            });

            return preferences.length > 0 ? preferences[0].channel : null;
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to get best channel for customer: ${error.message}`,
                "CommunicationLearningService"
            );
            return null;
        }
    }

    /**
     * Clean up old learning data (optional maintenance method)
     */
    async cleanupOldData(daysToKeep: number = 365): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const deletedCount = await prisma.communicationLearningData.deleteMany({
                where: {
                    sent_at: { lt: cutoffDate },
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Cleaned up ${deletedCount.count} old learning data records`,
                "CommunicationLearningService"
            );
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to cleanup old learning data: ${error.message}`,
                "CommunicationLearningService"
            );
            throw error;
        }
    }
}
