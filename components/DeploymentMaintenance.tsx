"use client";

import { Box, Typography } from "@mui/material";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import AppSpinner from "@/shared/layout-components/spinner/AppSpinner";
import {
    markApiAvailable,
    noteConfirmedOutage,
    probeApiHealth,
    subscribeApiAvailability,
} from "@/utils/apiAvailability";

const RECHECK_MS = 5000;
const PROACTIVE_POLL_MS = 5000;

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
    const [down, setDown] = useState(false);
    const preview = useSyncExternalStore(
        subscribeNoop,
        isPreviewMaintenance,
        () => false
    );

    useEffect(() => {
        const unsubscribe = subscribeApiAvailability(setDown);

        if (preview) {
            return unsubscribe;
        }

        const check = async () => {
            const probe = await probeApiHealth();
            if (probe === "down") {
                noteConfirmedOutage();
            } else if (probe === "up") {
                // Always clear the consecutive-failure streak; reload only if
                // the overlay was already up for a sustained outage.
                markApiAvailable();
            }
        };

        void check();
        const pollId = window.setInterval(() => {
            void check();
        }, PROACTIVE_POLL_MS);

        return () => {
            unsubscribe();
            window.clearInterval(pollId);
        };
    }, [preview]);

    useEffect(() => {
        if (!down || preview) {
            return;
        }
        let cancelled = false;
        const recheck = async () => {
            const probe = await probeApiHealth();
            if (!cancelled && probe === "up") {
                markApiAvailable();
            }
        };
        // Run immediately — do not wait for the first interval tick.
        void recheck();
        const id = window.setInterval(() => {
            void recheck();
        }, RECHECK_MS);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, [down, preview]);

    if (!down && !preview) {
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
