import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
    isTopUpInsurancePolicyEffectivelyActive,
    startOfTodayUtc,
} from "@/shared/creditInsurance/insurancePolicyLifecycle";

import { enqueueAsOfRewrite } from "./asOfRewriteQueue";
import { syncCreditInsuranceGapPipelineForCustomer } from "./syncCreditInsuranceGapPipeline";

type TopUpInsurancePolicyRow = {
    id: number;
    policy_kind: string;
    status: string;
    allow_concurrent_top_ups: boolean;
    parent_insurance_policy_id: number | null;
    currency: string | null;
    account_id: number;
    ParentInsurancePolicy: {
        id: number;
        status: string;
        start_date: Date;
        end_date: Date;
    } | null;
};

type CreateTopUpInput = {
    customerId: number;
    insurancePolicyId: number;
    topUpType: "Fixed" | "Percentage";
    topUpValue: Prisma.Decimal;
    currency?: string | null;
    startDate: Date;
    endDate: Date;
    notes?: string | null;
    userId?: string | null;
    premium?: Prisma.Decimal | null;
    premiumCurrency?: string | null;
};

type UpdateTopUpInput = Partial<CreateTopUpInput> & {
    cancelledAt?: Date | null;
};

export class CustomerTopUpService {
    private static assertTopUpInsurancePolicyEffectivelyActive(
        insurancePolicy: TopUpInsurancePolicyRow,
        todayUtc: Date = startOfTodayUtc()
    ): void {
        if (insurancePolicy.policy_kind !== "TopUp") {
            throw new Error("Top-up must reference a TopUp-kind insurance policy");
        }
        const parent = insurancePolicy.ParentInsurancePolicy;
        if (
            !isTopUpInsurancePolicyEffectivelyActive({
                topUpStatus: insurancePolicy.status,
                parentPolicyId: insurancePolicy.parent_insurance_policy_id,
                parentStatus: parent?.status,
                parentStartDate: parent?.start_date,
                parentEndDate: parent?.end_date,
                todayUtc,
            })
        ) {
            throw new Error(
                "Top-up insurance policy must be effectively active (Active with an assignable parent policy)"
            );
        }
    }

    private static async assertCustomerMatchesTopUpParent(
        customerId: number,
        parentInsurancePolicyId: number
    ): Promise<void> {
        const activeCp = await prisma.customerPolicy.findFirst({
            where: {
                customer_id: customerId,
                is_active: true,
                insurance_policy_id: parentInsurancePolicyId,
            },
            select: { id: true },
        });
        if (!activeCp) {
            throw new Error(
                "Customer's active primary policy does not match the top-up policy's parent"
            );
        }
    }

    static async validateCanCreate(accountId: number): Promise<void> {
        const policy = await prisma.insurancePolicy.findFirst({
            where: { account_id: accountId, policy_kind: "TopUp" },
        });
        if (!policy) {
            throw new Error("Account has no TopUp policies configured");
        }
    }

    static async create(input: CreateTopUpInput): Promise<{ id: number }> {
        const { customerId, insurancePolicyId, startDate, endDate, userId } = input;

        const insurancePolicy = await prisma.insurancePolicy.findUnique({
            where: { id: insurancePolicyId },
            select: {
                id: true,
                policy_kind: true,
                status: true,
                allow_concurrent_top_ups: true,
                parent_insurance_policy_id: true,
                currency: true,
                account_id: true,
                ParentInsurancePolicy: {
                    select: {
                        id: true,
                        status: true,
                        start_date: true,
                        end_date: true,
                    },
                },
            },
        });

        if (!insurancePolicy) {
            throw new Error("Insurance policy not found");
        }

        this.assertTopUpInsurancePolicyEffectivelyActive(
            insurancePolicy as TopUpInsurancePolicyRow
        );

        if (!input.topUpValue || new Prisma.Decimal(input.topUpValue).lte(0)) {
            throw new Error("Top-up value must be positive");
        }

        if (endDate < startDate) {
            throw new Error("end_date must be >= start_date");
        }

        // Validate value bounds
        if (input.topUpType === "Percentage") {
            if (new Prisma.Decimal(input.topUpValue).gt(1000)) {
                throw new Error("Percentage top-up value must be <= 1000");
            }
            if (input.currency) {
                throw new Error("Percentage top-ups must not have a currency set");
            }

            const activeCp = await prisma.customerPolicy.findFirst({
                where: { customer_id: customerId, is_active: true, approved_limit: { not: null } },
                select: { id: true },
            });
            if (!activeCp) {
                throw new Error("Cannot create percentage top-up: customer has no active primary policy with approved limit");
            }
        } else {
            // Fixed
            const currency = input.currency || insurancePolicy.currency;
            if (!currency) {
                throw new Error("Fixed top-up requires a currency");
            }
        }

        if (insurancePolicy.parent_insurance_policy_id) {
            await this.assertCustomerMatchesTopUpParent(
                customerId,
                insurancePolicy.parent_insurance_policy_id
            );
        }

        // Concurrent overlap check
        if (!insurancePolicy.allow_concurrent_top_ups) {
            const overlap = await prisma.customerTopUp.findFirst({
                where: {
                    customer_id: customerId,
                    insurance_policy_id: insurancePolicyId,
                    cancelled_at: null,
                    start_date: { lte: endDate },
                    end_date: { gte: startDate },
                },
                select: { id: true },
            });
            if (overlap) {
                throw new Error(
                    "Overlapping active top-up exists and concurrent top-ups are not allowed for this policy"
                );
            }
        }

        const created = await prisma.customerTopUp.create({
            data: {
                customer_id: customerId,
                insurance_policy_id: insurancePolicyId,
                top_up_type: input.topUpType,
                top_up_value: input.topUpValue,
                currency: input.topUpType === "Percentage" ? null : (input.currency || insurancePolicy.currency || null),
                start_date: startDate,
                end_date: endDate,
                notes: input.notes ?? null,
                premium: input.premium ?? null,
                premium_currency: input.premiumCurrency ?? null,
                created_by: userId ?? null,
                modified_by: userId ?? null,
            },
            select: { id: true },
        });

        await this.triggerGapRecompute(customerId);

        // Late-entered cover must appear on the past days it spans:
        // rewrite from the top-up start through today.
        await enqueueAsOfRewrite({
            accountId: insurancePolicy.account_id,
            customerIds: [customerId],
            fromDate: startDate,
            toDate: startOfTodayUtc(),
        }).catch(() => {});

        return created;
    }

