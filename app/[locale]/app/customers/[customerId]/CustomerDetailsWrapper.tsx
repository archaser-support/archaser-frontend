"use client";

import { Box } from "@mui/material";
import dynamic from "next/dynamic";
import { Suspense } from "react";

import AppSpinner from "@/shared/layout-components/spinner/AppSpinner";

const CustomerDetailsLoading = () => (
    <Box
        sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 400,
            width: "100%",
        }}
    >
        <AppSpinner />
    </Box>
);

// Dynamically import the component with no SSR
const CustomerDetailsCombined = dynamic(() => import("./CustomerDetailsCombined"), {
    ssr: false,
    loading: () => <CustomerDetailsLoading />,
});

interface CustomerDetailsWrapperProps {
    customerId: string;
}

export default function CustomerDetailsWrapper({
    customerId,
}: CustomerDetailsWrapperProps) {
    return (
        <div style={{ width: "100%", height: "100%", margin: 0, padding: 0 }}>
            <Suspense fallback={<CustomerDetailsLoading />}>
                <CustomerDetailsCombined customerId={customerId} />
            </Suspense>
        </div>
    );
}
