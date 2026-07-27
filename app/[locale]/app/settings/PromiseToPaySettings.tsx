"use client";

import { Box } from "@mui/material";
import { useSession } from "next-auth/react";
import React from "react";
import { useTranslation } from "react-i18next";

import PromiseToPayTemplateList from "./PromiseToPayTemplateList";

export default function PromiseToPaySettings() {
    const { t } = useTranslation(["settings", "common"]);
    const { data: session } = useSession();
    const accountId = session?.user?.account_id || 0;

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <PromiseToPayTemplateList accountId={accountId} />
        </Box>
    );
}