    static async update(
        topUpId: number,
        input: UpdateTopUpInput,
        userId?: string | null,
    ): Promise<{ id: number } | null> {
        const existing = await prisma.customerTopUp.findUnique({
            where: { id: topUpId },
            include: {
                InsurancePolicy: {
                    select: {
                        id: true,
                        policy_kind: true,
                        status: true,
                        allow_concurrent_top_ups: true,
                        parent_insurance_policy_id: true,
                        currency: true,
                        account_id: true,
                        ParentInsurancePolicy: {
                            select: {
                                id: true,
                                status: true,
                                start_date: true,
                                end_date: true,
                            },
                        },
                    },
                },
            },
        });

        if (!existing || existing.InsurancePolicy.policy_kind !== "TopUp") {
            return null;
        }

        const willBeCancelled =
            input.cancelledAt !== undefined
                ? input.cancelledAt != null
                : existing.cancelled_at != null;

        if (!willBeCancelled) {
            this.assertTopUpInsurancePolicyEffectivelyActive(
                existing.InsurancePolicy as TopUpInsurancePolicyRow
            );
            if (existing.InsurancePolicy.parent_insurance_policy_id) {
                await this.assertCustomerMatchesTopUpParent(
                    existing.customer_id,
                    existing.InsurancePolicy.parent_insurance_policy_id
                );
            }
        }

        const data: Record<string, unknown> = {
            modified_by: userId ?? null,
        };

        if (input.topUpType !== undefined) data.top_up_type = input.topUpType;
        if (input.topUpValue !== undefined) data.top_up_value = input.topUpValue;
        if (input.currency !== undefined) {
            data.currency = input.topUpType === "Percentage" ? null : (input.currency || null);
        }
        if (input.startDate !== undefined) data.start_date = input.startDate;
        if (input.endDate !== undefined) data.end_date = input.endDate;
        if (input.notes !== undefined) data.notes = input.notes;
        if (input.cancelledAt !== undefined) data.cancelled_at = input.cancelledAt;
        if (input.premium !== undefined) data.premium = input.premium;
        if (input.premiumCurrency !== undefined) data.premium_currency = input.premiumCurrency;

        const updated = await prisma.customerTopUp.update({
            where: { id: topUpId },
            data,
            select: { id: true },
        });

        await this.triggerGapRecompute(existing.customer_id);

        // Rewrite from the earliest of the previous and new start so both the days
        // it used to span and the days it now spans recompute.
        const previousStart = existing.start_date;
        const nextStart = input.startDate ?? existing.start_date;
        const fromDate = nextStart < previousStart ? nextStart : previousStart;
        await enqueueAsOfRewrite({
            accountId: existing.InsurancePolicy.account_id,
            customerIds: [existing.customer_id],
            fromDate,
            toDate: startOfTodayUtc(),
        }).catch(() => {});

        return updated;
    }

    static async cancel(topUpId: number, userId?: string | null): Promise<boolean> {
        const existing = await prisma.customerTopUp.findUnique({
            where: { id: topUpId },
            select: {
                id: true,
                customer_id: true,
                start_date: true,
                InsurancePolicy: { select: { account_id: true } },
            },
        });
        if (!existing) {
            return false;
        }

        await prisma.customerTopUp.update({
            where: { id: topUpId },
            data: { cancelled_at: new Date(), modified_by: userId ?? null },
        });

        await this.triggerGapRecompute(existing.customer_id);

        // Cancelling clears the top-up from every day it spanned under current
        // cancelled_at rules: rewrite from its start through today.
        await enqueueAsOfRewrite({
            accountId: existing.InsurancePolicy.account_id,
            customerIds: [existing.customer_id],
            fromDate: existing.start_date,
            toDate: startOfTodayUtc(),
        }).catch(() => {});

        return true;
    }

