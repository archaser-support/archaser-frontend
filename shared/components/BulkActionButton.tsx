import { Tune } from "@mui/icons-material";
import { Badge, IconButton, Tooltip, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import { getEndlessScrollToolbarTooltipProps } from "@/shared/layout-components/grid/endlessScrollToolbarTooltip";

interface BulkActionButtonProps {
    /** Number of selected rows */
    selectedRowsCount: number;
    /** Handler for when the bulk action button is clicked - receives the mouse event for positioning */
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    /** Whether the button should be disabled */
    disabled?: boolean;
    /** Optional custom tooltip title */
    tooltipTitle?: string;
    /** Optional custom disabled tooltip title */
    disabledTooltipTitle?: string;
}

/**
 * Reusable bulk action button component for list pages
 * Displays a badge with the count of selected rows and a tune icon
 * Positioned to the left of the export button in the toolbar
 */
export const BulkActionButton: React.FC<BulkActionButtonProps> = ({
    selectedRowsCount,
    onClick,
    disabled = false,
    tooltipTitle,
    disabledTooltipTitle,
}) => {
    const { t, i18n } = useTranslation("common");
    const theme = useTheme();

    const defaultTooltipTitle =
        tooltipTitle ||
        t("actions.bulk_actions", { defaultValue: "Bulk Actions" });
    const defaultDisabledTooltipTitle =
        disabledTooltipTitle ||
        t("actions.select_rows_for_bulk_actions", {
            defaultValue: "Select rows to enable bulk actions",
        });

    const isDisabled = disabled || selectedRowsCount === 0;
    const tooltipText = isDisabled
        ? defaultDisabledTooltipTitle
        : defaultTooltipTitle;

    return (
        <Tooltip
            title={tooltipText}
            {...getEndlessScrollToolbarTooltipProps(i18n.language === "he")}
        >
            <span>
                <Badge
                    badgeContent={selectedRowsCount > 0 ? selectedRowsCount : 0}
                    color="primary"
                    sx={{
                        mr: i18n.language === "he" ? 0 : theme.spacing(1),
                        ml: i18n.language === "he" ? theme.spacing(1) : 0,
                        "& .MuiBadge-badge": {
                            display: selectedRowsCount > 0 ? "flex" : "none",
                        },
                    }}
                >
                    <IconButton
                        color="primary"
                        size="small"
                        onClick={onClick}
                        disabled={isDisabled}
                        className="toolbar-button"
                    >
                        <Tune />
                    </IconButton>
                </Badge>
            </span>
        </Tooltip>
    );
};

export default BulkActionButton;
