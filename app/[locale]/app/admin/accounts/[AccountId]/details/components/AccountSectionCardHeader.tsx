"use client";

import { Box, Typography } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import React from "react";

import {
    accountCardHeaderSx,
    accountCardTitleSx,
    accountSectionIconSx,
} from "../accountCardStyles";

interface AccountSectionCardHeaderProps {
    icon: SvgIconComponent;
    title: string;
}

export default function AccountSectionCardHeader({
    icon: Icon,
    title,
}: AccountSectionCardHeaderProps) {
    return (
        <Box sx={accountCardHeaderSx}>
            <Icon sx={accountSectionIconSx} />
            <Typography variant="subtitle1" sx={accountCardTitleSx}>
                {title}
            </Typography>
        </Box>
    );
}
