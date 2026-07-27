import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import { IconButton, Popover, Box, Typography, Button, TextField, MenuItem, FormControl, InputLabel, Select, Badge , CircularProgress } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const CustomFilterButton: React.FC = () => {
    const { t, i18n } = useTranslation(["common"]);
    const apiRef = useGridApiContext();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [filter, setFilter] = useState<{ id: string, field: string, operator: string, value: string } | null>(null);
    const [activeFiltersCount, setActiveFiltersCount] = useState(0);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    // Check if apiRef is available and has the necessary methods
    const isApiRefReady = apiRef && apiRef.current && typeof apiRef.current.getAllColumns === 'function';

    // Get available columns for filtering
    let columns: any[] = [];
    if (isApiRefReady) {
        columns = apiRef.current.getAllColumns();
    }

    // Load existing filter when popover opens
    React.useEffect(() => {
        if (open && isApiRefReady && apiRef.current) {
            try {
                // Try to get filter model from state
                const state = apiRef.current.state;
                if (state && state.filter && state.filter.filterModel && state.filter.filterModel.items) {
                    const existingItems = state.filter.filterModel.items;

                    // Find our custom filter (those with IDs starting with 'filter-')
                    const customFilter = existingItems
                        .filter((item: any) => item.id && typeof item.id === 'string' && item.id.startsWith('filter-'))
                        .map((item: any) => ({
                            id: item.id,
                            field: item.field,
                            operator: item.operator,
                            value: item.value
                        }))[0]; // Only take the first filter

                    if (customFilter) {
                        setFilter(customFilter);
                    }
                }
            } catch (error) {
                // If we can't read the state, start with empty filter
            }
        }
    }, [open, isApiRefReady]);

    // Update active filters count
    React.useEffect(() => {
        setActiveFiltersCount(filter && filter.value && filter.value.trim() !== '' ? 1 : 0);
    }, [filter]);

    // Auto-create a filter when columns are available and no filter exists
    React.useEffect(() => {
        if (isApiRefReady && columns.length > 0 && !filter) {
            const defaultFilter = {
                id: `filter-${Date.now()}`,
                field: columns[0]?.field || '',
                operator: 'contains',
                value: ''
            };
            setFilter(defaultFilter);
        }
    }, [isApiRefReady, columns, filter]);

    const addFilter = () => {
        const newFilter = {
            id: `filter-${Date.now()}`,
            field: columns[0]?.field || '',
            operator: 'contains',
            value: ''
        };
        setFilter(newFilter);
    };

    const removeFilter = () => {
        setFilter(null);
    };

    const updateFilter = (field: string, value: any) => {
        if (filter) {
            setFilter({ ...filter, [field]: value });
        }
    };

    const applyFilters = () => {
        if (isApiRefReady && apiRef.current) {
            try {
                // Get current filter model to preserve other filters
                const state = apiRef.current.state;
                const currentItems = state?.filter?.filterModel?.items || [];

                if (!filter || !filter.value || filter.value.trim() === '') {
                    // No valid filter, clear all filters
                    apiRef.current.setFilterModel({ items: [] });
                } else {
                    // Apply the single filter
                    const filterItem = {
                        id: filter.id,
                        field: filter.field,
                        operator: filter.operator,
                        value: filter.value
                    };

                    // Remove our custom filters from existing items, then add the new one
                    const otherFilters = currentItems.filter((item: any) =>
                        !item.id || (typeof item.id === 'string' && !item.id.startsWith('filter-'))
                    );

                    const newFilterModel = {
                        items: [...otherFilters, filterItem]
                    };

                    apiRef.current.setFilterModel(newFilterModel);
                }
            } catch (error) {
                // If we can't read the state, just apply the single filter
                if (filter && filter.value && filter.value.trim() !== '') {
                    apiRef.current.setFilterModel({
                        items: [{
                            id: filter.id,
                            field: filter.field,
                            operator: filter.operator,
                            value: filter.value
                        }]
                    });
                } else {
                    apiRef.current.setFilterModel({ items: [] });
                }
            }
        }
        handleClose();
    };

    const clearFilters = () => {
        if (isApiRefReady && apiRef.current) {
            try {
                // Get current filter model
                const state = apiRef.current.state;
                const currentItems = state?.filter?.filterModel?.items || [];

                // Remove only our custom filters, keep other filters
                const otherFilters = currentItems.filter((item: any) =>
                    !item.id || (typeof item.id === 'string' && !item.id.startsWith('filter-'))
                );

                const newFilterModel = {
                    items: otherFilters
                };

                apiRef.current.setFilterModel(newFilterModel);
            } catch (error) {
                // If we can't read the state, clear all filters
                apiRef.current.setFilterModel({ items: [] });
            }
        }
        setFilter(null);
        handleClose();
    };

    return (
        <>
            <Badge badgeContent={activeFiltersCount} color="primary" max={9}>
                <Button
                    onClick={handleClick}
                    startIcon={<FilterListIcon fontSize="small" />}
                    sx={{
                        minHeight: { xs: "20px", sm: "24px", md: "28px" },
                        padding: {
                            xs: "0px 4px",
                            sm: "2px 8px",
                            md: "4px 12px",
                        },
                        fontSize: {
                            xs: "0.7rem",
                            sm: "0.75rem",
                            md: "0.8rem",
                        },
                        textTransform: "none",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        "& .MuiButton-startIcon": {
                            marginRight: i18n.language === "he" ? 0 : "8px",
                            marginLeft: i18n.language === "he" ? "8px" : 0,
                        },
                    }}
                >
                    {t("common.filters")}
                </Button>
            </Badge>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: i18n.language === "he" ? 'left' : 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: i18n.language === "he" ? 'left' : 'right',
                }}
                sx={{
                    '& .MuiPopover-paper': {
                        marginTop: '8px',
                        minWidth: 300,
                        ...(i18n.language === "he" ? {
                            left: '24px',
                            right: 'auto !important'
                        } : {
                            right: '24px',
                            left: 'auto !important'
                        })
                    },
                }}
            >
                <Box sx={{ p: 1.5 }}>
                    {isApiRefReady ? (
                        <Box>
                            {/* Header */}
                            <Box sx={{
                                mb: 1.5,
                                width: "100%",
                                textAlign: i18n.language === "he" ? "right" : "left",
                                direction: i18n.language === "he" ? "rtl" : "ltr"
                            }}>
                                <Typography
                                    variant="subtitle1"
                                    sx={{
                                        fontWeight: 600,
                                        textAlign: "inherit",
                                        direction: "inherit"
                                    }}
                                >
                                    {t("common.filter")}
                                </Typography>
                            </Box >

                            {/* Filter form */}
                            {
                                filter && (
                                    <Box sx={{
                                        display: 'flex',
                                        gap: 1,
                                        mb: 1.5,
                                        alignItems: 'center',
                                        direction: i18n.language === "he" ? "rtl" : "ltr"
                                    }}>
                                        <FormControl sx={{ minWidth: 100 }}>
                                            <Select
                                                value={filter.field}
                                                onChange={(e) => updateFilter('field', e.target.value)}
                                                sx={{
                                                    direction: i18n.language === "he" ? "rtl" : "ltr",
                                                    // Override global theme RTL styles with higher specificity
                                                    "&.MuiSelect-root .MuiSelect-select": {
                                                        textAlign: i18n.language === "he" ? "right" : "left",
                                                        direction: i18n.language === "he" ? "rtl" : "ltr",
                                                        paddingRight: i18n.language === "he" ? "32px" : "14px",
                                                        paddingLeft: i18n.language === "he" ? "14px" : "32px"
                                                    },
                                                    "&.MuiSelect-root .MuiSelect-icon": {
                                                        right: i18n.language === "he" ? "auto" : "14px",
                                                        left: i18n.language === "he" ? "14px" : "auto"
                                                    },
                                                    "& .MuiMenuItem-root": {
                                                        textAlign: i18n.language === "he" ? "right" : "left",
                                                        direction: i18n.language === "he" ? "rtl" : "ltr"
                                                    }
                                                }}
                                            >
                                                {columns.map((column: any) => (
                                                    <MenuItem
                                                        key={column.field}
                                                        value={column.field}
                                                    >
                                                        {column.headerName || column.field}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>

                                        <FormControl sx={{ minWidth: 80 }}>
                                            <Select
                                                value={filter.operator}
                                                onChange={(e) => updateFilter('operator', e.target.value)}
                                                dir={i18n.language === "he" ? "rtl" : "ltr"}
                                            >
                                                <MenuItem
                                                    value="contains"
                                                >
                                                    {t("common.contains")}
                                                </MenuItem>
                                                <MenuItem
                                                    value="equals"
                                                >
                                                    {t("common.equals")}
                                                </MenuItem>
                                                <MenuItem
                                                    value="startsWith"
                                                >
                                                    {t("common.startsWith")}
                                                </MenuItem>
                                                <MenuItem
                                                    value="endsWith"
                                                >
                                                    {t("common.endsWith")}
                                                </MenuItem>
                                            </Select>
                                        </FormControl>

                                        <TextField
                                            placeholder={t("common.value")}
                                            value={filter.value}
                                            onChange={(e) => updateFilter('value', e.target.value)}
                                            sx={{
                                                flexGrow: 1,
                                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                                "& .MuiInputBase-input": {
                                                    textAlign: i18n.language === "he" ? "right" : "left"
                                                }
                                            }}
                                        />
                                    </Box>
                                )
                            }

                            {/* Action buttons */}
                            <Box sx={{
                                display: 'flex',
                                gap: 1,
                                justifyContent: i18n.language === "he" ? "flex-start" : "flex-end",
                                pt: 1,
                                borderTop: 1,
                                borderColor: 'divider',
                                direction: i18n.language === "he" ? "rtl" : "ltr"
                            }}>
                                <Button
                                    onClick={clearFilters}
                                    sx={{
                                        direction: i18n.language === "he" ? "rtl" : "ltr",
                                        textAlign: i18n.language === "he" ? "right" : "left"
                                    }}
                                >
                                    {t("common.clear")}
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={applyFilters}
                                    sx={{
                                        direction: i18n.language === "he" ? "rtl" : "ltr",
                                        textAlign: i18n.language === "he" ? "right" : "left"
                                    }}
                                >
                                    {t("common.apply")}
                                </Button>
                            </Box>
                        </Box >
                    ) : (
                        <CircularProgress size={16} />
                    )}
                </Box >
            </Popover >
        </>
    );
};

export default CustomFilterButton;
