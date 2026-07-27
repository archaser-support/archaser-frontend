import { Download, Print, DensitySmall, DensityMedium, DensityLarge } from "@mui/icons-material";
import { Button, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import {
    GridToolbarContainer,
    GridToolbarExport,
    GridToolbarDensitySelector,
    useGridApiContext,
} from "@mui/x-data-grid";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

import TableSearch from "../search/TableSearch";

import CustomColumnsButton from "./CustomColumnsButton";
import CustomFilterButton from "./CustomFilterButton";

interface CustomDataGridToolbarProps {
    customButtons?: React.ReactNode;
    variant?: "standalone" | "embedded";
    // Search props
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    searchDebounceMs?: number;
    searchDisabled?: boolean;
    searchDirection?: 'ltr' | 'rtl';
    onSearchFocus?: () => void;
    onSearchBlur?: () => void;
}

export const CustomDataGridToolbar = ({
    customButtons,
    variant = "standalone",
    searchValue,
    onSearchChange,
    searchPlaceholder,
    searchDebounceMs = 1000,
    searchDisabled = false,
    searchDirection = 'ltr',
    onSearchFocus,
    onSearchBlur,
}: CustomDataGridToolbarProps) => {
    const { t, i18n } = useTranslation(["common"]);
    const theme = useTheme();
    const apiRef = useGridApiContext();
    const [exportAnchorEl, setExportAnchorEl] = React.useState<null | HTMLElement>(null);
    const exportOpen = Boolean(exportAnchorEl);
    const [densityAnchorEl, setDensityAnchorEl] = React.useState<null | HTMLElement>(null);
    const densityOpen = Boolean(densityAnchorEl);



    const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
        setExportAnchorEl(event.currentTarget);
    };

    const handleExportClose = () => {
        setExportAnchorEl(null);
    };

    const handleDensityClick = (event: React.MouseEvent<HTMLElement>) => {
        setDensityAnchorEl(event.currentTarget);
    };

    const handleDensityClose = () => {
        setDensityAnchorEl(null);
    };

    const handleDensityChange = (density: 'compact' | 'standard' | 'comfortable') => {
        if (apiRef.current) {
            apiRef.current.setDensity(density);
        }
        setDensityAnchorEl(null);
    };

    const handleExportCSV = () => {
        if (apiRef.current) {
            apiRef.current.exportDataAsCsv();
        }
        handleExportClose();
    };

    const handleExportPrint = () => {
        if (apiRef.current) {
            apiRef.current.exportDataAsPrint();
        }
        handleExportClose();
    };

    return (
        <GridToolbarContainer
            sx={{
                padding: { xs: "0px 6px", sm: "1px 8px", md: "10px 12px" },
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: "4px",
                marginBottom: "2px",
                backgroundColor: theme.palette.action.hover,
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: { xs: "2px", sm: "4px", md: "6px" },
                alignItems: { xs: "stretch", sm: "center" },
                flexWrap: "wrap",
                minHeight: { xs: "24px", sm: "28px", md: "32px" },
                direction: i18n.language === "he" ? "rtl" : "ltr",
            }}
        >
            {/* Custom buttons section - left side */}
            {customButtons && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        order: { xs: 2, md: 1 },
                    }}
                >
                    {customButtons}
                </Box>
            )}

            {/* Standard toolbar components - right side */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.25,
                    order: { xs: 1, md: 2 },
                    marginLeft: { xs: 0, md: customButtons ? "auto" : 0 },
                    width: { xs: "100%", md: "auto" },
                    justifyContent: { xs: "center", md: "flex-end" },
                    flex: 1,

                    padding: {
                        xs: "1px 0px 2px 0px !important",
                        sm: "1px 0px 2px 0px !important",
                        md: "1px 0px 2px 0px !important",
                    },
                    margin: {
                        xs: "0px !important",
                        sm: "0px !important",
                        md: "0px !important",
                    },
                    "& .MuiDataGrid-toolbarContainer": {
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
                    "& .MuiDataGrid-toolbarContainer *": {
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
                    "& > *": {
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
                }}
            >
                {/* Custom TableSearch component */}
                {searchValue !== undefined && onSearchChange && (
                    <TableSearch
                        searchValue={searchValue}
                        onSearchChange={onSearchChange}
                        placeholder={searchPlaceholder}
                        debounceMs={searchDebounceMs}
                        disabled={searchDisabled}
                        direction={searchDirection}
                        fullWidth={false}
                        onFocus={onSearchFocus}
                        onBlur={onSearchBlur}
                    />
                )}
                <Box
                    sx={{
                        fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" },
                        minHeight: { xs: "20px", sm: "24px", md: "28px" },
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
                    }}
                >
                    <CustomFilterButton />
                </Box>
                <Box
                    sx={{
                        fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" },
                        minHeight: { xs: "20px", sm: "24px", md: "28px" },
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
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        "& .MuiButton-root": {
                            minHeight: { xs: "20px", sm: "24px", md: "28px" },
                            padding: {
                                xs: "0px 2px",
                                sm: "1px 4px",
                                md: "2px 6px",
                            },
                            fontSize: {
                                xs: "0.7rem",
                                sm: "0.75rem",
                                md: "0.8rem",
                            },
                            margin: {
                                xs: "0px !important",
                                sm: "0px !important",
                                md: "0px !important",
                            },
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiButton-startIcon": {
                                marginRight: i18n.language === "he" ? 0 : "8px",
                                marginLeft: i18n.language === "he" ? "8px" : 0,
                            },
                        },
                        // RTL support for menu items
                        "& .MuiMenuItem-root": {
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            display: "flex",
                            flexDirection: i18n.language === "he" ? "row-reverse" : "row",
                            alignItems: "center",
                            "& .MuiSvgIcon-root": {
                                order: i18n.language === "he" ? 2 : 1,
                                marginRight: i18n.language === "he" ? 0 : "8px",
                                marginLeft: i18n.language === "he" ? "8px" : 0,
                            },
                            "& span": {
                                order: i18n.language === "he" ? 1 : 2,
                                textAlign: i18n.language === "he" ? "right" : "left",
                            },
                        },
                    }}
                >
                    <Button
                        size="small"
                        onClick={handleExportClick}
                        startIcon={<Download fontSize="small" />}
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
                        {t("common.export")}
                    </Button>
                    <Menu
                        anchorEl={exportAnchorEl}
                        open={exportOpen}
                        onClose={handleExportClose}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: i18n.language === "he" ? 'left' : 'right',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: i18n.language === "he" ? 'left' : 'right',
                        }}
                        sx={{
                            '& .MuiMenu-paper': {
                                marginTop: '8px',
                                minWidth: 150,
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
                        <MenuItem
                            onClick={handleExportCSV}
                            sx={{
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                display: "flex",
                                flexDirection: i18n.language === "he" ? "row-reverse" : "row",
                                alignItems: "center",
                                "& .MuiListItemIcon-root": {
                                    order: i18n.language === "he" ? 2 : 1,
                                    marginRight: i18n.language === "he" ? 0 : "8px",
                                    marginLeft: i18n.language === "he" ? "8px" : 0,
                                    minWidth: "auto",
                                },
                                "& .MuiListItemText-root": {
                                    order: i18n.language === "he" ? 1 : 2,
                                    textAlign: i18n.language === "he" ? "right" : "left",
                                },
                            }}
                        >
                            <ListItemIcon>
                                <Download fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>{t("common.download_as_csv")}</ListItemText>
                        </MenuItem>
                        <MenuItem
                            onClick={handleExportPrint}
                            sx={{
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                display: "flex",
                                flexDirection: i18n.language === "he" ? "row-reverse" : "row",
                                alignItems: "center",
                                "& .MuiListItemIcon-root": {
                                    order: i18n.language === "he" ? 2 : 1,
                                    marginRight: i18n.language === "he" ? 0 : "8px",
                                    marginLeft: i18n.language === "he" ? "8px" : 0,
                                    minWidth: "auto",
                                },
                                "& .MuiListItemText-root": {
                                    order: i18n.language === "he" ? 1 : 2,
                                    textAlign: i18n.language === "he" ? "right" : "left",
                                },
                            }}
                        >
                            <ListItemIcon>
                                <Print fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>{t("common.print")}</ListItemText>
                        </MenuItem>
                    </Menu>
                </Box>
                <Box
                    sx={{
                        fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" },
                        minHeight: { xs: "20px", sm: "24px", md: "28px" },
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
                    }}
                >
                    <CustomColumnsButton />
                </Box>
                <Box
                    sx={{
                        fontSize: { xs: "0.7rem", sm: "0.75rem", md: "0.8rem" },
                        minHeight: { xs: "20px", sm: "24px", md: "28px" },
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
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        "& .MuiButton-root": {
                            minHeight: { xs: "20px", sm: "24px", md: "28px" },
                            padding: {
                                xs: "0px 2px",
                                sm: "1px 4px",
                                md: "2px 6px",
                            },
                            fontSize: {
                                xs: "0.7rem",
                                sm: "0.75rem",
                                md: "0.8rem",
                            },
                            margin: {
                                xs: "0px !important",
                                sm: "0px !important",
                                md: "0px !important",
                            },
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiButton-startIcon": {
                                marginRight: i18n.language === "he" ? 0 : "8px",
                                marginLeft: i18n.language === "he" ? "8px" : 0,
                            },
                        },
                        // RTL support for menu items
                        "& .MuiMenuItem-root": {
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            display: "flex",
                            flexDirection: i18n.language === "he" ? "row-reverse" : "row",
                            alignItems: "center",
                            textAlign: i18n.language === "he" ? "right" : "left",
                            "& .MuiListItemIcon-root": {
                                order: i18n.language === "he" ? 2 : 1,
                                marginRight: i18n.language === "he" ? 0 : "8px",
                                marginLeft: i18n.language === "he" ? "8px" : 0,
                                minWidth: "auto",
                            },
                            "& .MuiListItemText-root": {
                                order: i18n.language === "he" ? 1 : 2,
                                textAlign: i18n.language === "he" ? "right" : "left",
                            },
                            "& span": {
                                order: i18n.language === "he" ? 1 : 2,
                                textAlign: i18n.language === "he" ? "right" : "left",
                            },
                            "& .MuiSvgIcon-root": {
                                order: i18n.language === "he" ? 2 : 1,
                                marginRight: i18n.language === "he" ? 0 : "8px",
                                marginLeft: i18n.language === "he" ? "8px" : 0,
                            },
                        },
                    }}
                >
                    <Button
                        onClick={handleDensityClick}
                        sx={{
                            minHeight: { xs: "20px", sm: "24px", md: "28px" },
                            padding: {
                                xs: "0px 2px",
                                sm: "1px 4px",
                                md: "2px 6px",
                            },
                            fontSize: {
                                xs: "0.7rem",
                                sm: "0.75rem",
                                md: "0.8rem",
                            },
                            margin: {
                                xs: "0px !important",
                                sm: "0px !important",
                                md: "0px !important",
                            },
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            "& .MuiButton-startIcon": {
                                marginRight: i18n.language === "he" ? 0 : "8px",
                                marginLeft: i18n.language === "he" ? "8px" : 0,
                            },
                        }}
                    >
                        {t("common.density")}
                    </Button>
                    <Menu
                        anchorEl={densityAnchorEl}
                        open={densityOpen}
                        onClose={handleDensityClose}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: i18n.language === "he" ? 'left' : 'right',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: i18n.language === "he" ? 'left' : 'right',
                        }}
                        sx={{
                            '& .MuiPaper-root': {
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                textAlign: i18n.language === "he" ? "right" : "left",
                            },
                        }}
                    >
                        <MenuItem
                            onClick={() => handleDensityChange('compact')}
                            sx={{
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                display: "flex",
                                flexDirection: i18n.language === "he" ? "row-reverse" : "row",
                                alignItems: "center",
                                "& .MuiListItemIcon-root": {
                                    order: i18n.language === "he" ? 2 : 1,
                                    marginRight: i18n.language === "he" ? 0 : "8px",
                                    marginLeft: i18n.language === "he" ? "8px" : 0,
                                    minWidth: "auto",
                                },
                                "& .MuiListItemText-root": {
                                    order: i18n.language === "he" ? 1 : 2,
                                    textAlign: i18n.language === "he" ? "right" : "left",
                                },
                            }}
                        >
                            <ListItemIcon>
                                <DensitySmall fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>{t("common.compact")}</ListItemText>
                        </MenuItem>
                        <MenuItem
                            onClick={() => handleDensityChange('standard')}
                            sx={{
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                display: "flex",
                                flexDirection: i18n.language === "he" ? "row-reverse" : "row",
                                alignItems: "center",
                                "& .MuiListItemIcon-root": {
                                    order: i18n.language === "he" ? 2 : 1,
                                    marginRight: i18n.language === "he" ? 0 : "8px",
                                    marginLeft: i18n.language === "he" ? "8px" : 0,
                                    minWidth: "auto",
                                },
                                "& .MuiListItemText-root": {
                                    order: i18n.language === "he" ? 1 : 2,
                                    textAlign: i18n.language === "he" ? "right" : "left",
                                },
                            }}
                        >
                            <ListItemIcon>
                                <DensityMedium fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>{t("common.standard")}</ListItemText>
                        </MenuItem>
                        <MenuItem
                            onClick={() => handleDensityChange('comfortable')}
                            sx={{
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                display: "flex",
                                flexDirection: i18n.language === "he" ? "row-reverse" : "row",
                                alignItems: "center",
                                "& .MuiListItemIcon-root": {
                                    order: i18n.language === "he" ? 2 : 1,
                                    marginRight: i18n.language === "he" ? 0 : "8px",
                                    marginLeft: i18n.language === "he" ? "8px" : 0,
                                    minWidth: "auto",
                                },
                                "& .MuiListItemText-root": {
                                    order: i18n.language === "he" ? 1 : 2,
                                    textAlign: i18n.language === "he" ? "right" : "left",
                                },
                            }}
                        >
                            <ListItemIcon>
                                <DensityLarge fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>{t("common.comfortable")}</ListItemText>
                        </MenuItem>
                    </Menu>
                </Box>
            </Box>
        </GridToolbarContainer>
    );
};

export default CustomDataGridToolbar;
