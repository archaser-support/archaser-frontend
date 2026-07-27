import { Autocomplete, Box, TextField } from "@mui/material";
import { alpha, SxProps, Theme, useTheme } from "@mui/material/styles";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

interface ToolbarDropdownFilterProps<T> {
    value: T | null;
    onChange: (value: T | null) => void;
    options: T[];
    getOptionLabel: (option: T) => string;
    placeholder?: string;
    isOptionEqualToValue?: (option: T, value: T) => boolean;
    /** Return option content only; ToolbarDropdownFilter wraps it in the list item. */
    renderOption?: (
        props: React.HTMLAttributes<HTMLLIElement> & { key: string | number },
        option: T
    ) => React.ReactNode;
    onOpen?: () => void;
    onClose?: () => void;
    startAdornment?: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
    filterOptions?: (
        options: T[],
        state: { inputValue: string }
    ) => T[];
    /** Optional sx to override or extend default width/styles (e.g. larger minWidth for business unit dropdown) */
    sx?: SxProps<Theme>;
    /** Outlined field label (always shown shrunk above the input) */
    label?: string;
    error?: boolean;
    required?: boolean;
    fullWidth?: boolean;
    noOptionsText?: string;
}

export function ToolbarDropdownFilter<T>({
    value,
    onChange,
    options,
    getOptionLabel,
    placeholder,
    isOptionEqualToValue,
    renderOption,
    onOpen,
    onClose,
    startAdornment,
    loading,
    disabled,
    filterOptions,
    sx: sxProp,
    label,
    error = false,
    required = false,
    fullWidth = false,
    noOptionsText,
}: ToolbarDropdownFilterProps<T>) {
    const { i18n } = useTranslation(["common"]);
    const theme = useTheme();

    const isHebrew = i18n.language === "he";
    const indicatorSize = 24;
    const toolbarInputLineHeightPx =
        theme.appButton.toolbarControl.height - 2;

    const inputRootHeight = theme.appButton.sizeSmall.height;

    const toolbarFieldWidth = fullWidth
        ? "100%"
        : { xs: "100%", sm: theme.spacing(22.5) };

    const toolbarDropdownStyles = useMemo(
        () => ({
            minWidth: toolbarFieldWidth,
            width: toolbarFieldWidth,
            flexShrink: 0,
            alignSelf: { xs: "stretch", sm: fullWidth ? "stretch" : "center" },
            overflow: label ? "visible" : undefined,
            ...(label
                ? {
                      "& .MuiFormControl-root, & .MuiTextField-root": {
                          width: "100%",
                          minWidth: "100%",
                      },
                  }
                : {}),
            "& .MuiFormControl-root": {
                minHeight: label ? "auto" : 0,
                margin: 0,
                marginBottom: 0,
                overflow: label ? "visible" : undefined,
            },
            "& .MuiAutocomplete-endAdornment": {
                top: "50%",
                transform: "translateY(-50%)",
                right: isHebrew ? "auto" : 9,
                left: isHebrew ? 9 : "auto",
                height: "auto !important",
                width: "auto",
                maxHeight: theme.appButton.sizeSmall.height,
                display: "flex",
                alignItems: "center",
                zIndex: 1,
            },
            ...(label
                ? {
                      "& .MuiTextField-root > .MuiInputLabel-root": {
                          fontSize: "0.75rem",
                          lineHeight: `${theme.typography.body2.lineHeight ?? 1.5} !important`,
                          overflow: "visible !important",
                          zIndex: 1,
                          backgroundColor: theme.palette.background.paper,
                          px: 0.5,
                          "&.MuiInputLabel-shrink": {
                              lineHeight: `${theme.typography.body2.lineHeight ?? 1.5} !important`,
                              overflow: "visible !important",
                              height: "auto !important",
                              minHeight: "14px",
                          },
                      },
                      "& .MuiOutlinedInput-notchedOutline legend": {
                          display: "block",
                          maxWidth: "1000px",
                      },
                      "& .MuiOutlinedInput-notchedOutline legend span": {
                          display: "inline",
                          padding: "0 4px",
                      },
                  }
                : {}),
            "& .MuiOutlinedInput-root": {
                height: inputRootHeight,
                minHeight: inputRootHeight,
                maxHeight: label ? "none" : inputRootHeight,
                margin: 0,
                display: "flex",
                alignItems: "center",
                padding: "0 !important",
                overflow: label ? "visible" : undefined,
                backgroundColor: "transparent",
                borderRadius: theme.appButton.borderRadius,
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                "& fieldset": {
                    borderColor: theme.palette.divider,
                    borderWidth: "1px",
                    borderRadius: theme.appButton.borderRadius,
                    overflow: "visible",
                },
                "&:hover fieldset": {
                    borderColor: theme.palette.divider,
                },
                "&.Mui-focused fieldset": {
                    borderColor: theme.palette.primary.main,
                    borderWidth: "1px",
                },
                ...(startAdornment
                    ? {
                          "&.MuiInputBase-adornedStart": {
                              paddingLeft: isHebrew
                                  ? "0 !important"
                                  : `${theme.spacing(1)} !important`,
                              paddingRight: isHebrew
                                  ? `${theme.spacing(1)} !important`
                                  : "0 !important",
                              gap: theme.spacing(0.5),
                          },
                      }
                    : {}),
            },
            "& .MuiAutocomplete-inputRoot": {
                padding: "0 !important",
                paddingRight: isHebrew
                    ? startAdornment
                        ? `${theme.spacing(1)} !important`
                        : "0 !important"
                    : "32px !important",
                paddingLeft: isHebrew ? "32px !important" : "0 !important",
            },
            "&.MuiAutocomplete-hasPopupIcon.MuiAutocomplete-hasClearIcon .MuiAutocomplete-inputRoot":
                {
                    paddingRight: isHebrew
                        ? startAdornment
                            ? `${theme.spacing(1)} !important`
                            : "0 !important"
                        : `${theme.spacing(7)} !important`,
                    paddingLeft: isHebrew
                        ? `${theme.spacing(7)} !important`
                        : "0 !important",
                },
            "& .MuiOutlinedInput-input, & .MuiInputBase-input, & input.MuiInputBase-inputSizeSmall":
            {
                flex: "1 1 auto",
                minWidth: label ? theme.spacing(6) : 0,
                margin: "0 !important",
                padding: startAdornment
                    ? isHebrew
                      ? "0 0 0 8px !important"
                      : "0 8px 0 0 !important"
                    : "0 8px !important",
                fontSize: { xs: "0.75rem", sm: "0.8125rem", md: "0.875rem" },
                height: `${toolbarInputLineHeightPx}px !important`,
                minHeight: `${toolbarInputLineHeightPx}px !important`,
                maxHeight: `${toolbarInputLineHeightPx}px !important`,
                lineHeight: `${toolbarInputLineHeightPx}px !important`,
                alignSelf: "center",
                textAlign: isHebrew ? "right" : "left",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                boxSizing: "border-box",
                appearance: "none",
                WebkitAppearance: "none",
            },
            "& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator": {
                width: indicatorSize,
                height: indicatorSize,
                minWidth: indicatorSize,
                minHeight: indicatorSize,
                maxWidth: indicatorSize,
                maxHeight: indicatorSize,
                padding: 0.5,
                flexShrink: 0,
                color: "rgb(var(--primary-rgb))",
                backgroundColor: "transparent",
                "&:hover": {
                    backgroundColor: "rgba(var(--primary-rgb), 0.08)",
                },
                "& .MuiSvgIcon-root": {
                    fontSize: "1.125rem",
                    color: "inherit",
                },
            },
            "& .MuiInputAdornment-root": {
                margin: "0 !important",
                paddingTop: 0,
                paddingBottom: 0,
                height: "auto !important",
                maxHeight: "none !important",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "center",
                flexShrink: 0,
                minWidth: "auto",
                width: "auto",
                "& > span.notranslate": {
                    display: "none",
                    width: 0,
                    minWidth: 0,
                },
            },
            ...(startAdornment
                ? {
                      "& .MuiInputAdornment-positionStart": {
                          marginLeft: 0,
                          marginRight: isHebrew ? 0 : theme.spacing(0.5),
                          paddingLeft: isHebrew
                              ? 0
                              : `${theme.spacing(1)} !important`,
                          paddingRight: isHebrew
                              ? `${theme.spacing(1)} !important`
                              : 0,
                          minWidth: "auto",
                          width: "auto",
                      },
                  }
                : {}),
            "& .MuiAutocomplete-paper": {
                direction: isHebrew ? "rtl" : "ltr",
                "& .MuiAutocomplete-listbox": {
                    direction: isHebrew ? "rtl" : "ltr",
                },
            },
        }),
        [
            theme,
            isHebrew,
            indicatorSize,
            toolbarInputLineHeightPx,
            startAdornment,
            label,
            inputRootHeight,
            fullWidth,
            toolbarFieldWidth,
        ]
    );

    const optionStyles = useMemo(
        () => ({
            fontSize: theme.typography.body2.fontSize || "0.875rem",
            color: theme.palette.text.primary,
            direction: i18n.language === "he" ? "rtl" : "ltr",
            textAlign: i18n.language === "he" ? "right" : "left",
            "&.Mui-focused": {
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
            "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.15),
            },
        }),
        [theme, i18n.language]
    );

    const handleChange = useCallback(
        (_event: unknown, newValue: T | null) => {
            onChange(newValue);
        },
        [onChange]
    );

    const defaultIsOptionEqualToValue = useCallback(
        (option: T, value: T) => option === value,
        []
    );

    return (
        <Autocomplete
            className={
                label
                    ? "toolbar-autocomplete toolbar-autocomplete-labeled"
                    : "toolbar-autocomplete"
            }
            value={value}
            onChange={handleChange}
            options={options}
            getOptionLabel={getOptionLabel}
            isOptionEqualToValue={
                isOptionEqualToValue || defaultIsOptionEqualToValue
            }
            filterOptions={filterOptions}
            loading={loading}
            disabled={disabled}
            noOptionsText={noOptionsText}
            onOpen={onOpen}
            onClose={onClose}
            slotProps={{
                popupIndicator: { size: "small" },
                clearIndicator: { size: "small" },
            }}
            dir={i18n.language === "he" ? "rtl" : "ltr"}
            {...(i18n.language === "he" && {
                "data-hebrew": true,
                "data-rtl": true,
            })}
            sx={
                (sxProp
                    ? [toolbarDropdownStyles, sxProp]
                    : toolbarDropdownStyles) as SxProps<Theme>
            }
            renderInput={(params) => {
                const { InputProps: paramsInputProps, ...textFieldParams } =
                    params;
                return (
                    <TextField
                        {...textFieldParams}
                        margin="none"
                        size="small"
                        fullWidth={fullWidth || Boolean(label)}
                        label={label}
                        placeholder={placeholder}
                        variant="outlined"
                        error={error}
                        required={required}
                        InputLabelProps={{
                            shrink: true,
                        }}
                        slotProps={{
                            input: {
                                ...paramsInputProps,
                                className: [
                                    label
                                        ? "input-toolbar-labeled"
                                        : "input-toolbar-height",
                                    paramsInputProps?.className,
                                ]
                                    .filter(Boolean)
                                    .join(" "),
                                startAdornment: startAdornment ? (
                                    <>
                                        {startAdornment}
                                        {paramsInputProps?.startAdornment}
                                    </>
                                ) : (
                                    paramsInputProps?.startAdornment
                                ),
                            },
                        }}
                    />
                );
            }}
            renderOption={(props, option) => {
                const { key, ...restProps } = props;
                return (
                    <Box
                        key={key}
                        component="li"
                        {...restProps}
                        sx={{
                            ...optionStyles,
                            ...(renderOption
                                ? {
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                      padding: "8px 12px",
                                  }
                                : {}),
                        }}
                    >
                        {renderOption
                            ? renderOption(
                                  props as React.HTMLAttributes<HTMLLIElement> & {
                                      key: string | number;
                                  },
                                  option
                              )
                            : getOptionLabel(option)}
                    </Box>
                );
            }}
        />
    );
}
