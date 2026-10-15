"use client";

import { Box, Typography } from "@mui/material";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import AppSpinner from "@/shared/layout-components/spinner/AppSpinner";
import {
    isDeployStatusPollingEnabled,
    subscribeDeployStatus,
    syncDeployOverlayFromStatus,
} from "@/utils/deployStatus";

const POLL_MS = 5000;

function isPreviewMaintenance(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    return (
        new URLSearchParams(window.location.search).get(
            "previewMaintenance"
        ) === "1"
    );
}

const subscribeNoop = () => () => {};

export default function DeploymentMaintenance() {
    const { t } = useTranslation("common");
    const [deploying, setDeploying] = useState(false);
    const preview = useSyncExternalStore(
        subscribeNoop,
        isPreviewMaintenance,
        () => false
    );
    const pollingEnabled = useSyncExternalStore(
        subscribeNoop,
        isDeployStatusPollingEnabled,
        () => false
    );

    useEffect(() => {
        if (preview || !pollingEnabled) {
            return;
        }

        const unsubscribe = subscribeDeployStatus(setDeploying);

        void syncDeployOverlayFromStatus();
        const pollId = window.setInterval(() => {
            void syncDeployOverlayFromStatus();
        }, POLL_MS);

        return () => {
            unsubscribe();
            window.clearInterval(pollId);
        };
    }, [preview, pollingEnabled]);

    if (!deploying && !preview) {
        return null;
    }

    return (
        <Box
            role="status"
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: (theme) => theme.zIndex.modal + 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                px: 3,
                textAlign: "center",
                bgcolor: "background.default",
            }}
        >
            <AppSpinner />
            <Typography variant="h5" component="h1">
                {t("messages.deployment_title")}
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: "32rem" }}>
                {t("messages.deployment_body")}
            </Typography>
        </Box>
    );
}
