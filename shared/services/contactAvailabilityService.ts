import { apiFetch } from "@/utils/apiFetch";
import moment from "moment-timezone";

import { ContactAvailability } from "../../types/BusinessHours";

export class ContactAvailabilityService {
    /**
     * Get contact availability settings
     */
    static async getContactAvailability(
        contactId: number
    ): Promise<ContactAvailability | null> {
        try {
            const response = await apiFetch(`/api/entities/contacts?operation=availability&contactId=${contactId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to get contact availability: ${response.statusText}`
                );
            }

            const data = await response.json();
            return data.availability;
        } catch (error) {
            console.error("Error getting contact availability:", error);
            return null;
        }
    }

    /**
     * Update contact availability settings
     */
    static async updateContactAvailability(
        contactId: number,
        availability: ContactAvailability
    ): Promise<boolean> {
        try {
            const response = await apiFetch(`/api/entities/contacts?operation=availability&contactId=${contactId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ availability }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to update contact availability: ${response.statusText}`
                );
            }

            return true;
        } catch (error) {
            console.error("Error updating contact availability:", error);
            return false;
        }
    }

    /**
     * Get default availability for a contact
     */
    static getDefaultAvailability(
        timezone: string = "UTC"
    ): ContactAvailability {
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
     * Validate availability settings
     */
    static validateAvailability(availability: ContactAvailability): string[] {
        const errors: string[] = [];

        if (!availability.businessHours) {
            errors.push("Business hours are required");
        } else {
            const { start, end, timezone, daysOfWeek } =
                availability.businessHours;

            if (!start || !end) {
                errors.push("Start and end times are required");
            }

            if (!timezone) {
                errors.push("Timezone is required");
            }

            if (!daysOfWeek || daysOfWeek.length === 0) {
                errors.push("At least one working day must be selected");
            }
        }

        if (
            !availability.preferredChannels ||
            availability.preferredChannels.length === 0
        ) {
            errors.push("At least one preferred channel must be selected");
        }

        if (!availability.urgencyLevels) {
            errors.push("Urgency levels are required");
        }

        return errors;
    }

    /**
     * Format business hours for display
     */
    static formatBusinessHours(availability: ContactAvailability): string {
        const { businessHours } = availability;
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const workingDays = businessHours.daysOfWeek
            .map((day) => days[day])
            .join(", ");

        return `${businessHours.start} - ${businessHours.end} (${workingDays}) ${businessHours.timezone}`;
    }

    /**
     * Check if a time is within business hours
     */
    static isWithinBusinessHours(
        time: Date,
        availability: ContactAvailability
    ): boolean {
        const { businessHours } = availability;
        const momentTime = moment(time).tz(
            businessHours.timezone
        );

        const hour = momentTime.hour();
        const minute = momentTime.minute();
        const day = momentTime.day();

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
}
