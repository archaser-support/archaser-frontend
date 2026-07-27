export const BROADCAST_CONSTANTS = {
    REFRESH_TIMELINE: "REFRESH_TIMELINE",
};

/**
 * Call outcome constants and mappings
 */
export const CALL_OUTCOMES = {
    SCHEDULE_FOLLOW_UP: "schedule_follow_up",
    PROMISE_TO_PAY: "promise_to_pay",
    MAKE_PAYMENT: "make_payment",
    ADD_NEW_CONTACT: "add_new_contact",
    MOVE_TO_LEGAL: "move_to_legal",
    OPEN_DISPUTE: "open_dispute",
    NO_ANSWER: "no_answer",
    BAD_NUMBER: "bad_number",
    GENERAL: "general",
} as const;

export const CALL_OUTCOME_LABELS: Record<string, string> = {
    [CALL_OUTCOMES.SCHEDULE_FOLLOW_UP]: "Schedule Follow-up Call",
    [CALL_OUTCOMES.PROMISE_TO_PAY]: "Promise to Pay",
    [CALL_OUTCOMES.MAKE_PAYMENT]: "Payment Arrangement",
    [CALL_OUTCOMES.ADD_NEW_CONTACT]: "Add New Contact",
    [CALL_OUTCOMES.MOVE_TO_LEGAL]: "Move to Legal",
    [CALL_OUTCOMES.OPEN_DISPUTE]: "Open Dispute",
    [CALL_OUTCOMES.NO_ANSWER]: "No Answer",
    [CALL_OUTCOMES.BAD_NUMBER]: "Bad Number",
    [CALL_OUTCOMES.GENERAL]: "General Discussion",
};

/**
 * Get call result label for a given outcome
 */
export function getCallResultLabel(callOutcome: string): string {
    return (
        CALL_OUTCOME_LABELS[callOutcome] ||
        CALL_OUTCOME_LABELS[CALL_OUTCOMES.GENERAL]
    );
}
