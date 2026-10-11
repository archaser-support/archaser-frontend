"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

import PageLoader from "@/shared/layout-components/spinner/PageLoader";

// Dynamically import the component with no SSR
const CustomerDetailsCombined = dynamic(() => import("./CustomerDetailsCombined"), {
    ssr: false,
    loading: () => <PageLoader />,
});

interface CustomerDetailsWrapperProps {
    customerId: string;
}

export default function CustomerDetailsWrapper({
    customerId,
}: CustomerDetailsWrapperProps) {
    return (
        <div style={{ width: "100%", height: "100%", margin: 0, padding: 0 }}>
            <Suspense fallback={<PageLoader />}>
                <CustomerDetailsCombined customerId={customerId} />
            </Suspense>
        </div>
    );
}
