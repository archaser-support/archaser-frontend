"use client";

import { Box, Container, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

interface SettingsContentProps {
    children: React.ReactNode;
}

export default function SettingsContent({ children }: SettingsContentProps) {
    const { t } = useTranslation(["settings", "common"]);

    return (
        <Container maxWidth="xl">
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    {t("fields.title")}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {t("fields.description")}
                </Typography>
            </Box>
            {children}
        </Container>
    );
}
