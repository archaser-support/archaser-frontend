"use client";

import {
    Groups as GroupsIcon,
    Person as PersonIcon,
} from "@mui/icons-material";
import { Box, InputAdornment, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";

type ViewModeOption = {
    id: "child" | "parent";
    label: string;
};

type DashboardViewByFilterProps = {
    value: "child" | "parent";
    onChange: (mode: "child" | "parent") => void;
};

const VIEW_BY_FILTER_WIDTH_SPACING = 38;

export default function DashboardViewByFilter({
    value,
    onChange,
}: DashboardViewByFilterProps) {
    const { t, i18n } = useTranslation("dashboard");
    const theme = useTheme();
    const isHebrew = i18n.language === "he";

    const options = useMemo<ViewModeOption[]>(
        () => [
            {
                id: "child",
                label: t("fields.view_mode_child"),
            },
            {
                id: "parent",
                label: t("fields.view_mode_parent"),
            },
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

    const viewByFilterSx = useMemo(
        () => ({
            minWidth: {
                xs: "100%",
                sm: theme.spacing(VIEW_BY_FILTER_WIDTH_SPACING),
            },
            width: {
                xs: "100%",
                sm: theme.spacing(VIEW_BY_FILTER_WIDTH_SPACING),
            },
            flexShrink: 0,
        }),
        [theme]
    );

    const ViewIcon = value === "child" ? PersonIcon : GroupsIcon;

    const startAdornment = (
        <InputAdornment position="start" sx={toolbarStartAdornmentSx}>
            <ViewIcon
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
            <ToolbarDropdownFilter<ViewModeOption>
                value={selectedOption}
                onChange={(newValue) => {
                    if (newValue != null) {
                        onChange(newValue.id);
                    }
                }}
                options={options}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, v) => option.id === v.id}
                label={t("fields.view_by")}
                startAdornment={startAdornment}
                sx={viewByFilterSx}
                renderOption={(_props, option) => {
                    const OptionIcon =
                        option.id === "child" ? PersonIcon : GroupsIcon;
                    return (
                        <>
                            <OptionIcon
                                sx={{
                                    fontSize: "1.125rem",
                                    color: "rgb(var(--primary-rgb))",
                                }}
                            />
                            <Typography variant="body2">
                                {option.label}
                            </Typography>
                        </>
                    );
                }}
            />
        </Box>
    );
}
