"use client";
import { CalendarToday as CalendarTodayIcon } from "@mui/icons-material";
import { Box, InputAdornment, useTheme } from "@mui/material";

import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import moment from "moment";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getDatePickerFormat } from "@/utils/datetimeOperations";
import {
    detectDateRangePreset,
    isSameLocalCalendarDay,
    resolvePresetAfterDateCommit,
    type DatePreset,
} from "./dateRangePreset";

interface PresetOption {
    value: DatePreset;
    label: string;
}

interface DateRangePickerProps {
    startDate: Date;
    endDate: Date;
    onStartDateChange: (date: Date) => void;
    onEndDateChange: (date: Date) => void;
    /** When both bounds change together (preset), prefer this over sequential start/end callbacks. */
    onDateRangeChange?: (start: Date, end: Date) => void;
}

/** Slightly wider than default toolbar (22.5) for Hebrew preset labels + calendar icon. */
const DATE_RANGE_FILTER_WIDTH_SPACING = 24;

const DateRangePicker: React.FC<DateRangePickerProps> = ({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onDateRangeChange,
}) => {
    const { t, i18n } = useTranslation(["dashboard"]);
    const { data: session } = useSession();
    const theme = useTheme();
    const [preset, setPreset] = useState<DatePreset>("today");
    const [showCustomDates, setShowCustomDates] = useState(false);
    const presetRef = useRef(preset);
    presetRef.current = preset;

    const [tempStartDate, setTempStartDate] = useState<moment.Moment | null>(moment(startDate));
    const [tempEndDate, setTempEndDate] = useState<moment.Moment | null>(moment(endDate));

    useEffect(() => {
        setTempStartDate(moment(startDate));
    }, [startDate]);

    useEffect(() => {
        setTempEndDate(moment(endDate));
    }, [endDate]);

    const datePickerFormat = useMemo(
        () =>
            i18n.language === "he"
                ? "DD/MM/YYYY"
                : getDatePickerFormat(session ?? null, "DD/MM/YYYY"),
        [session, i18n.language]
    );

    const isRTL = i18n.language === "he";
    const isHebrew = i18n.language === "he";

    /** Custom start/end pickers — wide enough for DD/MM/YYYY + calendar adornment. */
    const betweenRangePickerLayoutSx = useMemo(() => {
        // Hebrew labels (e.g. תאריך התחלה) need a bit more notch room.
        const pickerWidthPx = isHebrew ? 184 : 168;
        return {
            row: {
                display: "flex",
                gap: 2.5,
                alignItems: "center",
                width: "auto",
                flexWrap: "nowrap" as const,
                flexShrink: 0,
            },
            item: {
                flex: `0 0 ${pickerWidthPx}px`,
                width: pickerWidthPx,
                minWidth: pickerWidthPx,
                maxWidth: pickerWidthPx,
            },
            /** Zero FormControl margin; keep picker inside the fixed item width. */
            textField: {
                margin: 0,
                width: "100%",
                maxWidth: "100%",
                "& .MuiFormControl-root": {
                    margin: 0,
                    marginBottom: 0,
                    width: "100%",
                    maxWidth: "100%",
                },
                "& .MuiPickersOutlinedInput-root, & .MuiOutlinedInput-root, & .MuiInputBase-root":
                    {
                        width: "100%",
                        maxWidth: "100%",
                    },
            },
        };
    }, [isHebrew]);

    /** Preset dropdown only — compact toolbar icon (custom dates use global picker styles like LogActivity). */
    const toolbarPresetIconSx = useMemo(
        () => ({
            fontSize: "1.125rem",
            color: "rgb(var(--secondary))",
        }),
        []
    );

    /** Toolbar labeled pickers — same 32px / legend layout as preset date-range filter. */
    const customRangeDatePickerSlotProps = useMemo(
        () => ({
            textField: {
                fullWidth: true,
                size: "small" as const,
                required: true,
                InputLabelProps: { shrink: true },
                ...(isHebrew && { "data-hebrew": true }),
                dir: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
                sx: betweenRangePickerLayoutSx.textField,
            },
        }),
        [isHebrew, isRTL, betweenRangePickerLayoutSx.textField]
    );

    const presetOptions: PresetOption[] = useMemo(
        () => [
            { value: "today", label: t("fields.date_preset_today") },
            { value: "yesterday", label: t("fields.date_preset_yesterday") },
            { value: "this_week", label: t("fields.date_preset_this_week") },
            { value: "last_week", label: t("fields.date_preset_last_week") },
            { value: "this_month", label: t("fields.date_preset_this_month") },
            { value: "last_month", label: t("fields.date_preset_last_month") },
            {
                value: "this_year",
                label: t("fields.date_preset_this_year", {
                    defaultValue: "This Year",
                }),
            },
            {
                value: "last_year",
                label: t("fields.date_preset_last_year", {
                    defaultValue: "Last Year",
                }),
            },
            { value: "custom", label: t("fields.date_preset_custom") },
        ],
        [t]
    );

    const selectedOption = useMemo(() => {
        return (
            presetOptions.find((opt) => opt.value === preset) ||
            presetOptions[0]
        );
    }, [preset, presetOptions]);

    const calculateDateRange = (
        presetValue: DatePreset
    ): { start: Date; end: Date } => {
        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        switch (presetValue) {
            case "today": {
                const start = new Date(today);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return { start, end };
            }
            case "yesterday": {
                const start = new Date(today);
                start.setDate(start.getDate() - 1);
                const end = new Date(start);
                end.setHours(23, 59, 59, 999);
                return { start, end };
            }
            case "this_week": {
                const start = new Date(today);
                start.setDate(today.getDate() - today.getDay());
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                return { start, end };
            }
            case "last_week": {
                const start = new Date(today);
                start.setDate(today.getDate() - today.getDay() - 7);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                return { start, end };
            }
            case "this_month": {
                const start = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    1
                );
                const end = new Date(
                    today.getFullYear(),
                    today.getMonth() + 1,
                    0,
                    23,
                    59,
                    59,
                    999
                );
                return { start, end };
            }
            case "last_month": {
                const start = new Date(
                    today.getFullYear(),
                    today.getMonth() - 1,
                    1
                );
                const end = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    0,
                    23,
                    59,
                    59,
                    999
                );
                return { start, end };
            }
            case "this_year": {
                const start = new Date(today.getFullYear(), 0, 1);
                const end = new Date(
                    today.getFullYear(),
                    11,
                    31,
                    23,
                    59,
                    59,
                    999
                );
                return { start, end };
            }
            case "last_year": {
                const year = today.getFullYear() - 1;
                const start = new Date(year, 0, 1);
                const end = new Date(year, 11, 31, 23, 59, 59, 999);
                return { start, end };
            }
            default:
                return { start: startDate, end: endDate };
        }
    };

    useEffect(() => {
        const detectedPreset = detectDateRangePreset(startDate, endDate);
        const nextPreset = resolvePresetAfterDateCommit(
            presetRef.current,
            detectedPreset
        );
        setPreset(nextPreset);
        setShowCustomDates(nextPreset === "custom");
    }, [startDate, endDate]);

    const handlePresetChange = (_: unknown, newValue: PresetOption | null) => {
        if (!newValue) return;

        const newPreset = newValue.value;
        setPreset(newPreset);

        if (newPreset === "custom") {
            setShowCustomDates(true);
        } else {
            setShowCustomDates(false);
            const { start, end } = calculateDateRange(newPreset);
            if (onDateRangeChange) {
                onDateRangeChange(start, end);
            } else {
                onStartDateChange(start);
                onEndDateChange(end);
            }
        }
    };

    const presetFilterSx = useMemo(
        () => ({
            minWidth: {
                xs: "100%",
                sm: theme.spacing(DATE_RANGE_FILTER_WIDTH_SPACING),
            },
            width: {
                xs: "100%",
                sm: theme.spacing(DATE_RANGE_FILTER_WIDTH_SPACING),
            },
            flexShrink: 0,
        }),
        [theme]
    );

    return (
        <Box
            sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                flexWrap: "nowrap",
            }}
        >
                <Box
                    className="endless-scroll-toolbar"
                    sx={{ flexShrink: 0, display: "inline-flex" }}
                >
                    <ToolbarDropdownFilter<PresetOption>
                        value={selectedOption}
                        onChange={(newValue) =>
                            handlePresetChange(null, newValue)
                        }
                        options={presetOptions}
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, value) =>
                            option.value === value.value
                        }
                        label={t("fields.toolbar_date_range_label")}
                        sx={presetFilterSx}
                        disableListboxScroll
                        startAdornment={
                            <InputAdornment position="start">
                                <CalendarTodayIcon sx={toolbarPresetIconSx} />
                            </InputAdornment>
                        }
                    />
                </Box>

                {showCustomDates && (
                    <Box
                        className="endless-scroll-toolbar"
                        sx={betweenRangePickerLayoutSx.row}
                    >
                        <Box sx={betweenRangePickerLayoutSx.item}>
                            <DatePicker
                                label={t(
                                    "fields.analytics_filters_start_date"
                                )}
                                value={tempStartDate}
                                onChange={(newValue) => {
                                    setTempStartDate(newValue);
                                }}
                                onAccept={(newValue) => {
                                    if (newValue && newValue.isValid()) {
                                        const next = newValue.toDate();
                                        if (!isSameLocalCalendarDay(next, startDate)) {
                                            onStartDateChange(next);
                                        }
                                    }
                                }}
                                maxDate={tempEndDate || undefined}
                                format={datePickerFormat}
                                slotProps={{
                                    ...customRangeDatePickerSlotProps,
                                    textField: {
                                        ...customRangeDatePickerSlotProps.textField,
                                        onBlur: () => {
                                            if (tempStartDate && tempStartDate.isValid()) {
                                                const next = tempStartDate.toDate();
                                                if (!isSameLocalCalendarDay(next, startDate)) {
                                                    onStartDateChange(next);
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        </Box>
                        <Box sx={betweenRangePickerLayoutSx.item}>
                            <DatePicker
                                label={t("fields.analytics_filters_end_date")}
                                value={tempEndDate}
                                onChange={(newValue) => {
                                    setTempEndDate(newValue);
                                }}
                                onAccept={(newValue) => {
                                    if (newValue && newValue.isValid()) {
                                        const next = newValue.toDate();
                                        if (!isSameLocalCalendarDay(next, endDate)) {
                                            onEndDateChange(next);
                                        }
                                    }
                                }}
                                minDate={tempStartDate || undefined}
                                format={datePickerFormat}
                                slotProps={{
                                    ...customRangeDatePickerSlotProps,
                                    textField: {
                                        ...customRangeDatePickerSlotProps.textField,
                                        onBlur: () => {
                                            if (tempEndDate && tempEndDate.isValid()) {
                                                const next = tempEndDate.toDate();
                                                if (!isSameLocalCalendarDay(next, endDate)) {
                                                    onEndDateChange(next);
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        </Box>
                    </Box>
                )}
        </Box>
    );
};

export default DateRangePicker;
