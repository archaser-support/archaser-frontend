import type { NamedPolicy, Prisma } from "@prisma/client";

import { type DbClient, prisma } from "@/lib/prisma";
import { getCustomerDisplayName } from "@/utils/customerDisplayName";
import { InsurancePolicyService } from "@/server/services/InsurancePolicyService";

import { CustomerPolicyService } from "./CustomerPolicyService";
import {
    emptyEffectiveCustomerPolicyFields,
    mapCustomerPolicyRow,
    type CustomerPolicyWriteInput,
} from "./customerPolicyTypes";
import {
    customerPolicyToNamedMasterFields,
    namedMasterToCustomerPolicyPatch,
    namedPolicyCustomerNumberMatchesAssignment,
} from "./namedMasterToCustomerPolicyPatch";
import { getActiveCustomerPolicyRow } from "./resolveActiveCustomerPolicy";
import { freezeCustomerPolicyGapOnDeactivation } from "./syncCustomerPolicyGapAmounts";
import { syncCreditInsuranceGapPipelineForCustomer } from "./syncCreditInsuranceGapPipeline";
import { syncCustomerInsuranceFields } from "./syncCustomerInsuranceFields";

export type NamedPolicyMasterInput = {
    customer_number: string;
    max_payment_term: number | null;
    customer_mep: number | null;
    reporting_days: number | null;
    customer_max_limit: unknown;
    limit_expiration_date?: Date | null;
};

export type CreateNamedPolicyWithAssignmentArgs = {
    policyId: number;
    accountId: number;
    userId: string;
    data: NamedPolicyMasterInput;
};

export type UpdateNamedPolicyWithSyncArgs = {
    namedPolicyId: number;
    accountId: number;
    userId: string;
    data: NamedPolicyMasterInput;
};

export type DeleteNamedPolicyWithDeactivationArgs = {
    namedPolicyId: number;
    accountId: number;
    userId: string;
};

export type NamedPolicyGridRow = NamedPolicy & {
    customer_name: string;
    customer_id: number | null;
};

export type NamedPolicyAssignmentResult =
    | { success: true; namedPolicy: NamedPolicy; customerId: number }
    | { success: false; errorCode: string; message: string };

export type NamedPolicyDeactivationResult =
    | { success: true; customerId: number | null }
    | { success: false; errorCode: string; message: string };

async function runPostAssignmentSync(
    customerId: number,
    refreshTermsBreachFlags = false
): Promise<void> {
    try {
        await syncCustomerInsuranceFields(customerId, {
            refreshTermsBreachFlags,
        });
    } catch (syncErr) {
        console.error(
            "[NamedPolicyAssignment] syncCustomerInsuranceFields failed:",
            syncErr
        );
    }

    try {
        await syncCreditInsuranceGapPipelineForCustomer(customerId, {
            skipPolicyAggregate: false,
        });
    } catch (syncErr) {
        console.error(
            "[NamedPolicyAssignment] syncCreditInsuranceGapPipelineForCustomer failed:",
            syncErr
        );
    }
}

function buildNamedPolicyRowData(
    policyId: number,
    customerNumber: string,
    data: NamedPolicyMasterInput,
    userId: string
) {
    return {
        insurance_policy_id: policyId,
        customer_number: customerNumber,
        max_payment_term: data.max_payment_term ?? null,
        customer_mep: data.customer_mep ?? null,
        reporting_days: data.reporting_days ?? null,
        customer_max_limit: (data.customer_max_limit ?? null) as
            | Prisma.Decimal
            | string
            | number
            | null,
        limit_expiration_date: data.limit_expiration_date ?? null,
        created_by: userId,
        modified_by: userId,
    };
}

function buildDclToNamedConversionPatch(
    master: NamedPolicyMasterFields,
    policyMinCreditScore: Prisma.Decimal | null
): CustomerPolicyWriteInput & {
    credit_score?: unknown;
    zero_limit_date: null;
} {
    return {
        ...namedMasterToCustomerPolicyPatch(master),
        credit_score: policyMinCreditScore,
        zero_limit_date: null,
    };
}

type NamedPolicyMasterFields = {
    customer_number: string;
    customer_max_limit: unknown;
    limit_expiration_date?: Date | null;
    max_payment_term: number | null;
    customer_mep: number | null;
    reporting_days: number | null;
};

