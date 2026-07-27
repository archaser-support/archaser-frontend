"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Business as BusinessIcon } from "@mui/icons-material";
import { Box, InputAdornment, Typography, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";

type BusinessUnitRecord = {
    id: number;
    name: string;
};

type BusinessUnitOption = {
    id: number | null;
    label: string;
};

type BusinessUnitDashboardFilterProps = {
    value: number | null;
    onChange: (businessUnitId: number | null) => void;
};

const BUSINESS_UNIT_FILTER_WIDTH_SPACING = 28;

export default function BusinessUnitDashboardFilter({
    value,
    onChange,
}: BusinessUnitDashboardFilterProps) {
    const { t, i18n } = useTranslation("dashboard");
    const theme = useTheme();
    const isHebrew = i18n.language === "he";

    const { data: businessUnits = [], isLoading } = useQuery<BusinessUnitRecord[]>({
        queryKey: ["dashboard-business-units"],
        queryFn: async () => {
            const response = await apiFetch("/api/entities/business-units");
            if (!response.ok) {
                throw new Error("Failed to fetch business units");
            }
            return response.json();
        },
        refetchOnWindowFocus: false,
    });

    const options = useMemo<BusinessUnitOption[]>(() => {
        const allOption: BusinessUnitOption = {
            id: null,
            label: t("fields.all_business_units"),
        };

        const unitOptions = businessUnits.map((unit) => ({
            id: unit.id,
            label: unit.name,
        }));

        return [allOption, ...unitOptions];
    }, [businessUnits, t]);

    const selectedOption =
        options.find((option) => option.id === value) ?? options[0];

    const toolbarStartAdornmentSx = useMemo(
        () => ({
            marginLeft: 0,
            marginRight: isHebrew ? 0 : theme.spacing(0.5),
            paddingLeft: isHebrew ? 0 : theme.spacing(1),
            paddingRight: isHebrew ? theme.spacing(1) : 0,
            minWidth: "auto",
            width: "auto",
        }),
        [theme, isHebrew]
    );

    const filterSx = useMemo(
        () => ({
            minWidth: {
                xs: "100%",
                sm: theme.spacing(BUSINESS_UNIT_FILTER_WIDTH_SPACING),
            },
            width: {
                xs: "100%",
                sm: theme.spacing(BUSINESS_UNIT_FILTER_WIDTH_SPACING),
            },
            flexShrink: 0,
        }),
        [theme]
    );

    if (!isLoading && businessUnits.length <= 1) {
        return null;
    }

    const startAdornment = (
        <InputAdornment position="start" sx={toolbarStartAdornmentSx}>
            <BusinessIcon
                sx={{
                    fontSize: "1.125rem",
                    color: "rgb(var(--primary-rgb))",
                }}
            />
        </InputAdornment>
    );

    return (
        <Box
            sx={{
                direction: isHebrew ? "rtl" : "ltr",
                flexShrink: 0,
            }}
        >
            <ToolbarDropdownFilter<BusinessUnitOption>
                value={selectedOption}
                onChange={(newValue) => {
                    if (newValue != null) {
                        onChange(newValue.id);
                    }
                }}
                options={options}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, current) =>
                    option.id === current.id
                }
                label={t("fields.business_unit_filter")}
                loading={isLoading}
                startAdornment={startAdornment}
                sx={filterSx}
                renderOption={(_props, option) => (
                    <>
                        <BusinessIcon
                            sx={{
                                fontSize: "1.125rem",
                                color: "rgb(var(--primary-rgb))",
                            }}
                        />
                        <Typography variant="body2">{option.label}</Typography>
                    </>
                )}
            />
        </Box>
    );
}
