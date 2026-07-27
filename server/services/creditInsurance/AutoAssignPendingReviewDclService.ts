import { type DbClient, prisma } from "@/lib/prisma";
import { InsurancePolicyService } from "@/server/services/InsurancePolicyService";
import { normalizePolicyExclusionReason } from "@/shared/creditInsurance/policyExclusion";

import { CustomerPolicyService } from "./CustomerPolicyService";
import {
    emptyEffectiveCustomerPolicyFields,
    mapCustomerPolicyRow,
} from "./customerPolicyTypes";
import { getActiveCustomerPolicyRow } from "./resolveActiveCustomerPolicy";
import { syncCustomerInsuranceFields } from "./syncCustomerInsuranceFields";
import { syncCreditInsuranceGapPipelineForCustomer } from "./syncCreditInsuranceGapPipeline";

export type AutoAssignPendingReviewDclSkippedReason =
    | "credit_insurance_disabled"
    | "no_single_assignable_primary"
    | "active_linked_policy_exists"
    | "active_named_assignment_exists"
    | "policy_switch_failed"
    | "policy_patch_failed";

export async function autoAssignPendingReviewDcl(args: {
    customerId: number;
    accountId: number;
    countryId: number | null;
    customerNumber: string | null;
    customerNumberPolicy?: string | null;
    modifiedBy: string | null;
    dbClient?: DbClient;
}): Promise<{ assigned: boolean; skippedReason?: AutoAssignPendingReviewDclSkippedReason }> {
    const dbClient = args.dbClient ?? prisma;

    const account = await dbClient.account.findUnique({
        where: { id: args.accountId },
        select: { has_credit_insurance: true },
    });
    if (!account?.has_credit_insurance) {
        return { assigned: false, skippedReason: "credit_insurance_disabled" };
    }

    const assignablePrimaryPolicies =
        await InsurancePolicyService.listAssignablePrimaryPolicies(args.accountId);
    if (assignablePrimaryPolicies.length !== 1) {
        return { assigned: false, skippedReason: "no_single_assignable_primary" };
    }
    const targetPolicy = assignablePrimaryPolicies[0];

    const activePolicy = await getActiveCustomerPolicyRow(args.customerId, dbClient);
    if (activePolicy?.insurance_policy_id != null) {
        return { assigned: false, skippedReason: "active_linked_policy_exists" };
    }
    if (activePolicy?.limit_type === "Named") {
        return { assigned: false, skippedReason: "active_named_assignment_exists" };
    }

    const switchResult = await CustomerPolicyService.switchActivePolicy({
        customerId: args.customerId,
        accountId: args.accountId,
        newInsurancePolicyId: targetPolicy.id,
        countryId: args.countryId,
        customerNumber: args.customerNumber,
        customerNumberPolicy: args.customerNumberPolicy ?? null,
        limitType: "DCL",
        modifiedBy: args.modifiedBy,
        dbClient,
    });
    if (switchResult.error) {
        return { assigned: false, skippedReason: "policy_switch_failed" };
    }

    const activeAfterSwitch = await getActiveCustomerPolicyRow(
        args.customerId,
        dbClient
    );

    const patchResult = await CustomerPolicyService.applyActivePolicyPatch({
        customerId: args.customerId,
        accountId: args.accountId,
        countryId: args.countryId,
        customerNumber: args.customerNumber,
        modifiedBy: args.modifiedBy,
        patch: {
            limit_type: "DCL",
            policy_exclusion_reason: "Pending review",
        },
        existingCountryId: args.countryId,
        existing: activeAfterSwitch
            ? mapCustomerPolicyRow(activeAfterSwitch)
            : emptyEffectiveCustomerPolicyFields(),
        dbClient,
    });
    if (patchResult.error) {
        return { assigned: false, skippedReason: "policy_patch_failed" };
    }

    if (!args.dbClient) {
        await syncCustomerInsuranceFields(args.customerId);
        await syncCreditInsuranceGapPipelineForCustomer(args.customerId, {
            skipPolicyAggregate: false,
        });
    }

    return { assigned: true };
}

/**
 * Ensure DCL customers with a linked policy and no exclusion reason get
 * pending-review exclusion. Skips when the user explicitly chose a reason or
 * cleared an existing reason on this save.
 */
export async function ensurePendingReviewOnDclWithoutExclusion(args: {
    previousPolicyExclusionReason: string | null;
    policyExclusionReasonInRequest: unknown;
    limitTypeInRequest: unknown;
    customerId: number;
    accountId: number;
    countryId: number | null;
    customerNumber: string | null;
    modifiedBy: string | null;
    dbClient?: DbClient;
}): Promise<void> {
    const requestedReason =
        args.policyExclusionReasonInRequest !== undefined
            ? normalizePolicyExclusionReason(args.policyExclusionReasonInRequest)
            : undefined;

    if (requestedReason !== undefined && requestedReason !== null) {
        return;
    }

    if (
        requestedReason === null &&
        normalizePolicyExclusionReason(args.previousPolicyExclusionReason) !==
            null
    ) {
        return;
    }

    if (args.limitTypeInRequest === "Named") {
        return;
    }

    const dbClient = args.dbClient ?? prisma;
    const active = await getActiveCustomerPolicyRow(args.customerId, dbClient);
    if (active?.insurance_policy_id == null) {
        return;
    }
    if (active.limit_type === "Named") {
        return;
    }
    if (normalizePolicyExclusionReason(active.policy_exclusion_reason)) {
        return;
    }

    const patchResult = await CustomerPolicyService.applyActivePolicyPatch({
        customerId: args.customerId,
        accountId: args.accountId,
        countryId: args.countryId,
        customerNumber: args.customerNumber,
        modifiedBy: args.modifiedBy,
        patch: {
            limit_type: "DCL",
            policy_exclusion_reason: "Pending review",
        },
        existingCountryId: args.countryId,
        existing: mapCustomerPolicyRow(active),
        dbClient,
    });
    if (patchResult.error) {
        throw new Error(patchResult.error);
    }
}

/** @deprecated Use ensurePendingReviewOnDclWithoutExclusion */
export async function ensurePendingReviewOnFirstDclPolicyLink(args: {
    hadLinkedPolicyBefore: boolean;
    policyExclusionReasonInRequest: unknown;
    limitTypeInRequest: unknown;
    customerId: number;
    accountId: number;
    countryId: number | null;
    customerNumber: string | null;
    modifiedBy: string | null;
    dbClient?: DbClient;
    previousPolicyExclusionReason?: string | null;
}): Promise<void> {
    return ensurePendingReviewOnDclWithoutExclusion({
        previousPolicyExclusionReason:
            args.previousPolicyExclusionReason ?? null,
        policyExclusionReasonInRequest: args.policyExclusionReasonInRequest,
        limitTypeInRequest: args.limitTypeInRequest,
        customerId: args.customerId,
        accountId: args.accountId,
        countryId: args.countryId,
        customerNumber: args.customerNumber,
        modifiedBy: args.modifiedBy,
        dbClient: args.dbClient,
    });
}
