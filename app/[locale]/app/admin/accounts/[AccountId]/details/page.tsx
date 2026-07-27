"use client";

import { Box, Typography, Container } from "@mui/material";
import { useParams } from "next/navigation";
import React from "react";

import AccountDetails from "./AccountDetails";

const AccountDetailsPage: React.FC = () => {
    const params = useParams();

    if (!params || !params.AccountId) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Account ID Not Found
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        No account ID was provided.
                    </Typography>
                </Box>
            </Container>
        );
    }

    const accountIdParam = params.AccountId as string;

    // Handle "new" case for creating a new account
    if (accountIdParam === "new") {
        return <AccountDetails accountId="new" />;
    }

    const accountId = parseInt(accountIdParam, 10);

    if (isNaN(accountId)) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Invalid Account ID
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        The provided account ID is not valid.
                    </Typography>
                </Box>
            </Container>
        );
    }

    return <AccountDetails accountId={accountId} />;
};

export default AccountDetailsPage;