async function applyAssignmentAfterMasterCreate(args: {
    dbClient: DbClient;
    policyId: number;
    accountId: number;
    userId: string;
    customer: {
        id: number;
        country_id: number | null;
        customer_number: string | null;
    };
    masterFields: NamedPolicyMasterFields;
    activePolicy: Awaited<ReturnType<typeof getActiveCustomerPolicyRow>>;
    policyMinCreditScore: Prisma.Decimal | null;
}): Promise<boolean> {
    const masterPatch = namedMasterToCustomerPolicyPatch(args.masterFields);
    const patchArgs = {
        customerId: args.customer.id,
        accountId: args.accountId,
        countryId: args.customer.country_id,
        customerNumber: args.customer.customer_number,
        modifiedBy: args.userId,
        dbClient: args.dbClient,
        existingCountryId: args.customer.country_id,
    };

    if (!args.activePolicy) {
        const policyResult = await CustomerPolicyService.applyActivePolicyPatch({
            ...patchArgs,
            patch: { policy_id: args.policyId, ...masterPatch },
            existing: emptyEffectiveCustomerPolicyFields(),
        });
        if (policyResult.error) {
            throw new Error(policyResult.error);
        }
        return policyResult.refreshTermsBreachFlags === true;
    }

    if (
        args.activePolicy.insurance_policy_id === args.policyId &&
        args.activePolicy.limit_type === "DCL"
    ) {
        const policyResult = await CustomerPolicyService.applyActivePolicyPatch({
            ...patchArgs,
            patch: buildDclToNamedConversionPatch(
                args.masterFields,
                args.policyMinCreditScore
            ),
            existing: mapCustomerPolicyRow(args.activePolicy),
        });
        if (policyResult.error) {
            throw new Error(policyResult.error);
        }
        return policyResult.refreshTermsBreachFlags === true;
    }

    if (args.activePolicy.insurance_policy_id === args.policyId) {
        const policyResult = await CustomerPolicyService.applyActivePolicyPatch({
            ...patchArgs,
            patch: masterPatch,
            existing: mapCustomerPolicyRow(args.activePolicy),
        });
        if (policyResult.error) {
            throw new Error(policyResult.error);
        }
        return policyResult.refreshTermsBreachFlags === true;
    }

    const wasExcludedBeforeSwitch =
        args.activePolicy.excluded_from_policy === true ||
        (args.activePolicy.policy_exclusion_reason != null &&
            args.activePolicy.policy_exclusion_reason !== "");
    const switchResult = await CustomerPolicyService.switchActivePolicy({
        customerId: args.customer.id,
        accountId: args.accountId,
        newInsurancePolicyId: args.policyId,
        countryId: args.customer.country_id,
        customerNumber: args.customer.customer_number,
        customerNumberPolicy: args.masterFields.customer_number,
        limitType: "Named",
        modifiedBy: args.userId,
        dbClient: args.dbClient,
    });
    if (switchResult.error) {
        throw new Error(switchResult.error);
    }

    const activeAfterSwitch = await getActiveCustomerPolicyRow(
        args.customer.id,
        args.dbClient
    );
    const policyResult = await CustomerPolicyService.applyActivePolicyPatch({
        ...patchArgs,
        patch: masterPatch,
        existing: activeAfterSwitch
            ? mapCustomerPolicyRow(activeAfterSwitch)
            : emptyEffectiveCustomerPolicyFields(),
    });
    if (policyResult.error) {
        throw new Error(policyResult.error);
    }
    return (
        wasExcludedBeforeSwitch || policyResult.refreshTermsBreachFlags === true
    );
}

function mapAssignmentError(err: unknown): NamedPolicyAssignmentResult {
    if (
        err instanceof Error &&
        err.message === "NAMED_POLICY_CUSTOMER_NUMBER_EXISTS"
    ) {
        return {
            success: false,
            errorCode: "named_policy_customer_number_exists",
            message: "A row for this customer number already exists",
        };
    }

    if (err instanceof Error) {
        return {
            success: false,
            errorCode: "policy_write_failed",
            message: err.message,
        };
    }

    return {
        success: false,
        errorCode: "policy_write_failed",
        message: "Named policy assignment failed",
    };
}

type ActiveNamedAssignmentRow = {
    customer_number_policy: string | null;
    approved_limit: unknown;
    approved_limit_expiration_date: Date | null;
    max_payment_term: number | null;
    max_allowed_mep: number | null;
    reporting_days: number | null;
    Customer: {
        id: number;
        customer_number: string | null;
        Person: {
            first_name: string | null;
            last_name: string | null;
        } | null;
        Company: { name: string | null } | null;
    };
};

