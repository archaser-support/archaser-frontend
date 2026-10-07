import {
    customerHasLinkedInsurancePolicy,
    type CustomerWithPolicyFields,
} from "@/shared/customerPolicyAdapter";

export type CustomerDetailDefaultTab =
    | "dashboard"
    | "activities"
    | "aggregated_data";

export type CustomerDetailDashboardUxInput = {
    customer: CustomerWithPolicyFields | null | undefined;
    hasCreditInsurance: boolean;
    hasCollection: boolean;
    hasChildren: boolean;
    explicitTab: string | null | undefined;
};

export type CustomerDetailDashboardUx = {
    showDashboardNoPolicyEmptyState: boolean;
    defaultTabWithoutUrlParam: CustomerDetailDefaultTab;
};

export function resolveCustomerDetailDashboardUx(
    input: CustomerDetailDashboardUxInput
): CustomerDetailDashboardUx {
    const hasLinkedPolicy = customerHasLinkedInsurancePolicy(input.customer);
    const showDashboardNoPolicyEmptyState =
        input.hasCreditInsurance && !hasLinkedPolicy;

    // Shell parents land on Dashboard (credit rollups live there). Aggregated
    // Data remains available for collection content only — not the default.
    let defaultTabWithoutUrlParam: CustomerDetailDefaultTab = "dashboard";
    if (
        input.hasCreditInsurance &&
        input.hasCollection &&
        !hasLinkedPolicy &&
        !input.hasChildren
    ) {
        defaultTabWithoutUrlParam = "activities";
    }

    return {
        showDashboardNoPolicyEmptyState,
        defaultTabWithoutUrlParam,
    };
}
