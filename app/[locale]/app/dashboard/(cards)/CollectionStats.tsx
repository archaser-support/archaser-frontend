import {
    AutoAwesome as AutoAwesomeIcon,
    CheckCircle as CheckCircleIcon,
    Gavel as GavelIcon,
    Person as PersonIcon,
    Work as WorkIcon,
} from "@mui/icons-material";
import {
    Box,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { currencies } from "@/shared/data/common/currencies";
import { CollectionStat } from "@/types/Dashboard";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

// Helper function to get currency code (returns code instead of symbol)
const getCurrencySymbol = (currencyCode: string): string => {
    // Return the currency code directly (e.g., "ILS" instead of "₪")
    return currencyCode;
};

// Helper function to clean amount values by removing "Customers" text
const cleanAmountValue = (amount: string): string => {
    // Remove "Customers" text from the amount value
    return amount.replace(/customers\s*/gi, "").trim();
};

// Helper function to clean data values that might contain translation keys
const cleanDataValue = (value: string): string => {
    // If the value looks like a translation key, return "0"
    if (
        value.includes("dashboard.") ||
        value.includes("fields.") ||
        value.includes("actions.")
    ) {
        return "0";
    }
    // Remove "Customers" text from the value
    return value.replace(/customers\s*/gi, "").trim();
};

// Collection Phases Summary Card
type CollectionPhasesCardProps = {
    automatedStats: { customers: string; invoices: string; amount: string };
    agentStats: { customers: string; invoices: string; amount: string };
    currency: string;
};

const CollectionPhasesCard = ({
    automatedStats,
    agentStats,
    currency,
}: CollectionPhasesCardProps) => {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    return (
        <FinancialDashboardChartCard
            icon={<WorkIcon />}
            iconAccent="terms"
            title={t("fields.charts_collection_stats_title")}
        >
                <Box sx={{ flex: 1 }}>
                    {/* Automated Section */}
                    <Box sx={{ mb: 2 }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                mb: 1,
                                gap: 0.5,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <AutoAwesomeIcon
                                sx={{
                                    color: theme.palette.chartPalette.main,
                                    fontSize: "1rem",
                                }}
                            />
                            <Typography
                                variant={
                                    i18n.language === "he"
                                        ? "hebrewBodyText"
                                        : "body2"
                                }
                                sx={{
                                    fontWeight: 600,
                                    color: "#2F3B52",
                                    fontSize: "0.75rem",
                                    // Override theme for English only
                                    ...(i18n.language !== "he" && {
                                        textAlign: "left",
                                        direction: "ltr",
                                    }),
                                }}
                            >
                                {t("values.categories_automated", {
                                    ns: "dashboard",
                                })}
                            </Typography>
                        </Box>
                        <Stack spacing={0.5} sx={{ pl: 2 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t(
                                        "fields.charts_collection_stats_customers"
                                    )}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {automatedStats.customers}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t(
                                        "fields.charts_collection_stats_invoices"
                                    )}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {automatedStats.invoices}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t("fields.charts_collection_stats_amount")}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {formatCurrencyWithRTLSupport(
                                        parseFloat(
                                            cleanAmountValue(automatedStats.amount)
                                        ) || 0,
                                        currency,
                                        i18n.language,
                                        i18n.language
                                    )}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>

                    {/* Agent Section */}
                    <Box sx={{ mt: 1.5 }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                mb: 1,
                                gap: 0.5,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <PersonIcon
                                sx={{
                                    color: theme.palette.chartPalette.main,
                                    fontSize: "1rem",
                                }}
                            />
                            <Typography
                                variant={
                                    i18n.language === "he"
                                        ? "hebrewBodyText"
                                        : "body2"
                                }
                                sx={{
                                    fontWeight: 600,
                                    color: "#2F3B52",
                                    fontSize: "0.75rem",
                                    // Override theme for English only
                                    ...(i18n.language !== "he" && {
                                        textAlign: "left",
                                        direction: "ltr",
                                    }),
                                }}
                            >
                                {t("fields.charts_collection_stats_agent")}
                            </Typography>
                        </Box>
                        <Stack spacing={0.5} sx={{ pl: 2 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t(
                                        "fields.charts_collection_stats_customers"
                                    )}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {agentStats.customers}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t(
                                        "fields.charts_collection_stats_invoices"
                                    )}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {agentStats.invoices}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t("fields.charts_collection_stats_amount")}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {formatCurrencyWithRTLSupport(
                                        parseFloat(
                                            cleanAmountValue(agentStats.amount)
                                        ) || 0,
                                        currency,
                                        i18n.language,
                                        i18n.language
                                    )}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>
                </Box>
        </FinancialDashboardChartCard>
    );
};

// Dispute and Promise to Pay Summary Card
type DisputeAndPromiseCardProps = {
    disputeStats: { customers: string; invoices: string; amount: string };
    promiseStats: { customers: string; invoices: string; amount: string };
    currency: string;
};

const DisputeAndPromiseCard = ({
    disputeStats,
    promiseStats,
    currency,
}: DisputeAndPromiseCardProps) => {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    return (
        <FinancialDashboardChartCard
            icon={<GavelIcon />}
            iconAccent="atRisk"
            title={t("fields.stats_dispute_and_promise")}
        >
                <Box sx={{ flex: 1 }}>
                    {/* Dispute Section */}
                    <Box sx={{ mb: 2 }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                mb: 1,
                                gap: 0.5,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <GavelIcon
                                sx={{
                                    color: theme.palette.chartPalette.main,
                                    fontSize: "1rem",
                                }}
                            />
                            <Typography
                                variant={
                                    i18n.language === "he"
                                        ? "hebrewBodyText"
                                        : "body2"
                                }
                                sx={{
                                    fontWeight: 600,
                                    color: "#2F3B52",
                                    fontSize: "0.75rem",
                                    // Override theme for English only
                                    ...(i18n.language !== "he" && {
                                        textAlign: "left",
                                        direction: "ltr",
                                    }),
                                }}
                            >
                                {t("fields.charts_collection_stats_dispute")}
                            </Typography>
                        </Box>
                        <Stack spacing={0.5} sx={{ pl: 2 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t(
                                        "fields.charts_collection_stats_customers"
                                    )}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {disputeStats.customers}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t(
                                        "fields.charts_collection_stats_invoices"
                                    )}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {disputeStats.invoices}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t("fields.charts_collection_stats_amount")}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {formatCurrencyWithRTLSupport(
                                        parseFloat(
                                            cleanAmountValue(disputeStats.amount)
                                        ) || 0,
                                        currency,
                                        i18n.language,
                                        i18n.language
                                    )}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>

                    {/* Promise to Pay Section */}
                    <Box sx={{ mt: 1.5 }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                mb: 1,
                                gap: 0.5,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <CheckCircleIcon
                                sx={{
                                    color: theme.palette.chartPalette.light,
                                    fontSize: "1rem",
                                }}
                            />
                            <Typography
                                variant={
                                    i18n.language === "he"
                                        ? "hebrewBodyText"
                                        : "body2"
                                }
                                sx={{
                                    fontWeight: 600,
                                    color: "#2F3B52",
                                    fontSize: "0.75rem",
                                    // Override theme for English only
                                    ...(i18n.language !== "he" && {
                                        textAlign: "left",
                                        direction: "ltr",
                                    }),
                                }}
                            >
                                {t(
                                    "fields.charts_collection_stats_promise_to_pay"
                                )}
                            </Typography>
                        </Box>
                        <Stack spacing={0.5} sx={{ pl: 2 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t(
                                        "fields.charts_collection_stats_customers"
                                    )}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {promiseStats.customers}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t(
                                        "fields.charts_collection_stats_invoices"
                                    )}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {promiseStats.invoices}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#7C8DA1",
                                        fontSize: "0.625rem",
                                    }}
                                >
                                    {t("fields.charts_collection_stats_amount")}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#2F3B52",
                                        fontSize: "0.625rem",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {formatCurrencyWithRTLSupport(
                                        parseFloat(
                                            cleanAmountValue(promiseStats.amount)
                                        ) || 0,
                                        currency,
                                        i18n.language,
                                        i18n.language
                                    )}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>
                </Box>
        </FinancialDashboardChartCard>
    );
};

