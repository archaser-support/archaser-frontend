"use client";

import { Box } from "@mui/material";
import React from "react";

import { CreditInsuranceSettingsList } from "./CreditInsuranceSettingsList";

export function CreditInsuranceSettings({
    accountId,
    canEdit,
}: {
    accountId: number;
    canEdit: boolean;
}) {
    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
                <CreditInsuranceSettingsList
                    accountId={accountId}
                    canEdit={canEdit}
                />
            </Box>
        </Box>
    );
}
