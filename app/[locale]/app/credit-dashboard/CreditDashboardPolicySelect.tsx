"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";

export type CreditDashboardPolicyItem = {
    id: number;
    policy_number: string | null;
};

type PolicyOption = {
    id: number | null;
    label: string;
};

export function useCreditDashboardPoliciesQuery() {
    return useQuery({
        queryKey: ["credit-insurance", "dashboard-policies", "assigned"],
        queryFn: async (): Promise<CreditDashboardPolicyItem[]> => {
            const res = await apiFetch("/api/entities/insurance-policies?assigned_only=1"
            );
            if (!res.ok) {
                return [];
            }
            const j = (await res.json()) as {
                policies?: CreditDashboardPolicyItem[];
            };
            return j.policies ?? [];
        },
        staleTime: 60_000,
    });
}

type CreditDashboardPolicySelectProps = {
    policies: CreditDashboardPolicyItem[];
    /** null = all policies */
    value: number | null;
    onChange: (policyId: number | null) => void;
};

export function CreditDashboardPolicySelect({
    policies,
    value,
    onChange,
}: CreditDashboardPolicySelectProps) {
    const { t, i18n } = useTranslation("dashboard");
    const isHe = i18n.language === "he";

    const options = useMemo(() => {
        const labelForPolicyId = (policyId: number | null) => {
            if (policyId == null) {
                return t("credit_insurance_dashboard.all_policies");
            }
            const p = policies.find((x) => Number(x.id) === Number(policyId));
            if (!p) {
                return t("credit_insurance_dashboard.em_dash");
            }
            return p.policy_number && String(p.policy_number).trim()
                ? p.policy_number
                : t("credit_insurance_dashboard.policy_number_fallback", {
                    id: p.id,
                });
        };
        return [
            {
                id: null as number | null,
                label: t("credit_insurance_dashboard.all_policies"),
            },
            ...policies.map((p) => ({
                id: p.id,
                label: labelForPolicyId(p.id),
            })),
        ] as PolicyOption[];
    }, [policies, t]);

    const selectedOption =
        options.find((opt) => opt.id === value) ??
        options.find((opt) => opt.id == null) ??
        null;

    if (policies.length <= 1) {
        return null;
    }

    const scopeLabel = t("credit_insurance_dashboard.policy_scope_label");

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                direction: isHe ? "rtl" : "ltr",
                width: "auto",
                flexShrink: 0,
                minWidth: 0,
            }}
        >
            <ToolbarDropdownFilter<PolicyOption>
                value={selectedOption}
                onChange={(opt) => onChange(opt?.id ?? null)}
                options={options}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, v) => option.id === v.id}
                label={scopeLabel}
            />
        </Box>
    );
}
