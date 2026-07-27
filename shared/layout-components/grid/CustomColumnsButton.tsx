import SearchIcon from '@mui/icons-material/Search';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { Button, Popover, Box, Typography, FormControlLabel, Checkbox, TextField, InputAdornment , CircularProgress } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const CustomColumnsButton: React.FC = () => {
    const { t, i18n } = useTranslation(["common"]);
    const apiRef = useGridApiContext();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [columnStates, setColumnStates] = useState<Record<string, boolean>>({});
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
        setSearchTerm('');
    };

    // Check if apiRef is available and has the necessary methods
    const isApiRefReady = apiRef && apiRef.current && typeof apiRef.current.getAllColumns === 'function';

    // Get available columns for visibility control
    let columns: any[] = [];
    if (isApiRefReady) {
        columns = apiRef.current.getAllColumns();
    }

    // Filter columns based on search term
    const filteredColumns = columns.filter((column: any) =>
        (column.headerName || column.field).toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Initialize column states when popover opens
    React.useEffect(() => {
        if (open && isApiRefReady && columns.length > 0) {
            const initialStates: Record<string, boolean> = {};
            columns.forEach((column: any) => {
                // Read the actual current state from the DataGrid
                try {
                    // Try multiple methods to get the current visibility state
                    let isVisible = true;

                    // Method 1: Check if column has hide property
                    if (column.hide !== undefined) {
                        isVisible = !column.hide;
                    } else {
                        // Method 2: Check visible columns list
                        const visibleColumns = apiRef.current.getVisibleColumns();
                        isVisible = visibleColumns.some((col: any) => col.field === column.field);
                    }

                    initialStates[column.field] = isVisible;
                } catch (error) {
                    // Fallback to visible if we can't read the state
                    initialStates[column.field] = true;
                }
            });
            setColumnStates(initialStates);
            setRefreshKey(prev => prev + 1);
        }
    }, [open, isApiRefReady, columns]);

    // Check if a column is visible using our local state
    const isColumnVisible = (field: string) => {
        return columnStates[field] !== false;
    };

    const handleColumnVisibilityChange = (field: string, visible: boolean) => {
        if (apiRef && apiRef.current) {
            apiRef.current.setColumnVisibility(field, visible);
            // Update our local state
            setColumnStates(prev => ({
                ...prev,
                [field]: visible
            }));
        }
    };

    const handleShowAll = () => {
        if (apiRef && apiRef.current) {
            const newStates: Record<string, boolean> = {};
            columns.forEach((column: any) => {
                apiRef.current.setColumnVisibility(column.field, true);
                newStates[column.field] = true;
            });
            setColumnStates(newStates);
        }
    };

    const handleHideAll = () => {
        if (apiRef && apiRef.current) {
            const newStates: Record<string, boolean> = {};
            columns.forEach((column: any) => {
                apiRef.current.setColumnVisibility(column.field, false);
                newStates[column.field] = false;
            });
            setColumnStates(newStates);
        }
    };

    return (
        <>
            <Button
                size="small"
                onClick={handleClick}
                startIcon={<ViewColumnIcon fontSize="small" />}
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
                {t("common.columns")}
            </Button>
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
                        minWidth: 250,
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
                                display: 'flex',
                                justifyContent: i18n.language === "he" ? "flex-end" : "space-between",
                                alignItems: 'center',
                                mb: 1.5,
                                direction: i18n.language === "he" ? "rtl" : "ltr"
                            }}>
                                <Typography
                                    variant="subtitle1"
                                    sx={{
                                        fontWeight: 600,
                                        textAlign: i18n.language === "he" ? "right" : "left",
                                        direction: i18n.language === "he" ? "rtl" : "ltr"
                                    }}
                                >
                                    {t("common.columns")}
                                </Typography>
                                <Box sx={{
                                    display: 'flex',
                                    gap: 0.5,
                                    direction: i18n.language === "he" ? "rtl" : "ltr"
                                }}>
                                    <Button
                                        size="small"
                                        onClick={handleShowAll}
                                        variant="outlined"
                                        sx={{
                                            fontSize: '0.75rem',
                                            px: 1,
                                            direction: i18n.language === "he" ? "rtl" : "ltr",
                                            textAlign: i18n.language === "he" ? "right" : "left"
                                        }}
                                    >
                                        {t("common.showAll")}
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={handleHideAll}
                                        variant="outlined"
                                        sx={{
                                            fontSize: '0.75rem',
                                            px: 1,
                                            direction: i18n.language === "he" ? "rtl" : "ltr",
                                            textAlign: i18n.language === "he" ? "right" : "left"
                                        }}
                                    >
                                        {t("common.hideAll")}
                                    </Button>
                                </Box>
                            </Box>

                            {/* Search */}
                            <TextField
                                size="small"
                                placeholder={t("common.searchColumns")}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    mb: 1.5,
                                    width: '100%',
                                    direction: i18n.language === "he" ? "rtl" : "ltr",
                                    "& .MuiInputBase-input": {
                                        textAlign: i18n.language === "he" ? "right" : "left"
                                    }
                                }}
                            />

                            {/* Columns list */}
                            <Box sx={{
                                maxHeight: 250,
                                overflow: 'auto',
                                direction: i18n.language === "he" ? "rtl" : "ltr"
                            }} key={refreshKey}>
                                {filteredColumns.length > 0 ? (
                                    filteredColumns.map((column: any) => (
                                        <FormControlLabel
                                            key={column.field}
                                            control={
                                                <Checkbox
                                                    checked={isColumnVisible(column.field)}
                                                    onChange={(e) => handleColumnVisibilityChange(column.field, e.target.checked)}
                                                    size="small"
                                                    sx={{
                                                        padding: '2px 10px 2px 11px !important',
                                                    }}
                                                />
                                            }
                                            label={column.headerName || column.field}
                                            sx={{
                                                display: 'flex',
                                                width: '100%',
                                                mb: 0.5,
                                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                                '& .MuiFormControlLabel-label': {
                                                    fontSize: '0.875rem',
                                                    textAlign: i18n.language === "he" ? "right" : "left"
                                                }
                                            }}
                                        />
                                    ))
                                ) : (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            textAlign: i18n.language === "he" ? "right" : "center",
                                            py: 1,
                                            direction: i18n.language === "he" ? "rtl" : "ltr"
                                        }}
                                    >
                                        {t("common.noColumnsFound")}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    ) : (
                        <CircularProgress size={16} />
                    )}
                </Box>
            </Popover>
        </>
    );
};

export default CustomColumnsButton;
