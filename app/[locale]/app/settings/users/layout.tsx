"use client";

import { Box } from "@mui/material";
import React from "react";

interface UsersLayoutProps {
    children: React.ReactNode;
}

const UsersLayout: React.FC<UsersLayoutProps> = ({ children }) => {
    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
            {children}
        </Box>
    );
};

export default UsersLayout;
