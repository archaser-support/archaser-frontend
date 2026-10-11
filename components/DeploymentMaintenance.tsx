"use client";

import { Box, CircularProgress, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    markApiAvailable,
    probeApiHealth,
    subscribeApiAvailability,
} from "@/utils/apiAvailability";

const RECHECK_MS = 8000;

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

export default function DeploymentMaintenance() {
    const { t } = useTranslation("common");
    const [down, setDown] = useState(false);
    const [preview, setPreview] = useState(false);

    useEffect(() => {
        setPreview(isPreviewMaintenance());
        return subscribeApiAvailability(setDown);
    }, []);

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
                zIndex: (theme) => theme.zIndex.modal,
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
            <CircularProgress />
            <Typography variant="h5" component="h1">
                {t("messages.deployment_title")}
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: "32rem" }}>
                {t("messages.deployment_body")}
            </Typography>
        </Box>
    );
}
