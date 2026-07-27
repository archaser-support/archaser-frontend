"use client";

import { Box, Alert, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import Seo from "@/shared/layout-components/seo/seo";
import { fetchDisputeStats } from "@/shared/services/disputeService";
import { clearDisputeNotifications } from "@/shared/services/notificationService";

import DisputeList from "./DisputeList";

export default function Page() {
    const { t } = useTranslation(["disputes", "common"]);

    // Clear dispute notifications when the page loads
    useEffect(() => {
        clearDisputeNotifications();
    }, []);

    const { data, isLoading, error } = useQuery({
        queryKey: ["disputeStats", {}],
        queryFn: fetchDisputeStats,
        refetchOnWindowFocus: false,
    });

    // Memoize loading spinner
    const loadingComponent = useMemo(
        () => (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: { xs: "300px", sm: "400px" },
                }}
            >
                <CircularProgress />
            </Box>
        ),
        []
    );

    // Memoize error message
    const errorComponent = useMemo(
        () =>
            error instanceof Error ? (
                <Box sx={{ p: { xs: 2, sm: 4 } }}>
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {t("fields.error_loading")}: {error.message}
                    </Alert>
                </Box>
            ) : null,
        [error, t]
    );

    if (isLoading) {
        return loadingComponent;
    }

    if (error) {
        return errorComponent;
    }

    return (
        <>
            <Seo title={t("sections.title")} />
            <InternalPageWrapper>
                <DisputeList />
            </InternalPageWrapper>
        </>
    );
}
