import { prisma } from "@/lib/prisma";
import { record_status } from "@prisma/client";

import {
    TOPUP_PARENT_SYNC_ACTOR,
    effectivelyActivePrismaWhere,
    isPrimaryPolicyAssignable,
    isPrimaryPolicyEffectivelyActive,
    primaryEffectivelyActivePrismaWhere,
    startOfTodayUtc,
} from "@/shared/creditInsurance/insurancePolicyLifecycle";

import { insurancePolicyAssignedToLiveCustomersFilter } from "./creditInsurance/customerPolicyQueryHelpers";

/** Prisma client typings include InsurancePolicy after `npx prisma generate`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdb = prisma as any;

export class InsurancePolicyService {
    static async assertAccountHasCreditInsurance(accountId: number): Promise<void> {
        const a = await pdb.account.findUnique({
            where: { id: accountId },
            select: { has_credit_insurance: true },
        });
        if (!a?.has_credit_insurance) {
            throw new Error("Credit insurance is not enabled for this account");
        }
    }

    /** TopUp policies must reference an assignable Primary parent in the same account. */
    static async assertTopUpParentPolicy(
        accountId: number,
        parentPolicyId: number,
        todayUtc: Date = startOfTodayUtc()
    ): Promise<void> {
        const parent = await pdb.insurancePolicy.findFirst({
            where: { id: parentPolicyId, account_id: accountId },
            select: {
                status: true,
                policy_kind: true,
                start_date: true,
                end_date: true,
            },
        });
        if (!parent) {
            throw new Error("Parent insurance policy not found");
        }
        if (parent.policy_kind !== "Primary") {
            throw new Error("Parent policy must be a Primary policy");
        }
        if (
            !isPrimaryPolicyAssignable({
                status: parent.status,
                startDate: parent.start_date,
                endDate: parent.end_date,
                todayUtc,
            })
        ) {
            throw new Error(
                "Parent policy must be Active and within its policy term"
            );
        }
    }

    static async findAssignablePrimaryPolicy(
        accountId: number,
        policyId: number,
        todayUtc: Date = startOfTodayUtc()
    ) {
        const policy = await pdb.insurancePolicy.findFirst({
            where: {
                id: policyId,
                account_id: accountId,
                ...primaryEffectivelyActivePrismaWhere(todayUtc),
            },
            select: {
                id: true,
                status: true,
                policy_kind: true,
                start_date: true,
                end_date: true,
            },
        });
        if (
            !policy ||
            !isPrimaryPolicyAssignable({
                status: policy.status,
                startDate: policy.start_date,
                endDate: policy.end_date,
                todayUtc,
            })
        ) {
            return null;
        }
        return policy;
    }

    /** Resolve assignable Primary policy by policy_number (rejects TopUp / inactive / out of term). */
    static async findAssignablePrimaryPolicyByNumber(
        accountId: number,
        policyNumber: string,
        todayUtc: Date = startOfTodayUtc()
    ) {
        const trimmed = policyNumber.trim();
        if (!trimmed) {
            return null;
        }
        const policy = await pdb.insurancePolicy.findFirst({
            where: {
                account_id: accountId,
                policy_number: trimmed,
            },
            select: { id: true },
        });
        if (!policy) {
            return null;
        }
        return this.findAssignablePrimaryPolicy(
            accountId,
            policy.id,
            todayUtc
        );
    }

    static async listAssignablePrimaryPolicies(
        accountId: number,
        todayUtc: Date = startOfTodayUtc()
    ) {
        return pdb.insurancePolicy.findMany({
            where: {
                account_id: accountId,
                ...primaryEffectivelyActivePrismaWhere(todayUtc),
            },
            select: {
                id: true,
                policy_number: true,
                status: true,
                policy_kind: true,
                start_date: true,
                end_date: true,
            },
            orderBy: { id: "asc" },
        });
    }

    /** Sync child TopUp policies when a Primary parent status/dates change. */
    static async syncChildTopUpPoliciesWithParent(
        parentPolicyId: number,
        accountId: number,
        todayUtc: Date = startOfTodayUtc()
    ): Promise<{ deactivated: number; activated: number }> {
        const parent = await pdb.insurancePolicy.findFirst({
            where: {
                id: parentPolicyId,
                account_id: accountId,
                policy_kind: "Primary",
            },
            select: { status: true, start_date: true, end_date: true },
        });
        if (!parent) {
            return { deactivated: 0, activated: 0 };
        }

        const effectivelyActive = isPrimaryPolicyEffectivelyActive({
            status: parent.status,
            startDate: parent.start_date,
            endDate: parent.end_date,
            todayUtc,
        });

        if (effectivelyActive) {
            const activated = await pdb.insurancePolicy.updateMany({
                where: {
                    account_id: accountId,
                    policy_kind: "TopUp",
                    parent_insurance_policy_id: parentPolicyId,
                    status: "Inactive",
                    modified_by: TOPUP_PARENT_SYNC_ACTOR,
                },
                data: {
                    status: "Active",
                    modified_by: TOPUP_PARENT_SYNC_ACTOR,
                },
            });
            return { deactivated: 0, activated: activated.count };
        }

        const deactivated = await pdb.insurancePolicy.updateMany({
            where: {
                account_id: accountId,
                policy_kind: "TopUp",
                parent_insurance_policy_id: parentPolicyId,
                status: "Active",
            },
            data: {
                status: "Inactive",
                modified_by: TOPUP_PARENT_SYNC_ACTOR,
            },
        });
        return { deactivated: deactivated.count, activated: 0 };
    }

    static async listPolicies(args: {
        accountId: number;
        status?: (typeof record_status)[keyof typeof record_status];
        assignableOnly?: boolean;
        effectivelyActiveOnly?: boolean;
        /**
         * When true, only policies with at least one Active/Inactive customer whose
         * {@link Customer.policy_id} points at the policy (credit dashboard scope).
         */
        assignedOnly?: boolean;
    }) {
        const todayUtc = startOfTodayUtc();
        const effectiveFilter = args.assignableOnly
            ? primaryEffectivelyActivePrismaWhere(todayUtc)
            : args.effectivelyActiveOnly
              ? effectivelyActivePrismaWhere(todayUtc)
              : {};
        return pdb.insurancePolicy.findMany({
            where: {
                account_id: args.accountId,
                ...(args.status && !args.assignableOnly && !args.effectivelyActiveOnly
                    ? { status: args.status }
                    : {}),
                ...effectiveFilter,
                ...(args.assignedOnly
                    ? {
                          ...insurancePolicyAssignedToLiveCustomersFilter(
                              args.accountId
                          ),
                          policy_kind: "Primary",
                      }
                    : {}),
            },
            orderBy: { policy_number: "asc" },
            include: {
                InsurancePolicyCountry: {
                    include: { Country: { select: { id: true, name: true, iso2: true } } },
                },
                NamedPolicy: true,
            },
        });
    }

    /** Paginated list for EndlessScrollDataGrid (search, sort, skip/take). */
    static async listPoliciesPaged(args: {
        accountId: number;
        status?: (typeof record_status)[keyof typeof record_status];
        assignableOnly?: boolean;
        effectivelyActiveOnly?: boolean;
        search?: string;
        sortField?: string;
        sortDirection?: "asc" | "desc";
        skip: number;
        take: number;
    }): Promise<{ policies: unknown[]; total: number }> {
        const todayUtc = startOfTodayUtc();
        const dir: "asc" | "desc" =
            args.sortDirection === "desc" ? "desc" : "asc";
        const allowed = new Set([
            "id",
            "policy_number",
            "policy_kind",
            "start_date",
            "end_date",
            "status",
            "currency",
            "max_payment_term",
            "max_allowed_mep",
            "reporting_days",
            "cost_calculation_method",
            "cost_percent",
        ]);
        const field = allowed.has(args.sortField || "")
            ? (args.sortField as string)
            : "policy_number";
        const orderBy = { [field]: dir };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            account_id: args.accountId,
        };
        if (args.assignableOnly) {
            Object.assign(where, primaryEffectivelyActivePrismaWhere(todayUtc));
        } else if (args.effectivelyActiveOnly) {
            Object.assign(where, effectivelyActivePrismaWhere(todayUtc));
        } else if (args.status) {
            where.status = args.status;
        }
        const q = args.search?.trim();
        if (q) {
            where.OR = [
                { policy_number: { contains: q, mode: "insensitive" } },
                { currency: { contains: q, mode: "insensitive" } },
            ];
        }

        const include = {
            InsurancePolicyCountry: {
                include: {
                    Country: { select: { id: true, name: true, iso2: true } },
                },
            },
            ParentInsurancePolicy: {
                select: {
                    id: true,
                    policy_number: true,
                    insurer_name: true,
                    status: true,
                    start_date: true,
                    end_date: true,
                },
            },
        };

        const [policies, total] = await Promise.all([
            pdb.insurancePolicy.findMany({
                where,
                orderBy,
                skip: args.skip,
                take: args.take,
                include,
            }),
            pdb.insurancePolicy.count({ where }),
        ]);

        return { policies, total };
    }

    static async getPolicyById(policyId: number, accountId: number) {
        return pdb.insurancePolicy.findFirst({
            where: { id: policyId, account_id: accountId },
            include: {
                InsurancePolicyCountry: {
                    include: { Country: { select: { id: true, name: true, iso2: true } } },
                },
                NamedPolicy: true,
                ParentInsurancePolicy: {
                    select: {
                        id: true,
                        policy_number: true,
                        insurer_name: true,
                        status: true,
                        start_date: true,
                        end_date: true,
                    },
                },
            },
        });
    }

    /**
     * Resolve credit-insurance field defaults when assigning a policy to a customer.
     * Precedence: NamedPolicy row matching customer_number or customer_number_policy,
     * else InsurancePolicyCountry for the customer's country, else policy-level scalars.
     *
     * When `namedMatchByPolicyCustomerNumberOnly` is true (Limit type "Named" flow), the
     * NamedPolicy row is resolved by **Policy Customer Number** first; if that is empty or
     * there is no row, the main **Customer Number** is tried (same as the default flow),
     * so prefill (including `limit_expiration_date` → `approved_limit_expiration_date`) still
     * works when the policy customer field is not filled yet. If no row matches, returns
     * `{ source: "no_named_match" }`.
     */
    static async getCustomerPrefillForEdit(args: {
        policyId: number;
        accountId: number;
        countryId: number | null;
        customerNumber: string | null | undefined;
        customerNumberPolicy: string | null | undefined;
        namedMatchByPolicyCustomerNumberOnly?: boolean;
    }): Promise<
        | {
            source: "named" | "country" | "policy";
            limit_type: "Named" | "DCL";
            max_payment_term: number | null;
            max_allowed_mep: number | null;
            reporting_days: number | null;
            mep_cutoff_day_of_month: number | null;
            mep_substitute_day_of_month: number | null;
            reporting_cutoff_day_of_month: number | null;
            reporting_substitute_day_of_month: number | null;
            payment_term_cutoff_day_of_month: number | null;
            payment_term_substitute_day_of_month: number | null;
            approved_limit: unknown;
            approved_limit_expiration_date?: Date | null;
            customer_number_policy?: string | null;
            credit_score: unknown;
        }
        | { source: "no_named_match" }
        | null
    > {
        const policy = await pdb.insurancePolicy.findFirst({
            where: { id: args.policyId, account_id: args.accountId },
            select: {
                max_payment_term: true,
                max_allowed_mep: true,
                reporting_days: true,
                mep_cutoff_day_of_month: true,
                mep_substitute_day_of_month: true,
                reporting_cutoff_day_of_month: true,
                reporting_substitute_day_of_month: true,
                payment_term_cutoff_day_of_month: true,
                payment_term_substitute_day_of_month: true,
                min_credit_score: true,
                max_dcl: true,
            },
        });
        if (!policy) {
            return null;
        }

        const norm = (s: string | null | undefined) => {
            const t = s?.trim();
            return t ? t : null;
        };
        const cn = norm(args.customerNumber);
        const cnp = norm(args.customerNumberPolicy);
        const namedOnlyByPolicyNumber = Boolean(
            args.namedMatchByPolicyCustomerNumberOnly
        );

        let countryRow: {
            payment_term_cap: number | null;
            country_mep: number | null;
            reporting_days: number | null;
            country_max_limit: unknown;
        } | null = null;
        if (args.countryId) {
            countryRow = await pdb.insurancePolicyCountry.findFirst({
                where: {
                    insurance_policy_id: args.policyId,
                    country_id: args.countryId,
                },
                select: {
                    payment_term_cap: true,
                    country_mep: true,
                    reporting_days: true,
                    country_max_limit: true,
                },
            });
        }

        let named: {
            customer_number: string;
            max_payment_term: number | null;
            customer_mep: number | null;
            reporting_days: number | null;
            customer_max_limit: unknown;
            limit_expiration_date: Date | null;
        } | null = null;

        if (namedOnlyByPolicyNumber) {
            // Prefer Policy Customer Number; if empty or no row, fall back to main Customer Number
            // so Named rows still prefill (including limit_expiration_date) before the policy field is filled.
            if (cnp) {
                named = await pdb.namedPolicy.findFirst({
                    where: {
                        insurance_policy_id: args.policyId,
                        customer_number: cnp,
                    },
                    select: {
                        customer_number: true,
                        max_payment_term: true,
                        customer_mep: true,
                        reporting_days: true,
                        customer_max_limit: true,
                        limit_expiration_date: true,
                    },
                });
            }
            if (!named && cn) {
                named = await pdb.namedPolicy.findFirst({
                    where: {
                        insurance_policy_id: args.policyId,
                        customer_number: cn,
                    },
                    select: {
                        customer_number: true,
                        max_payment_term: true,
                        customer_mep: true,
                        reporting_days: true,
                        customer_max_limit: true,
                        limit_expiration_date: true,
                    },
                });
            }
            if (!named) {
                return { source: "no_named_match" };
            }
        } else {
            if (cn) {
                named = await pdb.namedPolicy.findFirst({
                    where: {
                        insurance_policy_id: args.policyId,
                        customer_number: cn,
                    },
                    select: {
                        customer_number: true,
                        max_payment_term: true,
                        customer_mep: true,
                        reporting_days: true,
                        customer_max_limit: true,
                        limit_expiration_date: true,
                    },
                });
            }
            if (!named && cnp) {
                named = await pdb.namedPolicy.findFirst({
                    where: {
                        insurance_policy_id: args.policyId,
                        customer_number: cnp,
                    },
                    select: {
                        customer_number: true,
                        max_payment_term: true,
                        customer_mep: true,
                        reporting_days: true,
                        customer_max_limit: true,
                        limit_expiration_date: true,
                    },
                });
            }
        }

        if (named) {
            const max_payment_term =
                named.max_payment_term ??
                countryRow?.payment_term_cap ??
                policy.max_payment_term;
            const max_allowed_mep =
                named.customer_mep ??
                countryRow?.country_mep ??
                policy.max_allowed_mep;
            const reporting_days =
                named.reporting_days ??
                countryRow?.reporting_days ??
                policy.reporting_days;
            let approved_limit: unknown = named.customer_max_limit;
            if (approved_limit == null && countryRow) {
                approved_limit = countryRow.country_max_limit;
            }
            if (approved_limit == null) {
                approved_limit = policy.max_dcl;
            }
            return {
                source: "named",
                limit_type: "Named",
                max_payment_term,
                max_allowed_mep,
                reporting_days,
                mep_cutoff_day_of_month: policy.mep_cutoff_day_of_month,
                mep_substitute_day_of_month: policy.mep_substitute_day_of_month,
                reporting_cutoff_day_of_month: policy.reporting_cutoff_day_of_month,
                reporting_substitute_day_of_month:
                    policy.reporting_substitute_day_of_month,
                payment_term_cutoff_day_of_month:
                    policy.payment_term_cutoff_day_of_month,
                payment_term_substitute_day_of_month:
                    policy.payment_term_substitute_day_of_month,
                approved_limit,
                approved_limit_expiration_date: named.limit_expiration_date ?? null,
                customer_number_policy: named.customer_number,
                credit_score: policy.min_credit_score,
            };
        }

        if (countryRow) {
            return {
                source: "country",
                limit_type: "DCL",
                max_payment_term:
                    countryRow.payment_term_cap ?? policy.max_payment_term,
                max_allowed_mep: countryRow.country_mep ?? policy.max_allowed_mep,
                reporting_days:
                    countryRow.reporting_days ?? policy.reporting_days,
                mep_cutoff_day_of_month: policy.mep_cutoff_day_of_month,
                mep_substitute_day_of_month: policy.mep_substitute_day_of_month,
                reporting_cutoff_day_of_month: policy.reporting_cutoff_day_of_month,
                reporting_substitute_day_of_month:
                    policy.reporting_substitute_day_of_month,
                payment_term_cutoff_day_of_month:
                    policy.payment_term_cutoff_day_of_month,
                payment_term_substitute_day_of_month:
                    policy.payment_term_substitute_day_of_month,
                approved_limit:
                    countryRow.country_max_limit ?? policy.max_dcl,
                credit_score: policy.min_credit_score,
            };
        }

        return {
            source: "policy",
            limit_type: "DCL",
            max_payment_term: policy.max_payment_term,
            max_allowed_mep: policy.max_allowed_mep,
            reporting_days: policy.reporting_days,
            mep_cutoff_day_of_month: policy.mep_cutoff_day_of_month,
            mep_substitute_day_of_month: policy.mep_substitute_day_of_month,
            reporting_cutoff_day_of_month: policy.reporting_cutoff_day_of_month,
            reporting_substitute_day_of_month:
                policy.reporting_substitute_day_of_month,
            payment_term_cutoff_day_of_month:
                policy.payment_term_cutoff_day_of_month,
            payment_term_substitute_day_of_month:
                policy.payment_term_substitute_day_of_month,
            approved_limit: policy.max_dcl,
            credit_score: policy.min_credit_score,
        };
    }

    static async createPolicy(
        data: Record<string, unknown>,
        accountId: number,
        userId: string
    ) {
        await this.assertAccountHasCreditInsurance(accountId);
        return pdb.insurancePolicy.create({
            data: {
                ...data,
                account_id: accountId,
                created_by: userId,
                modified_by: userId,
            },
            include: {
                InsurancePolicyCountry: true,
                NamedPolicy: true,
            },
        });
    }

    static async updatePolicy(
        policyId: number,
        accountId: number,
        data: Record<string, unknown>,
        userId: string
    ) {
        await this.assertAccountHasCreditInsurance(accountId);
        const existing = await pdb.insurancePolicy.findFirst({
            where: { id: policyId, account_id: accountId },
        });
        if (!existing) {
            return null;
        }
        return pdb.insurancePolicy.update({
            where: { id: policyId },
            data: {
                ...data,
                modified_by: userId,
            },
            include: {
                InsurancePolicyCountry: {
                    include: { Country: { select: { id: true, name: true, iso2: true } } },
                },
                NamedPolicy: true,
            },
        });
    }

    static async deletePolicy(policyId: number, accountId: number): Promise<boolean> {
        await this.assertAccountHasCreditInsurance(accountId);
        const existing = await pdb.insurancePolicy.findFirst({
            where: { id: policyId, account_id: accountId },
        });
        if (!existing) {
            return false;
        }
        const linked = await pdb.customerPolicy.count({
            where: {
                insurance_policy_id: policyId,
                is_active: true,
                Customer: { account_id: accountId },
            },
        });
        if (linked > 0) {
            throw new Error(
                "Cannot delete policy while customers are assigned on an active CustomerPolicy row"
            );
        }
        await pdb.insurancePolicy.delete({ where: { id: policyId } });
        return true;
    }

    static async upsertCountryRow(args: {
        policyId: number;
        accountId: number;
        countryId: number;
        data: Record<string, unknown>;
        userId: string;
    }) {
        await this.assertAccountHasCreditInsurance(args.accountId);
        const policy = await pdb.insurancePolicy.findFirst({
            where: { id: args.policyId, account_id: args.accountId },
        });
        if (!policy) {
            throw new Error("Policy not found");
        }

        const existing = await pdb.insurancePolicyCountry.findFirst({
            where: {
                insurance_policy_id: args.policyId,
                country_id: args.countryId,
            },
        });

        const baseData = {
            payment_term_cap: args.data.payment_term_cap ?? null,
            country_mep: args.data.country_mep ?? null,
            reporting_days: args.data.reporting_days ?? null,
            country_max_limit: args.data.country_max_limit ?? null,
        };

        if (existing) {
            return pdb.insurancePolicyCountry.update({
                where: { id: existing.id },
                data: {
                    ...baseData,
                    modified_by: args.userId,
                },
            });
        }

        return pdb.insurancePolicyCountry.create({
            data: {
                insurance_policy_id: args.policyId,
                country_id: args.countryId,
                ...baseData,
                created_by: args.userId,
                modified_by: args.userId,
            },
        });
    }

    static async deleteCountryRow(
        countryRowId: string,
        accountId: number
    ): Promise<boolean> {
        await this.assertAccountHasCreditInsurance(accountId);
        const row = await pdb.insurancePolicyCountry.findFirst({
            where: { id: countryRowId },
            include: { InsurancePolicy: { select: { account_id: true } } },
        });
        if (!row || row.InsurancePolicy.account_id !== accountId) {
            return false;
        }
        await pdb.insurancePolicyCountry.delete({ where: { id: countryRowId } });
        return true;
    }

    static async createNamedPolicyRow(args: {
        policyId: number;
        accountId: number;
        data: {
            customer_number: string;
            max_payment_term: number | null;
            customer_mep: number | null;
            reporting_days: number | null;
            customer_max_limit: unknown;
            limit_expiration_date?: Date | null;
        };
        userId: string;
    }) {
        await this.assertAccountHasCreditInsurance(args.accountId);
        const policy = await pdb.insurancePolicy.findFirst({
            where: { id: args.policyId, account_id: args.accountId },
        });
        if (!policy) {
            throw new Error("Policy not found");
        }

        const dup = await pdb.namedPolicy.findFirst({
            where: {
                insurance_policy_id: args.policyId,
                customer_number: args.data.customer_number,
            },
        });
        if (dup) {
            throw new Error("NAMED_POLICY_CUSTOMER_NUMBER_EXISTS");
        }

        return pdb.namedPolicy.create({
            data: {
                insurance_policy_id: args.policyId,
                customer_number: args.data.customer_number,
                max_payment_term: args.data.max_payment_term ?? null,
                customer_mep: args.data.customer_mep ?? null,
                reporting_days: args.data.reporting_days ?? null,
                customer_max_limit: args.data.customer_max_limit ?? null,
                limit_expiration_date: args.data.limit_expiration_date ?? null,
                created_by: args.userId,
                modified_by: args.userId,
            },
        });
    }

    static async updateNamedPolicyRow(args: {
        namedPolicyId: number;
        accountId: number;
        data: {
            customer_number: string;
            max_payment_term: number | null;
            customer_mep: number | null;
            reporting_days: number | null;
            customer_max_limit: unknown;
            limit_expiration_date?: Date | null;
        };
        userId: string;
    }) {
        await this.assertAccountHasCreditInsurance(args.accountId);
        const existing = await pdb.namedPolicy.findFirst({
            where: { id: args.namedPolicyId },
            include: { InsurancePolicy: { select: { account_id: true } } },
        });
        if (!existing || existing.InsurancePolicy.account_id !== args.accountId) {
            return null;
        }

        const conflict = await pdb.namedPolicy.findFirst({
            where: {
                insurance_policy_id: existing.insurance_policy_id,
                customer_number: args.data.customer_number,
                NOT: { id: args.namedPolicyId },
            },
        });
        if (conflict) {
            throw new Error("NAMED_POLICY_CUSTOMER_NUMBER_EXISTS");
        }

        return pdb.namedPolicy.update({
            where: { id: args.namedPolicyId },
            data: {
                customer_number: args.data.customer_number,
                max_payment_term: args.data.max_payment_term ?? null,
                customer_mep: args.data.customer_mep ?? null,
                reporting_days: args.data.reporting_days ?? null,
                customer_max_limit: args.data.customer_max_limit ?? null,
                limit_expiration_date: args.data.limit_expiration_date ?? null,
                modified_by: args.userId,
            },
        });
    }

    static async deleteNamedPolicyRow(
        namedPolicyId: number,
        accountId: number
    ): Promise<boolean> {
        await this.assertAccountHasCreditInsurance(accountId);
        const row = await pdb.namedPolicy.findFirst({
            where: { id: namedPolicyId },
            include: { InsurancePolicy: { select: { account_id: true } } },
        });
        if (!row || row.InsurancePolicy.account_id !== accountId) {
            return false;
        }
        await pdb.namedPolicy.delete({ where: { id: namedPolicyId } });
        return true;
    }
}
