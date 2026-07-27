import { Schedule as ScheduleIcon } from "@mui/icons-material";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { AgingRangeRow } from "@/types/Dashboard";

import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";

import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";
import AppUrls from "@/utils/appUrls";
import {
    formatAmountWithoutSymbol,
    formatCurrencyWithRTLSupport,
} from "@/utils/stringFormatters";

type AgingOverduePortfolioProps = {
    rows: AgingRangeRow[];
    chartData?: AgingRangeRow[]; // Aging range data for the table
    currency: string;
};

// Helper function to get currency code (use code instead of symbol)
const getCurrencySymbol = (currencyCode: string): string => {
    return currencyCode;
};

const AgingOverduePortfolio = ({
    rows,
    chartData,
    currency,
}: AgingOverduePortfolioProps) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const currencySymbol = getCurrencySymbol(currency);
    const businessUnitId = useDashboardBusinessUnitId();

    const handleChartClick = (daysRange?: string) => {
        // Navigate to dashboard with tab parameter first
        router.push(`/${locale}${AppUrls.DASHBOARD}?tab=overdue`);

        // Then navigate to chart details after a short delay
        setTimeout(() => {
            const searchParams = appendDashboardBusinessUnitId(
                new URLSearchParams({
                    type: "aging-portfolio",
                    period: new Date().toISOString().slice(0, 7),
                    ...(daysRange && { daysRange }),
                }),
                businessUnitId
            );
            router.push(
                `/${locale}${AppUrls.DASHBOARD}/chart-details?${searchParams.toString()}`
            );
        }, 0);
    };

    // Use chartData for the aging portfolio table, fallback to rows if chartData is not available
    const displayRows = chartData && chartData.length > 0 ? chartData : rows;

    // Get color based on aging range using chart palette
    const getAgingColor = (daysRange: string | undefined): string => {
        // Handle undefined or null values
        if (!daysRange) {
            return "#9E9E9E"; // Grey - Default fallback
        }

        // Handle different possible formats
        let key = daysRange;

        // If it's a translation key, extract the actual key
        if (
            daysRange.includes("fields.aging_ranges_") ||
            daysRange.includes("values.aging_ranges_")
        ) {
            const keyMatch = daysRange.match(/\.([^.]+)$/);
            key = keyMatch ? keyMatch[1] : daysRange;
        }
        // If it's a translation key with agingRange, extract the key
        else if (daysRange.includes("agingRange.")) {
            const keyMatch = daysRange.match(/\.([^.]+)$/);
            key = keyMatch ? keyMatch[1] : daysRange;
        }

        if (key.includes("0_7") || key.includes("0-7")) {
            return alpha(theme.palette.chartPalette.main, 0.15);
        } else if (key.includes("8_30") || key.includes("8-30")) {
            return alpha(theme.palette.chartPalette.main, 0.3);
        } else if (key.includes("31_60") || key.includes("31-60")) {
            return alpha(theme.palette.chartPalette.main, 0.45);
        } else if (key.includes("61_90") || key.includes("61-90")) {
            return alpha(theme.palette.chartPalette.main, 0.6);
        } else if (key.includes("91_180") || key.includes("91-180")) {
            return theme.palette.chartPalette.light;
        } else if (key.includes("181_365") || key.includes("181-365")) {
            return theme.palette.chartPalette.main;
        } else if (key.includes("365") || key.includes("365+")) {
            return theme.palette.chartPalette.dark;
        } else {
            return "#9E9E9E"; // Grey - Default fallback
        }
    };

    // Helper function to get translated aging range text
    const getTranslatedAgingRange = (daysRange: string | undefined): string => {
        // Handle undefined or null values
        if (!daysRange) {
            return t("values.aging_ranges_unknown", {
                ns: "dashboard",
                defaultValue: "Unknown",
            });
        }

        // If it's already a translation key, use it directly
        if (
            daysRange.startsWith("fields.aging_ranges_") ||
            daysRange.startsWith("fields.aging_range_") ||
            daysRange.startsWith("values.aging_ranges_") ||
            daysRange.startsWith("values.aging_range_")
        ) {
            return t(daysRange, { ns: "dashboard" });
        }

        // If it's a key like "0_7", "8_30", etc., construct the translation key
        if (daysRange.includes("_") || daysRange.includes("-")) {
            return t(`values.aging_ranges_${daysRange}`, {
                ns: "dashboard",
            });
        }

        // Fallback to direct translation if the format is unexpected
        return t(daysRange);
    };

    return (
        <FinancialDashboardChartCard
            icon={<ScheduleIcon />}
            iconAccent="overdue"
            title={t("fields.stats_aging_overdue_portfolio")}
            subtitle={t("fields.charts_aging_overdue_portfolio_description")}
            minHeight={400}
        >
            <Box sx={{ pt: 0.5, flex: 1, overflow: "hidden" }}>
                    {displayRows && displayRows.length > 0 ? (
                        <TableContainer sx={{ height: "100%", border: "0px" }}>
                            <Table size="small" sx={{ height: "100%" }}>
                                <TableHead
                                    sx={{ textAlign: "center !important" }}
                                >
                                    <TableRow
                                        sx={{ backgroundColor: "transparent" }}
                                    >
                                        <TableCell
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: "0.5rem",
                                                textTransform: "uppercase",
                                                color: "#2F3B52 !important",
                                                py: 1,
                                                px: 1,
                                                backgroundColor:
                                                    "transparent !important",
                                                textAlign: "center !important",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {t(
                                                "fields.charts_aging_overdue_portfolio_invoices"
                                            )}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: "0.5rem",
                                                textTransform: "uppercase",
                                                color: "#2F3B52 !important",
                                                py: 1,
                                                px: 1,
                                                backgroundColor:
                                                    "transparent !important",
                                                textAlign: "center !important",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {t(
                                                "fields.charts_aging_overdue_portfolio_customers"
                                            )}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: "0.5rem",
                                                textTransform: "uppercase",
                                                color: "#2F3B52 !important",
                                                py: 1,
                                                px: 1,
                                                backgroundColor:
                                                    "transparent !important",
                                                textAlign: "center !important",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {t(
                                                "fields.charts_aging_overdue_portfolio_amount"
                                            )}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: "0.5rem",
                                                textTransform: "uppercase",
                                                color: "#2F3B52 !important",
                                                py: 1,
                                                px: 1,
                                                backgroundColor:
                                                    "transparent !important",
                                                textAlign: "center !important",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {t(
                                                "fields.charts_aging_overdue_portfolio_days_range"
                                            )}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: "0.5rem",
                                                textTransform: "uppercase",
                                                color: "#2F3B52 !important",
                                                py: 1,
                                                px: 1,
                                                backgroundColor:
                                                    "transparent !important",
                                                textAlign: "center !important",
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            {t(
                                                "fields.charts_aging_overdue_portfolio_amount_percentage"
                                            )}
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {displayRows.map((row, idx) => (
                                        <TableRow
                                            key={idx}
                                            sx={{
                                                "&:hover": {
                                                    backgroundColor: "#F2F6FB",
                                                },
                                                transition: "all 0.2s ease",
                                            }}
                                        >
                                            <TableCell
                                                sx={{
                                                    fontWeight: 600,
                                                    color: "#2F3B52",
                                                    py: 0.75,
                                                    px: 1,
                                                    fontSize: "0.8rem",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                }}
                                            >
                                                {Math.round(row.invoices)}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    fontWeight: 600,
                                                    color: "#2F3B52",
                                                    py: 0.75,
                                                    px: 1,
                                                    fontSize: "0.8rem",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                }}
                                            >
                                                {Math.round(
                                                    row.customers ??
                                                    row.accounts ??
                                                    0
                                                )}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    fontWeight: 700,
                                                    color: "#2F3B52",
                                                    py: 0.75,
                                                    px: 1,
                                                    fontSize: "0.8rem",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {Number(row.amount) === 0
                                                    ? formatCurrencyWithRTLSupport(
                                                        0,
                                                        currency,
                                                        locale,
                                                        i18n.language
                                                    )
                                                    : formatCurrencyWithRTLSupport(
                                                        Number(row.amount),
                                                        currency,
                                                        locale,
                                                        i18n.language
                                                    )}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    py: 0.75,
                                                    px: 1,
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                }}
                                            >
                                                <Box
                                                    onClick={() =>
                                                        handleChartClick(
                                                            row.daysRange
                                                        )
                                                    }
                                                    sx={{
                                                        display: "inline-block",
                                                        px: 1.5,
                                                        py: 0.5,
                                                        borderRadius: "4px",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600,
                                                        color: "#FFFFFF",
                                                        backgroundColor:
                                                            getAgingColor(
                                                                row.daysRange
                                                            ),
                                                        boxShadow: `0 2px 4px ${alpha(theme.palette.chartPalette.main, 0.2)}`,
                                                        minWidth: "fit-content",
                                                        cursor: "pointer",
                                                        transition:
                                                            "all 0.2s ease",
                                                        textAlign:
                                                            i18n.language ===
                                                                "he"
                                                                ? "right !important"
                                                                : "left !important",
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl !important"
                                                                : "ltr !important",
                                                        "&:hover": {
                                                            transform:
                                                                "translateY(-1px)",
                                                            boxShadow: `0 4px 8px ${alpha(theme.palette.chartPalette.main, 0.3)}`,
                                                        },
                                                    }}
                                                >
                                                    {getTranslatedAgingRange(
                                                        row.daysRange
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    fontWeight: 600,
                                                    color: "#2F3B52",
                                                    py: 0.75,
                                                    px: 1,
                                                    fontSize: "0.8rem",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                }}
                                            >
                                                {row.amountPercentage}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                color: "#7C8DA1",
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ textAlign: "center" }}
                            >
                                {t(
                                    "messages.charts_aging_overdue_portfolio_no_overdue_invoices",
                                    {
                                        ns: "dashboard",
                                        defaultValue:
                                            "No overdue invoices data available",
                                    }
                                )}
                            </Typography>
                        </Box>
                    )}
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default AgingOverduePortfolio;
