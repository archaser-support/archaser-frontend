import type { customer_limit_type } from "@prisma/client";

import { prismaJobs } from "@/lib/prisma";
import { BusinessUnitService } from "@/server/services/BusinessUnitService";
import { InsurancePolicyService } from "@/server/services/InsurancePolicyService";
import { CustomerPolicyService } from "@/server/services/creditInsurance/CustomerPolicyService";
import {
    emptyEffectiveCustomerPolicyFields,
    mapCustomerPolicyRow,
    type CustomerPolicyWriteInput,
} from "@/server/services/creditInsurance/customerPolicyTypes";
import { getActiveCustomerPolicyRow } from "@/server/services/creditInsurance/resolveActiveCustomerPolicy";
import { syncCustomerInsuranceFields } from "@/server/services/creditInsurance/syncCustomerInsuranceFields";
import {
    isAllowedPolicyExclusionReason,
    normalizePolicyExclusionReason,
} from "@/server/services/creditInsurance/policyExclusion";
import {
    DAY_OF_MONTH_MAX,
    DAY_OF_MONTH_MIN,
    type MonthEndCutoffFields,
    validateMonthEndCutoffPair,
} from "@/shared/creditInsurance/monthEndCutoffFields";

function getPrisma() {
    return prismaJobs();
}

export type ImportPolicyRowInput = {
    policy_number: string;
    customer_number: string;
    limit_type: "DCL" | "Named" | string;
    customer_number_policy?: string | null;
    approved_limit?: string | number | null;
    approved_limit_expiration_date?: string | null;
    approved_limit_currency?: string | null;
    max_payment_term?: number | string | null;
    max_allowed_mep?: number | string | null;
    mep_cutoff_day_of_month?: number | string | null;
    mep_substitute_day_of_month?: number | string | null;
    reporting_days?: number | string | null;
    reporting_cutoff_day_of_month?: number | string | null;
    reporting_substitute_day_of_month?: number | string | null;
    payment_term_cutoff_day_of_month?: number | string | null;
    payment_term_substitute_day_of_month?: number | string | null;
    credit_score?: string | number | null;
    credit_score_input_date?: string | null;
    active_customer_since?: string | null;
    policy_exclusion_reason?: string | null;
};

export type ImportPolicyRowResult =
    | { success: true; action: "create" | "patch" | "switch"; customerId: number }
    | { success: false; errorCode: string; message: string };

export type ImportPolicyContext = {
    accountId: number;
    userId: string;
    userBusinessUnitId: number | null;
    isAdmin?: boolean;
};

type PrefillResult = Exclude<
    Awaited<ReturnType<typeof InsurancePolicyService.getCustomerPrefillForEdit>>,
    null | { source: "no_named_match" }
>;

function isBlank(value: unknown): boolean {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === "string") {
        return value.trim() === "";
    }
    return false;
}

function parseLimitType(value: unknown): customer_limit_type | null {
    if (isBlank(value)) {
        return null;
    }
    const normalized = String(value).trim().toUpperCase();
    if (normalized === "DCL") {
        return "DCL";
    }
    if (normalized === "NAMED") {
        return "Named";
    }
    return null;
}

function fail(errorCode: string, message: string): ImportPolicyRowResult {
    return { success: false, errorCode, message };
}

function parseImportDayOfMonth(
    value: unknown,
    fieldKey: keyof MonthEndCutoffFields
): ImportPolicyRowResult | number | null {
    if (isBlank(value)) {
        return null;
    }
    const parsed = Number(String(value).trim());
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        return fail(
            "invalid_month_end_day",
            `import.validation.invalidMonthEndDayOfMonth:${fieldKey}`
        );
    }
    if (parsed < DAY_OF_MONTH_MIN || parsed > DAY_OF_MONTH_MAX) {
        return fail(
            "month_end_day_out_of_range",
            `import.validation.monthEndDayOutOfRange:${fieldKey}`
        );
    }
    return parsed;
}

