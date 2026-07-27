"use client";
import { Groups as GroupsIcon } from "@mui/icons-material";
import {
    Avatar,
    Box,
    Card,
    CardContent,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CreditDashboardTitleInfoIcon } from "@/app/[locale]/app/credit-dashboard/creditDashboardTitleTooltip";
import { OperationDashboardResponse } from "@/types/OperationDashboard";

interface AgentStatsTableProps {
    data: OperationDashboardResponse;
    currency: string;
}

const AgentStatsTable: React.FC<AgentStatsTableProps> = ({
    data,
    currency,
}) => {
    const { t, i18n } = useTranslation([
        "common",
        "activities",
        "disputes",
        "dashboard",
    ]);
    const theme = useTheme();
    const c = theme.creditDashboardChartCard;
    const isRtl = i18n.language === "he";

    const { agents } = data;

    const cardShellSx = {
        ...c.card(theme, { clickable: false, hoverable: true }),
    } as const;

    const cardContentSx = {
        ...c.cardContent(theme, { withChartBody: true }),
        pb: 1,
        direction: isRtl ? "rtl" : "ltr",
        display: "flex",
        flexDirection: "column",
    } as const;

    /** Clears the absolutely positioned card-icon (top 14px + 48px tall). */
    const headerAreaSx = {
        position: "relative" as const,
        minHeight: 62,
        mb: theme.spacing(1),
        flexShrink: 0,
    };

    const tableBodySx = {
        ...theme.metricStatCard.bodyColumn(theme, isRtl),
        flex: 1,
        minWidth: 0,
        minHeight: 0,
    };

    const cardTitle = (
        <>
            <Box
                className="card-icon"
                aria-hidden
                sx={c.headerIconLeading(theme, isRtl, "default")}
            >
                <GroupsIcon />
            </Box>
            <Box sx={c.headerColumn(theme, isRtl)}>
                <Typography
                    variant="body2"
                    component="span"
                    sx={{
                        ...c.headerTitle(theme, isRtl),
                        ml: 0,
                        mr: 0,
                        mb: theme.spacing(1),
                        display: "block",
                    }}
                >
                    {t("fields.agent_stats")}
                </Typography>
            </Box>
        </>
    );

    // Calculate min/max values for each column to determine highest/lowest
    const columnExtremes = useMemo(() => {
        if (agents.length === 0) {
            return {
                manualActivities: { min: 0, max: 0 },
                totalActivities: { min: 0, max: 0 },
                disputesCreated: { min: 0, max: 0 },
                disputesClosed: { min: 0, max: 0 },

                totalCalls: { min: 0, max: 0 },
                callSuccessRate: { min: 0, max: 0 },
                promisesToPay: { min: 0, max: 0 },
                activitiesPerDay: { min: 0, max: 0 },
            };
        }

        const values = {
            manualActivities: agents.map((a) => a.activities.manual),
            totalActivities: agents.map(
                (a) => a.activities.manual + a.activities.automated
            ),
            disputesCreated: agents.map((a) => a.disputes.created),
            disputesClosed: agents.map((a) => a.disputes.closed),

            totalCalls: agents.map((a) => a.calls.total),
            callSuccessRate: agents.map((a) =>
                a.calls.total > 0
                    ? (a.calls.successful / a.calls.total) * 100
                    : 0
            ),
            promisesToPay: agents.map((a) => a.promises.total),
            activitiesPerDay: agents.map(
                (a) => a.productivity.activitiesPerDay
            ),
        };

        return {
            manualActivities: {
                min: Math.min(...values.manualActivities),
                max: Math.max(...values.manualActivities),
            },
            totalActivities: {
                min: Math.min(...values.totalActivities),
                max: Math.max(...values.totalActivities),
            },
            disputesCreated: {
                min: Math.min(...values.disputesCreated),
                max: Math.max(...values.disputesCreated),
            },
            disputesClosed: {
                min: Math.min(...values.disputesClosed),
                max: Math.max(...values.disputesClosed),
            },

            totalCalls: {
                min: Math.min(...values.totalCalls),
                max: Math.max(...values.totalCalls),
            },
            callSuccessRate: {
                min: Math.min(...values.callSuccessRate),
                max: Math.max(...values.callSuccessRate),
            },
            promisesToPay: {
                min: Math.min(...values.promisesToPay),
                max: Math.max(...values.promisesToPay),
            },
            activitiesPerDay: {
                min: Math.min(...values.activitiesPerDay),
                max: Math.max(...values.activitiesPerDay),
            },
        };
    }, [agents]);

    if (agents.length === 0) {
        return (
            <Card sx={cardShellSx}>
                <CardContent sx={cardContentSx}>
                    <Box sx={headerAreaSx}>{cardTitle}</Box>
                    <Box sx={tableBodySx}>
                        <Typography
                            sx={{
                                textAlign: "center",
                                color: theme.palette.text.secondary,
                                py: 4,
                            }}
                        >
                            {t("fields.no_agents")}
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card sx={cardShellSx}>
            <CardContent sx={cardContentSx}>
                <Box sx={headerAreaSx}>{cardTitle}</Box>
                <Box sx={tableBodySx}>
                    <TableContainer
                        component={Paper}
                        sx={{ boxShadow: "none" }}
                    >
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t("fields.agent_name")}</TableCell>
                                <TableCell align="right">
                                    {t("fields.manual_activities", {
                                        ns: "activities",
                                    })}
                                </TableCell>
                                <TableCell align="right">
                                    {t("fields.total_activities", {
                                        ns: "activities",
                                    })}
                                </TableCell>
                                <TableCell align="right">
                                    {t("fields.disputes_created", {
                                        ns: "disputes",
                                    })}
                                </TableCell>
                                <TableCell align="right">
                                    {t("fields.disputes_closed", {
                                        ns: "disputes",
                                    })}
                                </TableCell>

                                <TableCell align="right">
                                    {t("fields.total_calls", {
                                        ns: "activities",
                                    })}
                                </TableCell>
                                <TableCell align="right">
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "flex-end",
                                            gap: 0.5,
                                        }}
                                    >
                                        {t("fields.call_success_rate", {
                                            ns: "activities",
                                        })}
                                        <CreditDashboardTitleInfoIcon
                                            isRtl={isRtl}
                                            title={t(
                                                "tooltips.call_success_rate_tooltip",
                                                {
                                                    ns: "activities",
                                                }
                                            )}
                                            ariaLabel={t(
                                                "credit_insurance_dashboard.chart_title_help_aria",
                                                { ns: "dashboard" }
                                            )}
                                        />
                                    </Box>
                                </TableCell>
                                <TableCell align="right">
                                    {t("fields.promises_to_pay", {
                                        ns: "dashboard",
                                    })}
                                </TableCell>
                                <TableCell align="right">
                                    {t("fields.activities_per_day", {
                                        ns: "activities",
                                    })}
                                </TableCell>
                            </TableRow >
                        </TableHead >
                        <TableBody>
                            {agents.map((agent) => {
                                const totalActivities =
                                    agent.activities.manual +
                                    agent.activities.automated;
                                const callSuccessRate =
                                    agent.calls.total > 0
                                        ? (agent.calls.successful /
                                            agent.calls.total) *
                                        100
                                        : 0;

                                // Helper function to get cell color based on value
                                const getCellColor = (
                                    value: number,
                                    extremes: { min: number; max: number }
                                ) => {
                                    if (extremes.min === extremes.max)
                                        return undefined; // All values are the same
                                    if (value === extremes.max) {
                                        return theme.palette.success.main;
                                    }
                                    if (value === extremes.min) {
                                        return theme.palette.error.main;
                                    }
                                    return undefined;
                                };

                                return (
                                    <TableRow key={agent.userId} hover>
                                        <TableCell>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                }}
                                            >
                                                <Avatar
                                                    src={
                                                        agent.image || undefined
                                                    }
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                    }}
                                                >
                                                    {agent.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </Avatar>
                                                <Typography variant="body2">
                                                    {agent.name}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                color: getCellColor(
                                                    agent.activities.manual,
                                                    columnExtremes.manualActivities
                                                ),
                                                fontWeight:
                                                    agent.activities.manual ===
                                                        columnExtremes
                                                            .manualActivities
                                                            .max ||
                                                        agent.activities.manual ===
                                                        columnExtremes
                                                            .manualActivities
                                                            .min
                                                        ? 600
                                                        : 400,
                                            }}
                                        >
                                            {agent.activities.manual.toLocaleString()}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                color: getCellColor(
                                                    totalActivities,
                                                    columnExtremes.totalActivities
                                                ),
                                                fontWeight:
                                                    totalActivities ===
                                                        columnExtremes
                                                            .totalActivities
                                                            .max ||
                                                        totalActivities ===
                                                        columnExtremes
                                                            .totalActivities.min
                                                        ? 600
                                                        : 400,
                                            }}
                                        >
                                            {totalActivities.toLocaleString()}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                color: getCellColor(
                                                    agent.disputes.created,
                                                    columnExtremes.disputesCreated
                                                ),
                                                fontWeight:
                                                    agent.disputes.created ===
                                                        columnExtremes
                                                            .disputesCreated
                                                            .max ||
                                                        agent.disputes.created ===
                                                        columnExtremes
                                                            .disputesCreated.min
                                                        ? 600
                                                        : 400,
                                            }}
                                        >
                                            {agent.disputes.created.toLocaleString()}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                color: getCellColor(
                                                    agent.disputes.closed,
                                                    columnExtremes.disputesClosed
                                                ),
                                                fontWeight:
                                                    agent.disputes.closed ===
                                                        columnExtremes
                                                            .disputesClosed
                                                            .max ||
                                                        agent.disputes.closed ===
                                                        columnExtremes
                                                            .disputesClosed.min
                                                        ? 600
                                                        : 400,
                                            }}
                                        >
                                            {agent.disputes.closed.toLocaleString()}
                                        </TableCell>

                                        <TableCell
                                            align="right"
                                            sx={{
                                                color: getCellColor(
                                                    agent.calls.total,
                                                    columnExtremes.totalCalls
                                                ),
                                                fontWeight:
                                                    agent.calls.total ===
                                                        columnExtremes
                                                            .totalCalls.max ||
                                                        agent.calls.total ===
                                                        columnExtremes
                                                            .totalCalls.min
                                                        ? 600
                                                        : 400,
                                            }}
                                        >
                                            {agent.calls.total.toLocaleString()}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                color: getCellColor(
                                                    callSuccessRate,
                                                    columnExtremes.callSuccessRate
                                                ),
                                                fontWeight:
                                                    callSuccessRate ===
                                                        columnExtremes
                                                            .callSuccessRate
                                                            .max ||
                                                        callSuccessRate ===
                                                        columnExtremes
                                                            .callSuccessRate.min
                                                        ? 600
                                                        : 400,
                                            }}
                                        >
                                            {callSuccessRate.toFixed(1)}%
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                color: getCellColor(
                                                    agent.promises.total,
                                                    columnExtremes.promisesToPay
                                                ),
                                                fontWeight:
                                                    agent.promises.total ===
                                                        columnExtremes
                                                            .promisesToPay
                                                            .max ||
                                                        agent.promises.total ===
                                                        columnExtremes
                                                            .promisesToPay.min
                                                        ? 600
                                                        : 400,
                                            }}
                                        >
                                            {agent.promises.total.toLocaleString()}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                color: getCellColor(
                                                    agent.productivity
                                                        .activitiesPerDay,
                                                    columnExtremes.activitiesPerDay
                                                ),
                                                fontWeight:
                                                    agent.productivity
                                                        .activitiesPerDay ===
                                                        columnExtremes
                                                            .activitiesPerDay
                                                            .max ||
                                                        agent.productivity
                                                            .activitiesPerDay ===
                                                        columnExtremes
                                                            .activitiesPerDay
                                                            .min
                                                        ? 600
                                                        : 400,
                                            }}
                                        >
                                            {agent.productivity.activitiesPerDay.toFixed(
                                                1
                                            )}
                                        </TableCell>
                                    </TableRow >
                                );
                            })}
                        </TableBody >
                    </Table>
                </TableContainer>
                </Box>
            </CardContent>
        </Card>
    );
};

export default AgentStatsTable;
