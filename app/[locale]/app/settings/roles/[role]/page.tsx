"use client";

import { Box, Typography, Container } from "@mui/material";
import { useParams, useSearchParams } from "next/navigation";
import React from "react";

import RolePermissions from "./RolePermissions";

const RolePermissionsPage: React.FC = () => {
    const params = useParams();
    const searchParams = useSearchParams();

    if (!params || !params.role) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Role Not Found
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        No role was provided.
                    </Typography>
                </Box>
            </Container>
        );
    }

    const role = params.role as string;
    const accountId = searchParams?.get("accountId")
        ? parseInt(searchParams.get("accountId") as string, 10)
        : undefined;

    return <RolePermissions role={role} accountId={accountId} />;
};

export default RolePermissionsPage;

