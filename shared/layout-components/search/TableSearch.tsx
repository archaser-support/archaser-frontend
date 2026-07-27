import {
    Search as SearchIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import {
    Box,
    TextField,
    IconButton,
    InputAdornment,
    useTheme
} from '@mui/material';
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';

interface TableSearchProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
    disabled?: boolean;
    fullWidth?: boolean;
    maxWidth?: number | string;
    direction?: 'ltr' | 'rtl';
    onFocus?: () => void;
    onBlur?: () => void;
}

const TableSearchComponent: React.FC<TableSearchProps> = ({
    searchValue,
    onSearchChange,
    placeholder,
    debounceMs = 1000,
    disabled = false,
    fullWidth = false,
    maxWidth,
    direction = 'ltr',
    onFocus,
    onBlur
}) => {
    const theme = useTheme();
    const { t } = useTranslation(["common"]);
    const [localValue, setLocalValue] = useState(searchValue);
    const [debouncedValue] = useDebounce(localValue, debounceMs);
    const inputRef = useRef<HTMLInputElement>(null);
    const isUserTyping = useRef(false);
    const lastExternalValue = useRef(searchValue);
    const onSearchChangeRef = useRef(onSearchChange);

    // Keep the ref updated
    useEffect(() => {
        onSearchChangeRef.current = onSearchChange;
    }, [onSearchChange]);

    // Update parent when debounced value changes - use ref to avoid dependency
    useEffect(() => {
        if (debouncedValue !== searchValue) {
            onSearchChangeRef.current(debouncedValue);
        }
    }, [debouncedValue, searchValue]);

    // Only sync with external changes when the user is not typing and the value actually changed
    // This effect is now completely isolated from re-renders
    useEffect(() => {
        if (!isUserTyping.current && searchValue !== lastExternalValue.current) {
            setLocalValue(searchValue);
            lastExternalValue.current = searchValue;
        }
    }, [searchValue]);

    // Initialize local value only once on mount
    useEffect(() => {
        setLocalValue(searchValue);
        lastExternalValue.current = searchValue;
    }, []); // Empty dependency array - only run once

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        isUserTyping.current = true;
        setLocalValue(value);

        // Reset typing flag after a much longer delay to prevent interference during API calls
        setTimeout(() => {
            isUserTyping.current = false;
        }, 2000);
    }, []);

    const handleClear = useCallback(() => {
        isUserTyping.current = false;
        setLocalValue('');
        onSearchChangeRef.current('');
        lastExternalValue.current = '';
        // Maintain focus after clearing
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleFocus = useCallback(() => {
        isUserTyping.current = true;
        onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
        // Delay resetting typing flag to allow for programmatic focus
        // Use a longer delay to prevent interference during API calls
        setTimeout(() => {
            isUserTyping.current = false;
        }, 1000);
        onBlur?.();
    }, [onBlur]);

    return (
        <TextField
            inputRef={inputRef}
            fullWidth={fullWidth}
            placeholder={placeholder || t('common.actions.search', 'Search')}
            value={localValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            dir={direction}
            sx={{
                width: { xs: "100%", sm: "auto" },
                minWidth: { xs: "100%", sm: "160px", md: "200px" },
                maxWidth: maxWidth || "none",
                padding: {
                    xs: "0px !important",
                    sm: "0px !important",
                    md: "0px !important",
                },
                margin: {
                    xs: "0px !important",
                    sm: "0px !important",
                    md: "0px !important",
                },
                "& .MuiInputBase-root": {
                    border: "none",
                    backgroundColor: "transparent",
                    height: { xs: "20px", sm: "24px", md: "28px" },
                    padding: {
                        xs: "0px !important",
                        sm: "0px !important",
                        md: "0px !important",
                    },
                    margin: {
                        xs: "0px !important",
                        sm: "0px !important",
                        md: "0px !important",
                    },
                },
                "& .MuiOutlinedInput-root": {
                    border: "none",
                    backgroundColor: "transparent",
                    height: { xs: "20px", sm: "24px", md: "28px" },
                    padding: {
                        xs: "0px !important",
                        sm: "0px !important",
                        md: "0px !important",
                    },
                    margin: {
                        xs: "0px !important",
                        sm: "0px !important",
                        md: "0px !important",
                    },
                },
                "& fieldset": {
                    border: "none",
                },
                "& .MuiOutlinedInput-notchedOutline": {
                    border: "none",
                },
                "& .MuiInputBase-input": {
                    padding: {
                        xs: "1px 4px",
                        sm: "2px 6px",
                        md: "4px 8px",
                    },
                    fontSize: {
                        xs: "0.7rem",
                        sm: "0.75rem",
                        md: "0.8rem",
                    },
                    textAlign: direction === 'rtl' ? 'right' : 'left',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    borderRadius: 0,
                    transition: 'border-bottom-color 0.2s ease-in-out',
                },
                "& .MuiInputBase-input:focus": {
                    borderBottom: `2px solid ${theme.palette.primary.main}`,
                    outline: 'none',
                },
                "& .MuiInputBase-input:hover": {
                    borderBottom: `1px solid ${theme.palette.primary.light}`,
                },
            }}
            InputProps={{
                startAdornment: direction === 'rtl' ? null : (
                    <InputAdornment position="start">
                        <SearchIcon
                            sx={{
                                color: theme.palette.grey[500],
                                fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" }
                            }}
                        />
                    </InputAdornment>
                ),
                endAdornment: (
                    <>
                        {localValue && (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={handleClear}
                                    sx={{
                                        p: 0,
                                        color: theme.palette.grey[500],
                                        fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" },
                                        minHeight: { xs: "20px", sm: "24px", md: "28px" },
                                        minWidth: { xs: "20px", sm: "24px", md: "28px" },
                                        '&:hover': {
                                            color: theme.palette.grey[700]
                                        }
                                    }}
                                >
                                    <ClearIcon sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" } }} />
                                </IconButton>
                            </InputAdornment>
                        )}
                        {direction === 'rtl' && (
                            <InputAdornment position="start">
                                <SearchIcon
                                    sx={{
                                        color: theme.palette.grey[500],
                                        fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" }
                                    }}
                                />
                            </InputAdornment>
                        )}
                    </>
                ),
            }}
        />
    );
};

// Memoize the component to prevent re-renders unless props actually change
export const TableSearch = memo(TableSearchComponent, (prevProps, nextProps) => {
    // Only re-render if disabled or placeholder changes, NEVER re-render for searchValue changes
    // This ensures the component stays stable during API calls
    return prevProps.disabled === nextProps.disabled &&
        prevProps.placeholder === nextProps.placeholder;
});

export default TableSearch;
