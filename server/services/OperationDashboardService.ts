import {
    OperationDashboardResponse,
    AggregateOperationStats,
    AgentOperationStats,
} from "@/types/OperationDashboard";
import { getCustomersWithoutContactWhereClause } from "@/shared/services/noContactService";
import { isConvertedOperationDashboardDetailType } from "@/shared/dashboard/operationDashboardDetailsLegacy";
import { prisma } from "@/lib/prisma";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

import { AccessControlService } from "./AccessControlService";
import { getPortalUserId, getSystemUserId } from "./UserService";

// Helper to format text (remove underscores)
const formatText = (text: string | null | undefined): string => {
    if (!text) return "";
    return text.replace(/_/g, " ");
};

// Helper to format parameter values in titles
const formatParams = (params: any): any => {
    if (!params || typeof params !== "object") return params;
    try {
        const formatted = { ...params };
        for (const key in formatted) {
            if (typeof formatted[key] === "string") {
                formatted[key] = formatText(formatted[key]);
            }
        }
        return formatted;
    } catch {
        return params;
    }
};

export const calculateOperationDashboardStats = async (params: {
    account_id: number;
    user_id: string;
    startDate?: Date;
    endDate?: Date;
    view_as_user_id?: string;
    view_as_user_role?: string;
    view_as_user_account_id?: number;
    business_unit_filter?: any;
    filter_by_user_id?: string; // Filter data by specific user ID
}) => {
    const {
        account_id,
        user_id,
        startDate,
        endDate,
        view_as_user_id,
        view_as_user_role,
        view_as_user_account_id,
        business_unit_filter,
        filter_by_user_id,
    } = params;

    // Set date range
    const now = new Date();
    const start =
        startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let end = endDate || now;

    // Normalize end date to ensure we include all activities created on that day
    if (endDate) {
        const endDateHours = endDate.getUTCHours();
        const endDateMinutes = endDate.getUTCMinutes();
        const endDateSeconds = endDate.getUTCSeconds();
        const endDateMs = endDate.getUTCMilliseconds();

        // Check if end date is at start of day (00:00:00.000)
        const isStartOfDay =
            endDateHours === 0 &&
            endDateMinutes === 0 &&
            endDateSeconds === 0 &&
            endDateMs === 0;

        // Check if end date is at end of day (23:59:59.999 or close to it)
        // Also check for 21:59:59.999, 22:59:59.999 which are end of day in different timezones
        const isEndOfDay =
            (endDateHours === 23 &&
                endDateMinutes === 59 &&
                endDateSeconds === 59 &&
                endDateMs >= 999) ||
            (endDateHours >= 21 &&
                endDateMinutes === 59 &&
                endDateSeconds === 59 &&
                endDateMs >= 999);

        if (isStartOfDay) {
            // If end date is at start of day, set it to end of that day
            end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
        } else if (isEndOfDay) {
            // If end date is already at end of day (in any timezone), keep it as-is
            // Don't replace with current time - user explicitly selected end of day
            end = endDate;
        } else {
            // If end date is today but not at end of day, and it's before current time,
            // use current time to include newly created calls
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const endDateStartOfDay = new Date(endDate);
            endDateStartOfDay.setUTCHours(0, 0, 0, 0);

            if (
                endDateStartOfDay.getTime() === today.getTime() &&
                endDate < now
            ) {
                // End date is today but in the past, use current time
                end = now;
            }
            // Otherwise, keep the provided endDate as-is
        }
    }

    // Get account currency
    const account = await prisma.account.findUnique({
        where: { id: account_id },
        select: { currency: true },
    });
    const currency = resolveCustomerFirstCurrency({
        accountCurrency: account?.currency,
    });

    // Get access control filters
    const accessControl = AccessControlService.getInstance();
    const isAdmin = account_id === 10013;

    // Check for broader access via use_view_as permission
    const { PermissionService } = await import(
        "@/server/services/PermissionService"
    );
    const permissionService = PermissionService.getInstance();
    const effectiveAccountId = view_as_user_account_id || account_id;
    const effectiveRole =
        view_as_user_role ||
        (
            await prisma.user.findUnique({
                where: { id: user_id },
                select: { role: true },
            })
        )?.role ||
        "";

    const hasViewAsPermission = await permissionService.hasPermission(
        effectiveAccountId,
        effectiveRole,
        "use_view_as"
    );

    const ownerFilter = isAdmin
        ? {}
        : await accessControl.getOwnerFilter(
            user_id,
            hasViewAsPermission,
            view_as_user_id,
            view_as_user_role,
            view_as_user_account_id
        );

    // Use provided business unit filter
    const buFilter = business_unit_filter || {};

    // Get all users for this account who create activities, filtered by business unit
    // Users should be filtered by their own business unit assignment
    const collectionAgentsWhere: any = {
        account_id: effectiveAccountId, // Use effectiveAccountId to support "view as"
        status: "Active",
        deactivated_at: null,
    };

    // Apply business unit filter to agents if not admin
    // buFilter may have OR structure, so we need to handle it properly
    if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
        if (buFilter.OR) {
            // Extract business unit IDs from OR structure
            const buIds: (number | null)[] = [];
            buFilter.OR.forEach((condition: any) => {
                if (condition.business_unit_id !== undefined) {
                    if (condition.business_unit_id === null) {
                        buIds.push(null);
                    } else if (condition.business_unit_id.in) {
                        buIds.push(...condition.business_unit_id.in);
                    } else {
                        buIds.push(condition.business_unit_id);
                    }
                }
            });
            if (buIds.length > 0) {
                const nonNullIds = buIds.filter(
                    (id): id is number => id !== null
                );
                if (nonNullIds.length > 0 && buIds.includes(null)) {
                    // Include null BUs if primary BU users
                    collectionAgentsWhere.OR = [
                        { business_unit_id: { in: nonNullIds } },
                        { business_unit_id: null },
                    ];
                } else if (nonNullIds.length > 0) {
                    collectionAgentsWhere.business_unit_id = { in: nonNullIds };
                } else if (buIds.includes(null)) {
                    collectionAgentsWhere.business_unit_id = null;
                }
            }
        } else if (buFilter.business_unit_id !== undefined) {
            collectionAgentsWhere.business_unit_id = buFilter.business_unit_id;
        }
    }

    const collectionAgents = await prisma.user.findMany({
        where: collectionAgentsWhere,
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            first_name: true,
            last_name: true,
        },
    });

    // Filter out system and portal users (audit users)
    // System users: IDs start with "11111111-1111-1111-1111-"
    // Portal users: IDs start with "00000000-0000-0000-0000-"
    const filteredAgents = collectionAgents.filter(
        (agent) =>
            !agent.id.startsWith("11111111-1111-1111-1111-") &&
            !agent.id.startsWith("00000000-0000-0000-0000-")
    );

    let agentIds = filteredAgents.map((agent) => agent.id);

    // Filter by specific user if provided
    if (filter_by_user_id) {
        if (agentIds.includes(filter_by_user_id)) {
            agentIds = [filter_by_user_id];
        } else {
            // User not found in collection agents, return empty stats
            agentIds = [];
        }
    }

    // Filter collectionAgents to only include agents in agentIds
    const filteredCollectionAgents = filteredAgents.filter((agent) =>
        agentIds.includes(agent.id)
    );

    // Identify system and portal users
    const systemUserId = getSystemUserId(effectiveAccountId);
    const portalUserId = getPortalUserId(effectiveAccountId);

    // Prepare list of IDs to query
    // If we're filtering by a specific agent, we only look at that agent
    // If we're looking at "All Agents", we also include System and Portal users to get their stats
    let queryUserIds = [...agentIds];
    if (!filter_by_user_id) {
        queryUserIds.push(systemUserId, portalUserId);
    }

    if (agentIds.length === 0) {
        // Return empty stats if no agents
        const emptyStats: OperationDashboardResponse = {
            aggregate: {
                activities: {
                    manual: 0,
                    automated: 0,
                    byType: {
                        SMS: 0,
                        Email: 0,
                        Call: 0,
                        WhatsApp: 0,
                        Internal: 0,
                    },
                    delivered: 0,
                    failed: 0,
                    successRate: 0,
                },
                disputes: {
                    created: 0,
                    closed: 0,
                    open: 0,
                    averageResolutionDays: 0,
                },
                calls: {
                    total: 0,
                    successful: 0,
                    successRate: 0,
                    byOutcome: {},
                },
                promises: {
                    total: 0,
                    fulfilled: 0,
                    fulfillmentRate: 0,
                    totalAmount: 0,
                },
                productivity: {
                    averageActivitiesPerAgent: 0,
                    averageActivitiesPerDay: 0,
                    topPerformingAgent: null,
                },
                issues: {
                    undeliveredActivities: 0,
                    missingContacts: 0,
                    automationStuck: 0,
                    overdueFollowUps: 0,
                    invalidTemplates: 0,
                },
                userCounts: {
                    system: 0,
                    portal: 0,
                },
            },
            agents: [],
            currency,
            dateRange: {
                startDate: start.toISOString(),
                endDate: end.toISOString(),
            },
        };
        return emptyStats;
    }

    // Build date filter for activities
    const dateFilter = {
        created_at: {
            gte: start,
            lte: end,
        },
    };

    // Build activity filter with business unit support
    // Activities are linked to customers via customer_id, so we need to filter by customer's business unit
    // Note: Some activities may have created_by: null (e.g., system-generated or portal activities)
    // For now, we only include activities where created_by matches queryUserIds
    // TODO: Consider including null created_by activities if they're in the date range
    const activityWhere: any = {
        account_id,
        created_by: { in: queryUserIds },
        ...dateFilter,
    };

    // Apply business unit filter through customer relationship
    if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
        activityWhere.Customer = buFilter;
    }

    // Query activities created by collection agents
    const activities = await prisma.activity.findMany({
        where: activityWhere,
        select: {
            id: true,
            created_by: true,
            system_generated: true,
            type: true,
            status: true,
            actual_delivery_time: true,
            schedule_time: true,
            title: true,
        },
    });

    // Query disputes with business unit filter
    const disputesWhere: any = {
        Customer: {
            account_id,
            ...ownerFilter,
        },
        OR: [
            {
                created_by: { in: queryUserIds },
                OR: [
                    { created_at: { gte: start, lte: end } },
                    {
                        closed_at: { gte: start, lte: end },
                    },
                    {
                        OR: [
                            {
                                dispute_status: {
                                    notIn: ["Resolved", "Cancelled"],
                                },
                            },
                            { dispute_status: null },
                        ],
                    },
                ],
            },
            {
                owner_id: { in: queryUserIds },
                OR: [
                    { created_at: { gte: start, lte: end } },
                    {
                        closed_at: { gte: start, lte: end },
                    },
                    {
                        OR: [
                            {
                                dispute_status: {
                                    notIn: ["Resolved", "Cancelled"],
                                },
                            },
                            { dispute_status: null },
                        ],
                    },
                ],
            },
            // Include disputes CLOSED BY the agent (modified_by) even if created by someone else (e.g., Portal User)
            {
                modified_by: { in: queryUserIds },
                closed_at: { gte: start, lte: end },
                dispute_status: { in: ["Resolved", "Cancelled"] },
            },
        ],
    };

    // Apply business unit filter - merge with existing Customer filter
    if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
        disputesWhere.Customer = {
            ...disputesWhere.Customer,
            ...buFilter,
        };
    }

    const disputes = await prisma.customerDispute.findMany({
        where: disputesWhere,
        select: {
            id: true,
            created_by: true,
            modified_by: true,
            owner_id: true,
            dispute_status: true,
            created_at: true,
            modified_at: true,
            closed_at: true,
        },
    });

    // Query calls (activities with type = Call OR Promise_to_pay OR Dispute)
    // We use a separate query ensuring we match the logic of the details page exactly
    // filtering out redundant dispute updates and ensuring portal users are EXCLUDED
    // Strictly filtering Disputes to ONLY "Dispute Opened" as per user request
    const callsWhere: any = {
        account_id,
        created_by: { in: queryUserIds.filter((id) => id !== portalUserId && id !== systemUserId) }, // Exclude portal and system user
        ...dateFilter,
        OR: [
            // Include Call (covers outcomes like Schedule Follow-up) and Promise_to_pay
            { type: { in: ["Call", "Promise_to_pay"] } },
            {
                AND: [
                    { type: "Dispute" },
                    {
                        title: {
                            contains: "filed",
                            mode: "insensitive",
                        },
                    },
                ],
            },
        ],
    };

    // Apply business unit filter through customer relationship
    if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
        callsWhere.Customer = buFilter;
    }

    const calls = await prisma.activity.findMany({
        where: callsWhere,
        select: {
            id: true,
            created_by: true,
            type: true,
            status: true,
            call_outcome: true,
            actual_delivery_time: true,
            created_at: true,
            title: true, // Needed for filtering "updated" disputes below
        },
    });

    // Query promises to pay (collection periods with promise_to_pay_date)
    const promisesWhere: any = {
        Customer: {
            account_id,
            ...ownerFilter,
        },
    };

    // Apply business unit filter - merge with existing Customer filter
    if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
        promisesWhere.Customer = {
            ...promisesWhere.Customer,
            ...buFilter,
        };
    }

    const promises = await prisma.customerCollectionPeriod.findMany({
        where: {
            ...promisesWhere,
            promise_to_pay_amount: { not: null },
            Activity: {
                some: {
                    created_by: { in: agentIds },
                    type: "Promise_to_pay",
                    status: "COMPLETED",
                    created_at: {
                        gte: start,
                        lte: end,
                    },
                },
            },
        },
        select: {
            id: true,
            customer_id: true,
            promise_to_pay_date: true,
            promise_to_pay_amount: true,
            promise_to_pay_count: true,
            Activity: {
                where: {
                    created_by: { in: queryUserIds },
                    type: "Promise_to_pay",
                    status: "COMPLETED",
                    created_at: { gte: start, lte: end },
                },
                select: {
                    created_by: true,
                    created_at: true,
                },
                take: 1,
                orderBy: { created_at: "desc" },
            },
            Customer: {
                select: {
                    owner_id: true,
                },
            },
        },
    });

    // Check for fulfilled promises (collection periods that moved from Promise_to_pay to another category or had payments)
    const fulfilledPromisesWhere: any = {
        Customer: {
            account_id,
            ...ownerFilter,
        },
    };

    // Apply business unit filter - merge with existing Customer filter
    if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
        fulfilledPromisesWhere.Customer = {
            ...fulfilledPromisesWhere.Customer,
            ...buFilter,
        };
    }

    const fulfilledPromises = await prisma.customerCollectionPeriod.findMany({
        where: {
            ...fulfilledPromisesWhere,
            previous_category: "Promise_to_pay",
            current_category: { not: "Promise_to_pay" },
            modified_at: {
                gte: start,
                lte: end,
            },
        },
        select: {
            id: true,
            promise_to_pay_amount: true,
            modified_at: true,
        },
    });

    // Calculate control center issues
    const undeliveredActivities = activities.filter(
        (a) => a.status === "FAILED" || a.status === "BOUNCED"
    ).length;

    // Build missing contacts where clause with BU filter
    const baseMissingContactsWhere = getCustomersWithoutContactWhereClause({
        accountId: account_id,
        ownerFilter,
        collectionStatus: "Active",
    });

    // Apply business unit filter - merge with existing where clause using AND
    let missingContactsWhere: any =
        !isAdmin && buFilter && Object.keys(buFilter).length > 0
            ? {
                AND: [baseMissingContactsWhere, buFilter],
            }
            : baseMissingContactsWhere;

    // Filter by selected agent if provided - only show customers owned by the selected agent(s)
    if (filter_by_user_id && agentIds.length > 0) {
        missingContactsWhere = {
            ...missingContactsWhere,
            owner_id: { in: agentIds },
        };
    }

    const missingContactsCount = await prisma.customer.count({
        where: missingContactsWhere,
    });

    const automationStuckWhere: any = {
        Customer: {
            account_id,
            ...ownerFilter,
        },
    };

    // Apply business unit filter and agent filter - merge with existing Customer filter
    if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
        automationStuckWhere.Customer = {
            ...automationStuckWhere.Customer,
            ...buFilter,
        };
    }

    // Filter by selected agent if provided - only show customers owned by the selected agent(s)
    if (filter_by_user_id && agentIds.length > 0) {
        automationStuckWhere.Customer = {
            ...automationStuckWhere.Customer,
            owner_id: { in: agentIds },
        };
    }

    const automationStuckCount = await prisma.customer.count({
        where: {
            ...automationStuckWhere.Customer,
            automation_stuck_no_contacts: true,
        },
    });

    // Overdue follow-ups: activities scheduled in the past but not delivered
    const overdueFollowUpsWhere: any = {
        account_id,
        created_by: { in: queryUserIds },
        schedule_time: { lt: new Date() },
        status: { in: ["SCHEDULED", "SENT"] },
        actual_delivery_time: null,
    };

    // Apply business unit filter through customer relationship
    if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
        overdueFollowUpsWhere.Customer = buFilter;
    }

    const overdueFollowUps = await prisma.activity.count({
        where: overdueFollowUpsWhere,
    });

    // Group activities by agent
    const activitiesByAgent = new Map<string, typeof activities>();
    activities.forEach((activity) => {
        if (activity.created_by) {
            if (!activitiesByAgent.has(activity.created_by)) {
                activitiesByAgent.set(activity.created_by, []);
            }
            activitiesByAgent.get(activity.created_by)!.push(activity);
        }
    });

    // Group disputes by agent
    // For each dispute, we may need to attribute it to multiple agents:
    // - created_by: for "disputes created" stats
    // - modified_by: for "disputes closed" stats (if different from created_by)
    // - owner_id: for "disputes open/owned" stats
    const disputesByAgent = new Map<string, typeof disputes>();
    disputes.forEach((dispute) => {
        // Add to the agent who created it
        if (dispute.created_by && agentIds.includes(dispute.created_by)) {
            if (!disputesByAgent.has(dispute.created_by)) {
                disputesByAgent.set(dispute.created_by, []);
            }
            disputesByAgent.get(dispute.created_by)!.push(dispute);
        }

        // Add to the agent who owns it (if different from creator)
        if (dispute.owner_id && dispute.owner_id !== dispute.created_by && agentIds.includes(dispute.owner_id)) {
            if (!disputesByAgent.has(dispute.owner_id)) {
                disputesByAgent.set(dispute.owner_id, []);
            }
            disputesByAgent.get(dispute.owner_id)!.push(dispute);
        }

        // Add to the agent who CLOSED it (if different from creator and owner)
        // This ensures disputes closed by an agent are attributed to them
        if (dispute.modified_by &&
            dispute.modified_by !== dispute.created_by &&
            dispute.modified_by !== dispute.owner_id &&
            agentIds.includes(dispute.modified_by) &&
            (dispute.dispute_status === "Resolved" || dispute.dispute_status === "Cancelled")) {
            if (!disputesByAgent.has(dispute.modified_by)) {
                disputesByAgent.set(dispute.modified_by, []);
            }
            disputesByAgent.get(dispute.modified_by)!.push(dispute);
        }
    });

    // Group calls by agent
    const callsByAgent = new Map<string, typeof calls>();
    calls.forEach((call) => {
        if (call.created_by) {
            if (!callsByAgent.has(call.created_by)) {
                callsByAgent.set(call.created_by, []);
            }
            callsByAgent.get(call.created_by)!.push(call);
        }
    });

    // Group promises by agent (use activity created_by first, fall back to customer owner_id)
    // This ensures promises are attributed even when customer has no owner
    const promisesByAgent = new Map<string, typeof promises>();
    promises.forEach((promise) => {
        // Try to get agent from promise activity first, then customer owner
        const agentId = promise.Activity[0]?.created_by || promise.Customer?.owner_id;
        if (agentId && agentIds.includes(agentId)) {
            if (!promisesByAgent.has(agentId)) {
                promisesByAgent.set(agentId, []);
            }
            promisesByAgent.get(agentId)!.push(promise);
        }
    });

    // Calculate aggregate stats
    const manualActivities = activities.filter(
        (a) =>
            !a.system_generated &&
            a.created_by !== systemUserId &&
            a.created_by !== portalUserId
    );
    const automatedActivities = activities.filter(
        (a) => a.system_generated && a.created_by === systemUserId
    );
    const deliveredActivities = activities.filter(
        (a) => a.status === "DELIVERED" || a.status === "COMPLETED"
    );
    const failedActivities = activities.filter(
        (a) => a.status === "FAILED" || a.status === "BOUNCED"
    );

    const activityByType = {
        SMS: activities.filter(
            (a) => a.type === "SMS" && a.created_by !== portalUserId
        ).length,
        Email: activities.filter(
            (a) => a.type === "Email" && a.created_by !== portalUserId
        ).length,
        Call: activities.filter(
            (a) => a.type === "Call" && a.created_by !== portalUserId
        ).length,
        WhatsApp: activities.filter(
            (a) => a.type === "WhatsApp" && a.created_by !== portalUserId
        ).length,
        Internal: activities.filter(
            (a) => a.type === "Internal" && a.created_by !== portalUserId
        ).length,
    };

    const disputesCreated = disputes.filter(
        (d) =>
            d.created_at >= start &&
            d.created_at <= end &&
            d.created_by !== portalUserId &&
            d.created_by !== systemUserId
    );
    const disputesClosed = disputes.filter(
        (d: any) =>
            (d.dispute_status === "Resolved" ||
                d.dispute_status === "Cancelled") &&
            d.closed_at &&
            d.closed_at >= start &&
            d.closed_at <= end &&
            // Attribute to the agent who CLOSED the dispute, not who created it
            d.modified_by !== portalUserId &&
            d.modified_by !== systemUserId
    );
    const disputesOpen = disputes.filter(
        (d: any) =>
            d.dispute_status !== "Resolved" &&
            d.dispute_status !== "Cancelled" &&
            // Check created_at for open disputes to ensure they are relevant to the timeframe
            d.created_at <= end &&
            d.created_by !== portalUserId &&
            d.created_by !== systemUserId
    );

    // Calculate average dispute resolution time
    const resolvedDisputes = disputes.filter(
        (d: any) => d.dispute_status === "Resolved" && d.created_at && d.closed_at
    );
    const totalResolutionDays = resolvedDisputes.reduce((sum, d) => {
        const days = Math.floor(
            ((d as any).closed_at!.getTime() - d.created_at!.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return sum + (days > 0 ? days : 0);
    }, 0);
    const averageResolutionDays =
        resolvedDisputes.length > 0
            ? totalResolutionDays / resolvedDisputes.length
            : 0;

    // Filter out redundant dispute activities for calls count (status updates, resolution updates)
    // We only want to count meaningful interactions
    const filteredCalls = calls.filter((c) => {
        if (c.type === "Dispute") {
            const title = (c.title || "").toLowerCase();
            if (title.includes("updated")) {
                return false;
            }
        }
        return true;
    });

    // Calculate call stats - use filteredCalls instead of raw calls
    const successfulCalls = filteredCalls.filter((c) => {
        // Calls are successful if they have COMPLETED status
        // Note: Calls don't have DELIVERED status (that's for emails/SMS)
        return c.status === "COMPLETED";
    });

    // Filter out portal and system created promises for counts and amount
    const filteredPromises = promises; // Already filtered by agentIds and COMPLETED status in query


    const totalPromiseAmount = filteredPromises.reduce(
        (sum, p) => sum + (p.promise_to_pay_amount || 0),
        0
    );

    const daysInRange = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    // Filter activities to only include those by actual agents for productivity stats
    const agentActivities = activities.filter((a) =>
        a.created_by && agentIds.includes(a.created_by)
    );
    const totalActivities = activities.length;

    // Average activities per day (overall)
    const averageActivitiesPerDay =
        daysInRange > 0 ? totalActivities / daysInRange : 0;

    // Average activities per agent (only agents)
    const averageActivitiesPerAgent =
        agentIds.length > 0 ? agentActivities.length / agentIds.length : 0;

    // Find top performing agent (only from filtered agents)
    let topAgent: { userId: string; name: string; activities: number } | null =
        null;
    let maxActivities = 0;
    activitiesByAgent.forEach((agentActivities, agentId) => {
        // Only consider agents that are in the filtered list
        if (
            agentIds.includes(agentId) &&
            agentActivities.length > maxActivities
        ) {
            const agent = filteredCollectionAgents.find(
                (a) => a.id === agentId
            );
            if (agent) {
                maxActivities = agentActivities.length;
                topAgent = {
                    userId: agentId,
                    name:
                        agent.name ||
                        `${agent.first_name || ""} ${agent.last_name || ""}`.trim() ||
                        agent.email ||
                        "Unknown",
                    activities: agentActivities.length,
                };
            }
        }
    });

    // Build agent stats - only for filtered agents
    const agentStats: AgentOperationStats[] = filteredCollectionAgents.map(
        (agent) => {
            const agentActivities = activitiesByAgent.get(agent.id) || [];
            const agentDisputes = disputesByAgent.get(agent.id) || [];
            const agentCalls = callsByAgent.get(agent.id) || [];
            const agentPromises = promisesByAgent.get(agent.id) || [];

            const manual = agentActivities.filter(
                (a) => !a.system_generated
            ).length;
            const automated = agentActivities.filter(
                (a) => a.system_generated
            ).length;
            const delivered = agentActivities.filter(
                (a) => a.status === "DELIVERED" || a.status === "COMPLETED"
            ).length;
            const failed = agentActivities.filter(
                (a) => a.status === "FAILED" || a.status === "BOUNCED"
            ).length;

            const byType: Record<string, number> = {
                SMS: agentActivities.filter((a) => a.type === "SMS").length,
                Email: agentActivities.filter((a) => a.type === "Email").length,
                Call: agentActivities.filter((a) => a.type === "Call").length,
                WhatsApp: agentActivities.filter((a) => a.type === "WhatsApp")
                    .length,
                Internal: agentActivities.filter((a) => a.type === "Internal")
                    .length,
            };

            const disputesCreated = agentDisputes.filter(
                (d) =>
                    d.created_at >= start &&
                    d.created_at <= end &&
                    d.created_by === agent.id
            );
            // Count disputes closed BY this agent (not just owned by them)
            const disputesClosed = agentDisputes.filter(
                (d: any) =>
                    (d.dispute_status === "Resolved" ||
                        d.dispute_status === "Cancelled") &&
                    d.closed_at &&
                    d.closed_at >= start &&
                    d.closed_at <= end &&
                    d.modified_by === agent.id
            );
            const disputesOpen = agentDisputes.filter(
                (d) =>
                    d.dispute_status !== "Resolved" &&
                    d.dispute_status !== "Cancelled" &&
                    d.created_at >= start &&
                    d.created_at <= end
            );

            const successfulCalls = agentCalls.filter(
                (c) => c.status === "COMPLETED"
            );

            const callOutcomes: Record<string, number> = {};
            agentCalls.forEach((call) => {
                // Group by status for now, could be enhanced with call_outcome field
                const outcome = call.status;
                callOutcomes[outcome] = (callOutcomes[outcome] || 0) + 1;
            });

            const promisesFulfilled = agentPromises.filter((p) => {
                // Check if promise was fulfilled (moved out of Promise_to_pay category)
                return fulfilledPromises.some(
                    (fp) =>
                        fp.id === p.id &&
                        fp.modified_at >= start &&
                        fp.modified_at <= end
                );
            });

            const promiseAmount = agentPromises.reduce(
                (sum, p) => sum + (p.promise_to_pay_amount || 0),
                0
            );

            // Calculate agent-specific issues
            const agentUndelivered = agentActivities.filter(
                (a) => a.status === "FAILED" || a.status === "BOUNCED"
            ).length;

            const agentOverdueFollowUps = agentActivities.filter(
                (a) =>
                    a.schedule_time &&
                    new Date(a.schedule_time) < new Date() &&
                    (a.status === "SCHEDULED" || a.status === "SENT") &&
                    !a.actual_delivery_time
            ).length;

            // Calculate average dispute resolution days for this agent
            const agentResolvedDisputes = agentDisputes.filter(
                (d) =>
                    d.dispute_status === "Resolved" &&
                    d.created_at &&
                    d.closed_at
            );
            const agentResolutionDays = agentResolvedDisputes.reduce(
                (sum, d) => {
                    const days = Math.floor(
                        (d.closed_at!.getTime() - d.created_at!.getTime()) /
                        (1000 * 60 * 60 * 24)
                    );
                    return sum + days;
                },
                0
            );
            const averageDisputeResolutionDays =
                agentResolvedDisputes.length > 0
                    ? agentResolutionDays / agentResolvedDisputes.length
                    : 0;

            return {
                userId: agent.id,
                name:
                    agent.name ||
                    `${agent.first_name || ""} ${agent.last_name || ""}`.trim() ||
                    agent.email ||
                    "Unknown",
                email: agent.email || "",
                image: agent.image,
                activities: {
                    manual,
                    automated,
                    byType,
                    delivered,
                    failed,
                },
                disputes: {
                    created: disputesCreated.length,
                    closed: disputesClosed.length,
                    open: disputesOpen.length,
                },
                calls: {
                    total: agentCalls.length,
                    successful: successfulCalls.length,
                    byOutcome: callOutcomes,
                },
                promises: {
                    total: agentPromises.length,
                    fulfilled: promisesFulfilled.length,
                    totalAmount: promiseAmount,
                },
                productivity: {
                    activitiesPerDay:
                        daysInRange > 0
                            ? agentActivities.length / daysInRange
                            : 0,
                    averageDisputeResolutionDays,
                },
                issues: {
                    undeliveredActivities: agentUndelivered,
                    missingContacts: 0, // Would need to query per agent
                    automationStuck: 0, // Would need to query per agent
                    overdueFollowUps: agentOverdueFollowUps,
                },
            };
        }
    );

    // Build aggregate stats
    const aggregate: AggregateOperationStats = {
        activities: {
            manual: manualActivities.length,
            automated: automatedActivities.length,
            byType: activityByType,
            delivered: deliveredActivities.length,
            failed: failedActivities.length,
            successRate:
                activities.length > 0
                    ? (deliveredActivities.length / activities.length) * 100
                    : 0,
        },
        disputes: {
            created: disputesCreated.length,
            closed: disputesClosed.length,
            open: disputesOpen.length,
            averageResolutionDays,
        },
        calls: {
            total: calls.length,
            successful: successfulCalls.length,
            successRate:
                calls.length > 0
                    ? (successfulCalls.length / calls.length) * 100
                    : 0,
            byOutcome: {},
        },
        promises: {
            total: filteredPromises.length,
            fulfilled: fulfilledPromises.length,
            fulfillmentRate:
                filteredPromises.length > 0
                    ? (fulfilledPromises.length / filteredPromises.length) * 100
                    : 0,
            totalAmount: totalPromiseAmount,
        },
        productivity: {
            averageActivitiesPerAgent,
            averageActivitiesPerDay,
            topPerformingAgent: topAgent,
        },
        issues: {
            undeliveredActivities,
            missingContacts: missingContactsCount,
            automationStuck: automationStuckCount,
            overdueFollowUps,
            invalidTemplates: 0, // Would need additional query
        },
        userCounts: {
            system: activities.filter((a) => a.created_by === systemUserId).length,
            portal: activities.filter((a) => a.created_by === portalUserId).length,
        },
    };

    // Generate dispute trend data by date
    const disputeTrendByDate = new Map<
        string,
        { created: number; closed: number }
    >();

    // Initialize all dates in range with 0
    const currentDate = new Date(start);
    while (currentDate <= end) {
        const dateKey = currentDate.toISOString().split("T")[0];
        disputeTrendByDate.set(dateKey, { created: 0, closed: 0 });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Count disputes by date
    disputes.forEach((dispute: any) => {
        // Count created disputes if they were created within the date range
        if (dispute.created_at >= start && dispute.created_at <= end) {
            const dateKey = dispute.created_at.toISOString().split("T")[0];
            const existing = disputeTrendByDate.get(dateKey) || {
                created: 0,
                closed: 0,
            };
            existing.created++;
            disputeTrendByDate.set(dateKey, existing);
        }

        // Only count closed disputes if they were closed within the date range
        if (
            (dispute.dispute_status === "Resolved" ||
                dispute.dispute_status === "Cancelled") &&
            dispute.closed_at &&
            dispute.closed_at >= start &&
            dispute.closed_at <= end
        ) {
            const resolvedDate = dispute.closed_at
                .toISOString()
                .split("T")[0];
            const resolved = disputeTrendByDate.get(resolvedDate) || {
                created: 0,
                closed: 0,
            };
            resolved.closed++;
            disputeTrendByDate.set(resolvedDate, resolved);
        }
    });

    // Convert to arrays for chart
    const sortedDates = Array.from(disputeTrendByDate.keys()).sort();
    const disputeTrendData = {
        dates: sortedDates,
        created: sortedDates.map(
            (date) => disputeTrendByDate.get(date)?.created || 0
        ),
        closed: sortedDates.map(
            (date) => disputeTrendByDate.get(date)?.closed || 0
        ),
    };

    const result = {
        aggregate,
        agents: agentStats,
        currency,
        dateRange: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
        },
        disputeTrend: disputeTrendData,
    };

    return result;
};

export const getOperationDashboardDetails = async (params: {
    account_id: number;
    user_id: string;
    type: string;
    startDate?: Date;
    endDate?: Date;
    view_as_user_id?: string;
    view_as_user_role?: string;
    view_as_user_account_id?: number;
    business_unit_filter?: any;
    filter_by_user_id?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}) => {
    const {
        account_id,
        user_id,
        type,
        startDate,
        endDate,
        view_as_user_id,
        view_as_user_role,
        view_as_user_account_id,
        business_unit_filter: buFilter,
        filter_by_user_id,
        search,
        page = 1,
        limit = 20,
        sortBy,
        sortOrder = "asc",
    } = params;

    // Converted KPI drills use report execute; keep this API for orphan URL types only.
    if (isConvertedOperationDashboardDetailType(type)) {
        return { data: [], totalRecords: 0 };
    }

    const isAdmin = account_id === 10013;
    const effectiveAccountId = view_as_user_account_id || account_id;

    // Get owner filter
    const accessControl = AccessControlService.getInstance();
    const permissionService = await import(
        "@/server/services/PermissionService"
    ).then((m) => m.PermissionService.getInstance());
    const effectiveRole =
        view_as_user_role ||
        (
            await prisma.user.findUnique({
                where: { id: user_id },
                select: { role: true },
            })
        )?.role ||
        "Collection_Agent";
    const hasViewAsPermission = await permissionService.hasPermission(
        effectiveAccountId,
        effectiveRole,
        "use_view_as"
    );

    const ownerFilter = isAdmin
        ? {}
        : await accessControl.getOwnerFilter(
            user_id,
            hasViewAsPermission,
            view_as_user_id,
            view_as_user_role,
            view_as_user_account_id
        );

    // Get all users who create activities, filtered by business unit
    const collectionAgentsWhere: any = {
        account_id: effectiveAccountId,
        status: "Active",
        deactivated_at: null,
    };

    if (filter_by_user_id) {
        collectionAgentsWhere.id = filter_by_user_id;
    }

    // Apply business unit filter
    if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
        if (buFilter.business_unit_id) {
            const nonNullIds = Array.isArray(buFilter.business_unit_id.in)
                ? buFilter.business_unit_id.in.filter((id: any) => id !== null)
                : [];
            if (nonNullIds.length > 0) {
                collectionAgentsWhere.business_unit_id = { in: nonNullIds };
            } else {
                collectionAgentsWhere.business_unit_id = null;
            }
        }
    }

    const collectionAgents = await prisma.user.findMany({
        where: collectionAgentsWhere,
        select: {
            id: true,
            name: true,
            first_name: true,
            last_name: true,
            email: true,
            image: true,
        },
    });

    // Filter out system and portal users (audit users)
    const filteredAgents = collectionAgents.filter(
        (agent) =>
            !agent.id.startsWith("11111111-1111-1111-1111-") &&
            !agent.id.startsWith("00000000-0000-0000-0000-")
    );

    let agentIds = filteredAgents.map((agent) => agent.id);
    if (filter_by_user_id) {
        if (agentIds.includes(filter_by_user_id)) {
            agentIds = [filter_by_user_id];
        } else {
            agentIds = [];
        }
    }

    // Set date range
    const now = new Date();
    const start =
        startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let end = endDate || now;

    // Normalize end date to ensure we include all activities created on that day
    if (endDate) {
        const endDateHours = endDate.getUTCHours();
        const endDateMinutes = endDate.getUTCMinutes();
        const endDateSeconds = endDate.getUTCSeconds();
        const endDateMs = endDate.getUTCMilliseconds();

        // Check if end date is at start of day (00:00:00.000)
        const isStartOfDay =
            endDateHours === 0 &&
            endDateMinutes === 0 &&
            endDateSeconds === 0 &&
            endDateMs === 0;

        // Check if end date is at end of day (23:59:59.999 or close to it)
        // Also check for 21:59:59.999, 22:59:59.999 which are end of day in different timezones
        const isEndOfDay =
            (endDateHours === 23 &&
                endDateMinutes === 59 &&
                endDateSeconds === 59 &&
                endDateMs >= 999) ||
            (endDateHours >= 21 &&
                endDateMinutes === 59 &&
                endDateSeconds === 59 &&
                endDateMs >= 999);

        if (isStartOfDay) {
            // If end date is at start of day, set it to end of that day
            end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
        } else if (isEndOfDay) {
            // If end date is already at end of day (in any timezone), keep it as-is
            // Don't replace with current time - user explicitly selected end of day
            end = endDate;
        } else {
            // If end date is today but not at end of day, and it's before current time,
            // use current time to include newly created calls
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const endDateStartOfDay = new Date(endDate);
            endDateStartOfDay.setUTCHours(0, 0, 0, 0);

            if (
                endDateStartOfDay.getTime() === today.getTime() &&
                endDate < now
            ) {
                // End date is today but in the past, use current time
                end = now;
            }
            // Otherwise, keep the provided endDate as-is
        }
    }

    // Build date filter for activities
    const dateFilter = {
        created_at: {
            gte: start,
            lte: end,
        },
    };

    // Build search filter
    const searchFilter = search
        ? {
            OR: [
                {
                    Customer: {
                        Person: {
                            first_name: {
                                contains: search,
                                mode: "insensitive" as const,
                            },
                        },
                    },
                },
                {
                    Customer: {
                        Person: {
                            last_name: {
                                contains: search,
                                mode: "insensitive" as const,
                            },
                        },
                    },
                },
                {
                    Customer: {
                        Company: {
                            name: {
                                contains: search,
                                mode: "insensitive" as const,
                            },
                        },
                    },
                },
                {
                    Customer: {
                        customer_number: {
                            contains: search,
                            mode: "insensitive" as const,
                        },
                    },
                },
            ],
        }
        : {};

    // Map frontend field names to database fields for sorting
    // Note: Prisma doesn't support nested sorting, so for computed fields like customer_name,
    // we'll sort by customer_id or handle sorting in memory after fetching
    const getSortField = (
        field: string | undefined,
        sortOrderParam: "asc" | "desc",
        type: string
    ): any => {
        if (!field) return { created_at: "desc" };

        // Map frontend fields to database fields for sorting
        // Note: For computed fields like customer_name, we sort by customer_id
        // Prisma doesn't support nested sorting, so we use direct fields only
        const fieldMap: Record<string, Record<string, any>> = {
            "automated-activities": {
                customer_name: { customer_id: sortOrderParam },
                customer_number: { customer_id: sortOrderParam },
                agent_name: { created_by: sortOrderParam },
                type: { type: sortOrderParam },
                status: { status: sortOrderParam },
                created_at: { created_at: sortOrderParam },
            },
            "undelivered-activities": {
                customer_name: { customer_id: sortOrderParam },
                customer_number: { customer_id: sortOrderParam },
                agent_name: { created_by: sortOrderParam },
                type: { type: sortOrderParam },
                status: { status: sortOrderParam },
                created_at: { created_at: sortOrderParam },
            },
            "overdue-follow-ups": {
                customer_name: { customer_id: sortOrderParam },
                customer_number: { customer_id: sortOrderParam },
                agent_name: { created_by: sortOrderParam },
                type: { type: sortOrderParam },
                status: { status: sortOrderParam },
                schedule_time: { schedule_time: sortOrderParam },
                created_at: { created_at: sortOrderParam },
            },
            "open-disputes": {
                customer_name: { customer_id: sortOrderParam },
                customer_number: { customer_id: sortOrderParam },
                agent_name: { created_by: sortOrderParam },
                dispute_status: { dispute_status: sortOrderParam },
                created_at: { created_at: sortOrderParam },
            },
            "missing-contacts": {
                customer_name: { id: sortOrderParam }, // Sort by customer id
                customer_number: { customer_number: sortOrderParam },
            },
            "automation-stuck": {
                customer_name: { customer_id: sortOrderParam },
                customer_number: { customer_id: sortOrderParam },
                created_at: { created_at: sortOrderParam },
            },
        };

        const typeMap = fieldMap[type];
        if (typeMap && typeMap[field]) {
            return typeMap[field];
        }

        // Default: try to use the field directly, or fall back to created_at
        try {
            return { [field]: sortOrderParam };
        } catch {
            return { created_at: "desc" };
        }
    };

    // Build sort order
    const orderBy = getSortField(sortBy, sortOrder, type);

    // Identify system and portal users
    const systemUserId = getSystemUserId(effectiveAccountId);
    const portalUserId = getPortalUserId(effectiveAccountId);

    // If no specific user is selected, we should include system and portal users in the query
    // This matches the logic in calculateOperationDashboardStats where they are added to queryUserIds
    if (!filter_by_user_id) {
        agentIds.push(systemUserId, portalUserId);
    }

    let data: any[] = [];
    let totalRecords = 0;

    switch (type) {
        case "automated-activities": {
            const activityWhere: any = {
                account_id,
                created_by: {
                    in: agentIds.filter((id) => id === systemUserId),
                },
                system_generated: true,
                ...dateFilter,
            };

            // Build search conditions for activities
            const activitySearchConditions: any[] = search
                ? [
                    {
                        Customer: {
                            Person: {
                                first_name: {
                                    contains: search,
                                    mode: "insensitive" as const,
                                },
                            },
                        },
                    },
                    {
                        Customer: {
                            Person: {
                                last_name: {
                                    contains: search,
                                    mode: "insensitive" as const,
                                },
                            },
                        },
                    },
                    {
                        Customer: {
                            Company: {
                                name: {
                                    contains: search,
                                    mode: "insensitive" as const,
                                },
                            },
                        },
                    },
                    {
                        Customer: {
                            customer_number: {
                                contains: search,
                                mode: "insensitive" as const,
                            },
                        },
                    },
                ]
                : [];

            // Handle search filter and buFilter together
            if (
                search &&
                !isAdmin &&
                buFilter &&
                Object.keys(buFilter).length > 0
            ) {
                // When both search and buFilter exist, we need to combine them properly
                // buFilter has structure: { OR: [{ business_unit_id: ... }, ...] }
                // We need to ensure each search condition also satisfies the business unit filter
                // Build OR conditions where each combines buFilter with a search condition
                const buConditions = buFilter.OR || [];

                // Create combinations: each buFilter condition AND each search condition
                const combinedConditions: any[] = [];
                buConditions.forEach((buCondition: any) => {
                    activitySearchConditions.forEach((searchCondition: any) => {
                        combinedConditions.push({
                            Customer: {
                                AND: [
                                    buCondition,
                                    ...(searchCondition.Customer
                                        ? [searchCondition.Customer]
                                        : []),
                                ],
                            },
                        });
                    });
                });

                activityWhere.OR = combinedConditions;
            } else if (search) {
                // Only search filter
                activityWhere.OR = activitySearchConditions;
            } else if (
                !isAdmin &&
                buFilter &&
                Object.keys(buFilter).length > 0
            ) {
                // Only buFilter
                activityWhere.Customer = buFilter;
            }

            totalRecords = await prisma.activity.count({
                where: activityWhere,
            });

            const activities = await prisma.activity.findMany({
                where: activityWhere,
                skip: (page - 1) * limit,
                take: limit,
                orderBy,
                include: {
                    Customer: {
                        include: {
                            Person: {
                                select: { first_name: true, last_name: true },
                            },
                            Company: { select: { name: true } },
                        },
                    },
                    User_Activity_created_byToUser: {
                        select: {
                            name: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                        },
                    },
                },
            });

            data = activities.map((activity) => ({
                id: activity.id.toString(),
                customer_id: activity.customer_id,
                customer_name: activity.Customer?.Person
                    ? `${activity.Customer.Person.first_name || ""} ${activity.Customer.Person.last_name || ""}`.trim()
                    : activity.Customer?.Company?.name ||
                    `Customer ${activity.customer_id}`,
                customer_number: activity.Customer?.customer_number || "",
                agent_name:
                    activity.User_Activity_created_byToUser?.name ||
                    `${activity.User_Activity_created_byToUser?.first_name || ""} ${activity.User_Activity_created_byToUser?.last_name || ""}`.trim() ||
                    activity.User_Activity_created_byToUser?.email ||
                    "Unknown",
                title: activity.title || "",
                title_params: formatParams(activity.title_params),
                type: formatText(activity.type),
                status: formatText(activity.status),
                created_at: activity.created_at,
            }));
            break;
        }

        case "open-disputes": {
            const disputesWhere: any = {
                Customer: {
                    account_id,
                    ...ownerFilter,
                },
                OR: [
                    { created_by: { notIn: [portalUserId, systemUserId] } },
                    { created_by: null },
                ], // Exclude portal and system created items but allow null
                AND: [
                    {
                        OR: [
                            { created_by: { in: agentIds } },
                            { owner_id: { in: agentIds } },
                        ],
                    },
                    {
                        OR: [
                            {
                                dispute_status: {
                                    notIn: ["Resolved", "Cancelled"],
                                },
                            },
                            { dispute_status: null },
                        ],
                    },
                ],
                created_at: {
                    lte: end,
                },
                ...searchFilter,
            };
            if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
                disputesWhere.Customer = {
                    ...disputesWhere.Customer,
                    ...buFilter,
                };
            }

            totalRecords = await prisma.customerDispute.count({
                where: disputesWhere,
            });

            const disputes = await prisma.customerDispute.findMany({
                where: disputesWhere,
                skip: (page - 1) * limit,
                take: limit,
                orderBy,
                include: {
                    Customer: {
                        include: {
                            Person: {
                                select: { first_name: true, last_name: true },
                            },
                            Company: { select: { name: true } },
                        },
                    },
                    User_CustomerDispute_created_byToUser: {
                        select: {
                            name: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                        },
                    },
                    User_CustomerDispute_owner_idToUser: {
                        select: {
                            name: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                        },
                    },
                    DisputeReason: {
                        select: { name: true },
                    },
                },
            });

            data = disputes.map((dispute) => ({
                id: dispute.id,
                customer_id: dispute.customer_id,
                customer_name: dispute.Customer?.Person
                    ? `${dispute.Customer.Person.first_name || ""} ${dispute.Customer.Person.last_name || ""}`.trim()
                    : dispute.Customer?.Company?.name ||
                    `Customer ${dispute.customer_id}`,
                customer_number: dispute.Customer?.customer_number || "",
                agent_name:
                    (dispute.User_CustomerDispute_owner_idToUser?.name ||
                        `${dispute.User_CustomerDispute_owner_idToUser?.first_name || ""} ${dispute.User_CustomerDispute_owner_idToUser?.last_name || ""}`.trim() ||
                        dispute.User_CustomerDispute_owner_idToUser?.email) ||
                    (dispute.User_CustomerDispute_created_byToUser?.name ||
                        `${dispute.User_CustomerDispute_created_byToUser?.first_name || ""} ${dispute.User_CustomerDispute_created_byToUser?.last_name || ""}`.trim() ||
                        dispute.User_CustomerDispute_created_byToUser?.email) ||
                    "Unknown",
                dispute_status: formatText(dispute.dispute_status),
                dispute_reason: formatText(dispute.DisputeReason?.name),
                dispute_resolution: formatText(dispute.dispute_resolution),
                created_at: dispute.created_at,
            }));
            break;
        }

        case "undelivered-activities": {
            const activityWhere: any = {
                account_id,
                created_by: { in: agentIds },
                status: { in: ["FAILED", "BOUNCED"] },
                ...dateFilter,
                ...searchFilter,
            };
            if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
                activityWhere.Customer = buFilter;
            }

            totalRecords = await prisma.activity.count({
                where: activityWhere,
            });

            const activities = await prisma.activity.findMany({
                where: activityWhere,
                skip: (page - 1) * limit,
                take: limit,
                orderBy,
                include: {
                    Customer: {
                        include: {
                            Person: {
                                select: { first_name: true, last_name: true },
                            },
                            Company: { select: { name: true } },
                        },
                    },
                    User_Activity_created_byToUser: {
                        select: {
                            name: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                        },
                    },
                },
            });

            data = activities.map((activity) => ({
                id: activity.id.toString(),
                customer_id: activity.customer_id,
                customer_name: activity.Customer?.Person
                    ? `${activity.Customer.Person.first_name || ""} ${activity.Customer.Person.last_name || ""}`.trim()
                    : activity.Customer?.Company?.name ||
                    `Customer ${activity.customer_id}`,
                customer_number: activity.Customer?.customer_number || "",
                agent_name:
                    activity.User_Activity_created_byToUser?.name ||
                    `${activity.User_Activity_created_byToUser?.first_name || ""} ${activity.User_Activity_created_byToUser?.last_name || ""}`.trim() ||
                    activity.User_Activity_created_byToUser?.email ||
                    "Unknown",
                title: activity.title || "",
                title_params: formatParams(activity.title_params),
                type: formatText(activity.type),
                status: formatText(activity.status),
                created_at: activity.created_at,
            }));
            break;
        }

        case "missing-contacts": {
            // Build base where clause with owner filter
            const baseMissingContactsWhere =
                getCustomersWithoutContactWhereClause({
                    accountId: account_id,
                    ownerFilter,
                    collectionStatus: "Active",
                });

            // Apply business unit filter - merge with existing where clause using AND
            const missingContactsWhere: any =
                !isAdmin && buFilter && Object.keys(buFilter).length > 0
                    ? {
                        AND: [baseMissingContactsWhere, buFilter],
                    }
                    : baseMissingContactsWhere;
            if (agentIds.length > 0) {
                missingContactsWhere.owner_id = { in: agentIds };
            }
            if (search) {
                missingContactsWhere.OR = [
                    {
                        Person: {
                            first_name: {
                                contains: search,
                                mode: "insensitive" as const,
                            },
                        },
                    },
                    {
                        Person: {
                            last_name: {
                                contains: search,
                                mode: "insensitive" as const,
                            },
                        },
                    },
                    {
                        Company: {
                            name: {
                                contains: search,
                                mode: "insensitive" as const,
                            },
                        },
                    },
                    {
                        customer_number: {
                            contains: search,
                            mode: "insensitive" as const,
                        },
                    },
                ];
            }

            totalRecords = await prisma.customer.count({
                where: missingContactsWhere,
            });

            const customers = await prisma.customer.findMany({
                where: missingContactsWhere,
                skip: (page - 1) * limit,
                take: limit,
                orderBy,
                include: {
                    Person: { select: { first_name: true, last_name: true } },
                    Company: { select: { name: true } },
                },
            });

            data = customers.map((customer) => ({
                id: customer.id,
                customer_id: customer.id,
                customer_name: customer.Person
                    ? `${customer.Person.first_name || ""} ${customer.Person.last_name || ""}`.trim()
                    : customer.Company?.name || `Customer ${customer.id}`,
                customer_number: customer.customer_number || "",
            }));
            break;
        }

        case "automation-stuck": {
            const automationStuckWhere: any = {
                account_id,
                ...ownerFilter,
                automation_stuck_no_contacts: true,
                ...searchFilter,
                ...(!isAdmin && buFilter && Object.keys(buFilter).length > 0 ? buFilter : {}),
            };
            if (agentIds.length > 0) {
                automationStuckWhere.owner_id = { in: agentIds };
            }

            totalRecords = await prisma.customer.count({
                where: automationStuckWhere,
            });

            const customers = await prisma.customer.findMany({
                where: automationStuckWhere,
                skip: (page - 1) * limit,
                take: limit,
                orderBy,
                include: {
                    Person: {
                        select: { first_name: true, last_name: true },
                    },
                    Company: { select: { name: true } },
                },
            });

            data = customers.map((customer) => ({
                id: customer.id,
                customer_id: customer.id,
                customer_name: customer.Person
                    ? `${customer.Person.first_name || ""} ${customer.Person.last_name || ""}`.trim()
                    : customer.Company?.name ||
                    `Customer ${customer.id}`,
                customer_number: customer.customer_number || "",
            }));
            break;
        }

        case "overdue-follow-ups": {
            const activityWhere: any = {
                account_id,
                created_by: { in: agentIds },
                ...dateFilter,
                schedule_time: { lt: new Date() },
                status: { in: ["SCHEDULED", "SENT"] },
                actual_delivery_time: null,
                ...searchFilter,
            };
            if (!isAdmin && buFilter && Object.keys(buFilter).length > 0) {
                activityWhere.Customer = buFilter;
            }

            totalRecords = await prisma.activity.count({
                where: activityWhere,
            });

            const activities = await prisma.activity.findMany({
                where: activityWhere,
                skip: (page - 1) * limit,
                take: limit,
                orderBy,
                include: {
                    Customer: {
                        include: {
                            Person: {
                                select: { first_name: true, last_name: true },
                            },
                            Company: { select: { name: true } },
                        },
                    },
                    User_Activity_created_byToUser: {
                        select: {
                            name: true,
                            first_name: true,
                            last_name: true,
                            email: true,
                        },
                    },
                },
            });

            data = activities.map((activity) => ({
                id: activity.id.toString(),
                customer_id: activity.customer_id,
                customer_name: activity.Customer?.Person
                    ? `${activity.Customer.Person.first_name || ""} ${activity.Customer.Person.last_name || ""}`.trim()
                    : activity.Customer?.Company?.name ||
                    `Customer ${activity.customer_id}`,
                customer_number: activity.Customer?.customer_number || "",
                agent_name:
                    activity.User_Activity_created_byToUser?.name ||
                    `${activity.User_Activity_created_byToUser?.first_name || ""} ${activity.User_Activity_created_byToUser?.last_name || ""}`.trim() ||
                    activity.User_Activity_created_byToUser?.email ||
                    "Unknown",
                title: activity.title || "",
                title_params: activity.title_params,
                type: activity.type,
                status: activity.status,
                created_at: activity.created_at,
            }));
            break;
        }

    }

    return { data, totalRecords };
};