    static async listForCustomer(
        customerId: number,
    ): Promise<
        Array<{
            id: number;
            topUpType: "Fixed" | "Percentage";
            topUpValue: Prisma.Decimal;
            currency: string | null;
            startDate: Date;
            endDate: Date;
            notes: string | null;
            cancelledAt: Date | null;
            isActive: boolean;
            insurancePolicyId: number;
            policyNumber: string;
            insurerName: string | null;
            allowConcurrentTopUps: boolean;
            parentPrimaryPolicyId: number | null;
            premium: Prisma.Decimal | null;
            premiumCurrency: string | null;
        }>
    > {
        const rows = await prisma.customerTopUp.findMany({
            where: { customer_id: customerId },
            orderBy: { start_date: "desc" },
            select: {
                id: true,
                top_up_type: true,
                top_up_value: true,
                currency: true,
                start_date: true,
                end_date: true,
                notes: true,
                cancelled_at: true,
                premium: true,
                premium_currency: true,
                InsurancePolicy: {
                    select: {
                        id: true,
                        policy_number: true,
                        insurer_name: true,
                        allow_concurrent_top_ups: true,
                        parent_insurance_policy_id: true,
                    },
                },
            },
        });

        const now = new Date();

        return rows.map((r) => ({
            id: r.id,
            topUpType: r.top_up_type as "Fixed" | "Percentage",
            topUpValue: r.top_up_value,
            currency: r.currency,
            startDate: r.start_date,
            endDate: r.end_date,
            notes: r.notes,
            cancelledAt: r.cancelled_at,
            isActive: !r.cancelled_at && now >= r.start_date && now <= r.end_date,
            insurancePolicyId: r.InsurancePolicy.id,
            policyNumber: r.InsurancePolicy.policy_number,
            insurerName: r.InsurancePolicy.insurer_name,
            allowConcurrentTopUps: r.InsurancePolicy.allow_concurrent_top_ups,
            parentPrimaryPolicyId: r.InsurancePolicy.parent_insurance_policy_id,
            premium: r.premium,
            premiumCurrency: r.premium_currency,
        }));
    }

    static async listForCustomerPaginated(
        customerId: number,
        page: number,
        limit: number,
        query: string,
        sortField: string,
        sortDirection: string,
    ): Promise<{
        data: Array<{
            id: number;
            top_up_type: "Fixed" | "Percentage";
            top_up_value: Prisma.Decimal;
            currency: string | null;
            start_date: Date;
            end_date: Date;
            notes: string | null;
            cancelled_at: Date | null;
            insurance_policy_id: number;
            premium: Prisma.Decimal | null;
            premium_currency: string | null;
            InsurancePolicy: {
                policy_number: string;
                insurer_name: string | null;
            } | null;
        }>;
        totalRecords: number;
    }> {
        const where: any = { customer_id: customerId };

        if (query) {
            where.OR = [
                { notes: { contains: query } },
                { InsurancePolicy: { policy_number: { contains: query } } },
            ];
        }

        const allowedSortFields = ["start_date", "end_date", "top_up_value", "cancelled_at"];
        const field = allowedSortFields.includes(sortField) ? sortField : "start_date";
        const dir = sortDirection === "asc" ? "asc" : "desc";

        const skip = (page - 1) * limit;

        const [rows, totalRecords] = await Promise.all([
            prisma.customerTopUp.findMany({
                where,
                orderBy: { [field]: dir },
                skip,
                take: limit,
                select: {
                    id: true,
                    top_up_type: true,
                    top_up_value: true,
                    currency: true,
                    start_date: true,
                    end_date: true,
                    notes: true,
                    cancelled_at: true,
                    insurance_policy_id: true,
                    premium: true,
                    premium_currency: true,
                    InsurancePolicy: {
                        select: {
                            policy_number: true,
                            insurer_name: true,
                        },
                    },
                },
            }),
            prisma.customerTopUp.count({ where }),
        ]);

        return { data: rows as any, totalRecords };
    }

    private static async triggerGapRecompute(customerId: number): Promise<void> {
        await syncCreditInsuranceGapPipelineForCustomer(customerId).catch(
            () => {}
        );
        try {
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                select: { account_id: true },
            });
            if (customer?.account_id != null) {
                const { invalidateDashboardCacheForAccount } = await import(
                    "@/server/utils/cacheInvalidationHelper"
                );
                await invalidateDashboardCacheForAccount(customer.account_id);
            }
        } catch {
            // Non-fatal
        }
    }
}
