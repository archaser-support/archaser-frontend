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

    let defaultTabWithoutUrlParam: CustomerDetailDefaultTab = "dashboard";
    if (input.hasChildren) {
        defaultTabWithoutUrlParam = "aggregated_data";
    } else if (
        input.hasCreditInsurance &&
        input.hasCollection &&
        !hasLinkedPolicy
    ) {
        defaultTabWithoutUrlParam = "activities";
    }

    return {
        showDashboardNoPolicyEmptyState,
        defaultTabWithoutUrlParam,
    };
}
