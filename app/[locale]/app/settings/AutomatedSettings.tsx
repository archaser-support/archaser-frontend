"use client";

import { Box } from "@mui/material";
import { useSession } from "next-auth/react";
import React from "react";
import { useTranslation } from "react-i18next";

import AutomatedTemplateList from "./AutomatedTemplateList";

export default function AutomatedSettings() {
    const { t } = useTranslation(["settings", "common"]);
    const { data: session } = useSession();
    const accountId = session?.user?.account_id || 0;

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <AutomatedTemplateList accountId={accountId} />
        </Box>
    );
}
