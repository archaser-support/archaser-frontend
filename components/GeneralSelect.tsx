"use client";
import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { useTheme , ThemeProvider } from "@mui/material/styles";
import React from "react";

export type GeneralSelectOption = {
    value: any;
    label: string;
};

type GeneralSelectProps = {
    options: GeneralSelectOption[];
    placeholder: string;
    classNamePrefix?: string;
    value: any;
    onChange: (option: any) => void;
    isDisabled: boolean;
    formatOptionLabel?: (data: GeneralSelectOption) => React.ReactNode;
};

const GeneralSelect = ({
    options,
    placeholder,
    value,
    onChange,
    isDisabled,
    formatOptionLabel,
}: GeneralSelectProps) => {
    const outerTheme = useTheme();

    // Ensure the value passed is in the correct format
    const selectedValue = value
        ? options.find((option) => option.value === value) || null
        : null;

    return (
        <ThemeProvider theme={outerTheme}>
            <Autocomplete
                value={selectedValue}
                onChange={(_, newValue) => onChange?.(newValue)}
                options={options}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) =>
                    option.value === value?.value
                }
                disabled={isDisabled}
                renderOption={(props, option) => (
                    <li {...props}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            {formatOptionLabel ? (
                                formatOptionLabel(option)
                            ) : (
                                <Typography>{option.label}</Typography>
                            )}
                        </Box>
                    </li>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={placeholder}
                        variant="outlined"
                        fullWidth
                    />
                )}
            />
        </ThemeProvider>
    );
};

export default GeneralSelect;
