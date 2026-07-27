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

import AppUrls from "@/utils/appUrls";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";

import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";
import {
    formatAmountWithoutSymbol,
    formatCurrencyWithRTLSupport,
} from "@/utils/stringFormatters";

// Helper function to get currency code (use code instead of symbol)
const getCurrencySymbol = (currencyCode: string): string => {
    return currencyCode;
};

interface MaturityRow {
    id: number;
    invoices: number;
    accounts: number;
    amount: number;
    daysRange: string;
    amountPercentage: string;
}

interface ReceivablesMaturityScheduleProps {
    data?: MaturityRow[];
    currency?: string;
}

const ReceivablesMaturitySchedule = ({
    data = [],
    currency = "USD",
}: ReceivablesMaturityScheduleProps) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const businessUnitId = useDashboardBusinessUnitId();
    const currencySymbol = getCurrencySymbol(currency);

    // Helper function to translate day ranges
    const translateDaysRange = (daysRange: string): string => {
        // Convert format from "0-7 days" to "0_7" for translation keys
        const normalizedRange = daysRange
            .replace(/\s+days?/g, "") // Remove "days" or "day"
            .replace(/-/g, "_") // Replace hyphens with underscores
            .replace(/\+/g, "_2000"); // Replace "+" with "_2000" for "365+"

        return t(`values.aging_ranges_${normalizedRange}`, {
            ns: "dashboard",
            defaultValue: daysRange,
        });
    };

    // Default maturity periods for due payments
    const defaultMaturityData: MaturityRow[] = [
        {
            id: 1,
            invoices: 0,
            accounts: 0,
            amount: 0,
            daysRange: "0-7 days",
            amountPercentage: "0.00%",
        },
        {
            id: 2,
            invoices: 0,
            accounts: 0,
            amount: 0,
            daysRange: "8-30 days",
            amountPercentage: "0.00%",
        },
        {
            id: 3,
            invoices: 0,
            accounts: 0,
            amount: 0,
            daysRange: "31-60 days",
            amountPercentage: "0.00%",
        },
        {
            id: 4,
            invoices: 0,
            accounts: 0,
            amount: 0,
            daysRange: "61-90 days",
            amountPercentage: "0.00%",
        },
        {
            id: 5,
            invoices: 0,
            accounts: 0,
            amount: 0,
            daysRange: "91-180 days",
            amountPercentage: "0.00%",
        },
        {
            id: 6,
            invoices: 0,
            accounts: 0,
            amount: 0,
            daysRange: "181-365 days",
            amountPercentage: "0.00%",
        },
        {
            id: 7,
            invoices: 0,
            accounts: 0,
            amount: 0,
            daysRange: "365 days+",
            amountPercentage: "0.00%",
        },
    ];

    const maturityData = data.length > 0 ? data : defaultMaturityData;

    const handleChartClick = (daysRange?: string) => {
        const searchParams = appendDashboardBusinessUnitId(
            new URLSearchParams({
                type: "receivables-maturity-schedule",
                period: new Date().toISOString().slice(0, 7),
                ...(daysRange && { daysRange }),
            }),
            businessUnitId
        );
        router.push(
            `${AppUrls.DASHBOARD}/chart-details?${searchParams.toString()}`
        );
    };

    // Get color based on maturity range using chart palette
    const getMaturityColor = (daysRange: string | undefined): string => {
        // Handle undefined or null values
        if (!daysRange) {
            return "#9E9E9E"; // Grey - Default fallback
        }

        if (daysRange.includes("0-7") || daysRange.includes("0_7")) {
            return alpha(theme.palette.chartPalette.main, 0.15);
        } else if (daysRange.includes("8-30") || daysRange.includes("8_30")) {
            return alpha(theme.palette.chartPalette.main, 0.3);
        } else if (daysRange.includes("31-60") || daysRange.includes("31_60")) {
            return alpha(theme.palette.chartPalette.main, 0.45);
        } else if (daysRange.includes("61-90") || daysRange.includes("61_90")) {
            return alpha(theme.palette.chartPalette.main, 0.6);
        } else if (
            daysRange.includes("91-180") ||
            daysRange.includes("91_180")
        ) {
            return theme.palette.chartPalette.light;
        } else if (
            daysRange.includes("181-365") ||
            daysRange.includes("181_365")
        ) {
            return theme.palette.chartPalette.main;
        } else if (daysRange.includes("365") || daysRange.includes("365+")) {
            return theme.palette.chartPalette.dark;
        } else {
            return "#9E9E9E"; // Grey - Default fallback
        }
    };

    return (
        <FinancialDashboardChartCard
            icon={<ScheduleIcon />}
            iconAccent="receivables"
            title={t("fields.stats_receivables_maturity_schedule")}
            subtitle={t("fields.stats_maturity_schedule_description")}
            minHeight={400}
        >
            <Box sx={{ pt: 0.5, flex: 1, overflow: "hidden" }}>
                    {maturityData && maturityData.length > 0 ? (
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
                                    {maturityData.map((row, idx) => (
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
                                                {Math.round(row.accounts ?? 0)}
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
                                                            getMaturityColor(
                                                                row.daysRange
                                                            ),
                                                        boxShadow:
                                                            `0 2px 4px ${alpha(theme.palette.chartPalette.main, 0.2)}`,
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
                                                            boxShadow:
                                                                `0 4px 8px ${alpha(theme.palette.chartPalette.main, 0.3)}`,
                                                        },
                                                    }}
                                                >
                                                    {translateDaysRange(
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
                                    "messages.charts_receivables_maturity_schedule_no_data",
                                    {
                                        ns: "dashboard",
                                        defaultValue:
                                            "No maturity schedule data available",
                                    }
                                )}
                            </Typography>
                        </Box>
                    )}
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default ReceivablesMaturitySchedule;