async function loadActiveNamedAssignments(
    policyId: number,
    accountId: number,
    dbClient: DbClient
): Promise<ActiveNamedAssignmentRow[]> {
    return dbClient.customerPolicy.findMany({
        where: {
            insurance_policy_id: policyId,
            limit_type: "Named",
            is_active: true,
            Customer: { account_id: accountId },
        },
        select: {
            customer_number_policy: true,
            approved_limit: true,
            approved_limit_expiration_date: true,
            max_payment_term: true,
            max_allowed_mep: true,
            reporting_days: true,
            Customer: {
                select: {
                    id: true,
                    customer_number: true,
                    Person: {
                        select: { first_name: true, last_name: true },
                    },
                    Company: { select: { name: true } },
                },
            },
        },
    });
}

type NamedPolicyCustomerGridInfo = {
    customer_name: string;
    customer_id: number;
};

function buildCustomerInfoByNumberMap(
    assignments: ActiveNamedAssignmentRow[]
): Map<string, NamedPolicyCustomerGridInfo> {
    const customerInfoByNumber = new Map<string, NamedPolicyCustomerGridInfo>();
    for (const assignment of assignments) {
        const info: NamedPolicyCustomerGridInfo = {
            customer_name: getCustomerDisplayName(assignment.Customer),
            customer_id: assignment.Customer.id,
        };
        const policyNumber = assignment.customer_number_policy?.trim();
        const mainNumber = assignment.Customer.customer_number?.trim();
        if (policyNumber) {
            customerInfoByNumber.set(policyNumber.toLowerCase(), info);
        }
        if (mainNumber) {
            customerInfoByNumber.set(mainNumber.toLowerCase(), info);
        }
    }
    return customerInfoByNumber;
}

function hasNamedPolicyMasterForAssignment(
    assignment: ActiveNamedAssignmentRow,
    existingMasterNumbers: Set<string>
): boolean {
    const policyNumber = assignment.customer_number_policy?.trim().toLowerCase();
    const mainNumber = assignment.Customer.customer_number?.trim().toLowerCase();
    return (
        (policyNumber != null && existingMasterNumbers.has(policyNumber)) ||
        (mainNumber != null && existingMasterNumbers.has(mainNumber))
    );
}

export class NamedPolicyAssignmentService {
    static async ensureNamedPolicyMastersForPolicy(args: {
        policyId: number;
        accountId: number;
        userId: string;
        dbClient?: DbClient;
    }): Promise<void> {
        const dbClient = args.dbClient ?? prisma;
        const assignments = await loadActiveNamedAssignments(
            args.policyId,
            args.accountId,
            dbClient
        );
        if (assignments.length === 0) {
            return;
        }

        const existingMasters = await dbClient.namedPolicy.findMany({
            where: { insurance_policy_id: args.policyId },
            select: { customer_number: true },
        });
        const existingMasterNumbers = new Set(
            existingMasters.map((row) => row.customer_number.trim().toLowerCase())
        );

        for (const assignment of assignments) {
            if (
                hasNamedPolicyMasterForAssignment(
                    assignment,
                    existingMasterNumbers
                )
            ) {
                continue;
            }

            const masterFields = customerPolicyToNamedMasterFields(
                assignment,
                assignment.Customer.customer_number
            );
            if (!masterFields) {
                continue;
            }

            await dbClient.namedPolicy.create({
                data: buildNamedPolicyRowData(
                    args.policyId,
                    masterFields.customer_number,
                    masterFields,
                    args.userId
                ),
            });
            existingMasterNumbers.add(
                masterFields.customer_number.trim().toLowerCase()
            );
        }
    }

    static async listNamedPolicyGridRows(args: {
        policyId: number;
        accountId: number;
        dbClient?: DbClient;
    }): Promise<NamedPolicyGridRow[]> {
        const dbClient = args.dbClient ?? prisma;
        const assignments = await loadActiveNamedAssignments(
            args.policyId,
            args.accountId,
            dbClient
        );
        if (assignments.length === 0) {
            return [];
        }

        const customerInfoByNumber = buildCustomerInfoByNumberMap(assignments);

        const masters = await dbClient.namedPolicy.findMany({
            where: { insurance_policy_id: args.policyId },
            orderBy: { customer_number: "asc" },
        });

        return masters
            .filter((master) =>
                assignments.some((assignment) =>
                    namedPolicyCustomerNumberMatchesAssignment({
                        masterCustomerNumber: master.customer_number,
                        customerNumberPolicy: assignment.customer_number_policy,
                        customerNumber: assignment.Customer.customer_number,
                    })
                )
            )
            .map((master) => {
                const customerInfo = customerInfoByNumber.get(
                    master.customer_number.trim().toLowerCase()
                );
                return {
                    ...master,
                    customer_name: customerInfo?.customer_name ?? "",
                    customer_id: customerInfo?.customer_id ?? null,
                };
            });
    }

