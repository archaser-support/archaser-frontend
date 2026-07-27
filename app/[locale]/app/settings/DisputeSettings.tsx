"use client";

import { Box } from "@mui/material";
import { useSession } from "next-auth/react";
import React from "react";

import { DisputeReasonsList } from "./DisputeReasonsList";

export default function DisputeSettings() {
    const { data: session } = useSession();
    const accountId = session?.user?.account_id || 0;

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <DisputeReasonsList accountId={accountId} />
        </Box>
    );
}
