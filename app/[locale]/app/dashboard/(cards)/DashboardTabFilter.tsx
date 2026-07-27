"use client";

import { Schedule as ScheduleIcon, Warning as WarningIcon } from "@mui/icons-material";
import { Box, InputAdornment, useTheme } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";

type TabOption = {
    id: 0 | 1;
    label: string;
};

type DashboardTabFilterProps = {
    value: 0 | 1;
    onChange: (tab: 0 | 1) => void;
};

export default function DashboardTabFilter({
    value,
    onChange,
}: DashboardTabFilterProps) {
    const { t, i18n } = useTranslation("dashboard");
    const theme = useTheme();
    const isHebrew = i18n.language === "he";

    const options = useMemo<TabOption[]>(
        () => [
            { id: 0, label: t("fields.tabs_overdue") },
            { id: 1, label: t("fields.tabs_due") },
        ],
        [t]
    );

    const selectedOption =
        options.find((opt) => opt.id === value) ?? options[0];

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

    const TabIcon = value === 0 ? WarningIcon : ScheduleIcon;

    const startAdornment = (
        <InputAdornment position="start" sx={toolbarStartAdornmentSx}>
            <TabIcon
                sx={{
                    fontSize: "1.125rem",
                    color: "rgb(var(--primary-rgb))",
                }}
            />
        </InputAdornment>
    );

    const tabFilterSx = useMemo(
        () => ({
            minWidth: { xs: "100%", sm: theme.spacing(22.5) },
            width: { xs: "100%", sm: theme.spacing(22.5) },
            flexShrink: 0,
        }),
        [theme]
    );

    return (
        <Box
            sx={{
                direction: isHebrew ? "rtl" : "ltr",
                flexShrink: 0,
            }}
        >
            <ToolbarDropdownFilter<TabOption>
                value={selectedOption}
                onChange={(newValue) => {
                    if (newValue != null) {
                        onChange(newValue.id);
                    }
                }}
                options={options}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, v) => option.id === v.id}
                label={t("fields.toolbar_tab_label")}
                startAdornment={startAdornment}
                sx={tabFilterSx}
            />
        </Box>
    );
}
