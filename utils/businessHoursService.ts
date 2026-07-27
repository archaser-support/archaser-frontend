import moment from "moment-timezone";

import {
    ContactAvailability,
    SchedulingOptions,
    SchedulingResult,
    HolidayCalendar,
    ResponsePattern,
} from "../types/BusinessHours";

import { ClientHolidayChecker } from "./clientHolidayChecker";

export class BusinessHoursService {
    private static instance: BusinessHoursService;
    private holidayCalendars: Map<string, HolidayCalendar> = new Map();
    private responsePatterns: Map<string, ResponsePattern> = new Map();
    private contactAvailabilityCache: Map<
        number,
        { data: ContactAvailability | null; timestamp: number }
    > = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private holidayChecker: ClientHolidayChecker;

    private constructor() {
        this.initializeHolidayCalendars();
        this.holidayChecker = ClientHolidayChecker.getInstance();
    }

    public static getInstance(): BusinessHoursService {
        if (!BusinessHoursService.instance) {
            BusinessHoursService.instance = new BusinessHoursService();
        }
        return BusinessHoursService.instance;
    }

    /**
     * Get contact availability configuration with client-side defaults
     *
     * Priority order for determining contact business hours:
     * 1. Contact's custom availability_schedule in database
     * 2. Contact's company -> customer -> country timezone
     * 3. Company's default business hours
     * 4. Default based on user locale or company settings
     * 5. UTC fallback
     */
    public async getContactAvailability(
        contactId: number
    ): Promise<ContactAvailability | null> {
        try {
            // Check cache first
            const cached = this.contactAvailabilityCache.get(contactId);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                return cached.data;
            }

            // Use default availability since we can't access database from browser
            const defaultAvailability = this.getDefaultAvailability(contactId);

            // Cache the result
            this.contactAvailabilityCache.set(contactId, {
                data: defaultAvailability,
                timestamp: Date.now(),
            });

            return defaultAvailability;
        } catch (error) {
            // Cache null result to avoid repeated error calls
            this.contactAvailabilityCache.set(contactId, {
                data: null,
                timestamp: Date.now(),
            });
            return null;
        }
    }

    /**
     * Clear the contact availability cache
     */
    public clearContactAvailabilityCache(): void {
        this.contactAvailabilityCache.clear();
    }

    /**
     * Clear cache for a specific contact
     */
    public clearContactAvailabilityCacheForContact(contactId: number): void {
        this.contactAvailabilityCache.delete(contactId);
    }

    /**
     * Smart scheduling with business hours consideration (client-side)
     */
    public async scheduleWithBusinessHours(
        baseDate: Date,
        options: SchedulingOptions
    ): Promise<SchedulingResult> {
        const contactAvailability = options.contactId
            ? await this.getContactAvailability(options.contactId)
            : null;

        const warnings: string[] = [];
        const suggestedTimes: Date[] = [];

        // Determine target timezone
        const targetTimezone = this.getTargetTimezone(
            options,
            contactAvailability
        );

        // Create base scheduled time
        let scheduledTime = moment.tz(baseDate, targetTimezone);

        // Apply preferred time if specified
        if (options.preferredTime) {
            const [hours, minutes] = options.preferredTime
                .split(":")
                .map(Number);
            scheduledTime = scheduledTime.set({
                hour: hours,
                minute: minutes,
                second: 0,
                millisecond: 0,
            });
        }

        // Check if within business hours
        let isBusinessHours = this.isWithinBusinessHours(
            scheduledTime,
            contactAvailability,
            options
        );

        // Store original business hours status for reporting
        const originalIsBusinessHours = isBusinessHours;

        if (!isBusinessHours && options.businessHoursOnly !== false) {
            // Find next available business hour
            const nextBusinessTime = this.findNextBusinessTime(
                scheduledTime,
                contactAvailability,
                options
            );
            scheduledTime = nextBusinessTime.scheduledTime;
            warnings.push(...nextBusinessTime.warnings);
            suggestedTimes.push(...nextBusinessTime.suggestedTimes);
            // Update isBusinessHours after time adjustment
            isBusinessHours = this.isWithinBusinessHours(
                scheduledTime,
                contactAvailability,
                options
            );
        } else if (options.businessHoursOnly === false) {
            // When business hours are overridden, keep the original status
            isBusinessHours = originalIsBusinessHours;
        }

        // Check for holidays and vacations (client-side)
        const holidayCheck = this.checkHolidaysAndVacations(
            scheduledTime,
            contactAvailability,
            options
        );
        if (holidayCheck.isHoliday) {
            warnings.push(
                `Scheduled on ${holidayCheck.holidayName} - consider rescheduling`
            );
        }

        // Generate alternative times
        const alternatives = this.generateAlternativeTimes(
            scheduledTime,
            contactAvailability,
            options
        );
        suggestedTimes.push(...alternatives);

        // Optimize based on response patterns
        if (options.contactId) {
            const optimizedTime = await this.optimizeBasedOnResponsePattern(
                scheduledTime,
                options.contactId,
                options.channel
            );
            if (optimizedTime) {
                scheduledTime = optimizedTime;
            }
        }

        return {
            scheduledTime: scheduledTime.toDate(),
            isBusinessHours,
            warnings,
            suggestedTimes,
            contactTimezone: targetTimezone,
            localTime: scheduledTime.format("YYYY-MM-DD HH:mm:ss"),
        };
    }

    /**
     * Check if time is within business hours
     */
    private isWithinBusinessHours(
        time: moment.Moment,
        availability: ContactAvailability | null,
        options: SchedulingOptions
    ): boolean {
        if (!availability) {
            // Default business hours: 8 AM - 5 PM, Sunday-Thursday (Israeli business hours)
            const hour = time.hour();
            const day = time.day();
            return hour >= 8 && hour < 17 && day >= 0 && day <= 4; // Sunday=0, Thursday=4
        }

        const { businessHours } = availability;
        const hour = time.hour();
        const minute = time.minute();
        const day = time.day();

        // Check if it's a working day
        if (!businessHours.daysOfWeek.includes(day)) {
            return false;
        }

        // Check if it's within business hours
        const [startHour, startMinute] = businessHours.start
            .split(":")
            .map(Number);
        const [endHour, endMinute] = businessHours.end.split(":").map(Number);

        const currentTime = hour * 60 + minute;
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        return currentTime >= startTime && currentTime < endTime;
    }

    /**
     * Find the next available business time
     */
    private findNextBusinessTime(
        currentTime: moment.Moment,
        availability: ContactAvailability | null,
        options: SchedulingOptions
    ): {
        scheduledTime: moment.Moment;
        warnings: string[];
        suggestedTimes: Date[];
    } {
        const warnings: string[] = [];
        const suggestedTimes: Date[] = [];
        let nextTime = currentTime.clone();

        // Safety limit to prevent infinite loops (max 7 days ahead)
        const maxIterations = 7 * 24; // 7 days * 24 hours
        let iterations = 0;

        // Skip to next business day if needed
        while (!this.isWithinBusinessHours(nextTime, availability, options) && iterations < maxIterations) {
            // If current day is not a business day, jump to next business day
            const currentDay = nextTime.day();
            const businessDays = availability?.businessHours.daysOfWeek || [0, 1, 2, 3, 4]; // Default: Sunday-Thursday
            
            if (!businessDays.includes(currentDay)) {
                // Find next business day
                let daysToAdd = 1;
                while (daysToAdd <= 7) {
                    const nextDay = (currentDay + daysToAdd) % 7;
                    if (businessDays.includes(nextDay)) {
                        nextTime.add(daysToAdd, "day");
                        const businessStart = availability?.businessHours.start || "08:00";
                        const [hours, minutes] = businessStart.split(":").map(Number);
                        nextTime = nextTime.set({
                            hour: hours,
                            minute: minutes,
                            second: 0,
                            millisecond: 0,
                        });
                        break;
                    }
                    daysToAdd++;
                }
                iterations += daysToAdd;
            } else {
                // Current day is a business day, just move to business hours
                const businessStart = availability?.businessHours.start || "08:00";
                const [hours, minutes] = businessStart.split(":").map(Number);
                nextTime = nextTime.set({
                    hour: hours,
                    minute: minutes,
                    second: 0,
                    millisecond: 0,
                });
                iterations++;
            }
        }

        // If we hit the safety limit, just use the current time
        if (iterations >= maxIterations) {
            warnings.push("Could not find suitable business time within 7 days, using current time");
            nextTime = currentTime.clone();
        }

        warnings.push(
            `Scheduled outside business hours - moved to ${nextTime.format("YYYY-MM-DD HH:mm")}`
        );

        return { scheduledTime: nextTime, warnings, suggestedTimes };
    }

    /**
     * Check for holidays and vacations (client-side)
     */
    private checkHolidaysAndVacations(
        time: moment.Moment,
        availability: ContactAvailability | null,
        options: SchedulingOptions
    ): { isHoliday: boolean; holidayName?: string } {
        if (!availability) {
            return { isHoliday: false };
        }

        const dateStr = time.format("YYYY-MM-DD");

        // Check personal holidays
        if (availability.holidays) {
            for (const holiday of availability.holidays) {
                if (holiday.dates.includes(dateStr)) {
                    return {
                        isHoliday: true,
                        holidayName: holiday.description,
                    };
                }
            }
        }

        // Check vacation
        if (availability.vacation) {
            const vacationStart = moment(availability.vacation.startDate);
            const vacationEnd = moment(availability.vacation.endDate);
            if (time.isBetween(vacationStart, vacationEnd, "day", "[]")) {
                return {
                    isHoliday: true,
                    holidayName: availability.vacation.description,
                };
            }
        }

        // Check national holidays using client-side holiday calendar
        const nationalHolidayCheck = this.holidayChecker.isHoliday(
            options?.countryCode || "US",
            time.toDate()
        );

        if (nationalHolidayCheck.isHoliday) {
            return {
                isHoliday: true,
                holidayName: `National Holiday: ${nationalHolidayCheck.holidayName}`,
            };
        }

        return { isHoliday: false };
    }

    /**
     * Generate alternative scheduling times
     */
    private generateAlternativeTimes(
        baseTime: moment.Moment,
        availability: ContactAvailability | null,
        options: SchedulingOptions
    ): Date[] {
        const alternatives: Date[] = [];
        const businessStart = availability?.businessHours.start || "09:00";
        const businessEnd = availability?.businessHours.end || "18:00";

        // Generate times for next 3 business days
        for (let day = 1; day <= 3; day++) {
            const nextDay = baseTime.clone().add(day, "day");

            // Morning slot
            const morningTime = nextDay.clone().set({
                hour: parseInt(businessStart.split(":")[0]),
                minute: parseInt(businessStart.split(":")[1]),
                second: 0,
                millisecond: 0,
            });

            if (
                this.isWithinBusinessHours(morningTime, availability, options)
            ) {
                alternatives.push(morningTime.toDate());
            }

            // Afternoon slot
            const afternoonTime = nextDay.clone().set({
                hour: parseInt(businessStart.split(":")[0]) + 4, // 4 hours after start
                minute: parseInt(businessStart.split(":")[1]),
                second: 0,
                millisecond: 0,
            });

            if (
                this.isWithinBusinessHours(afternoonTime, availability, options)
            ) {
                alternatives.push(afternoonTime.toDate());
            }
        }

        return alternatives;
    }

    /**
     * Optimize scheduling based on response patterns
     */
    private async optimizeBasedOnResponsePattern(
        scheduledTime: moment.Moment,
        contactId: number,
        channel: string
    ): Promise<moment.Moment | null> {
        const patternKey = `${contactId}-${channel}`;
        const pattern = this.responsePatterns.get(patternKey);

        if (!pattern) {
            return null;
        }

        // If we have optimal hours data, try to schedule within those hours
        if (pattern.optimalHours) {
            const [optimalStartHour] = pattern.optimalHours.start
                .split(":")
                .map(Number);
            const [optimalEndHour] = pattern.optimalHours.end
                .split(":")
                .map(Number);

            const currentHour = scheduledTime.hour();

            if (
                currentHour < optimalStartHour ||
                currentHour >= optimalEndHour
            ) {
                // Move to optimal time
                return scheduledTime.clone().set({
                    hour: optimalStartHour,
                    minute: 0,
                    second: 0,
                    millisecond: 0,
                });
            }
        }

        return null;
    }

    /**
     * Determine contact timezone based on available location data
     * This would typically be called from the backend with full contact/customer data
     */
    private determineContactTimezone(contactData?: {
        company_id?: number;
        customer?: {
            country_id?: number;
            state_id?: number;
            Country?: {
                iso2?: string;
            };
            State?: {
                iso2?: string;
            };
        };
    }): string {
        // Priority order for timezone determination:
        // 1. Contact's custom availability_schedule timezone
        // 2. Contact's company -> customer -> country timezone
        // 3. Default based on user locale or company settings
        // 4. UTC fallback

        // For now, we'll use Israeli timezone as default since the user mentioned Israel
        // In a full implementation, this would query the database for:
        // - Contact's availability_schedule
        // - Contact's company -> customer -> country
        // - Use customer's country_id to determine timezone

        return "Asia/Jerusalem"; // Israeli timezone as default
    }

    /**
     * Get default availability for a contact (client-side)
     */
    private getDefaultAvailability(contactId: number): ContactAvailability {
        // For now, we'll use Israeli business hours as the default since the user mentioned Israel
        // In a full implementation, this would be determined by:
        // 1. Contact's custom availability_schedule in database
        // 2. Contact's company -> customer -> country
        // 3. Company's default business hours
        // 4. Default based on user locale or company settings

        const timezone = this.determineContactTimezone();
        const isIsraeliBusinessHours = timezone === "Asia/Jerusalem";

        if (isIsraeliBusinessHours) {
            return {
                businessHours: {
                    start: "08:00", // 8 AM
                    end: "17:00", // 5 PM
                    timezone,
                    daysOfWeek: [0, 1, 2, 3, 4], // Sunday-Thursday (0=Sunday, 1=Monday, etc.)
                },
                preferredChannels: ["email", "sms"],
                urgencyLevels: {
                    urgent: true,
                    emergency: true,
                },
            };
        }

        // Default business hours: 9 AM - 6 PM, Monday-Friday (fallback for non-Israeli)
        return {
            businessHours: {
                start: "09:00",
                end: "18:00",
                timezone,
                daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
            },
            preferredChannels: ["email", "sms"],
            urgencyLevels: {
                urgent: true,
                emergency: true,
            },
        };
    }

    /**
     * Get target timezone for scheduling
     */
    private getTargetTimezone(
        options: SchedulingOptions,
        availability: ContactAvailability | null
    ): string {
        if (options.timezone) {
            return options.timezone;
        }

        if (availability?.businessHours?.timezone) {
            return availability.businessHours.timezone;
        }

        return "UTC";
    }

    /**
     * Initialize holiday calendars (client-side)
     */
    private initializeHolidayCalendars(): void {
        // US Holidays
        this.holidayCalendars.set("US", {
            countryCode: "US",
            holidays: [
                {
                    date: "2024-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                {
                    date: "2024-01-15",
                    name: "Martin Luther King Jr. Day",
                    type: "national",
                },
                {
                    date: "2024-02-19",
                    name: "Presidents' Day",
                    type: "national",
                },
                { date: "2024-05-27", name: "Memorial Day", type: "national" },
                {
                    date: "2024-07-04",
                    name: "Independence Day",
                    type: "national",
                },
                { date: "2024-09-02", name: "Labor Day", type: "national" },
                { date: "2024-10-14", name: "Columbus Day", type: "national" },
                { date: "2024-11-11", name: "Veterans Day", type: "national" },
                {
                    date: "2024-11-28",
                    name: "Thanksgiving Day",
                    type: "national",
                },
                { date: "2024-12-25", name: "Christmas Day", type: "national" },
            ],
        });

        // Add more countries as needed
    }

    /**
     * Update response pattern for a contact
     */
    public async updateResponsePattern(
        contactId: number,
        channel: string,
        responseTime: number,
        success: boolean
    ): Promise<void> {
        const patternKey = `${contactId}-${channel}`;
        const existingPattern = this.responsePatterns.get(patternKey);

        if (existingPattern) {
            // Update existing pattern
            const totalResponses = existingPattern.successRate * 100; // Approximate
            const newTotal = totalResponses + 1;
            const newSuccesses =
                existingPattern.successRate * totalResponses +
                (success ? 1 : 0);

            existingPattern.averageResponseTime =
                (existingPattern.averageResponseTime * totalResponses +
                    responseTime) /
                newTotal;
            existingPattern.successRate = newSuccesses / newTotal;
            existingPattern.lastUpdated = new Date();
        } else {
            // Create new pattern
            this.responsePatterns.set(patternKey, {
                contactId,
                channel,
                averageResponseTime: responseTime,
                successRate: success ? 1 : 0,
                optimalHours: { start: "09:00", end: "17:00" },
                lastUpdated: new Date(),
            });
        }
    }
}
