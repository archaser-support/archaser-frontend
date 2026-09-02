"use client";

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Card,
    CardContent,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    ExpandMore as ExpandMoreIcon,
    Sync as SyncIcon,
} from "@mui/icons-material";
import { memo } from "react";

import ConnectorSyncHistoryGrid from "@/shared/layout-components/import/ConnectorSyncHistoryGrid";
import type { SyncRunSummary } from "@/shared/services/billingConnectorService";
import { getBillingAccordionStyles } from "./billingAccordionStyles";
import {
    accountCardSx,
    accountCardTitleSx,
    accountSectionIconSx,
} from "../accountCardStyles";

export interface BillingSyncHistorySectionProps {
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    syncHistory: SyncRunSummary[];
    syncHistoryLoading: boolean;
    syncHistoryFetching: boolean;
}

const BillingSyncHistorySection = memo(function BillingSyncHistorySection({
    expanded,
    onExpandedChange,
    syncHistory,
    syncHistoryLoading,
    syncHistoryFetching,
}: BillingSyncHistorySectionProps) {
    const theme = useTheme();
    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
    const {
        accordionSx: billingAccordionSx,
        summarySx: billingAccordionSummarySx,
        detailsSx: billingAccordionDetailsSx,
        contentSx: billingAccordionContentSx,
    } = getBillingAccordionStyles(pillRadiusPx);

    return (
                        <Card elevation={0} sx={accountCardSx}>
                            <Accordion
                                disableGutters
                                elevation={0}
                                expanded={expanded}
                                onChange={(_, next) => onExpandedChange(next)}
                                sx={billingAccordionSx}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={billingAccordionSummarySx(expanded)}
                                >
                                    <SyncIcon sx={accountSectionIconSx} />
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography
                                            variant="subtitle1"
                                            sx={accountCardTitleSx}
                                        >
                                            Sync history
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.25 }}
                                        >
                                            {syncHistoryLoading &&
                                            syncHistory.length === 0
                                                ? "Loading recent runs…"
                                                : `${syncHistory.length} recent run${syncHistory.length === 1 ? "" : "s"}${
                                                      syncHistory[0]?.status
                                                          ? ` · latest ${syncHistory[0].status}`
                                                          : ""
                                                  }.`}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={billingAccordionDetailsSx}>
                                    <CardContent sx={billingAccordionContentSx}>
                                        <ConnectorSyncHistoryGrid
                                            runs={syncHistory}
                                            isLoading={
                                                syncHistoryLoading ||
                                                (syncHistoryFetching &&
                                                    syncHistory.length === 0)
                                            }
                                        />
                                    </CardContent>
                                </AccordionDetails>
                            </Accordion>
                        </Card>
    );
});

export default BillingSyncHistorySection;
