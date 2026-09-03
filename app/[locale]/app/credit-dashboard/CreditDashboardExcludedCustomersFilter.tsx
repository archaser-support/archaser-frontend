"use client";

import { Box, useTheme } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";

type ExcludedCustomersScope = "with" | "without";

type ExcludedCustomersOption = {
    id: ExcludedCustomersScope;
    label: string;
};

const EXCLUDED_CUSTOMERS_FILTER_WIDTH_SPACING = 30;
const EXCLUDED_CUSTOMERS_FILTER_WIDTH_SPACING_HE = 26;

type CreditDashboardExcludedCustomersFilterProps = {
    /** When true, no-policy exposure cohort is included in dashboard KPIs. */
    value: boolean;
    onChange: (includeNoPolicyExposure: boolean) => void;
};

export function CreditDashboardExcludedCustomersFilter({
    value,
    onChange,
}: CreditDashboardExcludedCustomersFilterProps) {
    const { t, i18n } = useTranslation("dashboard");
    const theme = useTheme();
    const isHe = i18n.language === "he";

    const options = useMemo((): ExcludedCustomersOption[] => {
        return [
            {
                id: "with",
                label: t("credit_insurance_dashboard.with_excluded_customers"),
            },
            {
                id: "without",
                label: t("credit_insurance_dashboard.without_excluded_customers"),
            },
        ];
    }, [t]);

    const selectedOption =
        options.find((opt) => opt.id === (value ? "with" : "without")) ??
        options[0];

    const scopeLabel = t(
        "credit_insurance_dashboard.excluded_customers_scope_label"
    );

    const filterWidthSpacing = isHe
        ? EXCLUDED_CUSTOMERS_FILTER_WIDTH_SPACING_HE
        : EXCLUDED_CUSTOMERS_FILTER_WIDTH_SPACING;

    const filterSx = useMemo(
        () => ({
            minWidth: {
                xs: "100%",
                sm: theme.spacing(filterWidthSpacing),
            },
            width: {
                xs: "100%",
                sm: theme.spacing(filterWidthSpacing),
            },
            flexShrink: 0,
        }),
        [theme, filterWidthSpacing]
    );

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
            <ToolbarDropdownFilter<ExcludedCustomersOption>
                value={selectedOption}
                onChange={(opt) => {
                    if (opt == null) {
                        return;
                    }
                    onChange(opt.id === "with");
                }}
                options={options}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, v) => option.id === v.id}
                label={scopeLabel}
                sx={filterSx}
            />
        </Box>
    );
}
