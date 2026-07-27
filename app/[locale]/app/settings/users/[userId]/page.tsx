"use client";

import { Box, Typography, Container } from "@mui/material";
import { useParams } from "next/navigation";
import React from "react";

import UserDetails from "./UserDetails";

const UserDetailsPage: React.FC = () => {
    const params = useParams();

    if (!params || !params.userId) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        User ID Not Found
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        No user ID was provided.
                    </Typography>
                </Box>
            </Container>
        );
    }

    const userId = params.userId as string;

    if (userId === "new") {
        return <UserDetails userId="new" />;
    }

    // Don't parse UUID as integer - pass it as string
    return <UserDetails userId={userId} />;
};

export default UserDetailsPage;
