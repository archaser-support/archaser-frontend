"use client";

import { Box, CircularProgress } from "@mui/material";
import dynamic from "next/dynamic";
import { Suspense } from "react";

// Dynamically import the component with no SSR
const CustomerDetailsCombined = dynamic(() => import("./CustomerDetailsCombined"), {
    ssr: false,
    loading: () => (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                p: 3,
            }}
        >
            <CircularProgress color="primary" size={40} />
        </Box>
    ),
});

interface CustomerDetailsWrapperProps {
    customerId: string;
}

export default function CustomerDetailsWrapper({
    customerId,
}: CustomerDetailsWrapperProps) {
    return (
        <div style={{ width: "100%", height: "100%", margin: 0, padding: 0 }}>
            <Suspense
                fallback={
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            p: 3,
                        }}
                    >
                        <CircularProgress color="primary" size={40} />
                    </Box>
                }
            >
                <CustomerDetailsCombined customerId={customerId} />
            </Suspense>
        </div>
    );
}
