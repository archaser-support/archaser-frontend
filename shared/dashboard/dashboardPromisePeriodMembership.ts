/**
 * Shared membership helpers for CustomerCollectionPeriod promise drills.
 *
 * Used by the dashboard_promises filter contract / execute seam.
 * Encodes legacy getOperationDashboardDetails promises-to-pay Activity.some rules.
 */

export const DASHBOARD_PROMISE_ACTIVITY_FILTER_FIELD =
    "__dashboard_promise_activity";

export interface DashboardPromiseActivityMembershipInput {
    /** Inclusive activity created_at window (legacy details date range). */
    start: Date;
    end: Date;
    /**
     * Agent IDs already excluding system/portal audit users
     * (matches details: agentIds.filter(id !== portal && id !== system)).
     */
    agentIdsExclAudit: string[];
}

/**
 * Prisma fragment for “has related COMPLETED Promise_to_pay activity in range
 * by agent”, plus non-null promise amount — exact details-list membership core.
 */
export function expandDashboardPromiseActivityWhere(
    input: DashboardPromiseActivityMembershipInput
): Record<string, unknown> {
    return {
        promise_to_pay_amount: { not: null },
        Activity: {
            some: {
                created_by: { in: input.agentIdsExclAudit },
                type: "Promise_to_pay",
                status: "COMPLETED",
                created_at: {
                    gte: input.start,
                    lte: input.end,
                },
            },
        },
    };
}