    static async createNamedPolicyWithAssignment(
        args: CreateNamedPolicyWithAssignmentArgs
    ): Promise<NamedPolicyAssignmentResult> {
        const customerNumber = args.data.customer_number.trim();
        if (!customerNumber) {
            return {
                success: false,
                errorCode: "customer_number_required",
                message: "customer_number is required",
            };
        }

        try {
            await InsurancePolicyService.assertAccountHasCreditInsurance(
                args.accountId
            );
        } catch {
            return {
                success: false,
                errorCode: "credit_insurance_disabled",
                message: "Credit insurance is not enabled for this account",
            };
        }

        const policy = await prisma.insurancePolicy.findFirst({
            where: { id: args.policyId, account_id: args.accountId },
            select: { id: true, min_credit_score: true },
        });
        if (!policy) {
            return {
                success: false,
                errorCode: "policy_not_found",
                message: "Policy not found",
            };
        }

        const customer = await prisma.customer.findFirst({
            where: {
                customer_number: customerNumber,
                account_id: args.accountId,
            },
            select: {
                id: true,
                country_id: true,
                customer_number: true,
            },
        });
        if (!customer) {
            return {
                success: false,
                errorCode: "customer_not_found",
                message: `Customer not found: ${customerNumber}`,
            };
        }

        const activePolicy = await getActiveCustomerPolicyRow(customer.id);
        const masterFields: NamedPolicyMasterFields = {
            customer_number: customerNumber,
            customer_max_limit: args.data.customer_max_limit,
            limit_expiration_date: args.data.limit_expiration_date ?? null,
            max_payment_term: args.data.max_payment_term,
            customer_mep: args.data.customer_mep,
            reporting_days: args.data.reporting_days,
        };

        try {
            const { namedPolicy, refreshTermsBreachFlags } =
                await prisma.$transaction(async (tx) => {
                const dbClient = tx as DbClient;

                const dup = await dbClient.namedPolicy.findFirst({
                    where: {
                        insurance_policy_id: args.policyId,
                        customer_number: customerNumber,
                    },
                });
                if (dup) {
                    throw new Error("NAMED_POLICY_CUSTOMER_NUMBER_EXISTS");
                }

                const created = await dbClient.namedPolicy.create({
                    data: buildNamedPolicyRowData(
                        args.policyId,
                        customerNumber,
                        args.data,
                        args.userId
                    ),
                });

                const refreshTermsBreachFlags =
                    await applyAssignmentAfterMasterCreate({
                        dbClient,
                        policyId: args.policyId,
                        accountId: args.accountId,
                        userId: args.userId,
                        customer,
                        masterFields,
                        activePolicy,
                        policyMinCreditScore: policy.min_credit_score,
                    });

                return { namedPolicy: created, refreshTermsBreachFlags };
            });

            await runPostAssignmentSync(customer.id, refreshTermsBreachFlags);

            return {
                success: true,
                namedPolicy,
                customerId: customer.id,
            };
        } catch (err: unknown) {
            return mapAssignmentError(err);
        }
    }

