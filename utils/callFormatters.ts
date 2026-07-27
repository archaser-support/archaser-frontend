/**
 * Utility functions for formatting call-related data for display
 */

export function formatCallType(callType: string | null | undefined): string {
    const callTypeMap: Record<string, string> = {
        'incoming': 'Incoming',
        'outgoing': 'Outgoing',
        'unknown': 'General', // Change "unknown" to "General" for better UX
        '': 'General',
        'null': 'General',
        'undefined': 'General'
    };

    // Handle null/undefined cases
    if (!callType || callType === 'null' || callType === 'undefined') {
        return 'General';
    }

    return callTypeMap[callType.toLowerCase()] || 'General';
}

export function formatCallOutcome(outcome: string | null | undefined): string {
    if (!outcome) {
        return 'Call completed';
    }

    const outcomeMap: Record<string, string> = {
        'open_dispute': 'Dispute opened',
        'promise_to_pay': 'Promise to pay',
        'no_answer': 'No answer',
        'busy': 'Busy',
        'contact_made': 'Contact made',
        'general': 'General call',
        'follow_up_scheduled': 'Follow up scheduled'
    };

    return outcomeMap[outcome] || outcome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