const CollectionStats = ({ stats }: { stats: Array<CollectionStat> }) => {
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    // Create default stats to ensure cards are always visible
    const createDefaultStats = (): Array<CollectionStat> => {
        return [
            {
                label: t("fields.charts_collection_stats_in_dispute", {
                    category: t("fields.charts_collection_stats_dispute"),
                }),
                value: [
                    {
                        label: t("fields.charts_collection_stats_customers"),
                        value: "0",
                    },
                    {
                        label: t("fields.charts_collection_stats_invoices"),
                        value: "0",
                    },
                    {
                        label: "USD",
                        value: "0",
                    },
                ],
            },
            {
                label: t("fields.charts_collection_stats_in_promise_to_pay", {
                    category: t(
                        "fields.charts_collection_stats_promise_to_pay"
                    ),
                }),
                value: [
                    {
                        label: t("fields.charts_collection_stats_customers"),
                        value: "0",
                    },
                    {
                        label: t("fields.charts_collection_stats_invoices"),
                        value: "0",
                    },
                    {
                        label: "USD",
                        value: "0",
                    },
                ],
            },
            {
                label: t("fields.stats_in_category_process", {
                    category: t("values.categories_automated", {
                        ns: "dashboard",
                    }),
                }),
                value: [
                    {
                        label: t("fields.charts_collection_stats_customers"),
                        value: "0",
                    },
                    {
                        label: t("fields.charts_collection_stats_invoices"),
                        value: "0",
                    },
                    {
                        label: "USD",
                        value: "0",
                    },
                ],
            },
            {
                label: t("fields.stats_in_category_process", {
                    category: t("fields.categories__agent"),
                }),
                value: [
                    {
                        label: t("fields.charts_collection_stats_customers"),
                        value: "0",
                    },
                    {
                        label: t("fields.charts_collection_stats_invoices"),
                        value: "0",
                    },
                    {
                        label: "USD",
                        value: "0",
                    },
                ],
            },
        ];
    };

    // Use provided stats if available, otherwise use default stats
    const finalStats = (() => {
        const defaultStats = createDefaultStats();

        if (!stats || stats.length === 0) {
            return defaultStats;
        }

        const mergedStats = [...stats];

        // Ensure all default categories are present
        defaultStats.forEach((defaultStat) => {
            const exists = mergedStats.some((stat) => {
                // Check for exact match or category match
                if (stat.label === defaultStat.label) return true;

                // Check for category matches
                const defaultLabel = defaultStat.label.toLowerCase();
                const statLabel = stat.label.toLowerCase();

                if (
                    defaultLabel.includes("automated") &&
                    statLabel.includes("automated")
                )
                    return true;
                if (
                    defaultLabel.includes("agent") &&
                    statLabel.includes("agent")
                )
                    return true;
                if (
                    defaultLabel.includes("dispute") &&
                    statLabel.includes("dispute")
                )
                    return true;
                if (
                    defaultLabel.includes("promise") &&
                    statLabel.includes("promise")
                )
                    return true;

                return false;
            });

            if (!exists) {
                mergedStats.push(defaultStat);
            }
        });

        return mergedStats;
    })();

    // Helper function to extract stats for a specific category
    const getStatsForCategory = (category: string) => {
        // Try to find by exact label match
        const stat = finalStats.find((s) => {
            const label = s.label.toLowerCase();

            // For dispute, look for "in dispute" or "dispute"
            if (category === "dispute") {
                return label.includes("dispute");
            }

            // For promise, look for "promise" or "p2pay"
            if (category === "promise") {
                return label.includes("promise") || label.includes("p2pay");
            }

            // For automated, look for "automated"
            if (category === "automated") {
                return label.includes("automated");
            }

            // For agent, look for "agent" but NOT "dispute" or "promise"
            // Must check for "agent" specifically, not just "collection" (which would match "collectionstats")
            if (category === "agent") {
                // First check if it's clearly NOT agent (dispute or promise)
                if (
                    label.includes("dispute") ||
                    label.includes("promise") ||
                    label.includes("automated")
                ) {
                    return false;
                }
                // Then check if it contains "agent"
                return label.includes("agent");
            }

            return false;
        });

        if (!stat || stat.value.length < 3) {
            return { customers: "0", invoices: "0", amount: "0" };
        }

        const computed = {
            customers: cleanDataValue(String(stat.value[0]?.value || "0")),
            invoices: cleanDataValue(String(stat.value[1]?.value || "0")),
            amount: cleanDataValue(String(stat.value[2]?.value || "0")),
        } as { customers: string; invoices: string; amount: string };

        return computed;
    };

    // Extract currency from the first stat that has a currency label
    const currency = (() => {
        // Create a set of valid currency codes for quick lookup
        const validCurrencyCodes = new Set(currencies.map((c) => c.code));

        for (const stat of finalStats) {
            for (const value of stat.value) {
                // Check if the label is a valid currency code
                if (value.label && validCurrencyCodes.has(value.label)) {
                    return value.label; // This is a valid currency code
                }
            }
        }
        return "USD"; // fallback
    })();

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(2, 1fr)",
                    lg: "repeat(2, 1fr)",
                    xl: "repeat(2, 1fr)",
                },
                gap: 1,
                width: "100%",
            }}
        >
            {/* Dispute and Promise to Pay - Merged */}
            <Box sx={{ height: "100%" }}>
                <DisputeAndPromiseCard
                    disputeStats={getStatsForCategory("dispute")}
                    promiseStats={getStatsForCategory("promise")}
                    currency={currency}
                />
            </Box>

            {/* Collection Phases - Merged Automated & Agent */}
            <Box sx={{ height: "100%" }}>
                <CollectionPhasesCard
                    automatedStats={getStatsForCategory("automated")}
                    agentStats={getStatsForCategory("agent")}
                    currency={currency}
                />
            </Box>
        </Box>
    );
};

export default CollectionStats;