    static async updateNamedPolicyWithSync(
        args: UpdateNamedPolicyWithSyncArgs
    ): Promise<NamedPolicyAssignmentResult> {
        try {
            await InsurancePolicyService.assertAccountHasCreditInsurance(
                args.accountId
            );
        } catch {
            return {
                success: false,
                errorCode: "credit_insurance_disabled",
                message: "Credit insurance is not enabled for this account",
            };
        }

        const existing = await prisma.namedPolicy.findFirst({
            where: { id: args.namedPolicyId },
            include: { InsurancePolicy: { select: { account_id: true } } },
        });
        if (
            !existing ||
            existing.InsurancePolicy.account_id !== args.accountId
        ) {
            return {
                success: false,
                errorCode: "named_policy_not_found",
                message: "Row not found",
            };
        }

        const customerNumber = existing.customer_number.trim();
        const customer = await prisma.customer.findFirst({
            where: {
                customer_number: customerNumber,
                account_id: args.accountId,
            },
            select: {
                id: true,
                country_id: true,
                customer_number: true,
            },
        });
        if (!customer) {
            return {
                success: false,
                errorCode: "customer_not_found",
                message: `Customer not found: ${customerNumber}`,
            };
        }

        const masterFields: NamedPolicyMasterFields = {
            customer_number: customerNumber,
            customer_max_limit: args.data.customer_max_limit,
            limit_expiration_date: args.data.limit_expiration_date ?? null,
            max_payment_term: args.data.max_payment_term,
            customer_mep: args.data.customer_mep,
            reporting_days: args.data.reporting_days,
        };

        try {
            const namedPolicy = await prisma.$transaction(async (tx) => {
                const dbClient = tx as DbClient;

                const conflict = await dbClient.namedPolicy.findFirst({
                    where: {
                        insurance_policy_id: existing.insurance_policy_id,
                        customer_number: customerNumber,
                        NOT: { id: args.namedPolicyId },
                    },
                });
                if (conflict) {
                    throw new Error("NAMED_POLICY_CUSTOMER_NUMBER_EXISTS");
                }

                const updated = await dbClient.namedPolicy.update({
                    where: { id: args.namedPolicyId },
                    data: {
                        customer_number: customerNumber,
                        max_payment_term: args.data.max_payment_term ?? null,
                        customer_mep: args.data.customer_mep ?? null,
                        reporting_days: args.data.reporting_days ?? null,
                        customer_max_limit: (args.data.customer_max_limit ??
                            null) as Prisma.Decimal | string | number | null,
                        limit_expiration_date:
                            args.data.limit_expiration_date ?? null,
                        modified_by: args.userId,
                    },
                });

                const activePolicy = await getActiveCustomerPolicyRow(
                    customer.id,
                    dbClient
                );
                if (
                    activePolicy &&
                    activePolicy.insurance_policy_id ===
                        existing.insurance_policy_id &&
                    activePolicy.limit_type === "Named"
                ) {
                    const policyResult =
                        await CustomerPolicyService.applyActivePolicyPatch({
                            customerId: customer.id,
                            accountId: args.accountId,
                            countryId: customer.country_id,
                            customerNumber: customer.customer_number,
                            modifiedBy: args.userId,
                            patch: namedMasterToCustomerPolicyPatch(
                                masterFields,
                                { includeLimitType: false }
                            ),
                            existing: mapCustomerPolicyRow(activePolicy),
                            existingCountryId: customer.country_id,
                            dbClient,
                        });
                    if (policyResult.error) {
                        throw new Error(policyResult.error);
                    }
                }

                return updated;
            });

            await runPostAssignmentSync(customer.id);

            return {
                success: true,
                namedPolicy,
                customerId: customer.id,
            };
        } catch (err: unknown) {
            return mapAssignmentError(err);
        }
    }

    static async deleteNamedPolicyWithDeactivation(
        args: DeleteNamedPolicyWithDeactivationArgs
    ): Promise<NamedPolicyDeactivationResult> {
        try {
            await InsurancePolicyService.assertAccountHasCreditInsurance(
                args.accountId
            );
        } catch {
            return {
                success: false,
                errorCode: "credit_insurance_disabled",
                message: "Credit insurance is not enabled for this account",
            };
        }

        const existing = await prisma.namedPolicy.findFirst({
            where: { id: args.namedPolicyId },
            include: { InsurancePolicy: { select: { account_id: true } } },
        });
        if (
            !existing ||
            existing.InsurancePolicy.account_id !== args.accountId
        ) {
            return {
                success: false,
                errorCode: "named_policy_not_found",
                message: "Row not found",
            };
        }

        const customer = await prisma.customer.findFirst({
            where: {
                customer_number: existing.customer_number.trim(),
                account_id: args.accountId,
            },
            select: { id: true },
        });

        try {
            await prisma.$transaction(async (tx) => {
                const dbClient = tx as DbClient;

                await dbClient.namedPolicy.delete({
                    where: { id: args.namedPolicyId },
                });

                if (customer) {
                    const activePolicy = await getActiveCustomerPolicyRow(
                        customer.id,
                        dbClient
                    );
                    if (
                        activePolicy &&
                        activePolicy.insurance_policy_id ===
                            existing.insurance_policy_id
                    ) {
                        await freezeCustomerPolicyGapOnDeactivation(
                            customer.id,
                            activePolicy.id,
                            dbClient
                        );
                        await dbClient.customerPolicy.update({
                            where: { id: activePolicy.id },
                            data: {
                                is_active: false,
                                modified_by: args.userId,
                            },
                        });
                    }
                }
            });

            if (customer) {
                await runPostAssignmentSync(customer.id);
            }

            return {
                success: true,
                customerId: customer?.id ?? null,
            };
        } catch (err: unknown) {
            if (err instanceof Error) {
                return {
                    success: false,
                    errorCode: "policy_write_failed",
                    message: err.message,
                };
            }
            return {
                success: false,
                errorCode: "policy_write_failed",
                message: "Failed to delete named policy assignment",
            };
        }
    }
}
