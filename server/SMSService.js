import Twilio from "twilio";

import { logMessage } from "@/server/services/LogService";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials are missing in environment variables.");
}

const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Sends an SMS using Twilio.
 * @param {Object} params - SMS parameters.
 * @param {string} params.to - Recipient mobile number.
 * @param {string} params.from - Sender number.
 * @param {string} params.body - SMS content.
 * @param {number} activityId - The ID of the activity record.
 * @returns {Object} - Success status and error message (if any).
 */
export const sendSMS = async ({ to, from, body }, activityId) => {
    try {
        // Input validation
        if (!to || !from || !body) {
            throw new Error(
                "Missing required SMS parameters: to, from, or body."
            );
        }

        const message = await client.messages.create({
            body,
            from,
            to,
        });

        await logMessage(
            "INFO",
            `SMS sent successfully (SID: ${message.sid})`,
            "sendSMS",
            { activityId, to, from }
        );
        return { success: true, sid: message.sid };
    } catch (error) {
        await logMessage(
            "ERROR",
            `Failed to send SMS: ${error.message}`,
            "sendSMS",
            { activityId, to, from }
        );
        return { success: false, error: error.message };
    }
};