function validateResolvedMonthEndFields(
    fields: MonthEndCutoffFields
): ImportPolicyRowResult | null {
    try {
        validateMonthEndCutoffPair(
            fields.mep_cutoff_day_of_month,
            fields.mep_substitute_day_of_month,
            "MEP"
        );
        validateMonthEndCutoffPair(
            fields.reporting_cutoff_day_of_month,
            fields.reporting_substitute_day_of_month,
            "Reporting"
        );
        validateMonthEndCutoffPair(
            fields.payment_term_cutoff_day_of_month,
            fields.payment_term_substitute_day_of_month,
            "Payment term"
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Invalid month-end fields";
        if (message.includes("MEP substitute")) {
            return fail(
                "mep_cutoff_requires_substitute",
                "import.validation.mepCutoffRequiresSubstitute"
            );
        }
        if (message.includes("MEP cutoff")) {
            return fail(
                "mep_substitute_requires_cutoff",
                "import.validation.mepSubstituteRequiresCutoff"
            );
        }
        if (message.includes("Reporting substitute")) {
            return fail(
                "reporting_cutoff_requires_substitute",
                "import.validation.reportingCutoffRequiresSubstitute"
            );
        }
        if (message.includes("Reporting cutoff")) {
            return fail(
                "reporting_substitute_requires_cutoff",
                "import.validation.reportingSubstituteRequiresCutoff"
            );
        }
        if (message.includes("Payment term substitute")) {
            return fail(
                "payment_term_cutoff_requires_substitute",
                "import.validation.paymentTermCutoffRequiresSubstitute"
            );
        }
        if (message.includes("Payment term cutoff")) {
            return fail(
                "payment_term_substitute_requires_cutoff",
                "import.validation.paymentTermSubstituteRequiresCutoff"
            );
        }
        return fail("invalid_month_end_fields", message);
    }
    return null;
}

function isImportFailure(
    value: ImportPolicyRowResult | number | null
): value is ImportPolicyRowResult {
    return (
        value !== null &&
        typeof value === "object" &&
        "success" in value &&
        !value.success
    );
}

function addMonthEndFieldsToPatch(
    row: ImportPolicyRowInput,
    prefill: PrefillResult | null,
    patch: CustomerPolicyWriteInput & { policy_id?: number }
): ImportPolicyRowResult | null {
    const shouldResolve =
        !isBlank(row.mep_cutoff_day_of_month) ||
        !isBlank(row.mep_substitute_day_of_month) ||
        !isBlank(row.reporting_cutoff_day_of_month) ||
        !isBlank(row.reporting_substitute_day_of_month) ||
        !isBlank(row.payment_term_cutoff_day_of_month) ||
        !isBlank(row.payment_term_substitute_day_of_month) ||
        Boolean(prefill);

    if (!shouldResolve) {
        return null;
    }

    const resolveField = (
        rowValue: unknown,
        prefillValue: number | null | undefined,
        fieldKey: keyof MonthEndCutoffFields
    ): ImportPolicyRowResult | number | null => {
        if (!isBlank(rowValue)) {
            return parseImportDayOfMonth(rowValue, fieldKey);
        }
        return prefillValue ?? null;
    };

    const mepCutoff = resolveField(
        row.mep_cutoff_day_of_month,
        prefill?.mep_cutoff_day_of_month,
        "mep_cutoff_day_of_month"
    );
    if (isImportFailure(mepCutoff)) {
        return mepCutoff;
    }
    const mepSubstitute = resolveField(
        row.mep_substitute_day_of_month,
        prefill?.mep_substitute_day_of_month,
        "mep_substitute_day_of_month"
    );
    if (isImportFailure(mepSubstitute)) {
        return mepSubstitute;
    }
    const reportingCutoff = resolveField(
        row.reporting_cutoff_day_of_month,
        prefill?.reporting_cutoff_day_of_month,
        "reporting_cutoff_day_of_month"
    );
    if (isImportFailure(reportingCutoff)) {
        return reportingCutoff;
    }
    const reportingSubstitute = resolveField(
        row.reporting_substitute_day_of_month,
        prefill?.reporting_substitute_day_of_month,
        "reporting_substitute_day_of_month"
    );
    if (isImportFailure(reportingSubstitute)) {
        return reportingSubstitute;
    }
    const paymentTermCutoff = resolveField(
        row.payment_term_cutoff_day_of_month,
        prefill?.payment_term_cutoff_day_of_month,
        "payment_term_cutoff_day_of_month"
    );
    if (isImportFailure(paymentTermCutoff)) {
        return paymentTermCutoff;
    }
    const paymentTermSubstitute = resolveField(
        row.payment_term_substitute_day_of_month,
        prefill?.payment_term_substitute_day_of_month,
        "payment_term_substitute_day_of_month"
    );
    if (isImportFailure(paymentTermSubstitute)) {
        return paymentTermSubstitute;
    }

    const resolved: MonthEndCutoffFields = {
        mep_cutoff_day_of_month: mepCutoff,
        mep_substitute_day_of_month: mepSubstitute,
        reporting_cutoff_day_of_month: reportingCutoff,
        reporting_substitute_day_of_month: reportingSubstitute,
        payment_term_cutoff_day_of_month: paymentTermCutoff,
        payment_term_substitute_day_of_month: paymentTermSubstitute,
    };

    const validationError = validateResolvedMonthEndFields(resolved);
    if (validationError) {
        return validationError;
    }

    patch.mep_cutoff_day_of_month = resolved.mep_cutoff_day_of_month;
    patch.mep_substitute_day_of_month = resolved.mep_substitute_day_of_month;
    patch.reporting_cutoff_day_of_month = resolved.reporting_cutoff_day_of_month;
    patch.reporting_substitute_day_of_month =
        resolved.reporting_substitute_day_of_month;
    patch.payment_term_cutoff_day_of_month =
        resolved.payment_term_cutoff_day_of_month;
    patch.payment_term_substitute_day_of_month =
        resolved.payment_term_substitute_day_of_month;

    return null;
}

function buildPolicyPatchFromRowAndPrefill(
    row: ImportPolicyRowInput,
    limitType: customer_limit_type,
    policyId: number,
    prefill: PrefillResult | null
): CustomerPolicyWriteInput | ImportPolicyRowResult {
    const patch: CustomerPolicyWriteInput & { policy_id?: number } = {
        policy_id: policyId,
        limit_type: limitType,
    };

    if (!isBlank(row.customer_number_policy)) {
        patch.customer_number_policy = String(row.customer_number_policy).trim();
    } else if (prefill) {
        patch.customer_number_policy = prefill.customer_number_policy ?? null;
    }

    if (!isBlank(row.approved_limit)) {
        patch.approved_limit = row.approved_limit;
    } else if (prefill) {
        patch.approved_limit =
            prefill.approved_limit != null
                ? (prefill.approved_limit as CustomerPolicyWriteInput["approved_limit"])
                : null;
    }

    if (!isBlank(row.approved_limit_expiration_date)) {
        patch.approved_limit_expiration_date =
            row.approved_limit_expiration_date as CustomerPolicyWriteInput["approved_limit_expiration_date"];
    } else if (prefill) {
        patch.approved_limit_expiration_date =
            prefill.approved_limit_expiration_date ?? null;
    }

    if (!isBlank(row.approved_limit_currency)) {
        patch.approved_limit_currency = String(
            row.approved_limit_currency
        ).trim();
    }

    if (!isBlank(row.max_payment_term)) {
        patch.max_payment_term = Number(row.max_payment_term);
    } else if (prefill) {
        patch.max_payment_term = prefill.max_payment_term ?? null;
    }

    if (!isBlank(row.max_allowed_mep)) {
        patch.max_allowed_mep = Number(row.max_allowed_mep);
    } else if (prefill) {
        patch.max_allowed_mep = prefill.max_allowed_mep ?? null;
    }

    if (!isBlank(row.reporting_days)) {
        patch.reporting_days = Number(row.reporting_days);
    } else if (prefill) {
        patch.reporting_days = prefill.reporting_days ?? null;
    }

    if (!isBlank(row.credit_score)) {
        patch.credit_score = row.credit_score;
    } else if (prefill) {
        patch.credit_score =
            prefill.credit_score != null
                ? (prefill.credit_score as CustomerPolicyWriteInput["credit_score"])
                : null;
    }

    if (!isBlank(row.credit_score_input_date)) {
        patch.credit_score_input_date =
            row.credit_score_input_date as CustomerPolicyWriteInput["credit_score_input_date"];
    }

    if (!isBlank(row.active_customer_since)) {
        patch.active_customer_since =
            row.active_customer_since as CustomerPolicyWriteInput["active_customer_since"];
    }

    if (row.policy_exclusion_reason !== undefined) {
        patch.policy_exclusion_reason = normalizePolicyExclusionReason(
            row.policy_exclusion_reason
        );
    }

    const monthEndError = addMonthEndFieldsToPatch(row, prefill, patch);
    if (monthEndError) {
        return monthEndError;
    }

    if (limitType === "DCL") {
        const effectiveReason = normalizePolicyExclusionReason(
            patch.policy_exclusion_reason
        );
        if (effectiveReason === null) {
            patch.policy_exclusion_reason = "Pending review";
        }
    }

    return patch;
}

async function resolvePrefillForImport(args: {
    policyId: number;
    accountId: number;
    countryId: number | null;
    customerNumber: string | null;
    customerNumberPolicy: string | null;
    limitType: customer_limit_type;
    customerNumberForError: string;
}): Promise<ImportPolicyRowResult | PrefillResult | null> {
    const namedOnly = args.limitType === "Named";
    const prefillResult =
        await InsurancePolicyService.getCustomerPrefillForEdit({
            policyId: args.policyId,
            accountId: args.accountId,
            countryId: args.countryId,
            customerNumber: args.customerNumber,
            customerNumberPolicy: args.customerNumberPolicy,
            namedMatchByPolicyCustomerNumberOnly: namedOnly,
        });

    if (
        namedOnly &&
        prefillResult &&
        "source" in prefillResult &&
        prefillResult.source === "no_named_match"
    ) {
        return fail(
            "no_named_match",
            `import.validation.noNamedPolicyMatch:${args.customerNumberForError}`
        );
    }

    if (
        !prefillResult ||
        ("source" in prefillResult && prefillResult.source === "no_named_match")
    ) {
        return null;
    }

    return prefillResult as PrefillResult;
}

async function runPostRowSync(
    customerId: number,
    refreshTermsBreachFlags = false
): Promise<void> {
    try {
        await syncCustomerInsuranceFields(customerId, {
            refreshTermsBreachFlags,
        });
    } catch (syncErr) {
        console.error(
            "[ImportPolicy] syncCustomerInsuranceFields failed:",
            syncErr
        );
    }
}

export class ImportPolicyService {
    async importPolicyRow(
        row: ImportPolicyRowInput,
        context: ImportPolicyContext
    ): Promise<ImportPolicyRowResult> {
        const policyNumber = row.policy_number?.trim();
        const customerNumber = row.customer_number?.trim();

        if (!policyNumber) {
            return fail(
                "policy_number_required",
                "import.validation.policyNumberRequired"
            );
        }
        if (!customerNumber) {
            return fail(
                "customer_number_required",
                "import.validation.customerNumberRequired"
            );
        }

        const limitType = parseLimitType(row.limit_type);
        if (!limitType) {
            return fail(
                "invalid_limit_type",
                "import.validation.invalidLimitType"
            );
        }

        const exclusionReason = normalizePolicyExclusionReason(
            row.policy_exclusion_reason
        );
        if (
            exclusionReason !== null &&
            !isAllowedPolicyExclusionReason(exclusionReason)
        ) {
            return fail(
                "invalid_policy_exclusion_reason",
                "import.validation.invalidPolicyExclusionReason"
            );
        }

        const customer = await getPrisma().customer.findFirst({
            where: {
                customer_number: customerNumber,
                account_id: context.accountId,
            },
            select: {
                id: true,
                country_id: true,
                customer_number: true,
                business_unit_id: true,
            },
        });

        if (!customer) {
            return fail(
                "customer_not_found",
                `import.validation.customerNotFound:${customerNumber}`
            );
        }

        const accessibleBuIds =
            await BusinessUnitService.getAccessibleBusinessUnitIds(
                context.userBusinessUnitId,
                context.isAdmin ?? false
            );

        if (
            customer.business_unit_id != null &&
            accessibleBuIds !== null &&
            !accessibleBuIds.includes(customer.business_unit_id)
        ) {
            const businessUnit = await getPrisma().businessUnit.findFirst({
                where: { id: customer.business_unit_id },
                select: { external_id: true },
            });
            const externalId =
                businessUnit?.external_id || `BU-${customer.business_unit_id}`;
            return fail(
                "business_unit_access_denied",
                `import.validation.businessUnitAccessDenied:${externalId}`
            );
        }

        const assignablePolicy =
            await InsurancePolicyService.findAssignablePrimaryPolicyByNumber(
                context.accountId,
                policyNumber
            );

        if (!assignablePolicy) {
            const policyExists = await getPrisma().insurancePolicy.findFirst({
                where: {
                    account_id: context.accountId,
                    policy_number: policyNumber,
                },
                select: { id: true, policy_kind: true },
            });

            if (!policyExists) {
                return fail(
                    "policy_not_found",
                    `import.validation.policyNotFound:${policyNumber}`
                );
            }

            if (policyExists.policy_kind === "TopUp") {
                return fail(
                    "policy_not_assignable",
                    `import.validation.policyTopUpNotAssignable:${policyNumber}`
                );
            }

            return fail(
                "policy_not_assignable",
                `import.validation.policyNotAssignable:${policyNumber}`
            );
        }

        const customerNumberPolicy = !isBlank(row.customer_number_policy)
            ? String(row.customer_number_policy).trim()
            : null;

        const prefillOrError = await resolvePrefillForImport({
            policyId: assignablePolicy.id,
            accountId: context.accountId,
            countryId: customer.country_id,
            customerNumber: customer.customer_number,
            customerNumberPolicy,
            limitType,
            customerNumberForError: customerNumber,
        });

        if (prefillOrError && "success" in prefillOrError && !prefillOrError.success) {
            return prefillOrError;
        }

        const prefill =
            prefillOrError && !("success" in prefillOrError)
                ? prefillOrError
                : null;

        const patchOrError = buildPolicyPatchFromRowAndPrefill(
            row,
            limitType,
            assignablePolicy.id,
            prefill
        );

        if ("success" in patchOrError && !patchOrError.success) {
            return patchOrError;
        }

        const patch = patchOrError as CustomerPolicyWriteInput;

        const activePolicy = await getActiveCustomerPolicyRow(customer.id);
        const patchArgs = {
            customerId: customer.id,
            accountId: context.accountId,
            countryId: customer.country_id,
            customerNumber: customer.customer_number,
            modifiedBy: context.userId,
            patch,
            existingCountryId: customer.country_id,
        };

        let action: "create" | "patch" | "switch";
        let refreshTermsBreachFlags = false;

        if (!activePolicy) {
            action = "create";
            const policyResult = await CustomerPolicyService.applyActivePolicyPatch({
                ...patchArgs,
                existing: emptyEffectiveCustomerPolicyFields(),
            });
            if (policyResult.error) {
                return fail("policy_write_failed", policyResult.error);
            }
            refreshTermsBreachFlags = policyResult.refreshTermsBreachFlags === true;
        } else if (activePolicy.insurance_policy_id === assignablePolicy.id) {
            action = "patch";
            const policyResult = await CustomerPolicyService.applyActivePolicyPatch({
                ...patchArgs,
                existing: mapCustomerPolicyRow(activePolicy),
            });
            if (policyResult.error) {
                return fail("policy_write_failed", policyResult.error);
            }
            refreshTermsBreachFlags = policyResult.refreshTermsBreachFlags === true;
        } else {
            action = "switch";
            const wasExcludedBeforeSwitch =
                limitType === "Named" &&
                (activePolicy.excluded_from_policy === true ||
                    (activePolicy.policy_exclusion_reason != null &&
                        activePolicy.policy_exclusion_reason !== ""));
            const switchResult = await CustomerPolicyService.switchActivePolicy({
                customerId: customer.id,
                accountId: context.accountId,
                newInsurancePolicyId: assignablePolicy.id,
                countryId: customer.country_id,
                customerNumber: customer.customer_number,
                customerNumberPolicy:
                    patch.customer_number_policy ?? customerNumberPolicy,
                limitType,
                modifiedBy: context.userId,
            });
            if (switchResult.error) {
                return fail("policy_write_failed", switchResult.error);
            }

            const activeAfterSwitch = await getActiveCustomerPolicyRow(
                customer.id
            );
            const policyResult = await CustomerPolicyService.applyActivePolicyPatch({
                ...patchArgs,
                existing: activeAfterSwitch
                    ? mapCustomerPolicyRow(activeAfterSwitch)
                    : emptyEffectiveCustomerPolicyFields(),
            });
            if (policyResult.error) {
                return fail("policy_write_failed", policyResult.error);
            }
            refreshTermsBreachFlags =
                wasExcludedBeforeSwitch ||
                policyResult.refreshTermsBreachFlags === true;
        }

        await runPostRowSync(customer.id, refreshTermsBreachFlags);

        return { success: true, action, customerId: customer.id };
    }
}
