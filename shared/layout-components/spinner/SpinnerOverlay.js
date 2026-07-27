"use client";
// components/SpinnerOverlay.js
import { CircularProgress, Box } from "@mui/material";
import React from "react";

import { useSpinner } from "./SpinnerProvider";

const SpinnerOverlay = () => {
    const { isVisible } = useSpinner();

    if (!isVisible) return null;

    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <CircularProgress 
                size={40}
                sx={{ color: "primary.main" }}
                role="status"
                aria-label="Loading"
            />
        </Box>
    );
};

export default SpinnerOverlay;
